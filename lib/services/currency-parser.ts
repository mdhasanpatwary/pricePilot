export type SupportedCurrency = 'BDT' | 'INR' | 'USD' | 'EUR';

const CURRENCY_PATTERNS: Array<{ currency: SupportedCurrency; pattern: RegExp }> = [
  { currency: 'BDT', pattern: /(৳|টাকা|\bBDT\b|Tk\.?)/i },
  { currency: 'INR', pattern: /(₹|\bINR\b|Rs\.?)/i },
  { currency: 'USD', pattern: /(\$|\bUSD\b)/i },
  { currency: 'EUR', pattern: /(€|\bEUR\b)/i },
];

export interface ParsedCurrencyAmount {
  amount: number | null;
  currency?: SupportedCurrency;
}

export function detectCurrency(input: string): SupportedCurrency | undefined {
  for (const c of CURRENCY_PATTERNS) {
    if (c.pattern.test(input)) return c.currency;
  }
  return undefined;
}

export function parseLocalizedCurrencyAmount(
  raw: string,
  options?: { locale?: string; fallbackCurrency?: SupportedCurrency }
): ParsedCurrencyAmount {
  if (!raw || !raw.trim()) return { amount: null };

  const currency = detectCurrency(raw) || options?.fallbackCurrency;
  let cleaned = raw
    .replace(/[^\d.,'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return { amount: null, currency };

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    cleaned = normalizeSingleSeparator(cleaned, ',', options?.locale);
  } else if (hasDot) {
    cleaned = normalizeSingleSeparator(cleaned, '.', options?.locale);
  }

  cleaned = cleaned.replace(/['\s]/g, '');
  cleaned = cleaned.replace(/[^\d.-]/g, '');

  const amount = parseFloat(cleaned);
  if (Number.isNaN(amount)) return { amount: null, currency };

  return { amount, currency };
}

function normalizeSingleSeparator(
  value: string,
  separator: ',' | '.',
  locale?: string
): string {
  const escaped = separator === '.' ? '\\.' : ',';
  const match = value.match(new RegExp(`${escaped}(\\d{1,2})$`));
  const likelyDecimal = Boolean(match) || usesDecimalComma(locale);

  if (likelyDecimal) {
    if (separator === ',') return value.replace(/\./g, '').replace(',', '.');
    return value.replace(/,/g, '');
  }

  return separator === ',' ? value.replace(/,/g, '') : value.replace(/\./g, '');
}

function usesDecimalComma(locale?: string): boolean {
  if (!locale) return false;
  const l = locale.toLowerCase();
  return l.startsWith('de') || l.startsWith('fr') || l.startsWith('es') || l.startsWith('it');
}
