import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AuctionModule", (m) => {
  const Auction = m.contract("Auctions",["0x6689DE8C741FA1C8471B12D04B53F196A72C357D"]);
});
