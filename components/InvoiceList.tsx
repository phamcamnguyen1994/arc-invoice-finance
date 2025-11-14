
import React from 'react';
import { Invoice } from '../types';
import { InvoiceCard } from './InvoiceCard';

interface InvoiceListProps {
  title: string;
  invoices: Invoice[];
  walletAddress?: string;
  getInvoice: (id: number) => Invoice | undefined;
  onBuy?: (invoiceId: number) => void;
  onList?: (invoiceId: number, minPrice: number) => void;
  onSettle?: (invoiceId: number) => void;
  onMarkDefaulted?: (invoiceId: number) => void;
}

export const InvoiceList: React.FC<InvoiceListProps> = ({ title, invoices, walletAddress, ...actions }) => {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-6">{title}</h1>
      {invoices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {invoices.map(invoice => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              walletAddress={walletAddress}
              {...actions}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 px-6 bg-card border border-border rounded-lg">
          <p className="text-muted-foreground">No invoices to display.</p>
        </div>
      )}
    </div>
  );
};
