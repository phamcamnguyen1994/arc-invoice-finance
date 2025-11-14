
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' USDC';
};

export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

export const calculateYield = (faceValue: number, price: number, dueDate: number): number => {
  if (price <= 0) return 0;
  
  const now = Date.now();
  if (dueDate <= now) return 0;

  const daysToMaturity = (dueDate - now) / (1000 * 60 * 60 * 24);
  if (daysToMaturity <= 0) return 0;

  const discount = faceValue - price;
  const simpleYield = discount / price;
  const annualizedYield = simpleYield * (365 / daysToMaturity);

  return annualizedYield * 100; // Return as percentage
};

export const getDaysRemaining = (dueDate: number): number => {
    const now = Date.now();
    if(dueDate <= now) return 0;
    return Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
};
