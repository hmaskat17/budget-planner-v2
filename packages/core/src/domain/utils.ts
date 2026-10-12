export function createId(prefix: string, random = Math.random): string {
  return `${prefix}-${random().toString(36).slice(2, 10)}`;
}

export function formatAmount(amount: number): string {
  return amount.toFixed(2);
}