const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

const FACE_VALUE = 10_000n * 10n ** 6n;
const MIN_PRICE = 9_800n * 10n ** 6n;
const PROTOCOL_FEE_BPS = 200;

const InvoiceNFTStatus = {
  Draft: 0,
  Listed: 1,
  Funded: 2,
  Settled: 3,
  Defaulted: 4,
  Cancelled: 5,
};

async function deployFixture() {
  const [deployer, sme, investor, debtor] = await ethers.getSigners();

  const usdc = await ethers.deployContract("TestUSDC");
  const invoiceNft = await ethers.deployContract("InvoiceNFT", [deployer.address]);
  const marketplace = await ethers.deployContract("InvoiceMarketplace", [
    deployer.address,
    await usdc.getAddress(),
    deployer.address,
    await invoiceNft.getAddress(),
    PROTOCOL_FEE_BPS,
  ]);

  const minterRole = await invoiceNft.MINTER_ROLE();
  const marketplaceRole = await invoiceNft.MARKETPLACE_ROLE();
  await invoiceNft.grantRole(minterRole, await marketplace.getAddress());
  await invoiceNft.grantRole(marketplaceRole, await marketplace.getAddress());

  await usdc.mint(investor.address, 20_000n * 10n ** 6n);
  await usdc.mint(debtor.address, 20_000n * 10n ** 6n);

  return { deployer, sme, investor, debtor, usdc, invoiceNft, marketplace };
}

describe("InvoiceMarketplace", function () {
  it("creates invoice NFT for SME", async function () {
    const { sme, debtor, invoiceNft, marketplace } = await loadFixture(deployFixture);

    const dueDate = (await time.latest()) + 60 * 24 * 60 * 60;
    await expect(
      marketplace.connect(sme).createInvoice(debtor.address, FACE_VALUE, dueDate, "ipfs://invoice1"),
    )
      .to.emit(invoiceNft, "InvoiceMinted")
      .withArgs(1, sme.address, debtor.address);

    expect(await invoiceNft.ownerOf(1)).to.equal(sme.address);
    const stored = await invoiceNft.invoiceData(1);
    expect(stored.issuer).to.equal(sme.address);
    expect(stored.debtor).to.equal(debtor.address);
    expect(stored.faceValue).to.equal(FACE_VALUE);
  });

  it("allows listing, buying, and settlement flow", async function () {
    const { sme, investor, debtor, usdc, invoiceNft, marketplace, deployer } = await loadFixture(deployFixture);

    const dueDate = (await time.latest()) + 60 * 24 * 60 * 60;
    await marketplace.connect(sme).createInvoice(debtor.address, FACE_VALUE, dueDate, "ipfs://invoice2");

    await invoiceNft.connect(sme).setApprovalForAll(await marketplace.getAddress(), true);
    await expect(marketplace.connect(sme).listInvoice(1, MIN_PRICE))
      .to.emit(marketplace, "InvoiceListed")
      .withArgs(1, sme.address, MIN_PRICE);

    expect(await invoiceNft.ownerOf(1)).to.equal(await marketplace.getAddress());

    await usdc.connect(investor).approve(await marketplace.getAddress(), MIN_PRICE);
    const sellerBalanceBefore = await usdc.balanceOf(sme.address);
    const feeBalanceBefore = await usdc.balanceOf(deployer.address);

    await expect(marketplace.connect(investor).buyInvoice(1))
      .to.emit(marketplace, "InvoicePurchased")
      .withArgs(1, investor.address, MIN_PRICE, (MIN_PRICE * BigInt(PROTOCOL_FEE_BPS)) / 10_000n);

    const sellerProceeds = MIN_PRICE - (MIN_PRICE * BigInt(PROTOCOL_FEE_BPS)) / 10_000n;
    expect(await usdc.balanceOf(sme.address)).to.equal(sellerBalanceBefore + sellerProceeds);
    expect(await usdc.balanceOf(deployer.address)).to.equal(
      feeBalanceBefore + (MIN_PRICE * BigInt(PROTOCOL_FEE_BPS)) / 10_000n,
    );
    expect(await invoiceNft.ownerOf(1)).to.equal(investor.address);

    await usdc.connect(debtor).approve(await marketplace.getAddress(), FACE_VALUE);
    const investorBalanceBefore = await usdc.balanceOf(investor.address);

    await expect(marketplace.connect(debtor).settleInvoice(1))
      .to.emit(marketplace, "InvoiceSettled")
      .withArgs(1, debtor.address, FACE_VALUE, (FACE_VALUE * BigInt(PROTOCOL_FEE_BPS)) / 10_000n);

    const investorPayout = FACE_VALUE - (FACE_VALUE * BigInt(PROTOCOL_FEE_BPS)) / 10_000n;
    expect(await usdc.balanceOf(investor.address)).to.equal(investorBalanceBefore + investorPayout);

    const invoiceData = await invoiceNft.invoiceData(1);
    expect(invoiceData.status).to.equal(InvoiceNFTStatus.Settled);
  });

  it("allows admin to mark defaulted", async function () {
    const { sme, investor, deployer, debtor, usdc, invoiceNft, marketplace } = await loadFixture(deployFixture);

    const dueDate = (await time.latest()) + 60 * 24 * 60 * 60;
    await marketplace.connect(sme).createInvoice(debtor.address, FACE_VALUE, dueDate, "ipfs://invoice3");
    await invoiceNft.connect(sme).setApprovalForAll(await marketplace.getAddress(), true);
    await marketplace.connect(sme).listInvoice(1, MIN_PRICE);
    await usdc.connect(investor).approve(await marketplace.getAddress(), MIN_PRICE);
    await marketplace.connect(investor).buyInvoice(1);

    await expect(marketplace.connect(deployer).markDefaulted(1))
      .to.emit(marketplace, "InvoiceDefaulted")
      .withArgs(1, deployer.address);

    const invoiceData = await invoiceNft.invoiceData(1);
    expect(invoiceData.status).to.equal(InvoiceNFTStatus.Defaulted);
  });
});

