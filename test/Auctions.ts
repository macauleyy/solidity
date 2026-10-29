import { expect } from "chai";
import { anyValue } from "@nomicfoundation/hardhat-ethers-chai-matchers/withArgs";
import hre, { network } from "hardhat";
import { upgrades } from "@openzeppelin/hardhat-upgrades";
import { matchesGlob } from "path";

// Default network is the local Hardhat network, so tests are isolated and free.
const connection = await network.create();
const { ethers, networkHelpers } = connection;
const upgradesApi = await upgrades(hre, connection);

const ZERO_ADDRESS = ethers.ZeroAddress;
const PLATFORM_FEE_BPS = 250n;
const ETH_USD_PRICE = 2_000n * 10n ** 18n; // $2,000, feed has 8 decimals
const USD_1 = 1n * 10n ** 18n;

async function deployAuctionsFixture() {
  const [owner, bidder1, bidder2, feeRecipient] = await ethers.getSigners();
  const feed = await ethers.deployContract("MockV3Aggregator", [18, ETH_USD_PRICE]);
  const nft = await ethers.deployContract("MyNFT");
  const Auctions = await ethers.getContractFactory("Auctions");

  const auction = await upgradesApi.deployProxy(
    Auctions,
    [owner.address, PLATFORM_FEE_BPS, feeRecipient.address, await feed.getAddress()],
    { kind: "uups" },
  );
  await auction.waitForDeployment();

  // Mint an NFT for the owner and approve the auction proxy to escrow it.
  await nft.connect(owner).mint("ipfs://test-metadata", {
    value: await nft.mintPrice(),
  });
  await nft.connect(owner).approve(await auction.getAddress(), 1n);

  return { auction, feed, nft, owner, bidder1, bidder2, feeRecipient };
}

