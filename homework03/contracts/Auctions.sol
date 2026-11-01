// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {ReentrancyGuardTransient}
    from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from
    "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";



contract Auctions is IERC721Receiver,Initializable, OwnableUpgradeable,UUPSUpgradeable,ReentrancyGuardTransient{
    using SafeERC20 for IERC20;
    mapping(uint256 => mapping(address => mapping(address => uint256))) public pendingReturns;
    uint256 public platformFee;         // 平台手续费率，以基点计，10000 表示 100%
    address public feeRecipient;        // 平台手续费接收地址


    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    mapping(address => bool) public supportedPaymentTokens;

    mapping(address => AggregatorV3Interface) usdFeeds;

    mapping(address => uint8) public tokenDecimals;


    function _setUsdFeed(
        address token,
        address feed,
        bool supported,
        uint8 tokenDecimals_
    ) internal {
        require(feed != address(0), "Invalid feed");
        require(feed.code.length > 0, "Feed is not a contract");

        if (token == address(0)) {
            require(tokenDecimals_ == 18, "ETH must use 18 decimals");
        } else {
            require(token.code.length > 0, "Token is not a contract");

            try IERC20Metadata(token).decimals() returns (uint8 actualDecimals) {
                require(actualDecimals == tokenDecimals_, "Decimals mismatch");
            } catch {
                revert("Token does not support decimals");
            }
        }

        try AggregatorV3Interface(feed).latestRoundData() returns (
            uint80 roundId,
            int256 price,
            uint256,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            require(roundId != 0 && answeredInRound >= roundId, "Invalid feed round");
            require(price > 0, "Invalid feed price");
            require(updatedAt > 0 && updatedAt <= block.timestamp, "Invalid update time");
        } catch {
            revert("Feed is not valid");
        }

        uint8 feedDecimals = AggregatorV3Interface(feed).decimals();
        require(feedDecimals <= 77, "Unsupported feed decimals");
        require(tokenDecimals_ <= 77, "Unsupported token decimals");

        usdFeeds[token] = AggregatorV3Interface(feed);
        supportedPaymentTokens[token] = supported;
        tokenDecimals[token] = tokenDecimals_;
    }

    function setUsdFeed(
        address token,
        address feed,
        uint8 tokenDecimals_
    ) external onlyOwner {
        _setUsdFeed(token, feed, true, tokenDecimals_);
    }

    event MaxPriceAgeUpdated(uint256 previousAge, uint256 newAge);

    function setMaxPriceAge(uint256 newMaxPriceAge) external onlyOwner {
        require(newMaxPriceAge > 0, "Max price age must be positive");
        emit MaxPriceAgeUpdated(maxPriceAge, newMaxPriceAge);
        maxPriceAge = newMaxPriceAge;
    }


    uint256 public maxPriceAge;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
        
    }

    function initialize(
        address initialOwner,
        uint256 platformFee1,
        address feeRecipient1,
        address ethUsdFeedAddress
    ) public initializer {
        __Ownable_init(initialOwner);

        require(platformFee1 <= 10000 && feeRecipient1 != address(0),"Wrong platformFee or feeRecipient");
        platformFee = platformFee1;
        feeRecipient = feeRecipient1;

        _setUsdFeed(address(0), ethUsdFeedAddress, true, 18);
        // 默认价格有效期；部署时应依据所用预言机的更新频率配置
        maxPriceAge = 1 days;
    }


    function getLatestUsdPrice(address token)
        public
        view
        returns (int256 price, uint8 feedDecimals, uint256 updatedAt)
    {
        uint80 roundId;
        uint80 answeredInRound;
        (
            roundId,
            price,
            ,
            updatedAt,
            answeredInRound
        ) = usdFeeds[token].latestRoundData();

        require(roundId != 0 && answeredInRound >= roundId, "Invalid price round");
        require(price > 0, "Invalid price");
        require(updatedAt > 0 && updatedAt <= block.timestamp, "Invalid timestamp");
        require(block.timestamp - updatedAt <= maxPriceAge, "Stale price");

        feedDecimals = usdFeeds[token].decimals();
        require(feedDecimals <= 77, "Unsupported feed decimals");
    }

    /// @dev 将代币数量换算为精度为 18 位的美元金额，并避免中间乘法溢出
    function _valueUsd18(
        uint256 amount,
        address token,
        int256 price,
        uint8 feedDecimals
    ) internal view returns (uint256) {
        uint256 priceUsd18;
        if (feedDecimals <= 18) {
            priceUsd18 = Math.mulDiv(
                uint256(price),
                10 ** uint256(18 - feedDecimals),
                1
            );
        } else {
            priceUsd18 = uint256(price) / (10 ** uint256(feedDecimals - 18));
        }
        return Math.mulDiv(amount, priceUsd18, 10 ** uint256(tokenDecimals[token]));
    }


    function _authorizeUpgrade(address)
        internal
        override
        onlyOwner
    {

    }

    struct Listing {
        address paymentToken;   // 支付代币地址；零地址表示 ETH
        address seller;         // 卖家地址
        address nftContract;    // NFT 合约地址
        uint256 tokenId;        // NFT 的 tokenId
        uint256 price;          // 以支付代币最小单位表示的价格
        bool active;            // 挂单是否有效
    }

    mapping(uint256 => Listing) public listings;  // 挂单 ID 到挂单信息的映射
    uint256 public listingCounter;                // 已分配的挂单 ID 数量

    // 拍卖状态及最高出价信息
    struct Auction {
        address paymentToken;     // 支付代币地址；零地址表示 ETH
        address seller;           // 卖家地址
        address nftContract;      // NFT 合约地址
        uint256 tokenId;          // NFT 的 tokenId
        uint256 startPriceUsd18;  // 以 18 位精度表示的美元起拍价
        uint256 highestBid;       // 当前最高出价的代币最小单位金额
        uint256 highestBidUsd18;  // 当前最高出价对应的 18 位精度美元金额
        address highestBidder;    // 当前最高出价者
        uint256 endTime;          // 拍卖结束时间戳
        bool active;              // 拍卖是否仍有效
    }

    // 拍卖创建事件
    event AuctionCreated(
        uint256 auctionCounter,
        address sender,
        address nftContract,
        uint256 tokenId,
        uint256 startPriceUsd18,
        uint256 endTime
    );
    
    // 出价事件
    event BidPlaced(
        uint256 auctionId, 
        address sender, 
        address paymentToken,
        uint256 value
    );

    // 拍卖结束事件
    event AuctionEnded(
        uint256 auctionId,
        address highestBidder,
        uint256 highestBid
    );

    // NFT 上架事件
    event NFTListed(
        uint256 indexed listingId,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 price
    );

    // NFT 下架事件
    event NFTDelisted(uint256 indexed listingId);

    // NFT 售出事件
    event NFTSold(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 price
    );

    mapping(uint256 => Auction) public auctions;
    uint256 auctionCounter;

    // 新增状态变量必须追加在末尾，以保持现有 UUPS 代理的存储布局
    mapping(address => mapping(address => uint256)) public pendingPayouts;

    event PayoutAccrued(address indexed account, address indexed paymentToken, uint256 amount);
    event PayoutWithdrawn(address indexed account, address indexed paymentToken, uint256 amount);

    // 创建 NFT 固定价格挂单，并将 NFT 托管到本合约
    function listNFT(
        address paymentToken,
        address nftContract,
        uint256 tokenId,
        uint256 price
    ) external returns (uint256) {
        require(price > 0, "Price must be greater than 0");
        require(
            paymentToken == address(0) || supportedPaymentTokens[paymentToken],
            "Unsupported payment token"
        );
        
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not the owner");
        require(
            nft.getApproved(tokenId) == address(this) ||
            nft.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved"
        );    
        
        listingCounter++;
        listings[listingCounter] = Listing({
            paymentToken: paymentToken,
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            active: true
        });

        IERC721(nftContract).safeTransferFrom(
            msg.sender,
            address(this),
            tokenId
        );  
        
        emit NFTListed(
            listingCounter,
            msg.sender,
            nftContract,
            tokenId,
            price
        );
        
        return listingCounter;
    }

    // 卖家撤销挂单并取回托管的 NFT
    function delistNFT(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        
        require(listing.active, "Listing not active");
        require(listing.seller == msg.sender, "Not the seller");
        
        listing.active = false;

        IERC721(listing.nftContract).safeTransferFrom(
            address(this),
            listing.seller,
            listing.tokenId
        );  
        
        emit NFTDelisted(listingId);
    }

    // 查询 NFT 的 ERC-2981 版税信息；无效实现按零版税处理
    function _getRoyaltyInfo(
        address nftContract,
        uint256 tokenId,
        uint256 salePrice
    ) internal view returns (address receiver, uint256 royaltyAmount) {
        // 无效的版税实现不得导致托管中的 NFT 永久无法转出
        try IERC165(nftContract).supportsInterface(type(IERC2981).interfaceId) returns (bool supported) {
            if (!supported) return (address(0), 0);
        } catch {
            return (address(0), 0);
        }

        try IERC2981(nftContract).royaltyInfo(tokenId, salePrice) returns (
            address royaltyReceiver,
            uint256 amount
        ) {
            if (royaltyReceiver == address(0) || amount > salePrice) {
                return (address(0), 0);
            }
            return (royaltyReceiver, amount);
        } catch {
            return (address(0), 0);
        }
    }


    // 创建拍卖并将 NFT 托管到本合约
    function createAuction(
        address paymentToken,
        address nftContract,
        uint256 tokenId,
        uint256 startPriceUsd18,
        uint256 durationMinutes
    ) external returns (uint256) {
        require(
            paymentToken == address(0) || supportedPaymentTokens[paymentToken],
            "Unsupported payment token"
        );
        require(startPriceUsd18 > 0, "Start price must be greater than 0");
        require(durationMinutes >= 1, "Duration must be at least 1 minute");
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not the owner");
        require(
            nft.getApproved(tokenId) == address(this) ||
            nft.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved"
        );
        auctionCounter++;
        auctions[auctionCounter] = Auction({
            paymentToken: paymentToken,
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            startPriceUsd18: startPriceUsd18,
            highestBid: 0,
            highestBidUsd18: 0,
            highestBidder: address(0),
            endTime: block.timestamp + (durationMinutes * 1 minutes),
            active: true
        });

        IERC721(nftContract).safeTransferFrom(msg.sender, address(this), tokenId);
        
        emit AuctionCreated(
            auctionCounter,
            msg.sender,
            nftContract,
            tokenId,
            startPriceUsd18,
            auctions[auctionCounter].endTime
        );
        
        return auctionCounter;
    }


    // 使用 ETH 出价；出价金额按 Chainlink 报价换算为美元后进行比较
    function placeBid(uint256 auctionId) external payable {
        Auction storage auction = auctions[auctionId];
        require(auction.active, "Auction not active");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(msg.sender != auction.seller, "Seller cannot bid");
        require(auction.paymentToken == address(0),"Not Eth"); 

        uint256 minBid;
        (int256 price, uint8 feedDecimals, ) = getLatestUsdPrice(auction.paymentToken);
        uint256 valueUsd18 = _valueUsd18(msg.value, auction.paymentToken, price, feedDecimals);

        if (auction.highestBid == 0) {
            minBid = auction.startPriceUsd18;
        } else {
            minBid = auction.highestBidUsd18 + (auction.highestBidUsd18 * 5 / 100); // 最低加价幅度为 5%
        }
        
        require(valueUsd18 >= minBid, "Bid too low");
        
        // 将上一位最高出价者的资金记入可提取退款
        if (auction.highestBidder != address(0)) {
            pendingReturns[auctionId][auction.highestBidder][auction.paymentToken] += auction.highestBid;
        }
        
        // 更新最高出价及其美元估值
        auction.highestBid = msg.value;
        auction.highestBidder = msg.sender;
        auction.highestBidUsd18 = valueUsd18;

        emit BidPlaced(auctionId, msg.sender, auction.paymentToken, msg.value);
    }

    // 使用 ERC-20 代币出价，并拒绝收取金额与请求金额不一致的代币
    function placeBidERC20(uint256 auctionId,uint256 amount) external payable  nonReentrant{
        Auction storage auction = auctions[auctionId];
        require(auction.active, "Auction not active");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(msg.sender != auction.seller, "Seller cannot bid");
        require(msg.value == 0,"No ETH"); 

    
        uint256 minBid;
        (int256 price, uint8 feedDecimals, ) = getLatestUsdPrice(auction.paymentToken);
        
        require(auction.paymentToken != address(0),"Not Erc20"); 
        uint256 valueUsd18 = _valueUsd18(amount, auction.paymentToken, price, feedDecimals);

        
        if (auction.highestBid == 0) {
            minBid = auction.startPriceUsd18;
        } else {
            minBid = auction.highestBidUsd18 + (auction.highestBidUsd18 * 5 / 100); // 最低加价幅度为 5%
        }
        
        require(valueUsd18 >= minBid, "Bid too low");

        uint256 balanceBefore = IERC20(auction.paymentToken).balanceOf(address(this));
        IERC20(auction.paymentToken).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(auction.paymentToken).balanceOf(address(this)) - balanceBefore;
        require(received == amount, "Unsupported fee-on-transfer token");
        
        // 将上一位最高出价者的资金记入可提取退款
        if (auction.highestBidder != address(0)) {
            pendingReturns[auctionId][auction.highestBidder][auction.paymentToken] += auction.highestBid;
        }
        
        // 更新最高出价及其美元估值
        auction.highestBid = amount;
        auction.highestBidder = msg.sender;
        auction.highestBidUsd18 = valueUsd18;
        
        emit BidPlaced(auctionId, msg.sender, auction.paymentToken, amount);
    }


    // 买家按固定价格购买 NFT，并将应付款项记入收款人的待领取余额
    function buyNFT(uint256 listingId) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");

        if(listing.paymentToken == address(0)){
            require(msg.value != 0,"Not ETH!");
            require(msg.value >= listing.price, "Insufficient payment");
        }else{
            require(msg.value == 0,"Not ERC20");
        }
        
        require(msg.sender != listing.seller, "Cannot buy your own NFT");
        
        listing.active = false;
        uint256 fee = (listing.price * platformFee) / 10000;
        uint256 sellerAmount = listing.price - fee;
        
        if(listing.paymentToken == address(0)){
            if (msg.value > listing.price) {
                _accruePayout(msg.sender, address(0), msg.value - listing.price);
            }
            _accruePayout(listing.seller, address(0), sellerAmount);
            _accruePayout(feeRecipient, address(0), fee);
        }else{
            uint256 balanceBefore = IERC20(listing.paymentToken).balanceOf(address(this));
            IERC20(listing.paymentToken).safeTransferFrom(
                msg.sender,
                address(this),
                listing.price
            );
            uint256 received = IERC20(listing.paymentToken).balanceOf(address(this)) - balanceBefore;
            require(received == listing.price, "Unsupported fee-on-transfer token");
            _accruePayout(listing.seller, listing.paymentToken, sellerAmount);
            _accruePayout(feeRecipient, listing.paymentToken, fee);
        }

        IERC721(listing.nftContract).safeTransferFrom(address(this), msg.sender, listing.tokenId);
            
        emit NFTSold(listingId, msg.sender, listing.seller, listing.price);
    }



    // 出价者提取先前被超出的出价
    function withdrawBid(uint256 auctionId,address paymentToken) external {
        uint256 amount = pendingReturns[auctionId][msg.sender][paymentToken];
        require(amount > 0, "No pending return");
        
        pendingReturns[auctionId][msg.sender][paymentToken] = 0;

        if (paymentToken == address(0)){
            (bool success, ) = msg.sender.call{value: amount}("");
            require(success, "Transfer failed");
        }else{
            IERC20(paymentToken).safeTransfer(
                msg.sender,
                amount
            );
        }
        
    }

    function withdrawPayout(address paymentToken) external nonReentrant {
        uint256 amount = pendingPayouts[msg.sender][paymentToken];
        require(amount > 0, "No pending payout");
        pendingPayouts[msg.sender][paymentToken] = 0;

        if (paymentToken == address(0)) {
            (bool success, ) = msg.sender.call{value: amount}("");
            require(success, "Payout transfer failed");
        } else {
            IERC20(paymentToken).safeTransfer(msg.sender, amount);
        }

        emit PayoutWithdrawn(msg.sender, paymentToken, amount);
    }

    function _accruePayout(address account, address paymentToken, uint256 amount) internal {
        if (amount == 0) return;
        pendingPayouts[account][paymentToken] += amount;
        emit PayoutAccrued(account, paymentToken, amount);
    }


    // 拍卖到期后结算最高出价，或在无人出价时结束拍卖
    function endAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        
        require(auction.active, "Auction not active");
        require(block.timestamp >= auction.endTime, "Auction not ended");
        
        auction.active = false;
        if(auction.highestBidder != address(0)){
            uint256 fee = (auction.highestBid * platformFee) / 10000;
            
            (address royaltyReceiver, uint256 royaltyAmount) = _getRoyaltyInfo(
                auction.nftContract,
                auction.tokenId,
                auction.highestBid
            );
            if (royaltyAmount > auction.highestBid - fee) {
                royaltyAmount = auction.highestBid - fee;
            }

            uint256 sellerAmount = auction.highestBid - fee - royaltyAmount;

            if (auction.paymentToken == address(0)) {            
                _accruePayout(royaltyReceiver, address(0), royaltyAmount);
                _accruePayout(auction.seller, address(0), sellerAmount);
                _accruePayout(feeRecipient, address(0), fee);
            } else {
                _accruePayout(royaltyReceiver, auction.paymentToken, royaltyAmount);
                _accruePayout(auction.seller, auction.paymentToken, sellerAmount);
                _accruePayout(feeRecipient, auction.paymentToken, fee);
            }

            // 将 NFT 转给最高出价者
            IERC721(auction.nftContract).safeTransferFrom(
                address(this),
                auction.highestBidder,
                auction.tokenId
            );

            emit AuctionEnded(
                auctionId,
                auction.highestBidder,
                auction.highestBid
            );

        } else {
            // 将 NFT 转给买家
            IERC721(auction.nftContract).safeTransferFrom(
                address(this),
                auction.seller,
                auction.tokenId
            );
            emit AuctionEnded(auctionId, address(0), 0);
        
        }
        
    }

}
