
export enum InvoiceStatus {
  Draft = 'Draft',
  Listed = 'Listed',
  Funded = 'Funded',
  Settled = 'Settled',
  Defaulted = 'Defaulted',
  Cancelled = 'Cancelled',
}

export interface Invoice {
  id: number;
  issuer: string;
  owner: string;
  debtor: string;
  faceValue: number;
  dueDate: number;
  createdAt: number;
  status: InvoiceStatus;
  minPrice: number;
}

export interface User {
  id: string;
  name: string;
  type: 'SME' | 'Investor' | 'Debtor';
  address?: string;
}
