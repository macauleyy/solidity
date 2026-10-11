import hre from "hardhat";
import { upgrades } from "@openzeppelin/hardhat-upgrades";

async function main() {
  const proxyAddress = process.env.AUCTION_PROXY_ADDRESS;
  if (!proxyAddress) throw new Error("请设置 AUCTION_PROXY_ADDRESS");

  const connection = await hre.network.create();
  const { ethers } = connection;
  const upgradesApi = await upgrades(hre, connection);

  const AuctionsV2 = await ethers.getContractFactory("AuctionsV2");
  await upgradesApi.upgradeProxy(proxyAddress, AuctionsV2);

  console.log("升级完成，Proxy address:", proxyAddress);
}

main().catch(console.error);