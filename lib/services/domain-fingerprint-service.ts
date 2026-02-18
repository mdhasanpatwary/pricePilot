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
  static readonly DEFAULT_DRIFT_THRESHOLD = 0.35;

  static normalizeDomain(domain: string): string {
    return (domain || '').trim().toLowerCase().replace(/^www\./, '');
  }

  static computeDriftScore(prev: DomainFingerprintMetrics, next: DomainFingerprintMetrics): number {
    const ratioDelta = (a: number, b: number): number => {
      const denom = Math.max(1, Math.abs(a), Math.abs(b));
      return Math.min(1, Math.abs(a - b) / denom);
    };

    // Weighted, coarse score in [0,1]. Prefer stability: changes in a single noisy signal
    // shouldn't immediately trigger STRUCTURE_CHANGED.
    let score = 0;
    let weightSum = 0;

    const add = (w: number, v: number) => {
      weightSum += w;
      score += w * Math.max(0, Math.min(1, v));
    };

    // DOM structure signals
    add(0.25, ratioDelta(prev.anchorCount, next.anchorCount));
    add(0.25, ratioDelta(prev.productContainerSignals, next.productContainerSignals));
    add(0.15, prev.hasProductSchema === next.hasProductSchema ? 0 : 1);

    // Title signals
    add(0.10, prev.title.separator === next.title.separator ? 0 : 1);
    add(0.05, ratioDelta(prev.title.length, next.title.length));

    // Script/platform signals
    add(0.20, ratioDelta(prev.scripts.scriptTagCount, next.scripts.scriptTagCount));
    add(0.05, prev.scripts.hasNextData === next.scripts.hasNextData ? 0 : 1);
    add(0.05, prev.scripts.hasJsonLd === next.scripts.hasJsonLd ? 0 : 1);
    add(0.05, prev.scripts.hasShopify === next.scripts.hasShopify ? 0 : 1);
    add(0.05, prev.scripts.hasWooCommerce === next.scripts.hasWooCommerce ? 0 : 1);
    add(0.05, prev.scripts.hasOpenCartRoute === next.scripts.hasOpenCartRoute ? 0 : 1);

    if (weightSum <= 0) return 0;
    return Math.max(0, Math.min(1, score / weightSum));
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
    driftThreshold?: number;
  }): Promise<{
    changed: boolean;
    previousHash: string | null;
    currentHash: string;
    driftScore: number;
    driftThreshold: number;
    metrics: DomainFingerprintMetrics;
    lastAlertAt: Date | null;
  }> {
    const domain = this.normalizeDomain(params.domain);
    const now = params.now ?? new Date();
    const driftThreshold =
      typeof params.driftThreshold === 'number' && Number.isFinite(params.driftThreshold)
        ? Math.max(0, Math.min(1, params.driftThreshold))
        : this.DEFAULT_DRIFT_THRESHOLD;
    const { hash: currentHash, metrics } = this.compute(params.html);

    const existing = await prisma.domainFingerprint.findUnique({
      where: { domain },
      select: {
        fingerprintHash: true,
        fingerprint: true,
        lastAlertAt: true,
      },
    });

    const previousHash = existing?.fingerprintHash ?? null;
    const previousMetrics = (existing?.fingerprint as DomainFingerprintMetrics | null) ?? null;
    const driftScore =
      previousMetrics ? this.computeDriftScore(previousMetrics, metrics) : 0;
    const changed = Boolean(previousHash && previousHash !== currentHash && driftScore >= driftThreshold);

    if (!existing) {
      await prisma.domainFingerprint.create({
        data: {
          domain,
          fingerprintHash: currentHash,
          fingerprint: metrics,
          lastSeenAt: now,
        },
      });
    } else {
      // Always update the stored fingerprint/hash to keep the baseline current,
      // but only increment change counters when the drift score crosses the threshold.
      await prisma.domainFingerprint.update({
        where: { domain },
        data: {
          fingerprintHash: currentHash,
          fingerprint: metrics,
          lastSeenAt: now,
          ...(changed
            ? { lastChangedAt: now, changeCount: { increment: 1 } }
            : {}),
        },
      });
    }

    return {
      changed,
      previousHash,
      currentHash,
      driftScore,
      driftThreshold,
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
