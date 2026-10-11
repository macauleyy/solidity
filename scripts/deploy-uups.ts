import hre from "hardhat";
import { upgrades } from "@openzeppelin/hardhat-upgrades";

async function main() {
  const connection = await hre.network.create();
  const { ethers } = connection;
  const upgradesApi = await upgrades(hre, connection);

  const Auction = await ethers.getContractFactory("Auctions");
  const auction = await upgradesApi.deployProxy(
    Auction,
    [process.env.OWNER_ADDRESS, 250n],
    { kind: "uups" }
  );

  await auction.waitForDeployment();
  console.log("Proxy address:", await auction.getAddress());
}

main().catch(console.error);