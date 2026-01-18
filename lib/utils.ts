import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "USD") {
  try {
    const formatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
    return formatter.format(amount ?? 0);
  } catch {
    // Fallback if currency code is invalid
    const sign = amount < 0 ? "-" : "";
    const abs = Math.abs(amount ?? 0).toFixed(2);
    return `${sign}${currency} ${abs}`;
  }
}
