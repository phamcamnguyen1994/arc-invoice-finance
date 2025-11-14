
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Invoice, InvoiceStatus } from '../types';
import { useContracts } from './useContracts';
import { useWeb3 } from '../contexts/Web3Context';

const USDC_DECIMALS = 6;
const DECIMAL_FACTOR = 10 ** USDC_DECIMALS;

const statusMap: Record<number, InvoiceStatus> = {
  0: InvoiceStatus.Draft,
  1: InvoiceStatus.Listed,
  2: InvoiceStatus.Funded,
  3: InvoiceStatus.Settled,
  4: InvoiceStatus.Defaulted,
  5: InvoiceStatus.Cancelled,
};

const toTokenUnits = (value: number): bigint => {
  if (!Number.isFinite(value)) {
    throw new Error('Invalid token amount');
  }
  return BigInt(Math.round(value * DECIMAL_FACTOR));
};

const fromTokenUnits = (value: bigint): number => Number(value) / DECIMAL_FACTOR;

const normalizeAddress = (value?: string | null): string => (value ? value.toLowerCase() : '');

export const useInvoiceData = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { marketplace, invoiceNft, usdc, addresses } = useContracts();
  const { address: walletAddress } = useWeb3();
  const hasLoggedContracts = useRef(false);

  const marketplaceAddressPromise = useMemo(async () => {
    if (!marketplace) return undefined;
    return marketplace.getAddress();
  }, [marketplace]);

  const fetchBalances = useCallback(
    async (accountAddresses: Set<string>) => {
      if (!usdc || accountAddresses.size === 0) {
        return;
      }
      try {
        const entries = await Promise.all(
          Array.from(accountAddresses)
            .filter(addr => !!addr)
            .map(async addr => {
              try {
                const balance: bigint = await usdc.balanceOf(addr);
                return [addr, fromTokenUnits(balance)] as const;
              } catch (error) {
                console.warn(`Failed to fetch balance for ${addr}`, error);
                return [addr, 0] as const;
              }
            }),
        );
        setBalances(prev => ({
          ...prev,
          ...Object.fromEntries(entries),
        }));
      } catch (error) {
        console.error('Failed to fetch balances', error);
      }
    },
    [usdc],
  );

  const fetchInvoices = useCallback(async () => {
    if (!invoiceNft) {
      return;
    }
    setIsLoading(true);
    try {
      let latestId = 0;
      try {
        latestId = Number(await invoiceNft.latestInvoiceId());
      } catch (error) {
        console.warn('Unable to read latest invoice id', error);
      }
      const invoicesFromChain = await Promise.all(
        Array.from({ length: latestId }, (_, index) => index + 1).map(async invoiceId => {
          try {
            const data = await invoiceNft.invoiceData(invoiceId);
            const ownerAddress = normalizeAddress(await invoiceNft.ownerOf(invoiceId));
            const statusNumeric = Number(data.status ?? 0);
            const status = statusMap[statusNumeric] ?? InvoiceStatus.Draft;

            let minPrice = 0;
            if (status === InvoiceStatus.Listed && marketplace?.listings) {
              try {
                const listing = await marketplace.listings(invoiceId);
                if (listing?.active) {
                  minPrice = fromTokenUnits(BigInt(listing.minPrice));
                }
              } catch (error) {
                console.warn(`Unable to read listing for invoice ${invoiceId}`, error);
              }
            }

            return {
              id: invoiceId,
              issuer: normalizeAddress(data.issuer),
              owner: ownerAddress,
              debtor: normalizeAddress(data.debtor),
              faceValue: fromTokenUnits(BigInt(data.faceValue)),
              dueDate: Number(data.dueDate) * 1000,
              createdAt: Number(data.createdAt) * 1000,
              status,
              minPrice,
            } satisfies Invoice;
          } catch (error) {
            return undefined;
          }
        }),
      );

      setInvoices(invoicesFromChain.filter((inv): inv is Invoice => !!inv));

      const addressesToTrack = new Set<string>();
      invoicesFromChain.forEach(invoice => {
        addressesToTrack.add(invoice.issuer);
        addressesToTrack.add(invoice.owner);
        addressesToTrack.add(invoice.debtor);
      });
      if (walletAddress) {
        addressesToTrack.add(normalizeAddress(walletAddress));
      }
      await fetchBalances(addressesToTrack);
    } catch (error) {
      console.error('Failed to fetch invoices from chain', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchBalances, invoiceNft, marketplace, walletAddress]);

  useEffect(() => {
    if (marketplace && invoiceNft && !hasLoggedContracts.current) {
      console.info(
        '[contracts] Connected to marketplace %s and invoice NFT %s',
        addresses.marketplace,
        addresses.invoiceNft,
      );
      hasLoggedContracts.current = true;
    }
    if (marketplace && invoiceNft) {
      void fetchInvoices();
    }
  }, [addresses.invoiceNft, addresses.marketplace, fetchInvoices, invoiceNft, marketplace]);

  const getInvoice = useCallback(
    (id: number): Invoice | undefined => invoices.find(inv => inv.id === id),
    [invoices],
  );

  const createInvoice = useCallback(
    async (debtorAddress: string, faceValue: number, dueDate: Date) => {
      if (!marketplace) {
        alert('Marketplace contract is not available.');
        return;
      }
      if (!walletAddress) {
        alert('Please connect your wallet first.');
        return;
      }
      const normalizedDebtor = normalizeAddress(debtorAddress);
      if (!normalizedDebtor) {
        alert('Debtor address is required.');
        return;
      }
      if (!Number.isFinite(faceValue) || faceValue <= 0) {
        alert('Face value must be greater than zero.');
        return;
      }
      const dueDateSeconds = Math.floor(dueDate.getTime() / 1000);
      if (dueDateSeconds <= Math.floor(Date.now() / 1000)) {
        alert('Due date must be in the future.');
        return;
      }
      try {
        const tx = await marketplace.createInvoice(
          normalizedDebtor,
          toTokenUnits(faceValue),
          BigInt(dueDateSeconds),
          '',
        );
        await tx.wait();
        await fetchInvoices();
        alert('Invoice created on-chain and added to your portfolio.');
      } catch (error) {
        console.error('Failed to create invoice', error);
        alert('Failed to create invoice on-chain. Check console for details.');
      }
    },
    [fetchInvoices, marketplace, walletAddress],
  );

  const listInvoice = useCallback(
    async (invoiceId: number, minPrice: number) => {
      if (!marketplace || !invoiceNft) {
        alert('Marketplace or Invoice NFT contract is not available.');
        return;
      }
      if (!walletAddress) {
        alert('Please connect your wallet first.');
        return;
      }
      if (!Number.isFinite(minPrice) || minPrice <= 0) {
        alert('Listing price must be greater than zero.');
        return;
      }
      const invoice = getInvoice(invoiceId);
      const normalizedWallet = normalizeAddress(walletAddress);
      if (!invoice || invoice.owner !== normalizedWallet) {
        alert('Only the current owner can list this invoice.');
        return;
      }
      if (minPrice >= invoice.faceValue) {
        alert('Listing price must be less than the face value to provide yield.');
        return;
      }
      try {
        const marketplaceAddress = await marketplaceAddressPromise;
        if (!marketplaceAddress) {
          throw new Error('Unable to resolve marketplace address.');
        }
        const currentlyApproved = await invoiceNft.isApprovedForAll(normalizedWallet, marketplaceAddress);
        if (!currentlyApproved) {
          const approvalTx = await invoiceNft.setApprovalForAll(marketplaceAddress, true);
          await approvalTx.wait();
        }
        const tx = await marketplace.listInvoice(invoiceId, toTokenUnits(minPrice));
        await tx.wait();
        await fetchInvoices();
        alert(`Invoice #${invoiceId} listed successfully.`);
      } catch (error) {
        console.error('Failed to list invoice', error);
        alert('Failed to list invoice. See console for details.');
      }
    },
    [fetchInvoices, getInvoice, invoiceNft, marketplace, marketplaceAddressPromise, walletAddress],
  );

  const buyInvoice = useCallback(
    async (invoiceId: number) => {
      if (!marketplace || !usdc) {
        alert('Marketplace or USDC contract unavailable.');
        return;
      }
      const invoice = getInvoice(invoiceId);
      if (!invoice || invoice.status !== InvoiceStatus.Listed) {
        alert('Invoice is not available for purchase.');
        return;
      }
      const priceUnits = toTokenUnits(invoice.minPrice);
      try {
        const marketplaceAddress = await marketplaceAddressPromise;
        if (!marketplaceAddress) {
          throw new Error('Unable to resolve marketplace address.');
        }
        const buyerAddress = normalizeAddress(walletAddress);
        const allowance: bigint = await usdc.allowance(buyerAddress, marketplaceAddress);
        if (allowance < priceUnits) {
          const approveTx = await usdc.approve(marketplaceAddress, priceUnits);
          await approveTx.wait();
        }
        const tx = await marketplace.buyInvoice(invoiceId);
        await tx.wait();
        await fetchInvoices();
        alert(`Invoice #${invoiceId} purchased successfully.`);
      } catch (error) {
        console.error('Failed to buy invoice', error);
        alert('Failed to purchase invoice. See console for details.');
      }
    },
    [fetchInvoices, getInvoice, marketplace, marketplaceAddressPromise, usdc, walletAddress],
  );

  const settleInvoice = useCallback(
    async (invoiceId: number) => {
      if (!marketplace || !usdc) {
        alert('Marketplace or USDC contract unavailable.');
        return;
      }
      if (!walletAddress) {
        alert('Please connect your wallet first.');
        return;
      }
      const invoice = getInvoice(invoiceId);
      if (!invoice || invoice.status !== InvoiceStatus.Funded) {
        alert('Invoice is not available for settlement.');
        return;
      }
      const debtorAddress = normalizeAddress(walletAddress);
      if (!debtorAddress) {
        alert('Debtor address is invalid.');
        return;
      }
      if (invoice.debtor !== debtorAddress) {
        alert('Only the recorded debtor can settle this invoice.');
        return;
      }
      try {
        const marketplaceAddress = await marketplaceAddressPromise;
        if (!marketplaceAddress) {
          throw new Error('Unable to resolve marketplace address.');
        }
        const amountUnits = toTokenUnits(invoice.faceValue);
        const allowance: bigint = await usdc.allowance(debtorAddress, marketplaceAddress);
        if (allowance < amountUnits) {
          const approveTx = await usdc.approve(marketplaceAddress, amountUnits);
          await approveTx.wait();
        }
        const tx = await marketplace.settleInvoice(invoiceId);
        await tx.wait();
        await fetchInvoices();
        alert(`Invoice #${invoiceId} settled successfully.`);
      } catch (error) {
        console.error('Failed to settle invoice', error);
        alert('Failed to settle invoice. See console for details.');
      }
    },
    [fetchInvoices, getInvoice, marketplace, marketplaceAddressPromise, usdc, walletAddress],
  );

  const markDefaulted = useCallback(
    async (invoiceId: number) => {
      if (!marketplace) {
        alert('Marketplace contract is not available.');
        return;
      }
      try {
        const tx = await marketplace.markDefaulted(invoiceId);
        await tx.wait();
        await fetchInvoices();
        alert(`Invoice #${invoiceId} marked as defaulted.`);
      } catch (error) {
        console.error('Failed to mark invoice as defaulted', error);
        alert('Failed to mark invoice as defaulted. See console for details.');
      }
    },
    [fetchInvoices, marketplace],
  );

  return {
    invoices,
    balances,
    isLoading,
    createInvoice,
    listInvoice,
    buyInvoice,
    settleInvoice,
    markDefaulted,
    getInvoice,
    refresh: fetchInvoices,
  };
};
