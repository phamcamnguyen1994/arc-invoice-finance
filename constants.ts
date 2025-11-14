
import { User } from './types';

const toAddress = (value?: string) => (value ? value.trim().toLowerCase() : '');

const {
  VITE_SME_ADDRESS_1,
  VITE_SME_ADDRESS_2,
  VITE_INVESTOR_ADDRESS_1,
  VITE_INVESTOR_ADDRESS_2,
  VITE_DEBTOR_ADDRESS_1,
  VITE_DEBTOR_ADDRESS_2,
  VITE_DEBTOR_ADDRESS_3,
} = import.meta.env;

export const USERS: User[] = [
  { id: 'smecorp-1', name: 'SME Corp A', type: 'SME', address: toAddress(VITE_SME_ADDRESS_1) },
  { id: 'smecorp-2', name: 'SME Corp B', type: 'SME', address: toAddress(VITE_SME_ADDRESS_2) },
  { id: 'investco-1', name: 'InvestCo', type: 'Investor', address: toAddress(VITE_INVESTOR_ADDRESS_1) },
  { id: 'richard-hendricks', name: 'Richard Hendricks', type: 'Investor', address: toAddress(VITE_INVESTOR_ADDRESS_2) },
  { id: 'debtor-x', name: 'Debtor X (for settlement)', type: 'Debtor', address: toAddress(VITE_DEBTOR_ADDRESS_1) }
];

export const DEBTORS: User[] = [
  { id: 'big-company-inc', name: 'Big Company Inc.', type: 'Debtor', address: toAddress(VITE_DEBTOR_ADDRESS_1) },
  { id: 'enterprise-llc', name: 'Enterprise LLC', type: 'Debtor', address: toAddress(VITE_DEBTOR_ADDRESS_2) },
  { id: 'global-ventures', name: 'Global Ventures', type: 'Debtor', address: toAddress(VITE_DEBTOR_ADDRESS_3) },
];

export const PROTOCOL_FEE_BPS = 200; // 2% to match deployed contract
export const FEE_RECIPIENT_ID = 'protocol-treasury';
export const GRACE_PERIOD_DAYS = 7;
