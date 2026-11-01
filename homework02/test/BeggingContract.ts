import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("捐赠合约", function () {
  async function deployFixture() {
    const [owner, donor, other] = await ethers.getSigners();
    const begging = await ethers.deployContract("BeggingContract", [], owner);
    return { begging, owner, donor, other };
  }

  it("按捐赠者地址累计记录捐赠金额", async function () {
    const { begging, donor } = await deployFixture();
    const firstDonation = ethers.parseEther("0.25");
    const secondDonation = ethers.parseEther("0.75");

    await expect(begging.connect(donor).donate({ value: firstDonation }))
      .to.emit(begging, "Donated")
      .withArgs(donor.address, firstDonation);
    await begging.connect(donor).donate({ value: secondDonation });

    expect(await begging.getDonation(donor.address)).to.equal(
      firstDonation + secondDonation,
    );
    expect(await ethers.provider.getBalance(await begging.getAddress())).to.equal(
      firstDonation + secondDonation,
    );
  });

  it("拒绝金额为零的捐赠", async function () {
    const { begging, donor } = await deployFixture();
    await expect(begging.connect(donor).donate({ value: 0n })).to.be.revertedWithCustomError(
      begging,
      "ZeroDonation",
    );
  });

  it("仅允许所有者提取全部资金", async function () {
    const { begging, owner, donor, other } = await deployFixture();
    const donation = ethers.parseEther("1");
    await begging.connect(donor).donate({ value: donation });

    await expect(begging.connect(other).withdraw()).to.be.revertedWithCustomError(
      begging,
      "OnlyOwner",
    );

    const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
    const tx = await begging.connect(owner).withdraw();
    const receipt = await tx.wait();
    const gasCost = receipt!.gasUsed * receipt!.gasPrice;
    const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

    expect(ownerBalanceAfter - ownerBalanceBefore + gasCost).to.equal(donation);
    expect(await ethers.provider.getBalance(await begging.getAddress())).to.equal(0n);
    await expect(tx).to.emit(begging, "Withdrawn").withArgs(owner.address, donation);
  });

  it("没有可提取资金时拒绝提款", async function () {
    const { begging, owner } = await deployFixture();
    await expect(begging.connect(owner).withdraw()).to.be.revertedWithCustomError(
      begging,
      "NoFundsToWithdraw",
    );
  });
});
