import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("NFTModule", (m) => {
  const nft = m.contract("MyNFT");
  m.call(
    nft,
    "mint",
    ["https://raw.githubusercontent.com/macauleyy/solidity/refs/heads/main/test.json"],
    { value: 10_000_000_000_000_000n }
  );
  return {nft};
});
