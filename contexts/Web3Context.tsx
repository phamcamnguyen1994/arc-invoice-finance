import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { BrowserProvider, JsonRpcSigner, Network } from 'ethers';

const ARC_CHAIN_ID = 5_042_002;
const ARC_CHAIN_HEX = '0x4cef52';
const ARC_NETWORK_PARAMS = {
  chainId: ARC_CHAIN_HEX,
  chainName: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
  },
  rpcUrls: [
    'https://rpc.testnet.arc.network',
    'https://rpc.blockdaemon.testnet.arc.network',
    'https://rpc.drpc.testnet.arc.network',
    'https://rpc.quicknode.testnet.arc.network',
  ],
  blockExplorerUrls: ['https://testnet.arcscan.app'],
};

type Web3ContextValue = {
  provider?: BrowserProvider;
  signer?: JsonRpcSigner;
  address?: string;
  network?: Network;
  isConnecting: boolean;
  error?: string;
  hasProvider: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
};

const Web3Context = createContext<Web3ContextValue | undefined>(undefined);

const createProvider = () => {
  if (typeof window === 'undefined' || !window.ethereum) {
    return undefined;
  }
  return new BrowserProvider(window.ethereum, 'any');
};

export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [provider, setProvider] = useState<BrowserProvider | undefined>(() => createProvider());
  const [signer, setSigner] = useState<JsonRpcSigner | undefined>();
  const [address, setAddress] = useState<string | undefined>();
  const [network, setNetwork] = useState<Network | undefined>();
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>();

  const hasProvider = typeof window !== 'undefined' && !!window.ethereum;

  const ensureArcNetwork = useCallback(async () => {
    if (!window.ethereum) {
      return false;
    }
    try {
      const chainId = (await window.ethereum.request({ method: 'eth_chainId' })) as string;
      if (chainId?.toLowerCase() === ARC_CHAIN_HEX) {
        return true;
      }
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ARC_CHAIN_HEX }],
      });
      return true;
    } catch (switchError) {
      const errorCode = (switchError as { code?: number })?.code;
      if (errorCode === 4902 || errorCode === -32603) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [ARC_NETWORK_PARAMS],
          });
          return true;
        } catch (addError) {
          console.error('Failed to add Arc testnet to wallet', addError);
          return false;
        }
      }
      console.warn('Unable to switch to Arc testnet', switchError);
      return false;
    }
  }, []);

  const resetConnection = useCallback(() => {
    setSigner(undefined);
    setAddress(undefined);
    setNetwork(undefined);
  }, []);

  const hydrateSigner = useCallback(
    async (providerInstance: BrowserProvider) => {
      try {
        const signerInstance = await providerInstance.getSigner();
        const signerAddress = await signerInstance.getAddress();
        const networkInfo = await providerInstance.getNetwork();
        setSigner(signerInstance);
        setAddress(signerAddress);
        setNetwork(networkInfo);
        setError(undefined);
      } catch (err) {
        resetConnection();
        setError(err instanceof Error ? err.message : 'Failed to access wallet signer');
      }
    },
    [resetConnection],
  );

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('No EVM wallet detected. Please install MetaMask or compatible provider.');
      return;
    }
    setIsConnecting(true);
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const networkReady = await ensureArcNetwork();
      if (!networkReady) {
        setError('Please approve Arc Testnet in your wallet to continue.');
        return;
      }
      const providerInstance = createProvider();
      if (!providerInstance) {
        throw new Error('Unable to create provider from injected wallet.');
      }
      setProvider(providerInstance);
      await hydrateSigner(providerInstance);
    } catch (err) {
      resetConnection();
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  }, [ensureArcNetwork, hydrateSigner, resetConnection]);

  const disconnect = useCallback(() => {
    resetConnection();
    setError(undefined);
  }, [resetConnection]);

  useEffect(() => {
    if (!window.ethereum || !window.ethereum.on) {
      return;
    }

    const handleAccountsChanged = async (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        resetConnection();
        return;
      }
      if (!provider) {
        const providerInstance = createProvider();
        if (providerInstance) {
          setProvider(providerInstance);
          await hydrateSigner(providerInstance);
        }
        return;
      }
      await hydrateSigner(provider);
    };

    const handleChainChanged = async () => {
      const providerInstance = createProvider();
      if (providerInstance) {
        setProvider(providerInstance);
        await hydrateSigner(providerInstance);
      } else {
        resetConnection();
      }
    };

    const handleDisconnect = () => {
      disconnect();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('disconnect', handleDisconnect);

    return () => {
      window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener?.('chainChanged', handleChainChanged);
      window.ethereum?.removeListener?.('disconnect', handleDisconnect);
    };
  }, [provider, hydrateSigner, resetConnection, disconnect]);

  // Attempt to hydrate existing wallet session on mount (if accounts already authorized)
  useEffect(() => {
    const initialize = async () => {
      if (!window.ethereum) {
        return;
      }
      try {
        const accounts = (await window.ethereum.request({
          method: 'eth_accounts',
        })) as string[];
        if (accounts && accounts.length > 0) {
          await ensureArcNetwork();
          const providerInstance = createProvider();
          if (providerInstance) {
            setProvider(providerInstance);
            await hydrateSigner(providerInstance);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to initialize wallet session');
      }
    };
    initialize();
  }, [ensureArcNetwork, hydrateSigner]);

  const value = useMemo(
    () => ({
      provider,
      signer,
      address,
      network,
      isConnecting,
      error,
      hasProvider,
      connect,
      disconnect,
    }),
    [address, connect, disconnect, error, hasProvider, isConnecting, network, provider, signer],
  );

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
};

export const useWeb3 = (): Web3ContextValue => {
  const ctx = useContext(Web3Context);
  if (!ctx) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return ctx;
};


