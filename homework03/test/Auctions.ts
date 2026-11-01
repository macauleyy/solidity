import { expect } from "chai";
import { anyValue } from "@nomicfoundation/hardhat-ethers-chai-matchers/withArgs";
import hre, { network } from "hardhat";
import { upgrades } from "@openzeppelin/hardhat-upgrades";

const connection = await network.create();
const { ethers, networkHelpers } = connection;
const upgradesApi = await upgrades(hre, connection);

const ZERO = ethers.ZeroAddress;
const FEE = 250n;
const USD_1 = 10n ** 18n;
const USD_2000 = 2_000n * USD_1;
const MINUTE = 60n;

async function deployFixture() {
  const [owner, bidder1, bidder2, feeRecipient, buyer] = await ethers.getSigners();
  const feed = await ethers.deployContract("MockV3Aggregator", [18, USD_2000]);
  const nft = await ethers.deployContract("MyNFT");
  const token = await ethers.deployContract("TestToken");
  const factory = await ethers.getContractFactory("Auctions");
  const auction = await upgradesApi.deployProxy(
    factory,
    [owner.address, FEE, feeRecipient.address, await feed.getAddress()],
    { kind: "uups" },
  );
  await auction.waitForDeployment();
  await nft.connect(owner).mint("ipfs://test", { value: await nft.mintPrice() });
  await nft.connect(owner).approve(await auction.getAddress(), 1n);
  await auction.setUsdFeed(await token.getAddress(), await feed.getAddress(), 18);
  await token.transfer(bidder1.address, ethers.parseEther("100"));
  await token.transfer(bidder2.address, ethers.parseEther("100"));
  await token.transfer(buyer.address, ethers.parseEther("100"));
  return { auction, feed, nft, token, owner, bidder1, bidder2, feeRecipient, buyer };
}

async function createAuction(ctx: Awaited<ReturnType<typeof deployFixture>>, token = ZERO, id = 1n) {
  await ctx.auction.createAuction(token, await ctx.nft.getAddress(), id, USD_1, 2n);
}

