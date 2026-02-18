/**
 * Proxy Manager for Bot Protection Handling
 *
 * Manages proxy rotation, health tracking, and selection for scraping operations.
 * Implements cooldown logic, site-specific success rate tracking, and alert triggering.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  decryptForUse,
  encryptForStorage,
  isEncryptedString,
} from '@/lib/services/encryption/field-encryption';

/**
 * Proxy configuration interface
 */
export interface Proxy {
  id: string;
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'socks5';
  username?: string;
  password?: string;
  provider: string;
  region?: string;
}

/**
 * Proxy health information interface
 */
export interface ProxyHealth {
  proxyId: string;
  globalSuccessRate: number;
  siteSpecificRates: Map<string, number>;
  lastSuccess: Date | null;
  lastFailure: Date | null;
  isBlocked: boolean;
  cooldownUntil: Date | null;
}

/**
 * ProxyManager class
 *
 * Manages proxy selection, health tracking, and cooldown logic for bot protection handling.
 */
export class ProxyManager {
  /**
   * Get a proxy for scraping a specific competitor website
   *
   * Implements the proxy selection algorithm:
   * 1. Filter out proxies in cooldown period for this site
   * 2. Filter out globally unavailable proxies (success rate < 10%)
   * 3. Sort by site-specific success rate (descending)
   * 4. Select top proxy with randomization to avoid overuse
   *
   * Requirements: 2.1, 2.6
   */
  async getProxy(competitorWebsiteId: string): Promise<Proxy | null> {
    try {
      const now = new Date();
      const proxies = await prisma.proxy.findMany({
        where: { status: 'active' },
        include: { ProxySiteHealth: { where: { competitorWebsiteId } } },
      });

      if (proxies.length === 0) {
        logger.warn('No active proxies available');
        return null;
      }

      const availableProxies = proxies
        .map((proxyRecord) => {
          const globalTotal = proxyRecord.globalSuccessCount + proxyRecord.globalFailureCount;
          const globalSuccessRate = globalTotal > 0 ? proxyRecord.globalSuccessCount / globalTotal : 0;
          if (globalTotal >= 10 && globalSuccessRate < 0.1) return null;

          const siteHealth = proxyRecord.ProxySiteHealth[0];
          if (siteHealth?.cooldownUntil && siteHealth.cooldownUntil > now) return null;

          const siteTotal = (siteHealth?.successCount || 0) + (siteHealth?.failureCount || 0);
          const siteSuccessRate = siteTotal > 0 ? (siteHealth?.successCount || 0) / siteTotal : 0.5;

          let password: string | undefined = undefined;
          if (proxyRecord.passwordEncrypted) {
            if (!isEncryptedString(proxyRecord.passwordEncrypted)) {
              try {
                const encrypted = encryptForStorage(proxyRecord.passwordEncrypted);
                void prisma.proxy
                  .update({
                    where: { id: proxyRecord.id },
                    data: { passwordEncrypted: encrypted },
                  })
                  .catch((e) => {
                    logger.warn(`[ProxyManager] Failed to persist proxy password migration (proxyId=${proxyRecord.id})`, {
                      error: e instanceof Error ? e.message : String(e),
                    });
                  });
                logger.info(`[ProxyManager] Migrated plaintext proxy password to encrypted (proxyId=${proxyRecord.id})`);
              } catch (error) {
                logger.warn(`[ProxyManager] Failed to migrate proxy password (proxyId=${proxyRecord.id})`, {
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }

            try {
              password = decryptForUse(proxyRecord.passwordEncrypted);
            } catch (error) {
              logger.error(`[ProxyManager] Failed to decrypt proxy password (proxyId=${proxyRecord.id})`, {
                error: error instanceof Error ? error.message : String(error),
              });
              password = undefined;
            }
          }

          return {
            proxy: {
              id: proxyRecord.id,
              host: proxyRecord.host,
              port: proxyRecord.port,
              protocol: proxyRecord.protocol as 'http' | 'https' | 'socks5',
              username: proxyRecord.username || undefined,
              password,
              provider: proxyRecord.provider,
              region: proxyRecord.region || undefined,
            },
            siteSuccessRate,
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      if (availableProxies.length === 0) return null;

      availableProxies.sort((a, b) => b.siteSuccessRate - a.siteSuccessRate);
      const topProxies = availableProxies.slice(0, Math.min(3, availableProxies.length));
      const selected = topProxies[Math.floor(Math.random() * topProxies.length)];

      logger.info(`Selected proxy \${selected.proxy.id} for site \${competitorWebsiteId}`);
      return selected.proxy;
    } catch (error) {
      logger.error('Error getting proxy', { error });
      return null;
    }
  }

  /**
   * Mark a proxy as failed for a specific competitor website
   * Requirements: 2.2, 2.3, 2.4
   */
  async markProxyFailed(proxyId: string, competitorWebsiteId: string): Promise<void> {
    try {
      const now = new Date();
      let siteHealth = await prisma.proxySiteHealth.findUnique({
        where: { proxyId_competitorWebsiteId: { proxyId, competitorWebsiteId } },
      });

      if (!siteHealth) {
        await prisma.proxySiteHealth.create({
          data: { proxyId, competitorWebsiteId, successCount: 0, failureCount: 1, lastFailureAt: now },
        });
      } else {
        const newFailureCount = siteHealth.failureCount + 1;
        const cooldownMinutes = newFailureCount === 1 ? 5 : newFailureCount === 2 ? 15 : 60;
        const cooldownUntil = new Date(now.getTime() + cooldownMinutes * 60 * 1000);

        await prisma.proxySiteHealth.update({
          where: { proxyId_competitorWebsiteId: { proxyId, competitorWebsiteId } },
          data: { failureCount: newFailureCount, lastFailureAt: now, cooldownUntil },
        });
        logger.info(`Proxy \${proxyId} failed for site \${competitorWebsiteId} (cooldown: \${cooldownMinutes} min)`);
      }

      await prisma.proxy.update({
        where: { id: proxyId },
        data: { globalFailureCount: { increment: 1 } },
      });

      await this.checkAllProxiesBlocked(competitorWebsiteId);
    } catch (error) {
      logger.error('Error marking proxy as failed', { error });
    }
  }

  /**
   * Mark a proxy as successful for a specific competitor website
   * Requirements: 2.2, 2.3, 2.4
   */
  async markProxySuccess(proxyId: string, competitorWebsiteId: string): Promise<void> {
    try {
      const now = new Date();
      const siteHealth = await prisma.proxySiteHealth.findUnique({
        where: { proxyId_competitorWebsiteId: { proxyId, competitorWebsiteId } },
      });

      if (!siteHealth) {
        await prisma.proxySiteHealth.create({
          data: { proxyId, competitorWebsiteId, successCount: 1, failureCount: 0, lastSuccessAt: now },
        });
      } else {
        await prisma.proxySiteHealth.update({
          where: { proxyId_competitorWebsiteId: { proxyId, competitorWebsiteId } },
          data: { successCount: { increment: 1 }, lastSuccessAt: now, cooldownUntil: null, failureCount: 0 },
        });
      }

      await prisma.proxy.update({
        where: { id: proxyId },
        data: { globalSuccessCount: { increment: 1 } },
      });
    } catch (error) {
      logger.error('Error marking proxy as successful', { error });
    }
  }

  /**
   * Get health information for a specific proxy
   * Requirements: 2.4
   */
  async getProxyHealth(proxyId: string): Promise<ProxyHealth> {
    try {
      const proxyRecord = await prisma.proxy.findUnique({
        where: { id: proxyId },
        include: { ProxySiteHealth: true },
      });

      if (!proxyRecord) throw new Error(`Proxy \${proxyId} not found`);

      const globalTotal = proxyRecord.globalSuccessCount + proxyRecord.globalFailureCount;
      const globalSuccessRate = globalTotal > 0 ? proxyRecord.globalSuccessCount / globalTotal : 0;

      const siteSpecificRates = new Map<string, number>();
      for (const health of proxyRecord.ProxySiteHealth) {
        const siteTotal = health.successCount + health.failureCount;
        const siteRate = siteTotal > 0 ? health.successCount / siteTotal : 0;
        siteSpecificRates.set(health.competitorWebsiteId, siteRate);
      }

      const isBlocked = globalTotal >= 10 && globalSuccessRate < 0.1;
      const now = new Date();

      const lastSuccess = proxyRecord.ProxySiteHealth
        .map((h) => h.lastSuccessAt)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0] || null;

      const lastFailure = proxyRecord.ProxySiteHealth
        .map((h) => h.lastFailureAt)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0] || null;

      const cooldownUntil = proxyRecord.ProxySiteHealth
        .map((h) => h.cooldownUntil)
        .filter((d): d is Date => d !== null && d > now)
        .sort((a, b) => b.getTime() - a.getTime())[0] || null;

      return {
        proxyId: proxyRecord.id,
        globalSuccessRate,
        siteSpecificRates,
        lastSuccess,
        lastFailure,
        isBlocked,
        cooldownUntil,
      };
    } catch (error) {
      logger.error('Error getting proxy health', { error });
      throw error;
    }
  }

  /**
   * Check if all proxies are blocked for a competitor website and trigger alert
   * Requirements: 2.5, 2.7
   */
  private async checkAllProxiesBlocked(competitorWebsiteId: string): Promise<void> {
    try {
      const now = new Date();
      const activeProxies = await prisma.proxy.findMany({
        where: { status: 'active' },
        include: { ProxySiteHealth: { where: { competitorWebsiteId } } },
      });

      if (activeProxies.length === 0) return;

      const allBlocked = activeProxies.every((proxyRecord) => {
        const globalTotal = proxyRecord.globalSuccessCount + proxyRecord.globalFailureCount;
        const globalSuccessRate = globalTotal > 0 ? proxyRecord.globalSuccessCount / globalTotal : 1;
        if (globalTotal >= 10 && globalSuccessRate < 0.1) return true;

        const siteHealth = proxyRecord.ProxySiteHealth[0];
        if (siteHealth?.cooldownUntil && siteHealth.cooldownUntil > now) return true;

        return false;
      });

      if (allBlocked) {
        logger.error(`All proxies blocked for competitor website \${competitorWebsiteId}`);

        const site = await prisma.site.findUnique({
          where: { id: competitorWebsiteId },
          select: { tenantId: true, baseUrl: true },
        });

        if (site) {
          await prisma.scrapingAlert.create({
            data: {
              tenantId: site.tenantId,
              competitorWebsiteId,
              severity: 'critical',
              type: 'all_proxies_blocked',
              title: 'All Proxies Blocked',
              message: `All proxies are currently blocked or in cooldown for \${site.baseUrl}. Scraping operations cannot proceed until proxies recover or new proxies are added.`,
              metadata: { activeProxyCount: activeProxies.length, timestamp: now.toISOString() },
            },
          });
          logger.info(`Created critical alert for all proxies blocked on site \${competitorWebsiteId}`);
        }
      }
    } catch (error) {
      logger.error('Error checking if all proxies blocked', { error });
    }
  }
}
