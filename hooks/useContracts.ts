import { useMemo } from 'react';
import { Contract, JsonRpcProvider } from 'ethers';
import { useWeb3 } from '../contexts/Web3Context';
import { ARC_RPC_URL, CONTRACT_ADDRESSES } from '../config/contracts';
import marketplaceArtifact from '../artifacts/contracts/InvoiceMarketplace.sol/InvoiceMarketplace.json';
import invoiceNftArtifact from '../artifacts/contracts/InvoiceNFT.sol/InvoiceNFT.json';

type MinimalArtifact = {
  abi: unknown[];
};

const MARKETPLACE_ABI = (marketplaceArtifact as MinimalArtifact).abi;
const INVOICE_NFT_ABI = (invoiceNftArtifact as MinimalArtifact).abi;
const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

const DEFAULT_USDC_ADDRESS = '0x3600000000000000000000000000000000000000';

export const useContracts = () => {
  const { signer, provider } = useWeb3();
  const usdcAddress = CONTRACT_ADDRESSES.usdc || DEFAULT_USDC_ADDRESS;

  const baseProvider = useMemo(() => {
    if (signer) {
      return signer;
    }
    if (provider) {
      return provider;
    }
    return new JsonRpcProvider(ARC_RPC_URL, {
      chainId: 5_042_002,
      name: 'Arc Testnet',
    });
  }, [provider, signer]);

  const marketplace = useMemo(() => {
    if (!CONTRACT_ADDRESSES.marketplace) {
      return undefined;
    }
    return new Contract(CONTRACT_ADDRESSES.marketplace, MARKETPLACE_ABI, baseProvider);
  }, [baseProvider]);

  const invoiceNft = useMemo(() => {
    if (!CONTRACT_ADDRESSES.invoiceNft) {
      return undefined;
    }
    return new Contract(CONTRACT_ADDRESSES.invoiceNft, INVOICE_NFT_ABI, baseProvider);
  }, [baseProvider]);

  const usdc = useMemo(() => {
    if (!usdcAddress) {
      return undefined;
    }
    return new Contract(usdcAddress, ERC20_ABI, baseProvider);
  }, [baseProvider, usdcAddress]);

  return {
    marketplace,
    invoiceNft,
    usdc,
    addresses: CONTRACT_ADDRESSES,
  };
};

