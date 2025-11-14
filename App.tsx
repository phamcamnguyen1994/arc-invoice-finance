
import React, { useMemo, useState } from 'react';
import { Header } from './components/Header';
import { InvoiceList } from './components/InvoiceList';
import { CreateInvoiceForm } from './components/CreateInvoiceForm';
import { useInvoiceData } from './hooks/useInvoiceData';
import { InvoiceStatus } from './types';
import { useWeb3 } from './contexts/Web3Context';
import { WorkflowTimeline } from './components/WorkflowTimeline';

type Tab = 'marketplace' | 'portfolio' | 'create';

const App: React.FC = () => {
  const { 
    invoices, 
    balances, 
    createInvoice, 
    listInvoice, 
    buyInvoice, 
    settleInvoice,
    markDefaulted,
    getInvoice
  } = useInvoiceData();
  const [activeTab, setActiveTab] = useState<Tab>('marketplace');
  const { address: walletAddress } = useWeb3();
  const [showWorkflow, setShowWorkflow] = useState(false);

  const currentUserAddress = useMemo(
    () => walletAddress?.toLowerCase() || '',
    [walletAddress],
  );

  const marketplaceInvoices = useMemo(() => {
    return invoices.filter(inv => inv.status === InvoiceStatus.Listed);
  }, [invoices]);

  const portfolioInvoices = useMemo(() => {
    if (!currentUserAddress) {
      return [];
    }
    return invoices.filter(inv => 
      inv.issuer === currentUserAddress ||
      inv.owner === currentUserAddress ||
      inv.debtor === currentUserAddress
    );
  }, [invoices, currentUserAddress]);

  const renderContent = () => {
    switch (activeTab) {
      case 'marketplace':
        return (
          <InvoiceList
            title="Marketplace"
            invoices={marketplaceInvoices}
            walletAddress={currentUserAddress}
            onBuy={buyInvoice}
            getInvoice={getInvoice}
          />
        );
      case 'portfolio':
        return (
          <InvoiceList
            title="My Portfolio"
            invoices={portfolioInvoices}
            walletAddress={currentUserAddress}
            onList={listInvoice}
            onSettle={settleInvoice}
            onMarkDefaulted={markDefaulted}
            getInvoice={getInvoice}
          />
        );
      case 'create':
        return (
          <CreateInvoiceForm
            onCreate={createInvoice}
            onFormSubmit={() => setActiveTab('portfolio')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Header
        balance={balances[currentUserAddress] || 0}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <main className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex justify-end">
          <button
            onClick={() => setShowWorkflow(prev => !prev)}
            className="px-3 py-2 text-sm font-medium border border-border rounded-md hover:bg-secondary transition-colors"
          >
            {showWorkflow ? 'Hide workflow' : 'Show workflow'}
          </button>
        </div>
        {showWorkflow && <WorkflowTimeline />}
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
