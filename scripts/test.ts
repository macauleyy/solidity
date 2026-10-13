// import { getNft, getAuction } from "./helpers.js";
import { network } from "hardhat";

async function main() {

    const { ethers } = await network.create();
    const signer = await ethers.getSigners();

    const address = process.env.NFT_ADDRESS;
    if (!address || !ethers.isAddress(address)) {
        throw new Error("请在 .env 中设置有效的 NFT_ADDRESS");
    }
    const nft = await ethers.getContractAt("MyNFT", address, signer[0]);

    const address1 = process.env.AUCTION_PROXY_ADDRESS;
    if (!address1 || !ethers.isAddress(address1)) {
        throw new Error("请在 .env 中设置有效的 AUCTION_ADDRESS");
    }
    const auction = await ethers.getContractAt("Auctions", address1, signer[0]);

    // 铸造NFT
    // console.log("---------1、铸造NFT---------");

    // const uri = "https://raw.githubusercontent.com/用户名/仓库名/main/test.json";
    
    // const mintPrice = await nft.mintPrice();
    // const tx = await nft.mint(uri, { value: mintPrice });
    // const receipt = await tx.wait();

    // let tokenId: bigint | undefined;
    // for (const log of receipt!.logs) {
    //     try {
    //         const parsed = nft.interface.parseLog(log);

    //         if (parsed?.name === "NFTMinted") {
    //             tokenId = parsed.args[1];
    //             break;
    //         }
    //     } catch {
    //         // 忽略不属于 NFT 合约的日志
    //     }
    // }
    // if (tokenId === undefined) {
    // throw new Error("交易回执中没有找到 NFTMinted 事件");
    // }
    // console.log("铸造的 tokenId:", tokenId.toString());

    
    // // NFT上架，上架前需先授权
    // console.log("---------2、NFT上架---------");
    // // const tokenId = tx;
    // const nftAddress = await nft.getAddress();
    // const auctionAddress = await auction.getAddress();
    // const signerAddress = await signer[0].getAddress();

    // const owner = await nft.ownerOf(tokenId);
    // if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
    //     throw new Error(`当前 signer 不是 tokenId ${tokenId} 的所有者`);
    // }

    // const approvalTx = await nft.approve(auctionAddress, tokenId);
    // await approvalTx.wait();
    // console.log("NFT 授权给:", await nft.getApproved(tokenId));

    // const price = 500_000_000_000n;
    // const tx1 = await auction.listNFT(nftAddress, tokenId, price);
    // const receipt1 = await tx1.wait();
    // let listingId: bigint | undefined;

    // for (const log of receipt1!.logs) {
    //     try {
    //         const parsed = auction.interface.parseLog(log);

    //         if (parsed?.name === "NFTListed") {
    //             listingId = parsed.args[0];
    //             break;
    //         }
    //     } catch {
    //         // 忽略不属于 NFT 合约的日志
    //     }
    // }

    // if (listingId === undefined) {
    // throw new Error("交易回执中没有找到 NFTListed 事件");
    // }

    // console.log("上架的 listingId:", listingId.toString());

    // console.log("上架成功");

    // 创建拍卖
    // console.log("---------3、创建拍卖---------");

    // const startPrice = 500_000_000_000n;
    // const durationHours = 2n * 60n * 60n;
    // const tx2 = await auction.createAuction(nftAddress, tokenId, startPrice, durationHours);
    // const receipt2 = await tx2.wait();
    // let auctionCounter: bigint | undefined;

    // for (const log of receipt2!.logs) {
    //     try {
    //         const parsed = auction.interface.parseLog(log);

    //         if (parsed?.name === "AuctionCreated") {
    //             // 假设事件参数顺序是 address, uint256, string
    //             auctionCounter = parsed.args[0];
    //             break;
    //         }
    //     } catch {
    //         // 忽略不属于 NFT 合约的日志
    //     }
    // }

    // if (auctionCounter === undefined) {
    // throw new Error("交易回执中没有找到 NFTListed 事件");
    // }
    // console.log("创建拍卖成功，拍卖ID为：",auctionCounter);
    
    // //  出价
    // console.log("---------4、出价---------");
    
    const auction1 = await ethers.getContractAt("Auctions", address1, signer[1]);
    // const tx3 = await auction1.placeBid(auctionCounter,{value: 500_000_000_000n});
    // await tx3.wait();
    // console.log("用户1出价成功");

    const auction2 = await ethers.getContractAt("Auctions", address1, signer[2]);
    // const tx4 = await auction2.placeBid(auctionCounter,{value: 600_000_000_000n});
    // await tx4.wait();
    // console.log("用户2出价成功");


    // 结束拍卖
    console.log("---------5、结束拍卖---------");

    const end = await auction.endAuction(21n);
    end.wait();

    const newOwner = nft.ownerOf(34n);
    console.log("The new owner is:",21n);

    // 退款
    await auction1.withdrawBid(21n);
    console.log("用户1提现完成");

    await auction2.withdrawBid(21n);
    console.log("用户2提现完成");

}

main().catch(console.error);