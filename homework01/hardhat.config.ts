import { defineConfig } from "hardhat/config";

export default defineConfig({
  solidity: {
    version: "0.8.34",
    settings: {
      evmVersion: "cancun",
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
});
