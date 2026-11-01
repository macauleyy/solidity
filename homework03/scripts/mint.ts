import { getNft } from "./helpers.js";

async function main() {
  const { nft } = await getNft();
  const uri = "https://raw.githubusercontent.com/用户名/仓库名/main/test.json";
  const mintPrice = await nft.mintPrice();

  const tx = await nft.mint(uri, { value: mintPrice });
  await tx.wait();

  console.log("铸造成功");
}

main().catch(console.error);