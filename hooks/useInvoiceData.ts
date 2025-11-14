
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
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRateLimitError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const err = error as Record<string, unknown>;
  if (typeof err.code === 'number' && err.code === -32005) {
    return true;
  }
  if (typeof err.code === 'string' && err.code.toLowerCase().includes('rate')) {
    return true;
  }
  if (typeof err.message === 'string' && err.message.toLowerCase().includes('rate limit')) {
    return true;
  }
  if ('error' in err && err.error) {
    return isRateLimitError(err.error);
  }
  return false;
};

const isMissingInvoiceError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const message =
    (error as { message?: unknown }).message && typeof (error as { message?: unknown }).message === 'string'
      ? ((error as { message: string }).message || '').toLowerCase()
      : '';
  return message.includes('missing revert data') || message.includes('call_exception');
};
const withRateLimitRetry = async <T>(
  action: () => Promise<T>,
  label: string,
  maxAttempts = 3,
) => {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await action();
    } catch (error) {
      if (attempt < maxAttempts && isRateLimitError(error)) {
        await sleep(250 * attempt);
        continue;
      }
      throw Object.assign(error instanceof Error ? error : new Error(String(error)), { label });
    }
  }
  throw new Error(`Exceeded retry attempts for ${label}`);
};

const normalizeAddress = (value?: string | null): string => (value ? value.toLowerCase() : '');

export const useInvoiceData = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const {
    marketplace,
    marketplaceRead,
    invoiceNft,
    invoiceNftRead,
    usdc,
    usdcRead,
    addresses,
  } = useContracts();
  const { address: walletAddress } = useWeb3();
  const hasLoggedContracts = useRef(false);

  const marketplaceAddressPromise = useMemo(async () => {
    if (!marketplace) return undefined;
    return marketplace.getAddress();
  }, [marketplace]);

  const fetchBalances = useCallback(
    async (accountAddresses: Set<string>) => {
      const contract = usdcRead || usdc;
      if (!contract || accountAddresses.size === 0) {
        return;
      }
      const updates: Array<readonly [string, number]> = [];
      for (const addr of accountAddresses) {
        if (!addr) continue;
        let attempts = 0;
        while (attempts < 3) {
          attempts += 1;
          try {
            const balance: bigint = await contract.balanceOf(addr);
            updates.push([addr, fromTokenUnits(balance)]);
            break;
          } catch (error) {
            if (attempts < 3 && isRateLimitError(error)) {
              await sleep(250 * attempts);
              continue;
            }
            console.warn(`Failed to fetch balance for ${addr}`, error);
            updates.push([addr, 0]);
            break;
          }
        }
        await sleep(75);
      }
      if (updates.length > 0) {
        setBalances(prev => ({
          ...prev,
          ...Object.fromEntries(updates),
        }));
      }
    },
    [usdc, usdcRead],
  );

  const fetchInvoices = useCallback(async () => {
    const nftReader = invoiceNftRead || invoiceNft;
    const marketplaceReader = marketplaceRead || marketplace;
    if (!nftReader) {
      return;
    }
    setIsLoading(true);
    try {
      let latestId = 0;
      try {
        latestId = Number(await withRateLimitRetry(() => nftReader.latestInvoiceId(), 'latestInvoiceId'));
      } catch (error) {
        console.warn('Unable to read latest invoice id', error);
      }
      const invoicesFromChain: Array<Invoice | null> = [];
      for (let invoiceId = 1; invoiceId <= latestId; invoiceId += 1) {
        try {
          const data = await withRateLimitRetry(() => nftReader.invoiceData(invoiceId), `invoiceData:${invoiceId}`);
          const owner = await withRateLimitRetry(() => nftReader.ownerOf(invoiceId), `ownerOf:${invoiceId}`);
          const ownerAddress = normalizeAddress(owner);
          const statusNumeric = Number(data.status ?? 0);
          const status = statusMap[statusNumeric] ?? InvoiceStatus.Draft;

          let minPrice = 0;
          if (status === InvoiceStatus.Listed && marketplaceReader?.listings) {
            try {
              const listing = await withRateLimitRetry(
                () => marketplaceReader.listings(invoiceId),
                `listings:${invoiceId}`,
              );
              if (listing?.active) {
                minPrice = fromTokenUnits(BigInt(listing.minPrice));
              }
            } catch (error) {
              console.warn(`Unable to read listing for invoice ${invoiceId}`, error);
            }
          }

          invoicesFromChain.push({
            id: invoiceId,
            issuer: normalizeAddress(data.issuer),
            owner: ownerAddress,
            debtor: normalizeAddress(data.debtor),
            faceValue: fromTokenUnits(BigInt(data.faceValue)),
            dueDate: Number(data.dueDate) * 1000,
            createdAt: Number(data.createdAt) * 1000,
            status,
            minPrice,
          });
        } catch (error) {
          if (!isMissingInvoiceError(error)) {
            console.warn(`Failed to fetch data for invoice ${invoiceId}`, error);
          }
          invoicesFromChain.push(null);
        }
        await sleep(50);
      }

      setInvoices(invoicesFromChain.filter((inv): inv is Invoice => !!inv));

      const addressesToTrack = new Set<string>();
      invoicesFromChain
        .filter((invoice): invoice is Invoice => !!invoice)
        .forEach(invoice => {
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
  }, [
    fetchBalances,
    invoiceNft,
    invoiceNftRead,
    marketplace,
    marketplaceRead,
    walletAddress,
  ]);

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
