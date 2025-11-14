import hardhat from "hardhat";

const { ethers } = hardhat;

const DEFAULT_USDC = "0x3600000000000000000000000000000000000000";
const DEFAULT_PROTOCOL_FEE_BPS = 200; // 2%

async function main() {
  const [deployer] = await ethers.getSigners();

  const feeRecipient = process.env.FEE_RECIPIENT ?? deployer.address;
  const protocolFeeBps =
    process.env.PROTOCOL_FEE_BPS !== undefined
      ? Number(process.env.PROTOCOL_FEE_BPS)
      : DEFAULT_PROTOCOL_FEE_BPS;
  const usdcAddress = process.env.USDC_ADDRESS ?? DEFAULT_USDC;

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Fee recipient:", feeRecipient);
  console.log("Protocol fee (bps):", protocolFeeBps);
  console.log("USDC token:", usdcAddress);

  const invoiceNftFactory = await ethers.getContractFactory("InvoiceNFT");
  const invoiceNft = await invoiceNftFactory.deploy(deployer.address);
  await invoiceNft.waitForDeployment();
  const invoiceNftAddress = await invoiceNft.getAddress();

  console.log("InvoiceNFT deployed at:", invoiceNftAddress);

  const marketplaceFactory = await ethers.getContractFactory("InvoiceMarketplace");
  const marketplace = await marketplaceFactory.deploy(
    deployer.address,
    usdcAddress,
    feeRecipient,
    invoiceNftAddress,
    protocolFeeBps
  );
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();

  console.log("InvoiceMarketplace deployed at:", marketplaceAddress);

  const minterRole = await invoiceNft.MINTER_ROLE();
  const marketplaceRole = await invoiceNft.MARKETPLACE_ROLE();

  await (await invoiceNft.grantRole(minterRole, marketplaceAddress)).wait();
  await (await invoiceNft.grantRole(marketplaceRole, marketplaceAddress)).wait();

  console.log("Granted marketplace contract minting and management roles on InvoiceNFT");

  console.log("Deployment complete. Remember to store:");
  console.log("  INVOICE_NFT_ADDRESS =", invoiceNftAddress);
  console.log("  INVOICE_MARKETPLACE_ADDRESS =", marketplaceAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


