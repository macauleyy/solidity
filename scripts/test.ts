import { getNft, getAuction } from "./helpers.js";


async function main() {
    const { ethers, signer, nft } = await getNft();
    const { auction, signer: auctionSigner } = await getAuction();

    const address = process.env.AUCTION_PROXY_ADDRESS;
    
    // NFT上架，上架前需先授权
    console.log("---------1、NFT上架---------");
    const tokenId = 1n;
    const nftAddress = await nft.getAddress();
    const auctionAddress = await auction.getAddress();
    const signerAddress = await signer.getAddress();

    if ((await auctionSigner.getAddress()).toLowerCase() !== signerAddress.toLowerCase()) {
        throw new Error("NFT 和拍卖合约使用的 signer 不一致");
    }

    const owner = await nft.ownerOf(tokenId);
    if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
        throw new Error(`当前 signer 不是 tokenId ${tokenId} 的所有者`);
    }

    const approvalTx = await nft.approve(auctionAddress, tokenId);
    await approvalTx.wait();

    console.log("NFT 授权给:", await nft.getApproved(tokenId));

    const price = 500_000_000_000n;
    const tx = await auction.listNFT(nftAddress, tokenId, price);
    await tx.wait();

    console.log("上架成功");

    // 创建拍卖
    console.log("---------2、创建拍卖---------");

    const startPrice = 500_000_000_000n;
    const durationHours = 2n * 60n * 60n;
    const tx1 = await auction.createAuction(nftAddress, tokenId, startPrice, durationHours);
    await tx1.wait();
    console.log("创建拍卖成功，拍卖ID为：",tx1);
    
    //  出价
    console.log("---------3、出价---------");
    const [ signer1 ] = await ethers.getSigners();
    const auction1 = ethers.getContractAt("Auctions", address, signer[1]);
    const tx2 = await auction1.placeBid(tx1,6000_000_000n);
    await tx2.wait();
    console.log("出价成功")



}

main().catch(console.error);