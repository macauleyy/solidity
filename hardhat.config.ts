import "dotenv/config";
import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatUpgrades from "@openzeppelin/hardhat-upgrades";


const sepoliaUrl = process.env.SEPOLIA_URL;
const privateKey = process.env.PRIVATE_KEY;
const bidderPrivateKey = process.env.BIDDER_PRIVATE_KEY;

if (!sepoliaUrl) {
  throw new Error("Missing SEPOLIA_URL in .env");
}

if (!privateKey) {
  throw new Error("Missing PRIVATE_KEY in .env");
}

// if (!privateKey) {
//   throw new Error("Missing PRIVATE_KEY in .env");
// }
export default defineConfig({
  plugins: [hardhatToolboxMochaEthers, hardhatUpgrades],

  solidity: {
    version: "0.8.34",
    settings: {
      evmVersion: "cancun",
    },
  },

  networks: {
    hardhat: {
      type: "edr-simulated",
      chainId: 31337,
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: process.env.SEPOLIA_URL,
      accounts: [privateKey,bidderPrivateKey],
      chainId: 11155111,
    },
  },

  verify: {
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY || "",
    },
  },
});