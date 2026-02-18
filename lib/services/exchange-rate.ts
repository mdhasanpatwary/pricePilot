import { logger } from '@/lib/logger';
import { SupportedCurrency } from './currency-parser';

export interface ExchangeRateQuote {
  from: SupportedCurrency;
  to: SupportedCurrency;
  rate: number;
  timestamp: Date;
}

export interface ExchangeRateProvider {
  getRate(from: SupportedCurrency, to: SupportedCurrency): Promise<ExchangeRateQuote>;
}

class StaticExchangeRateProvider implements ExchangeRateProvider {
  private readonly defaults: Record<string, number> = {
    'USD_BDT': 120,
    'BDT_USD': 1 / 120,
    'USD_INR': 84,
    'INR_USD': 1 / 84,
    'USD_EUR': 0.92,
    'EUR_USD': 1 / 0.92,
    'BDT_INR': 0.7,
    'INR_BDT': 1 / 0.7,
    'BDT_EUR': 0.0077,
    'EUR_BDT': 1 / 0.0077,
    'INR_EUR': 0.011,
    'EUR_INR': 1 / 0.011,
  };

  async getRate(from: SupportedCurrency, to: SupportedCurrency): Promise<ExchangeRateQuote> {
    if (from === to) {
      return { from, to, rate: 1, timestamp: new Date() };
    }
    const key = `${from}_${to}`;
    const overridden = readOverrideRate(key);
    const rate = overridden ?? this.defaults[key];
    if (!rate) {
      throw new Error(`No exchange rate configured for ${key}`);
    }
    return { from, to, rate, timestamp: new Date() };
  }
}

interface CacheEntry {
  quote: ExchangeRateQuote;
  expiresAtMs: number;
}

export class ExchangeRateService {
  private cache = new Map<string, CacheEntry>();
  private provider: ExchangeRateProvider;
  private ttlMs: number;

  constructor(provider?: ExchangeRateProvider, ttlMs: number = 10 * 60 * 1000) {
    this.provider = provider || new StaticExchangeRateProvider();
    this.ttlMs = ttlMs;
  }

  setProvider(provider: ExchangeRateProvider): void {
    this.provider = provider;
  }

  async getRate(from: SupportedCurrency, to: SupportedCurrency): Promise<ExchangeRateQuote> {
    const key = `${from}_${to}`;
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached && cached.expiresAtMs > now) {
      return cached.quote;
    }

    const quote = await this.provider.getRate(from, to);
    this.cache.set(key, {
      quote,
      expiresAtMs: now + this.ttlMs,
    });
    return quote;
  }

  async normalizeToBase(input: {
    amount: number;
    fromCurrency: SupportedCurrency;
    baseCurrency: SupportedCurrency;
  }): Promise<{ normalizedAmount: number; exchangeRateUsed: number; exchangeRateTimestamp: Date }> {
    const quote = await this.getRate(input.fromCurrency, input.baseCurrency);
    const normalizedAmount = Number((input.amount * quote.rate).toFixed(2));
    return {
      normalizedAmount,
      exchangeRateUsed: quote.rate,
      exchangeRateTimestamp: quote.timestamp,
    };
  }
}

function readOverrideRate(key: string): number | undefined {
  const raw = process.env.EXCHANGE_RATE_OVERRIDES;
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    const v = parsed[key];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      return v;
    }
  } catch (error) {
    logger.warn('[ExchangeRateService] Failed to parse EXCHANGE_RATE_OVERRIDES', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return undefined;
}

export const exchangeRateService = new ExchangeRateService();
