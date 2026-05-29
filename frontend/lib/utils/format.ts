export function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export function formatPct(value: number) {
  return `${value.toFixed(2)}%`;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
