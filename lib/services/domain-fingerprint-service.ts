import crypto from 'node:crypto';

import { prisma } from '@/lib/prisma';

export type DomainFingerprintMetrics = {
  anchorCount: number;
  productContainerSignals: number;
  hasProductSchema: boolean;
  title: {
    hasTitleTag: boolean;
    length: number;
    separator: 'pipe' | 'dash' | 'colon' | 'none';
  };
  scripts: {
    scriptTagCount: number;
    hasJsonLd: boolean;
    hasNextData: boolean;
    hasNuxtState: boolean;
    hasInitialState: boolean;
    hasOpenCartRoute: boolean;
    hasShopify: boolean;
    hasWooCommerce: boolean;
  };
};

function countRegex(haystack: string, re: RegExp): number {
  const m = haystack.match(re);
  return m ? m.length : 0;
}

function safeLower(html: string): string {
  return (html || '').toLowerCase();
}

export class DomainFingerprintService {
  static normalizeDomain(domain: string): string {
    return (domain || '').trim().toLowerCase().replace(/^www\./, '');
  }

  static compute(html: string): { hash: string; metrics: DomainFingerprintMetrics } {
    const lower = safeLower(html);

    const anchorCount =
      countRegex(lower, /<a\b[^>]*href=/g) +
      countRegex(lower, /<a\b[^>]*\bhref\b/g);

    // Lightweight "product container presence" signals from common templates/platforms.
    // We intentionally use coarse signals to avoid fingerprint churn from minor markup changes.
    const productContainerSignals =
      countRegex(lower, /\bclass=["'][^"']*\bproduct\b[^"']*["']/g) +
      countRegex(lower, /\bclass=["'][^"']*\bproduct-item\b[^"']*["']/g) +
      countRegex(lower, /\bclass=["'][^"']*\bproduct-list\b[^"']*["']/g) +
      countRegex(lower, /\bclass=["'][^"']*\bproduct-thumb\b[^"']*["']/g) +
      countRegex(lower, /\bclass=["'][^"']*\bp-item\b[^"']*["']/g) +
      countRegex(lower, /\bitemtype=["']https?:\/\/schema\.org\/product["']/g);

    const hasProductSchema =
      lower.includes('schema.org/product') || lower.includes('"@type":"product"');

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const rawTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';
    const titleSeparator: DomainFingerprintMetrics['title']['separator'] =
      rawTitle.includes('|') ? 'pipe' :
      rawTitle.includes(' - ') ? 'dash' :
      rawTitle.includes(':') ? 'colon' :
      'none';

    const scriptTagCount = countRegex(lower, /<script\b/g);
    const scripts: DomainFingerprintMetrics['scripts'] = {
      scriptTagCount,
      hasJsonLd: lower.includes('application/ld+json'),
      hasNextData: lower.includes('__next_data__') || lower.includes('id="__next_data__"') || lower.includes('window.__next_data__'),
      hasNuxtState: lower.includes('__nuxt__') || lower.includes('window.__nuxt__'),
      hasInitialState: lower.includes('__initial_state__') || lower.includes('window.__initial_state__') || lower.includes('window.__state__'),
      hasOpenCartRoute: lower.includes('index.php?route=') || lower.includes('route=product/') || lower.includes('opencart'),
      hasShopify: lower.includes('cdn.shopify.com') || lower.includes('shopify'),
      hasWooCommerce: lower.includes('woocommerce') || lower.includes('wp-content/plugins/woocommerce'),
    };

    const metrics: DomainFingerprintMetrics = {
      anchorCount,
      productContainerSignals,
      hasProductSchema,
      title: {
        hasTitleTag: Boolean(titleMatch),
        length: rawTitle.length,
        separator: titleSeparator,
      },
      scripts,
    };

    const normalizedForHash = JSON.stringify(metrics);
    const hash = crypto.createHash('sha256').update(normalizedForHash, 'utf8').digest('hex');

    return { hash, metrics };
  }

  static async detectAndUpdate(params: {
    domain: string;
    html: string;
    now?: Date;
  }): Promise<{
    changed: boolean;
    previousHash: string | null;
    currentHash: string;
    metrics: DomainFingerprintMetrics;
    lastAlertAt: Date | null;
  }> {
    const domain = this.normalizeDomain(params.domain);
    const now = params.now ?? new Date();
    const { hash: currentHash, metrics } = this.compute(params.html);

    const existing = await prisma.domainFingerprint.findUnique({
      where: { domain },
      select: {
        fingerprintHash: true,
        lastAlertAt: true,
      },
    });

    const previousHash = existing?.fingerprintHash ?? null;
    const changed = Boolean(previousHash && previousHash !== currentHash);

    if (!existing) {
      await prisma.domainFingerprint.create({
        data: {
          domain,
          fingerprintHash: currentHash,
          fingerprint: metrics,
          lastSeenAt: now,
        },
      });
    } else if (changed) {
      await prisma.domainFingerprint.update({
        where: { domain },
        data: {
          fingerprintHash: currentHash,
          fingerprint: metrics,
          lastSeenAt: now,
          lastChangedAt: now,
          changeCount: { increment: 1 },
        },
      });
    } else {
      await prisma.domainFingerprint.update({
        where: { domain },
        data: {
          lastSeenAt: now,
          fingerprint: metrics,
        },
      });
    }

    return {
      changed,
      previousHash,
      currentHash,
      metrics,
      lastAlertAt: existing?.lastAlertAt ?? null,
    };
  }

  static async markAlerted(domain: string, alertedAt: Date = new Date()): Promise<void> {
    const normalized = this.normalizeDomain(domain);
    await prisma.domainFingerprint.update({
      where: { domain: normalized },
      data: { lastAlertAt: alertedAt },
    });
  }
}

