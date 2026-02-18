export interface AvailabilityConfig {
  inStockKeywords?: string[];
  outOfStockKeywords?: string[];
}

export interface AvailabilityDetectionResult {
  inStock: boolean | null;
  explicitOutOfStock: boolean;
  matchedKeyword?: string;
}

const DEFAULT_IN_STOCK_KEYWORDS = [
  'in stock',
  'available',
  'ready to ship',
  'স্টকে আছে',
  'উপলব্ধ',
  'মজুদ আছে',
  'स्टॉक में है',
  'उपलब्ध',
];

const DEFAULT_OUT_OF_STOCK_KEYWORDS = [
  'out of stock',
  'sold out',
  'currently unavailable',
  'স্টক শেষ',
  'স্টকে নেই',
  'উপলব্ধ নয়',
  'स्टॉक खत्म',
  'स्टॉक में नहीं',
  'उपलब्ध नहीं',
];

export function detectAvailability(
  htmlOrText: string,
  config?: AvailabilityConfig | null
): AvailabilityDetectionResult {
  const normalized = (htmlOrText || '').toLowerCase();
  const outKeywords = [...DEFAULT_OUT_OF_STOCK_KEYWORDS, ...(config?.outOfStockKeywords || [])]
    .map((k) => k.toLowerCase());
  const inKeywords = [...DEFAULT_IN_STOCK_KEYWORDS, ...(config?.inStockKeywords || [])]
    .map((k) => k.toLowerCase());

  for (const keyword of outKeywords) {
    if (normalized.includes(keyword)) {
      return { inStock: false, explicitOutOfStock: true, matchedKeyword: keyword };
    }
  }

  for (const keyword of inKeywords) {
    if (normalized.includes(keyword)) {
      return { inStock: true, explicitOutOfStock: false, matchedKeyword: keyword };
    }
  }

  return { inStock: null, explicitOutOfStock: false };
}
