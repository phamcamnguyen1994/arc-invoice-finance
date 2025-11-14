
import React, { useMemo, useState } from 'react';
import { Invoice, InvoiceStatus } from '../types';
import { DEBTORS } from '../constants';
import { formatCurrency, formatDate, calculateYield, getDaysRemaining } from '../utils';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/Card';
import { Tag } from './ui/Tag';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Label } from './ui/Label';

interface InvoiceCardProps {
  invoice: Invoice;
  walletAddress?: string;
  getInvoice?: (id: number) => Invoice | undefined;
  onBuy?: (invoiceId: number) => void;
  onList?: (invoiceId: number, minPrice: number) => void;
  onSettle?: (invoiceId: number) => void;
  onMarkDefaulted?: (invoiceId: number) => void;
}

const statusColors: Record<InvoiceStatus, string> = {
  [InvoiceStatus.Draft]: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  [InvoiceStatus.Listed]: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  [InvoiceStatus.Funded]: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  [InvoiceStatus.Settled]: 'bg-green-500/20 text-green-400 border-green-500/30',
  [InvoiceStatus.Defaulted]: 'bg-red-500/20 text-red-400 border-red-500/30',
  [InvoiceStatus.Cancelled]: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

const normalize = (value?: string) => (value ? value.toLowerCase() : '');

export const InvoiceCard: React.FC<InvoiceCardProps> = ({
  invoice,
  walletAddress,
  onBuy,
  onList,
  onSettle,
  onMarkDefaulted,
}) => {
  const [isListModalOpen, setListModalOpen] = useState(false);
  const [listingPrice, setListingPrice] = useState<string>('');

  const normalizedUserAddress = normalize(walletAddress);
  const isOwner = normalizedUserAddress && invoice.owner === normalizedUserAddress;
  const isDebtor = normalizedUserAddress && invoice.debtor === normalizedUserAddress;

  const debtor = useMemo(() => {
    return (
      DEBTORS.find(d => normalize(d.address) === invoice.debtor || d.id === invoice.debtor) ?? {
        name: invoice.debtor ? `${invoice.debtor.slice(0, 6)}…${invoice.debtor.slice(-4)}` : 'Unknown Debtor',
      }
    );
  }, [invoice.debtor]);

  const daysRemaining = getDaysRemaining(invoice.dueDate);
  const annualizedYield = calculateYield(invoice.faceValue, invoice.minPrice, invoice.dueDate);

  const handleListSubmit = () => {
    if (onList && listingPrice) {
      const price = parseFloat(listingPrice);
      if (!isNaN(price) && price > 0 && price < invoice.faceValue) {
        onList(invoice.id, price);
        setListModalOpen(false);
        setListingPrice('');
      } else {
        alert('Please enter a valid price that is less than the face value.');
      }
    }
  };

  const isDue = Date.now() >= invoice.dueDate;
  const canDefault = Date.now() > invoice.dueDate + 7 * 24 * 60 * 60 * 1000;

  const renderActions = () => {
    switch (invoice.status) {
      case InvoiceStatus.Draft:
        if (isOwner) {
          return <Button onClick={() => setListModalOpen(true)}>List for Sale</Button>;
        }
        return null;
      case InvoiceStatus.Listed:
        if (!isOwner && normalizedUserAddress && invoice.minPrice > 0) {
          return <Button onClick={() => onBuy && onBuy(invoice.id)}>Buy for {formatCurrency(invoice.minPrice)}</Button>;
        }
        return null;
      case InvoiceStatus.Funded:
        if (isDebtor) {
          if (isDue && !canDefault) {
            return <Button onClick={() => onSettle && onSettle(invoice.id)}>Settle Invoice</Button>;
          }
          if (canDefault) {
            return (
              <Button variant="destructive" onClick={() => onMarkDefaulted && onMarkDefaulted(invoice.id)}>
                Mark as Default
              </Button>
            );
          }
        }
        return null;
      default:
        return null;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Invoice #{invoice.id}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">From: {debtor?.name || 'Unknown Debtor'}</p>
            </div>
            <Tag color={statusColors[invoice.status]}>{invoice.status}</Tag>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Face Value</p>
            <p className="text-3xl font-bold">{formatCurrency(invoice.faceValue)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground">Asking Price</p>
              <p className="font-medium">{invoice.minPrice > 0 ? formatCurrency(invoice.minPrice) : 'N/A'}</p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-muted-foreground">Due Date</p>
              <p className="font-medium">{formatDate(invoice.dueDate)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Yield (APR)</p>
              <p className="font-medium text-green-400">
                {invoice.status === InvoiceStatus.Listed && invoice.minPrice > 0 ? `${annualizedYield.toFixed(2)}%` : 'N/A'}
              </p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-muted-foreground">Days Left</p>
              <p className="font-medium">{daysRemaining}</p>
            </div>
          </div>
        </CardContent>
        <CardFooter>{renderActions()}</CardFooter>
      </Card>

      <Modal isOpen={isListModalOpen} onClose={() => setListModalOpen(false)} title={`List Invoice #${invoice.id}`}>
        <div className="space-y-4">
          <p>Set the "buy now" price for this invoice. You will receive this amount minus protocol fees.</p>
          <div className="flex justify-between p-2 bg-secondary rounded-md">
            <span className="text-muted-foreground">Face Value:</span>
            <span className="font-bold">{formatCurrency(invoice.faceValue)}</span>
          </div>
          <div>
            <Label htmlFor="listingPrice">Asking Price (USDC)</Label>
            <Input
              id="listingPrice"
              type="number"
              placeholder="e.g., 9800"
              value={listingPrice}
              onChange={e => setListingPrice(e.target.value)}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="secondary" onClick={() => setListModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleListSubmit}>List Invoice</Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
