import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("ERC20Module", (m) => {
  const Auction = m.contract("TestToken");
});
