import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("Counter", function () {
  it("Should emit the Increment event when calling the inc() function", async function () {
    const counter = await ethers.deployContract("Counter");

    await expect(counter.inc()).to.emit(counter, "Increment").withArgs(1n);
  });

  it("The sum of the Increment events should match the current value", async function () {
    const counter = await ethers.deployContract("Counter");
    const deploymentBlockNumber = await ethers.provider.getBlockNumber();

    // 连续执行多次递增操作
    for (let i = 1; i <= 10; i++) {
      await counter.incBy(i);
    }

    const events = await counter.queryFilter(
      counter.filters.Increment(),
      deploymentBlockNumber,
      "latest",
    );

    // 汇总事件中的递增量，并与合约当前值进行核对
    let total = 0n;
    for (const event of events) {
      total += event.args.by;
    }

    expect(await counter.x()).to.equal(total);
  });
});
