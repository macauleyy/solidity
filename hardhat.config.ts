import "dotenv/config";
import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatUpgrades from "@openzeppelin/hardhat-upgrades";


const sepoliaUrl = process.env.SEPOLIA_URL;
const privateKey = process.env.PRIVATE_KEY;
const bidderPrivateKey1 = process.env.BIDDER_PRIVATE_KEY1;
const bidderPrivateKey2 = process.env.BIDDER_PRIVATE_KEY2;


export default defineConfig({
  plugins: [hardhatToolboxMochaEthers, hardhatUpgrades],

  solidity: {
    version: "0.8.34",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },

  networks: {
    hardhat: {
      type: "edr-simulated",
      chainId: 31337,
    },
    ...(sepoliaUrl ? { sepolia: {
      type: "http",
      chainType: "l1",
      url: sepoliaUrl,
      accounts: [privateKey, bidderPrivateKey1, bidderPrivateKey2].filter(
        (key): key is string => Boolean(key),
      ),
      chainId: 11155111,
    } } : {}),
  },

  verify: {
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY || "",
    },
  },
});
