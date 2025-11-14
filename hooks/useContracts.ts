import { useMemo } from 'react';
import { Contract, FallbackProvider, JsonRpcProvider, Provider } from 'ethers';
import { useWeb3 } from '../contexts/Web3Context';
import { ARC_RPC_URL, ARC_RPC_URLS, CONTRACT_ADDRESSES } from '../config/contracts';
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

  const readProvider = useMemo(() => {
    const urls = (ARC_RPC_URLS.length ? ARC_RPC_URLS : [ARC_RPC_URL]).map(url => url.trim()).filter(Boolean);
    const createProvider = (url: string) =>
      new JsonRpcProvider(url, {
        chainId: 5_042_002,
        name: 'Arc Testnet',
      });
    if (urls.length <= 1) {
      return createProvider(urls[0] ?? ARC_RPC_URL);
    }
    const providers = urls.map((url, index) => ({
      provider: createProvider(url),
      priority: index + 1,
      weight: 1,
      stallTimeout: 250,
    }));
    return new FallbackProvider(providers, 1) as Provider;
  }, []);

  const baseProvider = useMemo(() => {
    if (signer) {
      return signer;
    }
    if (provider) {
      return provider;
    }
    return readProvider;
  }, [provider, readProvider, signer]);

  const marketplace = useMemo(() => {
    if (!CONTRACT_ADDRESSES.marketplace) {
      return undefined;
    }
    return new Contract(CONTRACT_ADDRESSES.marketplace, MARKETPLACE_ABI, baseProvider);
  }, [baseProvider]);

  const marketplaceRead = useMemo(() => {
    if (!CONTRACT_ADDRESSES.marketplace) {
      return undefined;
    }
    return new Contract(CONTRACT_ADDRESSES.marketplace, MARKETPLACE_ABI, readProvider);
  }, [readProvider]);

  const invoiceNft = useMemo(() => {
    if (!CONTRACT_ADDRESSES.invoiceNft) {
      return undefined;
    }
    return new Contract(CONTRACT_ADDRESSES.invoiceNft, INVOICE_NFT_ABI, baseProvider);
  }, [baseProvider]);

  const invoiceNftRead = useMemo(() => {
    if (!CONTRACT_ADDRESSES.invoiceNft) {
      return undefined;
    }
    return new Contract(CONTRACT_ADDRESSES.invoiceNft, INVOICE_NFT_ABI, readProvider);
  }, [readProvider]);

  const usdc = useMemo(() => {
    if (!usdcAddress) {
      return undefined;
    }
    return new Contract(usdcAddress, ERC20_ABI, baseProvider);
  }, [baseProvider, usdcAddress]);

  const usdcRead = useMemo(() => {
    if (!usdcAddress) {
      return undefined;
    }
    return new Contract(usdcAddress, ERC20_ABI, readProvider);
  }, [readProvider, usdcAddress]);

  return {
    marketplace,
    marketplaceRead,
    invoiceNft,
    invoiceNftRead,
    usdc,
    usdcRead,
    addresses: CONTRACT_ADDRESSES,
  };
};

