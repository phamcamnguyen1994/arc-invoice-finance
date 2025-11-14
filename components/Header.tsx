
import React, { useMemo } from 'react';
import { formatCurrency } from '../utils';
import { useWeb3 } from '../contexts/Web3Context';

interface HeaderProps {
  balance: number;
  activeTab: string;
  onTabChange: (tab: 'marketplace' | 'portfolio' | 'create') => void;
}

const WalletIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2 text-muted-foreground"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
);

const LogoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
);


export const Header: React.FC<HeaderProps> = ({ balance, activeTab, onTabChange }) => {
  const { address, connect, disconnect, isConnecting, hasProvider, network, error } = useWeb3();

  const accountLabel = useMemo(() => {
    if (!address) {
      return 'Wallet Disconnected';
    }
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }, [address]);

  const networkLabel = useMemo(() => {
    if (!network) {
      return 'Unknown Network';
    }
    return `${network.name} (${network.chainId})`;
  }, [network]);

  const NavButton: React.FC<{tab: 'marketplace' | 'portfolio' | 'create', label: string}> = ({tab, label}) => {
    const isActive = activeTab === tab;
    return (
        <button 
            onClick={() => onTabChange(tab)}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}>
                {label}
        </button>
    );
  }

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
                <LogoIcon />
                <span className="font-bold text-lg">Arc Invoice Finance</span>
            </div>
            <nav className="hidden md:flex items-center space-x-2">
                <NavButton tab="marketplace" label="Marketplace" />
                <NavButton tab="portfolio" label="My Portfolio" />
                <NavButton tab="create" label="Create Invoice" />
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex flex-col items-end">
              <div className="flex items-center bg-secondary px-3 py-2 rounded-md">
                <WalletIcon />
                <span className="text-sm font-medium text-foreground">{formatCurrency(balance)}</span>
              </div>
              <span className="text-xs text-muted-foreground mt-1">USDC balance</span>
            </div>

            <div className="flex flex-col items-end">
              <button
                onClick={() => (address ? disconnect() : connect())}
                disabled={isConnecting || (!hasProvider && !address)}
                className="px-3 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {address
                  ? 'Disconnect'
                  : !hasProvider
                    ? 'Install Wallet'
                    : isConnecting
                      ? 'Connecting...'
                      : 'Connect Wallet'}
              </button>
              <span className="text-xs text-muted-foreground mt-1">
                {address ? accountLabel : 'No wallet connected'}
              </span>
              {address && (
                <span className="text-xs text-muted-foreground">{networkLabel}</span>
              )}
              {!address && !hasProvider && (
                <span className="text-xs text-destructive mt-1">No EVM provider detected</span>
              )}
              {error && hasProvider && (
                <span className="text-xs text-destructive mt-1">{error}</span>
              )}
            </div>
          </div>
        </div>
        {/* Mobile Nav */}
        <div className="md:hidden flex items-center justify-center space-x-2 border-t border-border pt-2 pb-3">
             <NavButton tab="marketplace" label="Marketplace" />
             <NavButton tab="portfolio" label="Portfolio" />
            <NavButton tab="create" label="Create" />
        </div>
      </div>
    </header>
  );
};