describe("Auctions", function () {
  it("set usdFeed by address(0) Falied!",async function(){
    const { auction } =
      await networkHelpers.loadFixture(deployAuctionsFixture);
    let supported: boolean = false;
    const tokenDecimals_ = 17;

    await expect(
      auction.setUsdFeed(
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        tokenDecimals_,
      ),
    )
      .to.be.revertedWith("Invalid feed");
  })




  it("Falied by setting usdFeed with address which isnt contract address !",async function(){
    const { auction, bidder1 } =
      await networkHelpers.loadFixture(deployAuctionsFixture);

    let supported: boolean = false;
    const tokenDecimals_ = 17;

    await expect(
      auction.setUsdFeed(
        ZERO_ADDRESS,
        bidder1,
        tokenDecimals_,
      ),
    )
      .to.be.revertedWith("Feed is not a contract");
  })


  it("Falied by setting usdFeed with tokenDecimals_ which isnt 18 !",async function(){
    const { auction, nft, owner, bidder1 } =
      await networkHelpers.loadFixture(deployAuctionsFixture);

    const tokenDecimals_ = 17;

    await expect(
      auction.setUsdFeed(
        ZERO_ADDRESS,
        nft,
        tokenDecimals_,
      ),
    )
      .to.be.revertedWith("ETH must use 18 decimals");


  })

  it("Falied by setting usdFeed with token which isnt contract address!",async function(){
    const { auction, nft, owner, bidder1 } =
      await networkHelpers.loadFixture(deployAuctionsFixture);

    let supported: boolean = false;
    const tokenDecimals_ = 17;

    await expect(
      auction.setUsdFeed(
        bidder1,
        nft,
        tokenDecimals_,
      ),
    )
      .to.be.revertedWith("Token is not a contract");


  })


  it("reject by decimals mismatch!",async function(){
    const { auction, feed } =
      await networkHelpers.loadFixture(deployAuctionsFixture);
    let supported: boolean = false;
    const tokenDecimals_ = 17;

    await expect(
      auction.setUsdFeed(
        feed,
        feed,
        tokenDecimals_,
      ),
    )
      .to.be.revertedWith("Decimals mismatch");
  })

  it("reject by Token does not support!",async function(){
    const { auction, nft, feed } =
      await networkHelpers.loadFixture(deployAuctionsFixture);
    let supported: boolean = false;
    const tokenDecimals_ = 18;

    await expect(
      auction.setUsdFeed(
        nft,
        feed,
        tokenDecimals_,
      ),
    )
      .to.be.revertedWith("Token does not support decimals");
  })

  it("reject by platformFee !",async function(){
    const { auction, nft, feed } =
      await networkHelpers.loadFixture(deployAuctionsFixture);
    let supported: boolean = false;
    const tokenDecimals_ = 18;

    await expect(
      auction.setUsdFeed(
        nft,
        feed,
        tokenDecimals_,
      ),
    )
      .to.be.revertedWith("Token does not support decimals");
  })

  it("reject by price < 0!",async function(){
    const { auction, nft, feed } =
      await networkHelpers.loadFixture(deployAuctionsFixture);
    let supported: boolean = false;
    const tokenDecimals_ = 18;

    await expect(
      auction.listNFT(
        feed,
        nft,
        1n,
        0,
      ),
    )
      .to.be.revertedWith("Price must be greater than 0");
  })

  it("reject by Unsupported payment token!",async function(){
    const { auction, nft, feed } =
      await networkHelpers.loadFixture(deployAuctionsFixture);
    let supported: boolean = false;
    const tokenDecimals_ = 18;

    await expect(
      auction.listNFT(
        nft,
        nft,
        1n,
        10,
      ),
    )
      .to.be.revertedWith("Unsupported payment token");
  })

  it("rejects listing when caller is not the NFT owner", async function () {
    const { auction, nft, feed, bidder1 } =
      await networkHelpers.loadFixture(deployAuctionsFixture);
  
    const token = await ethers.deployContract("TestToken");
    const tokenAddress = await token.getAddress();
    const nftAddress = await nft.getAddress();
  
    // 参数顺序：支付代币、价格 Feed、支付代币精度
    await auction.setUsdFeed(tokenAddress, await feed.getAddress(), 18);
  
    await expect(
      auction.connect(bidder1).listNFT(tokenAddress, nftAddress, 1n, 10n),
    ).to.be.revertedWith("Not the owner");
  });

  it("rejects listing when marketplace not approved", async function () {
    const { auction, nft, feed, bidder1 } =
      await networkHelpers.loadFixture(deployAuctionsFixture);
  
    const token = await ethers.deployContract("TestToken");
    const tokenAddress = await token.getAddress();
    const nftAddress = await nft.getAddress();
  
    // 参数顺序：支付代币、价格 Feed、支付代币精度
    await auction.setUsdFeed(tokenAddress, await feed.getAddress(), 18);
  
    await expect(
      auction.listNFT(tokenAddress, nftAddress, 2n, 10n),
    ).to.be.revertedWith("Marketplace not approved");
  });
  

  it("creates an ETH auction and escrows the NFT", async function () {
    const { auction, nft, owner } =
      await networkHelpers.loadFixture(deployAuctionsFixture);

    const nftAddress = await nft.getAddress();
    const auctionAddress = await auction.getAddress();
    const durationMinutes = 10n;

    await expect(
      auction.createAuction(
        ZERO_ADDRESS,
        nftAddress,
        1n,
        USD_1,
        durationMinutes,
      ),
    )
      .to.emit(auction, "AuctionCreated")
      .withArgs(1n, owner.address, nftAddress, 1n, USD_1, anyValue);

    const createdAuction = await auction.auctions(1n);
    expect(createdAuction.paymentToken).to.equal(ZERO_ADDRESS);
    expect(createdAuction.seller).to.equal(owner.address);
    expect(createdAuction.nftContract).to.equal(nftAddress);
    expect(createdAuction.tokenId).to.equal(1n);
    expect(createdAuction.startPriceUsd18).to.equal(USD_1);
    expect(createdAuction.active).to.equal(true);
    expect(await nft.ownerOf(1n)).to.equal(auctionAddress);
  });

  it("rejects an ETH bid below the USD starting price",async function() {
    const { auction, nft, owner, bidder1} =
      await networkHelpers.loadFixture(deployAuctionsFixture);

    const nftAddress = await nft.getAddress();
    const auctionAddress = await auction.getAddress();
    const durationMinutes = 10n;

    await expect(
      auction.createAuction(
        ZERO_ADDRESS,
        nftAddress,
        1n,
        USD_1,
        durationMinutes,
      ),
    )
      .to.emit(auction, "AuctionCreated")
      .withArgs(1n, owner.address, nftAddress, 1n, USD_1, anyValue);

   
    await expect(
      auction.connect(bidder1).placeBid(1n,{value: 200n}),
    ).to.be.revertedWith("Bid too low");
    
  });

  it("accepts a valid ETH bid and emits BidPlaced",async function () {
    const { auction, nft, owner, bidder1} =
      await networkHelpers.loadFixture(deployAuctionsFixture);

    const nftAddress = await nft.getAddress();
    const auctionAddress = await auction.getAddress();
    const durationMinutes = 10n;

    await expect(
      auction.createAuction(
        ZERO_ADDRESS,
        nftAddress,
        1n,
        USD_1,
        durationMinutes,
      ),
    )
      .to.emit(auction, "AuctionCreated")
      .withArgs(1n, owner.address, nftAddress, 1n, USD_1, anyValue);

    const bitAmount = ethers.parseEther("0.1");
    await expect(
      auction.connect(bidder1).placeBid(1n,{value: bitAmount}),
    )
      .to.emit(auction,"BidPlaced")
      .withArgs(1n,bidder1.address,ZERO_ADDRESS,bitAmount);
  });

  it("credits the previous bidder when a higher bid arrives",async function () {
    const { auction, nft, owner, bidder1, bidder2} =
      await networkHelpers.loadFixture(deployAuctionsFixture);

    const nftAddress = await nft.getAddress();
    const auctionAddress = await auction.getAddress();
    const durationMinutes = 10n;

    await expect(
      auction.createAuction(
        ZERO_ADDRESS,
        nftAddress,
        1n,
        USD_1,
        durationMinutes,
      ),
    )
      .to.emit(auction, "AuctionCreated")
      .withArgs(1n, owner.address, nftAddress, 1n, USD_1, anyValue);

    const bitAmount1 = ethers.parseEther("0.1");
    const bitAmount2 = ethers.parseEther("0.15");

    await expect(
      auction.connect(bidder1).placeBid(1n,{value: bitAmount1}),
    )
      .to.emit(auction,"BidPlaced")
      .withArgs(1n,bidder1.address,ZERO_ADDRESS,bitAmount1);

      await expect(
        auction.connect(bidder2).placeBid(1n,{value: bitAmount2}),
      )
        .to.emit(auction,"BidPlaced")
        .withArgs(1n,bidder2.address,ZERO_ADDRESS,bitAmount2);
      // const pendingReturns = await(auction.pendingReturns(1n,))
    const createdAuction = await auction.auctions(1n);
    expect(createdAuction.paymentToken).to.equal(ZERO_ADDRESS);
    expect(createdAuction.seller).to.equal(owner.address);
    expect(createdAuction.nftContract).to.equal(nftAddress);
    expect(createdAuction.tokenId).to.equal(1n);
    expect(createdAuction.highestBid).to.equal(bitAmount2);
    expect(createdAuction.active).to.equal(true);
    expect(createdAuction.highestBidder).to.equal(bidder2);
    expect(await nft.ownerOf(1n)).to.equal(auctionAddress);

  });


  it("returns the NFT when an auction ends without bids",async function() {
    const { auction, nft, owner} =
      await networkHelpers.loadFixture(deployAuctionsFixture);

    const nftAddress = await nft.getAddress();
    const auctionAddress = await auction.getAddress();
    const durationMinutes = 1n;

    await expect(
      auction.createAuction(
        ZERO_ADDRESS,
        nftAddress,
        1n,
        USD_1,
        durationMinutes,
      ),
    )
      .to.emit(auction, "AuctionCreated")
      .withArgs(1n, owner.address, nftAddress, 1n, USD_1, anyValue);

    const createdAuction = await auction.auctions(1n);

    await networkHelpers.time.increaseTo(createdAuction.endTime + 1n);


    await expect(
      auction.endAuction(1n),
    )
      .to.emit(auction,"AuctionEnded")
      .withArgs(1n, ZERO_ADDRESS, 0n);

    expect(createdAuction.highestBidder).to.equal(ZERO_ADDRESS);


  });

  
});

// TODO: Replace each pending test with an `it(..., async function () { ... })`
// body and start it with `await networkHelpers.loadFixture(deployAuctionsFixture)`.
// Use createAuction(ZERO_ADDRESS, nftAddress, tokenId, USD_1, durationMinutes)
// to create an ETH auction and assert both emitted events and resulting state.
// The mock feed is local-only; use the real configured feed in deployment scripts.