describe("Auctions", function () {
  it("validates feed/token configuration", async function () {
    const { auction, feed, nft, bidder1 } = await networkHelpers.loadFixture(deployFixture);
    const feedAddress = await feed.getAddress();
    const tokenAddress = await nft.getAddress();

    await expect(auction.setUsdFeed(ZERO, ZERO, 18)).to.be.revertedWith("Invalid feed");
    await expect(auction.setUsdFeed(ZERO, bidder1.address, 18)).to.be.revertedWith("Feed is not a contract");
    await expect(auction.setUsdFeed(ZERO, feedAddress, 17)).to.be.revertedWith("ETH must use 18 decimals");
    await expect(auction.setUsdFeed(bidder1.address, feedAddress, 18)).to.be.revertedWith("Token is not a contract");
    await expect(auction.setUsdFeed(feedAddress, feedAddress, 17)).to.be.revertedWith("Decimals mismatch");
    await expect(auction.setUsdFeed(tokenAddress, feedAddress, 18)).to.be.revertedWith("Token does not support decimals");
  });

  it("initializes and exposes fresh USD prices", async function () {
    const { auction } = await networkHelpers.loadFixture(deployFixture);
    const [price, decimals, updatedAt] = await auction.getLatestUsdPrice(ZERO);
    expect(price).to.equal(USD_2000);
    expect(decimals).to.equal(18n);
    expect(updatedAt).to.be.greaterThan(0n);
    expect(await auction.platformFee()).to.equal(FEE);
    expect(await auction.maxPriceAge()).to.equal(24n * 60n * MINUTE);
    await expect(auction.setMaxPriceAge(2n * 24n * 60n * MINUTE))
      .to.emit(auction, "MaxPriceAgeUpdated")
      .withArgs(24n * 60n * MINUTE, 2n * 24n * 60n * MINUTE);
    expect(await auction.maxPriceAge()).to.equal(2n * 24n * 60n * MINUTE);
    await expect(auction.setMaxPriceAge(0n)).to.be.revertedWith("Max price age must be positive");
  });

  it("normalizes feeds with more than 18 decimals", async function () {
    const { auction, nft } = await networkHelpers.loadFixture(deployFixture);
    const highPrecisionFeed = await ethers.deployContract("MockV3Aggregator", [20, 2000n * 10n ** 20n]);
    await auction.setUsdFeed(ZERO, await highPrecisionFeed.getAddress(), 18);
    const [price, decimals] = await auction.getLatestUsdPrice(ZERO);
    expect(price).to.equal(2000n * 10n ** 20n);
    expect(decimals).to.equal(20n);
    await createAuction({ auction, nft } as Awaited<ReturnType<typeof deployFixture>>);
    await auction.connect((await ethers.getSigners())[1]).placeBid(1n, { value: ethers.parseEther("0.001") });
  });

  it("rejects invalid oracle data and initializer parameters", async function () {
    const { auction, feed, owner, feeRecipient } = await networkHelpers.loadFixture(deployFixture);
    const now = BigInt(await networkHelpers.time.latest());
    await feed.setData(0, now, false);
    await expect(auction.getLatestUsdPrice(ZERO)).to.be.revertedWith("Invalid price");
    await expect(auction.setUsdFeed(ZERO, await feed.getAddress(), 18)).to.be.revertedWith("Invalid feed price");
    await feed.setData(USD_2000, 0, false);
    await expect(auction.getLatestUsdPrice(ZERO)).to.be.revertedWith("Invalid timestamp");
    await expect(auction.setUsdFeed(ZERO, await feed.getAddress(), 18)).to.be.revertedWith("Invalid update time");
    await feed.setData(USD_2000, now + 100n, false);
    await expect(auction.getLatestUsdPrice(ZERO)).to.be.revertedWith("Invalid timestamp");
    await expect(auction.setUsdFeed(ZERO, await feed.getAddress(), 18)).to.be.revertedWith("Invalid update time");
    await feed.setData(USD_2000, now, true);
    await expect(auction.setUsdFeed(ZERO, await feed.getAddress(), 18)).to.be.revertedWith("Feed is not valid");
    await expect(auction.getLatestUsdPrice(ZERO)).to.revert(ethers);
    await feed.setData(USD_2000, now - 24n * 60n * MINUTE - 1n, false);
    await expect(auction.getLatestUsdPrice(ZERO)).to.be.revertedWith("Stale price");

    const factory = await ethers.getContractFactory("Auctions");
    await expect(upgradesApi.deployProxy(factory, [owner.address, 10_001n, feeRecipient.address, await feed.getAddress()], { kind: "uups" }))
      .to.be.revertedWith("Wrong platformFee or feeRecipient");
    await expect(upgradesApi.deployProxy(factory, [owner.address, FEE, ZERO, await feed.getAddress()], { kind: "uups" }))
      .to.be.revertedWith("Wrong platformFee or feeRecipient");
  });

  it("rejects invalid listings and returns an escrowed listing", async function () {
    const { auction, nft, token, bidder1, owner } = await networkHelpers.loadFixture(deployFixture);
    const nftAddress = await nft.getAddress();
    const tokenAddress = await token.getAddress();
    await expect(auction.listNFT(ZERO, nftAddress, 1n, 0n)).to.be.revertedWith("Price must be greater than 0");
    await expect(auction.listNFT(bidder1.address, nftAddress, 1n, 1n)).to.be.revertedWith("Unsupported payment token");
    await expect(auction.connect(bidder1).listNFT(ZERO, nftAddress, 1n, 1n)).to.be.revertedWith("Not the owner");
    await nft.connect(owner).approve(ZERO, 1n);
    await expect(auction.listNFT(ZERO, nftAddress, 1n, 1n)).to.be.revertedWith("Marketplace not approved");
    await nft.connect(owner).approve(await auction.getAddress(), 1n);
    await expect(auction.listNFT(ZERO, nftAddress, 1n, 1n)).to.emit(auction, "NFTListed").withArgs(1n, owner.address, nftAddress, 1n, 1n);
    await expect(auction.connect(bidder1).delistNFT(1n)).to.be.revertedWith("Not the seller");
    await expect(auction.delistNFT(1n)).to.emit(auction, "NFTDelisted").withArgs(1n);
    expect(await nft.ownerOf(1n)).to.equal(owner.address);
    await expect(auction.delistNFT(1n)).to.be.revertedWith("Listing not active");
  });

  it("sells an ETH listing with exact and excess payment", async function () {
    const { auction, nft, owner, bidder1, feeRecipient } = await networkHelpers.loadFixture(deployFixture);
    const nftAddress = await nft.getAddress();
    await auction.listNFT(ZERO, nftAddress, 1n, ethers.parseEther("0.1"));
    await expect(auction.connect(owner).buyNFT(1n, { value: ethers.parseEther("0.1") })).to.be.revertedWith("Cannot buy your own NFT");
    await expect(auction.connect(bidder1).buyNFT(1n)).to.be.revertedWith("Not ETH!");
    await expect(auction.connect(bidder1).buyNFT(1n, { value: 1n })).to.be.revertedWith("Insufficient payment");
    await expect(auction.connect(bidder1).buyNFT(1n, { value: ethers.parseEther("0.11") }))
      .to.emit(auction, "NFTSold").withArgs(1n, bidder1.address, owner.address, ethers.parseEther("0.1"));
    expect(await nft.ownerOf(1n)).to.equal(bidder1.address);
    expect(await auction.pendingPayouts(feeRecipient.address, ZERO)).to.equal(ethers.parseEther("0.0025"));
    expect(await auction.pendingPayouts(owner.address, ZERO)).to.equal(ethers.parseEther("0.0975"));
    expect(await auction.pendingPayouts(bidder1.address, ZERO)).to.equal(ethers.parseEther("0.01"));
    await auction.connect(feeRecipient).withdrawPayout(ZERO);
    await auction.connect(owner).withdrawPayout(ZERO);
    await auction.connect(bidder1).withdrawPayout(ZERO);
    expect(await ethers.provider.getBalance(feeRecipient.address)).to.be.greaterThan(0n);
    await expect(auction.connect(bidder1).buyNFT(1n, { value: ethers.parseEther("0.1") })).to.be.revertedWith("Listing not active");
  });

  it("sells an ERC20 listing", async function () {
    const { auction, nft, token, owner, buyer, feeRecipient } = await networkHelpers.loadFixture(deployFixture);
    const tokenAddress = await token.getAddress();
    const price = ethers.parseEther("10");
    await auction.listNFT(tokenAddress, await nft.getAddress(), 1n, price);
    await expect(auction.connect(buyer).buyNFT(1n, { value: 1n })).to.be.revertedWith("Not ERC20");
    await token.connect(buyer).approve(await auction.getAddress(), price);
    await expect(auction.connect(owner).buyNFT(1n)).to.be.revertedWith("Cannot buy your own NFT");
    await expect(auction.connect(buyer).buyNFT(1n)).to.emit(auction, "NFTSold").withArgs(1n, buyer.address, owner.address, price);
    expect(await nft.ownerOf(1n)).to.equal(buyer.address);
    expect(await auction.pendingPayouts(feeRecipient.address, tokenAddress)).to.equal(price * FEE / 10_000n);
    await auction.connect(feeRecipient).withdrawPayout(tokenAddress);
    await auction.connect(owner).withdrawPayout(tokenAddress);
    expect(await token.balanceOf(feeRecipient.address)).to.equal(price * FEE / 10_000n);
  });

  it("creates auctions and validates auction creation", async function () {
    const { auction, nft, token, owner, bidder1 } = await networkHelpers.loadFixture(deployFixture);
    const nftAddress = await nft.getAddress();
    await expect(auction.createAuction(bidder1.address, nftAddress, 1n, USD_1, 1n)).to.be.revertedWith("Unsupported payment token");
    await expect(auction.createAuction(ZERO, nftAddress, 1n, 0n, 1n)).to.be.revertedWith("Start price must be greater than 0");
    await expect(auction.createAuction(ZERO, nftAddress, 1n, USD_1, 0n)).to.be.revertedWith("Duration must be at least 1 minute");
    await expect(auction.connect(bidder1).createAuction(ZERO, nftAddress, 1n, USD_1, 1n)).to.be.revertedWith("Not the owner");
    await nft.connect(owner).approve(ZERO, 1n);
    await expect(auction.createAuction(ZERO, nftAddress, 1n, USD_1, 1n)).to.be.revertedWith("Marketplace not approved");
    await nft.connect(owner).approve(await auction.getAddress(), 1n);
    await auction.createAuction(await token.getAddress(), nftAddress, 1n, USD_1, 1n);
    expect(await nft.ownerOf(1n)).to.equal(await auction.getAddress());
  });

  it("accepts first and higher ETH bids, refunds displaced bidders, and withdraws", async function () {
    const { auction, nft, bidder1, bidder2 } = await networkHelpers.loadFixture(deployFixture);
    await createAuction({ auction, nft } as Awaited<ReturnType<typeof deployFixture>>);
    const bid1 = ethers.parseEther("0.001");
    const bid2 = ethers.parseEther("0.002");
    await expect(auction.connect(bidder1).placeBid(1n, { value: 100n })).to.be.revertedWith("Bid too low");
    await expect(auction.connect(bidder1).placeBid(1n, { value: bid1 })).to.emit(auction, "BidPlaced").withArgs(1n, bidder1.address, ZERO, bid1);
    await expect(auction.connect(bidder2).placeBid(1n, { value: bid2 })).to.emit(auction, "BidPlaced").withArgs(1n, bidder2.address, ZERO, bid2);
    expect(await auction.pendingReturns(1n, bidder1.address, ZERO)).to.equal(bid1);
    await expect(auction.connect(bidder1).withdrawBid(1n, ZERO)).to.changeEtherBalance(ethers, bidder1, bid1);
    expect(await auction.pendingReturns(1n, bidder1.address, ZERO)).to.equal(0n);
    await expect(auction.connect(bidder1).withdrawBid(1n, ZERO)).to.be.revertedWith("No pending return");
  });

  it("supports ERC20 bids, rejects invalid bids, and pays displaced bidders", async function () {
    const { auction, nft, token, bidder1, bidder2 } = await networkHelpers.loadFixture(deployFixture);
    await createAuction({ auction, nft } as Awaited<ReturnType<typeof deployFixture>>, await token.getAddress());
    const bid1 = ethers.parseEther("1");
    const bid2 = ethers.parseEther("2");
    await expect(auction.connect(bidder1).placeBidERC20(1n, bid1, { value: 1n })).to.be.revertedWith("No ETH");
    await token.connect(bidder1).approve(await auction.getAddress(), 1n);
    await expect(auction.connect(bidder1).placeBidERC20(1n, 1n)).to.be.revertedWith("Bid too low");
    await token.connect(bidder1).approve(await auction.getAddress(), bid1);
    await token.connect(bidder2).approve(await auction.getAddress(), bid2);
    await auction.connect(bidder1).placeBidERC20(1n, bid1);
    await auction.connect(bidder2).placeBidERC20(1n, bid2);
    expect(await auction.pendingReturns(1n, bidder1.address, await token.getAddress())).to.equal(bid1);
    await expect(auction.connect(bidder1).withdrawBid(1n, await token.getAddress())).to.changeTokenBalance(ethers, token, bidder1, bid1);
    await expect(auction.connect(bidder1).placeBid(1n, { value: ethers.parseEther("1") })).to.be.revertedWith("Not Eth");
  });

  it("rejects bids for inactive, ended, or seller-owned auctions", async function () {
    const { auction, nft, owner, bidder1 } = await networkHelpers.loadFixture(deployFixture);
    await expect(auction.connect(bidder1).placeBid(99n, { value: 1n })).to.be.revertedWith("Auction not active");
    await createAuction({ auction, nft } as Awaited<ReturnType<typeof deployFixture>>);
    await expect(auction.placeBid(1n, { value: ethers.parseEther("1") })).to.be.revertedWith("Seller cannot bid");
    const a = await auction.auctions(1n);
    await networkHelpers.time.increaseTo(a.endTime);
    await expect(auction.connect(bidder1).placeBid(1n, { value: ethers.parseEther("1") })).to.be.revertedWith("Auction ended");
    await expect(auction.connect(bidder1).placeBidERC20(1n, 1n)).to.be.revertedWith("Auction ended");
  });

  it("ends an auction without bids and rejects early or repeated ending", async function () {
    const { auction, nft, owner, bidder1 } = await networkHelpers.loadFixture(deployFixture);
    await createAuction({ auction, nft } as Awaited<ReturnType<typeof deployFixture>>);
    await expect(auction.endAuction(1n)).to.be.revertedWith("Auction not ended");
    const a = await auction.auctions(1n);
    await networkHelpers.time.increaseTo(a.endTime);
    await expect(auction.endAuction(1n)).to.emit(auction, "AuctionEnded").withArgs(1n, ZERO, 0n);
    expect(await nft.ownerOf(1n)).to.equal(owner.address);
    await expect(auction.endAuction(1n)).to.be.revertedWith("Auction not active");
    await expect(auction.connect(bidder1).withdrawBid(1n, ZERO)).to.be.revertedWith("No pending return");
  });

  it("settles ETH auction proceeds after a winning bid", async function () {
    const { auction, nft, owner, bidder1, feeRecipient } = await networkHelpers.loadFixture(deployFixture);
    await createAuction({ auction, nft } as Awaited<ReturnType<typeof deployFixture>>);
    const bid = ethers.parseEther("0.001");
    await auction.connect(bidder1).placeBid(1n, { value: bid });
    const a = await auction.auctions(1n);
    await networkHelpers.time.increaseTo(a.endTime);
    await expect(auction.endAuction(1n)).to.emit(auction, "AuctionEnded").withArgs(1n, bidder1.address, bid);
    expect(await nft.ownerOf(1n)).to.equal(bidder1.address);
    expect(await ethers.provider.getBalance(feeRecipient.address)).to.be.greaterThan(0n);
    expect(await ethers.provider.getBalance(owner.address)).to.be.greaterThan(0n);
  });

  it("settles ERC20 auction proceeds after a winning bid", async function () {
    const { auction, nft, token, owner, bidder1, feeRecipient } = await networkHelpers.loadFixture(deployFixture);
    await createAuction({ auction, nft } as Awaited<ReturnType<typeof deployFixture>>, await token.getAddress());
    const bid = ethers.parseEther("1");
    await token.connect(bidder1).approve(await auction.getAddress(), bid);
    await auction.connect(bidder1).placeBidERC20(1n, bid);
    const a = await auction.auctions(1n);
    await networkHelpers.time.increaseTo(a.endTime);
    await auction.endAuction(1n);
    expect(await nft.ownerOf(1n)).to.equal(bidder1.address);
    await auction.connect(feeRecipient).withdrawPayout(await token.getAddress());
    await auction.connect(owner).withdrawPayout(await token.getAddress());
    expect(await token.balanceOf(feeRecipient.address)).to.equal(bid * FEE / 10_000n);
    expect(await token.balanceOf(owner.address)).to.equal(999_700n * USD_1 + bid - bid * FEE / 10_000n);
  });

  it("pays ERC2981 royalties in ETH and ERC20 auction settlements", async function () {
    const { auction, token, owner, bidder1, feeRecipient, buyer } = await networkHelpers.loadFixture(deployFixture);
    const receiver = buyer.address;
    const royaltyNft = await ethers.deployContract("RoyaltyNFT", [receiver, 500]);
    const nftAddress = await royaltyNft.getAddress();
    const auctionAddress = await auction.getAddress();
    await royaltyNft.mint(owner.address, 1n);
    await royaltyNft.mint(owner.address, 2n);
    await royaltyNft.connect(owner).approve(auctionAddress, 1n);
    await royaltyNft.connect(owner).approve(auctionAddress, 2n);
    const bidEth = ethers.parseEther("0.001");
    await auction.createAuction(ZERO, nftAddress, 1n, USD_1, 1n);
    await auction.connect(bidder1).placeBid(1n, { value: bidEth });
    let a = await auction.auctions(1n);
    await networkHelpers.time.increaseTo(a.endTime);
    await auction.endAuction(1n);
    expect(await auction.pendingPayouts(receiver, ZERO)).to.equal(bidEth * 500n / 10_000n);
    await auction.connect(buyer).withdrawPayout(ZERO);
    expect(await ethers.provider.getBalance(receiver)).to.be.greaterThan(0n);
    expect(await royaltyNft.ownerOf(1n)).to.equal(bidder1.address);

    await token.connect(bidder1).approve(auctionAddress, ethers.parseEther("1"));
    await auction.createAuction(await token.getAddress(), nftAddress, 2n, USD_1, 1n);
    await auction.connect(bidder1).placeBidERC20(2n, ethers.parseEther("1"));
    a = await auction.auctions(2n);
    await networkHelpers.time.increaseTo(a.endTime);
    await auction.endAuction(2n);
    expect(await auction.pendingPayouts(receiver, await token.getAddress())).to.equal(ethers.parseEther("0.05"));
    await auction.connect(buyer).withdrawPayout(await token.getAddress());
    expect(await royaltyNft.ownerOf(2n)).to.equal(bidder1.address);
    await auction.connect(feeRecipient).withdrawPayout(await token.getAddress());
    expect(await token.balanceOf(feeRecipient.address)).to.be.greaterThan(0n);
  });

  it("settles auctions with broken and excessive royalty responses", async function () {
    const { auction, owner, bidder1 } = await networkHelpers.loadFixture(deployFixture);
    const auctionAddress = await auction.getAddress();
    const broken = await ethers.deployContract("RevertingRoyaltyNFT");
    const brokenInterface = await ethers.deployContract("RevertingInterfaceNFT");
    const invalid = await ethers.deployContract("InvalidRoyaltyNFT");
    const excessive = await ethers.deployContract("RoyaltyNFT", [bidder1.address, 10_000]);
    const nfts = [broken, brokenInterface, invalid, excessive];
    for (let i = 0; i < nfts.length; i++) {
      const nft = nfts[i];
      const id = BigInt(i + 1);
      await nft.mint(owner.address, id);
      await nft.connect(owner).approve(auctionAddress, id);
      await auction.createAuction(ZERO, await nft.getAddress(), id, USD_1, 1n);
      const bid = ethers.parseEther("0.001");
      await auction.connect(bidder1).placeBid(BigInt(i + 1), { value: bid });
      const state = await auction.auctions(BigInt(i + 1));
      await networkHelpers.time.increaseTo(state.endTime);
      await auction.endAuction(BigInt(i + 1));
      expect(await nft.ownerOf(id)).to.equal(bidder1.address);
    }
    expect(await auction.pendingPayouts(bidder1.address, ZERO)).to.be.greaterThan(ethers.parseEther("0.0009"));
  });

  it("validates ERC20 bid auction type and inactive state", async function () {
    const { auction, nft, bidder1 } = await networkHelpers.loadFixture(deployFixture);
    await createAuction({ auction, nft } as Awaited<ReturnType<typeof deployFixture>>);
    await expect(auction.connect(bidder1).placeBidERC20(1n, 1n)).to.be.revertedWith("Not Erc20");
    await expect(auction.connect(bidder1).placeBidERC20(99n, 1n)).to.be.revertedWith("Auction not active");
  });

  it("accepts an ERC721 receiver callback", async function () {
    const { auction, owner } = await networkHelpers.loadFixture(deployFixture);
    const selector = await auction.onERC721Received.staticCall(ZERO, owner.address, 1n, "0x");
    expect(selector).to.equal("0x150b7a02");
  });
});
