
import React, { useMemo, useState } from 'react';
import { Button } from './ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/Card';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { DEBTORS } from '../constants';

interface CreateInvoiceFormProps {
  onCreate: (debtorAddress: string, faceValue: number, dueDate: Date) => Promise<void> | void;
  onFormSubmit: () => void;
}

export const CreateInvoiceForm: React.FC<CreateInvoiceFormProps> = ({ onCreate, onFormSubmit }) => {
  const [debtorAddress, setDebtorAddress] = useState<string>(DEBTORS.find(d => d.address)?.address || '');
  const [faceValue, setFaceValue] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const minDueDate = useMemo(() => {
    const now = new Date(Date.now() + 5 * 60 * 1000); // at least 5 minutes in the future
    return now.toISOString().slice(0, 16);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valueNum = parseFloat(faceValue);
    const date = new Date(dueDate);
    const debtor = debtorAddress.trim();

    if (!debtor || !debtor.startsWith('0x') || debtor.length < 10) {
      alert('Please provide a valid debtor wallet address (0x...).');
      return;
    }

    if (!Number.isFinite(valueNum) || valueNum <= 0) {
      alert('Face value must be greater than zero.');
      return;
    }

    if (isNaN(date.getTime()) || date <= new Date()) {
      alert('Due date must be in the future.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onCreate(debtor, valueNum, date);
      setFaceValue('');
      setDueDate('');
      onFormSubmit();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create a New Invoice</CardTitle>
          <CardDescription>
            Tokenize a new invoice on Arc testnet. Make sure your connected wallet matches the selected SME role.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="debtorAddress">Debtor Address (0x...)</Label>
              <Input
                id="debtorAddress"
                type="text"
                placeholder="0x..."
                value={debtorAddress}
                onChange={(e) => setDebtorAddress(e.target.value)}
                list="debtor-addresses"
                required
              />
              <datalist id="debtor-addresses">
                {DEBTORS.filter(d => d.address).map(d => (
                  <option key={d.id} value={d.address}>
                    {d.name}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="faceValue">Face Value (USDC)</Label>
              <Input
                id="faceValue"
                type="number"
                placeholder="e.g., 10000"
                value={faceValue}
                onChange={(e) => setFaceValue(e.target.value)}
                min="0.01"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date & Time</Label>
              <Input
                id="dueDate"
                type="datetime-local"
                value={dueDate}
                min={minDueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Invoice'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
