import { createHash } from 'crypto';

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'msclkid',
  'ref',
  'ref_src',
  'source',
  'campaign',
  'aff',
  'affiliate',
]);

export function normalizeCanonicalUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl);
    parsed.hash = '';

    for (const key of Array.from(parsed.searchParams.keys())) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }

    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    parsed.pathname = pathname.toLowerCase();

    const sortedParams = new URLSearchParams(
      Array.from(parsed.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b))
    );
    parsed.search = sortedParams.toString() ? `?${sortedParams.toString()}` : '';

    return parsed.toString();
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

export function normalizeProductSlug(input?: string | null): string | null {
  if (!input) return null;
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || null;
}

export function normalizeSku(input?: string | null): string | null {
  if (!input) return null;
  const normalized = input.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  return normalized || null;
}

export function extractSlugFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return null;
    return normalizeProductSlug(parts[parts.length - 1]);
  } catch {
    return normalizeProductSlug(url);
  }
}

export function buildLogicalFingerprint(input: {
  siteId: string;
  canonicalUrl?: string | null;
  sku?: string | null;
  slug?: string | null;
}): string {
  const basis = [
    input.siteId,
    input.canonicalUrl || '',
    normalizeSku(input.sku) || '',
    normalizeProductSlug(input.slug) || '',
  ].join('|');

  return createHash('sha1').update(basis).digest('hex');
}
