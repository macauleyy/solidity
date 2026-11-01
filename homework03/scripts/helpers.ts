import { network } from "hardhat";

export async function getNft() {
  const { ethers } = await network.create();
  const [signer] = await ethers.getSigners();

  const address = process.env.NFT_ADDRESS;
  if (!address || !ethers.isAddress(address)) {
    throw new Error("请在 .env 中设置有效的 NFT_ADDRESS");
  }

  const nft = await ethers.getContractAt("MyNFT", address, signer);

 
  return { ethers, signer, nft };
}

export async function getAuction() {
  const { ethers } = await network.create();
  const [signer] = await ethers.getSigners();

  const address = process.env.AUCTION_PROXY_ADDRESS;
  if (!address || !ethers.isAddress(address)) {
    throw new Error("请在 .env 中设置有效的 AUCTION_ADDRESS");
  }

  const auction = await ethers.getContractAt("Auctions", address, signer);
  return { ethers, signer, auction };
}
