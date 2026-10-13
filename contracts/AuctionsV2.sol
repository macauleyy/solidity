// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {ReentrancyGuardTransient}
    from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from
    "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {AggregatorV3Interface}
    from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";



contract AuctionsV2 is Initializable, OwnableUpgradeable,UUPSUpgradeable,ReentrancyGuardTransient{
    mapping(uint256 => mapping(address => uint256)) public pendingReturns;
    uint256 public platformFee;
    address public feeRecipient;        // 手续费接收地址
    uint256 public value;

    IERC20 public paymentToken;

    AggregatorV3Interface public ethUsdFeed;
    uint256 public maxPriceAge;

    function initialize(
        address initialOwner,
        address feedAddress
    ) public initializer {
        __Ownable_init(initialOwner);

        require(feedAddress != address(0), "Invalid feed");
        ethUsdFeed = AggregatorV3Interface(feedAddress);

        // 示例值；应根据所用 Feed 的 heartbeat 设置
        maxPriceAge = 1 days;
    }

    function getLatestEthUsdPrice()
        external
        view
        returns (int256 price, uint8 feedDecimals, uint256 updatedAt)
    {
        (
            ,
            price,
            ,
            updatedAt,

        ) = ethUsdFeed.latestRoundData();

        require(price > 0, "Invalid price");
        require(updatedAt > 0 && updatedAt <= block.timestamp, "Invalid timestamp");
        require(block.timestamp - updatedAt <= maxPriceAge, "Stale price");

        feedDecimals = ethUsdFeed.decimals();
    }


    function _authorizeUpgrade(address)
        internal
        override
        onlyOwner
    {

    }

    struct Listing {
        address seller;        // 卖家地址
        address nftContract;   // NFT合约地址
        uint256 tokenId;       // Token ID
        uint256 price;         // 售价（wei）
        bool active;           // 是否激活
    }

    mapping(uint256 => Listing) public listings;  // 挂单映射
    uint256 public listingCounter;                // 挂单计数器

    // 拍卖结构体
    struct Auction {
        address paymentToken;     // address(0) 表示 ETH
        address seller;           // 卖家地址
        address nftContract;      // NFT合约地址
        uint256 tokenId;          // Token ID
        uint256 startPrice;       // 起拍价
        uint256 highestBid;       // 当前最高出价
        address highestBidder;    // 当前最高出价者
        uint256 endTime;          // 拍卖结束时间
        bool active;              // 是否激活
    }

    // 创建拍卖
    event AuctionCreated(
        uint256 auctionCounter,
        address sender,
        address nftContract,
        uint256 tokenId,
        uint256 startPrice,
        uint256 endTime
    );
    
    // 出价
    event BidPlaced(
        uint256 auctionId, 
        address sender, 
        uint256 value
    );

    // 拍卖结束
    event AuctionEnded(
        uint256 auctionId,
        address highestBidder,
        uint256 highestBid
    );

    // 上架
    event NFTListed(
        uint256 indexed listingId,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 price
    );

    // 下架
    event NFTDelisted(uint256 indexed listingId);

    mapping(uint256 => Auction) public auctions;
    uint256 auctionCounter;

     //  上架功能
    function listNFT(
        address nftContract,
        uint256 tokenId,
        uint256 price
    ) external returns (uint256) {
        require(price > 0, "Price must be greater than 0");
        
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not the owner");
        require(
            nft.getApproved(tokenId) == address(this) ||
            nft.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved"
        );
        
        listingCounter++;
        listings[listingCounter] = Listing({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            active: true
        });
        
        emit NFTListed(
            listingCounter,
            msg.sender,
            nftContract,
            tokenId,
            price
        );
        
        return listingCounter;
    }

    //  下架功能
    function delistNFT(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        
        require(listing.active, "Listing not active");
        require(listing.seller == msg.sender, "Not the seller");
        
        listing.active = false;
        
        emit NFTDelisted(listingId);
    }

    

    // 创建拍卖
    function createAuction(
        address nftContract,
        uint256 tokenId,
        uint256 startPriceUsd18,
        uint256 durationHours
    ) external returns (uint256) {
        require(startPrice > 0, "Start price must be greater than 0");
        require(durationHours >= 1, "Duration must be at least 1 hour");
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not the owner");
        require(
            nft.getApproved(tokenId) == address(this) ||
            nft.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved"
        );
        
        auctionCounter++;
        auctions[auctionCounter] = Auction({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            startPrice: startPriceUsd18,
            highestBid: 0,
            highestBidder: address(0),
            endTime: block.timestamp + (durationHours * 1 minutes),
            active: true
        });
        
        emit AuctionCreated(
            auctionCounter,
            msg.sender,
            nftContract,
            tokenId,
            startPrice,
            auctions[auctionCounter].endTime
        );
        
        return auctionCounter;
    }

    // placeBid 出价函数
    function placeBid(uint256 auctionId,uint256 amount) external payable {
        Auction storage auction = auctions[auctionId];
        require(auction.active, "Auction not active");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(msg.sender != auction.seller, "Seller cannot bid");
    
        uint256 minBid;

        if (auction.paymentToken == address(0)) {
            // ETH 出价：amount 和实际转入金额必须一致
            require(msg.value == amount, "ETH amount mismatch");
        } else {
            // ERC-20 出价：不能同时附带 ETH
            require(msg.value == 0, "Do not send ETH");
            IERC20(auction.paymentToken).safeTransferFrom(
                msg.sender,
                address(this),
                amount
            );
        }

        if (auction.highestBid == 0) {
            minBid = auction.startPrice;
        } else {
            minBid = auction.highestBid + (auction.highestBid * 5 / 100); // 5% increment
        }
        
        require(msg.value >= minBid, "Bid too low");
        
        // 如果有之前的出价者，记录他们的待退款金额
        if (auction.highestBidder != address(0)) {
            pendingReturns[auctionId][auction.highestBidder] += auction.highestBid;
        }
        
        // 更新最高出价
        auction.highestBid = msg.value;
        auction.highestBidder = msg.sender;
        
        emit BidPlaced(auctionId, msg.sender, msg.value);
    }


    // 退款函数
    function withdrawBid(uint256 auctionId) external {
        uint256 amount = pendingReturns[auctionId][msg.sender];
        require(amount > 0, "No pending return");
        
        pendingReturns[auctionId][msg.sender] = 0;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }


    // 结束拍卖
    function endAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        
        require(auction.active, "Auction not active");
        require(block.timestamp >= auction.endTime, "Auction not ended");
        
        auction.active = false;
        
        if (auction.highestBidder != address(0)) {
            // 有人出价，进行结算
            uint256 fee = (auction.highestBid * platformFee) / 10000;
            
            (address royaltyReceiver, uint256 royaltyAmount) = _getRoyaltyInfo(
                auction.nftContract,
                auction.tokenId,
                auction.highestBid
            );
            
            uint256 sellerAmount = auction.highestBid - fee - royaltyAmount;
            
            // 转移NFT
            IERC721(auction.nftContract).safeTransferFrom(
                auction.seller,
                auction.highestBidder,
                auction.tokenId
            );
            
            // 资金分配
            if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
                (bool successRoyalty, ) = royaltyReceiver.call{value: royaltyAmount}("");
                require(successRoyalty, "Royalty transfer failed");
            }
            
            (bool successSeller, ) = auction.seller.call{value: sellerAmount}("");
            require(successSeller, "Transfer to seller failed");
            
            (bool successFee, ) = feeRecipient.call{value: fee}("");
            require(successFee, "Transfer fee failed");
            
            emit AuctionEnded(
                auctionId,
                auction.highestBidder,
                auction.highestBid
            );
        } else {
            // 没有人出价，拍卖流拍
            emit AuctionEnded(auctionId, address(0), 0);
        }
    }





}