type EthereumEventHandler = (...args: unknown[]) => void;

interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: EthereumEventHandler) => void;
  removeListener?: (event: string, handler: EthereumEventHandler) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export {};

