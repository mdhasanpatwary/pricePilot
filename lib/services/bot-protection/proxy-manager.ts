/**
 * Proxy Manager for Bot Protection Handling
 *
 * Provides proxy selection/rotation with:
 * - DB-backed proxy pool (existing behavior)
 * - Optional env proxy pool fallback
 * - Per-domain proxy policy
 * - Session-based sticky assignment
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  decryptForUse,
  encryptForStorage,
  isEncryptedString,
} from '@/lib/services/encryption/field-encryption';
import {
  getProxyRuntimeConfig,
  resolveDomainProxyPolicy,
  type DomainProxyPolicy,
  type ProxyPoolPreference,
} from './proxy-configuration';

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
  type?: ProxyPoolPreference;
  source?: 'db' | 'env';
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

export interface ProxySelectionOptions {
  excludeProxyIds?: string[];
  domain?: string;
  stickySessionKey?: string;
  requireResidential?: boolean;
  retryCount?: number;
  blockReason?: string;
}

export interface ProxyOutcomeDetails {
  responseTimeMs?: number;
  statusCode?: number;
  failureType?: string;
  blocked?: boolean;
}

interface Candidate {
  proxy: Proxy;
  score: number;
}

interface RuntimeProxyHealth {
  successCount: number;
  failureCount: number;
  blockedCount: number;
  lastFailureAtMs?: number;
  cooldownUntilMs?: number;
  lastFailureReason?: string;
}

interface StickyProxyAssignment {
  proxyId: string;
  expiresAtMs: number;
}

function getGlobalState() {
  return globalThis as typeof globalThis & {
    __ppRuntimeProxyHealth?: Record<string, RuntimeProxyHealth>;
    __ppStickyProxyAssignments?: Record<string, StickyProxyAssignment>;
  };
}

function classifyProxyType(host: string, provider: string): ProxyPoolPreference {
  const v = `${host} ${provider}`.toLowerCase();
  if (v.includes('residential') || v.includes('resi') || v.includes('mobile') || v.includes('isp')) {
    return 'residential';
  }
  if (v.includes('dc') || v.includes('datacenter') || v.includes('server') || v.includes('cloud')) {
    return 'datacenter';
  }
  return 'any';
}

/**
 * ProxyManager class
 */
export class ProxyManager {
  private readonly runtimeConfig = getProxyRuntimeConfig();

  private getRuntimeHealthMap(): Record<string, RuntimeProxyHealth> {
    const globalState = getGlobalState();
    if (!globalState.__ppRuntimeProxyHealth) {
      globalState.__ppRuntimeProxyHealth = {};
    }
    return globalState.__ppRuntimeProxyHealth;
  }

  private getStickyMap(): Record<string, StickyProxyAssignment> {
    const globalState = getGlobalState();
    if (!globalState.__ppStickyProxyAssignments) {
      globalState.__ppStickyProxyAssignments = {};
    }
    return globalState.__ppStickyProxyAssignments;
  }

  private isEnvProxyId(proxyId: string): boolean {
    return proxyId.startsWith('env:');
  }

  private isTenantProxyId(proxyId: string): boolean {
    return proxyId.startsWith('tenant:');
  }

  private isRuntimeProxyId(proxyId: string): boolean {
    return this.isEnvProxyId(proxyId) || this.isTenantProxyId(proxyId);
  }

  private isBlockedFailure(details?: ProxyOutcomeDetails): boolean {
    return (
      details?.blocked === true ||
      details?.statusCode === 403 ||
      details?.statusCode === 429 ||
      details?.failureType === 'BOT_BLOCKED'
    );
  }

  private removeStickyAssignmentsForProxy(proxyId: string): void {
    const stickyMap = this.getStickyMap();
    for (const [key, assignment] of Object.entries(stickyMap)) {
      if (assignment.proxyId === proxyId) {
        delete stickyMap[key];
      }
    }
  }

  invalidateStickySession(stickySessionKey?: string, proxyId?: string, reason?: string): void {
    if (!stickySessionKey) return;
    const stickyMap = this.getStickyMap();
    const existing = stickyMap[stickySessionKey];
    if (!existing) return;
    if (proxyId && existing.proxyId !== proxyId) return;
    delete stickyMap[stickySessionKey];
    logger.info('[ProxyManager] Cleared sticky proxy assignment', {
      stickySessionKey,
      proxyId: existing.proxyId,
      reason,
    });
  }

  private shouldUseProxyForDomain(policy: DomainProxyPolicy): boolean {
    if (policy.mode === 'direct') return false;
    return true;
  }

  private normalizePoolPreference(
    policy: DomainProxyPolicy,
    options?: ProxySelectionOptions
  ): ProxyPoolPreference {
    if (options?.requireResidential) return 'residential';
    return policy.pool || 'any';
  }

  private applyPoolFilter(candidates: Candidate[], pool: ProxyPoolPreference): Candidate[] {
    if (pool === 'any') return candidates;
    return candidates.filter((candidate) => {
      const type = candidate.proxy.type || 'any';
      return pool === type || (pool === 'residential' && type === 'any');
    });
  }

  private getStickyProxyCandidate(
    stickySessionKey: string | undefined,
    candidates: Candidate[],
    excludedProxyIds: Set<string>
  ): Proxy | null {
    if (!stickySessionKey) return null;
    const stickyMap = this.getStickyMap();
    const sticky = stickyMap[stickySessionKey];
    if (!sticky) return null;
    if (sticky.expiresAtMs <= Date.now()) {
      delete stickyMap[stickySessionKey];
      return null;
    }
    if (excludedProxyIds.has(sticky.proxyId)) {
      return null;
    }
    const hit = candidates.find((candidate) => candidate.proxy.id === sticky.proxyId);
    return hit?.proxy || null;
  }

  private setStickyProxy(stickySessionKey: string | undefined, proxyId: string): void {
    if (!stickySessionKey) return;
    const stickyMap = this.getStickyMap();
    stickyMap[stickySessionKey] = {
      proxyId,
      expiresAtMs: Date.now() + this.runtimeConfig.stickyTtlMs,
    };
  }

  private async getDatabaseCandidates(
    competitorWebsiteId: string,
    excludedProxyIds: Set<string>
  ): Promise<Candidate[]> {
    const now = new Date();
    const proxies = await prisma.proxy.findMany({
      where: { status: 'active' },
      include: {
        ProxySiteHealth: { where: { competitorWebsiteId } },
        ProxyHealthSummary: true,
      },
    });

    const candidates: Candidate[] = [];
    for (const proxyRecord of proxies) {
      if (excludedProxyIds.has(proxyRecord.id)) continue;
      if (proxyRecord.ProxyHealthSummary?.disabledAt) continue;

      const globalTotal = proxyRecord.globalSuccessCount + proxyRecord.globalFailureCount;
      const globalSuccessRate = globalTotal > 0 ? proxyRecord.globalSuccessCount / globalTotal : 0;
      if (globalTotal >= 10 && globalSuccessRate < 0.1) continue;

      const siteHealth = proxyRecord.ProxySiteHealth[0];
      if (siteHealth?.cooldownUntil && siteHealth.cooldownUntil > now) continue;

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
        }
      }

      candidates.push({
        proxy: {
          id: proxyRecord.id,
          host: proxyRecord.host,
          port: proxyRecord.port,
          protocol: proxyRecord.protocol as 'http' | 'https' | 'socks5',
          username: proxyRecord.username || undefined,
          password,
          provider: proxyRecord.provider,
          region: proxyRecord.region || undefined,
          type: classifyProxyType(proxyRecord.host, proxyRecord.provider),
          source: 'db' as const,
        },
        score: siteSuccessRate,
      });
    }

    return candidates;
  }

  private async getTenantSiteProxyCandidate(
    competitorWebsiteId: string
  ): Promise<Candidate | null> {
    try {
      const site = await (prisma.site as any).findUnique({
        where: { id: competitorWebsiteId },
        select: {
          tenantId: true,
          tenantProxyEnabled: true,
          tenantProxyProtocol: true,
          tenantProxyHost: true,
          tenantProxyPort: true,
          tenantProxyUsername: true,
          tenantProxyPasswordEncrypted: true,
        },
      });

      if (!site?.tenantProxyEnabled || !site.tenantProxyHost || !site.tenantProxyPort) {
        return null;
      }

      let password: string | undefined = undefined;
      if (site.tenantProxyPasswordEncrypted) {
        try {
          password = decryptForUse(site.tenantProxyPasswordEncrypted);
        } catch (error) {
          logger.warn('[ProxyManager] Failed to decrypt tenant proxy password', {
            competitorWebsiteId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return {
        proxy: {
          id: `tenant:${site.tenantId}:${competitorWebsiteId}`,
          host: site.tenantProxyHost,
          port: site.tenantProxyPort,
          protocol: (site.tenantProxyProtocol || 'http') as 'http' | 'https' | 'socks5',
          username: site.tenantProxyUsername || undefined,
          password,
          provider: 'tenant-managed',
          type: 'residential',
          source: 'env',
        },
        score: 0.95,
      };
    } catch (error) {
      logger.warn('[ProxyManager] Failed to load tenant proxy candidate', {
        competitorWebsiteId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private getEnvCandidates(excludedProxyIds: Set<string>): Candidate[] {
    const healthMap = this.getRuntimeHealthMap();
    const nowMs = Date.now();
    const candidates: Candidate[] = [];
    for (const proxy of this.runtimeConfig.envProxies) {
      if (excludedProxyIds.has(proxy.id)) continue;

      const health = healthMap[proxy.id];
      if (health?.cooldownUntilMs && health.cooldownUntilMs > nowMs) continue;

      const total = (health?.successCount || 0) + (health?.failureCount || 0);
      const successRate = total > 0 ? (health!.successCount / total) : 0.5;
      const scorePenalty = health?.blockedCount ? Math.min(0.4, health.blockedCount * 0.05) : 0;

      candidates.push({
        proxy: {
          ...proxy,
          source: 'env' as const,
        },
        score: Math.max(0, successRate - scorePenalty),
      });
    }
    return candidates;
  }

  /**
   * Get a proxy for scraping a specific competitor website.
   */
  async getProxy(competitorWebsiteId: string, options?: ProxySelectionOptions): Promise<Proxy | null> {
    try {
      const policy = resolveDomainProxyPolicy(options?.domain || '');
      if (!this.shouldUseProxyForDomain(policy)) {
        logger.info('[ProxyManager] Domain policy forces direct mode', {
          competitorWebsiteId,
          domain: options?.domain,
        });
        return null;
      }

      const excludedProxyIds = new Set(options?.excludeProxyIds || []);
      const poolPreference = this.normalizePoolPreference(policy, options);

      const tenantProxyCandidate = await this.getTenantSiteProxyCandidate(competitorWebsiteId);
      const dbCandidates = await this.getDatabaseCandidates(competitorWebsiteId, excludedProxyIds);
      const envCandidates = this.getEnvCandidates(excludedProxyIds);

      const prioritized: Candidate[] = tenantProxyCandidate
        ? [tenantProxyCandidate, ...dbCandidates, ...envCandidates]
        : [...dbCandidates, ...envCandidates];
      let candidates = this.applyPoolFilter(prioritized, poolPreference);
      if (candidates.length === 0 && poolPreference !== 'any') {
        // Fall back to any pool to avoid full outage.
        candidates = prioritized;
      }

      if (candidates.length === 0) {
        logger.warn('[ProxyManager] No proxy candidates available', {
          competitorWebsiteId,
          domain: options?.domain,
          poolPreference,
          excludedProxyCount: excludedProxyIds.size,
        });
        return null;
      }

      const stickySessionKey = policy.stickySession ? options?.stickySessionKey : undefined;
      const stickyProxy = this.getStickyProxyCandidate(stickySessionKey, candidates, excludedProxyIds);
      if (stickyProxy) {
        logger.info('[ProxyManager] Reusing sticky proxy', {
          competitorWebsiteId,
          proxyId: stickyProxy.id,
          domain: options?.domain,
          retryCount: options?.retryCount,
        });
        return stickyProxy;
      }

      candidates.sort((a, b) => b.score - a.score);
      const top = candidates.slice(0, Math.min(3, candidates.length));
      const selected = top[Math.floor(Math.random() * top.length)];

      this.setStickyProxy(stickySessionKey, selected.proxy.id);

      logger.info('[ProxyManager] Selected proxy', {
        competitorWebsiteId,
        proxyId: selected.proxy.id,
        source: selected.proxy.source,
        type: selected.proxy.type,
        domain: options?.domain,
        retryCount: options?.retryCount,
        blockReason: options?.blockReason,
      });

      return selected.proxy;
    } catch (error) {
      logger.error('Error getting proxy', { error });
      return null;
    }
  }

  /**
   * Mark a proxy as failed for a specific competitor website
   */
  async markProxyFailed(
    proxyId: string,
    competitorWebsiteId: string,
    details?: ProxyOutcomeDetails
  ): Promise<void> {
    try {
      if (this.isRuntimeProxyId(proxyId)) {
        const now = Date.now();
        const healthMap = this.getRuntimeHealthMap();
        const state = healthMap[proxyId] || { successCount: 0, failureCount: 0, blockedCount: 0 };
        state.failureCount += 1;
        state.lastFailureAtMs = now;
        state.lastFailureReason = details?.failureType;
        if (this.isBlockedFailure(details)) {
          state.blockedCount += 1;
        }
        const cooldownMinutes = state.failureCount === 1 ? 5 : state.failureCount === 2 ? 15 : 60;
        state.cooldownUntilMs = now + cooldownMinutes * 60 * 1000;
        healthMap[proxyId] = state;
        this.removeStickyAssignmentsForProxy(proxyId);
        logger.info('[ProxyManager] Marked runtime proxy failed', {
          proxyId,
          competitorWebsiteId,
          cooldownMinutes,
          failureType: details?.failureType,
          statusCode: details?.statusCode,
        });
        return;
      }

      const now = new Date();
      let siteHealth = await prisma.proxySiteHealth.findUnique({
        where: { proxyId_competitorWebsiteId: { proxyId, competitorWebsiteId } },
      });

      if (!siteHealth) {
        const cooldownUntil = new Date(now.getTime() + 5 * 60 * 1000);
        await prisma.proxySiteHealth.create({
          data: {
            proxyId,
            competitorWebsiteId,
            successCount: 0,
            failureCount: 1,
            lastFailureAt: now,
            cooldownUntil,
          },
        });
      } else {
        const newFailureCount = siteHealth.failureCount + 1;
        const cooldownMinutes = newFailureCount === 1 ? 5 : newFailureCount === 2 ? 15 : 60;
        const cooldownUntil = new Date(now.getTime() + cooldownMinutes * 60 * 1000);

        await prisma.proxySiteHealth.update({
          where: { proxyId_competitorWebsiteId: { proxyId, competitorWebsiteId } },
          data: { failureCount: newFailureCount, lastFailureAt: now, cooldownUntil },
        });
      }

      await prisma.proxy.update({
        where: { id: proxyId },
        data: { globalFailureCount: { increment: 1 } },
      });

      await this.recordProxyHealthSummary(proxyId, {
        success: false,
        responseTimeMs: details?.responseTimeMs,
        blocked: this.isBlockedFailure(details),
      });

      await this.checkAllProxiesBlocked(competitorWebsiteId);
    } catch (error) {
      logger.error('Error marking proxy as failed', { error });
    }
  }

  /**
   * Mark a proxy as successful for a specific competitor website
   */
  async markProxySuccess(
    proxyId: string,
    competitorWebsiteId: string,
    details?: ProxyOutcomeDetails
  ): Promise<void> {
    try {
      if (this.isRuntimeProxyId(proxyId)) {
        const healthMap = this.getRuntimeHealthMap();
        const state = healthMap[proxyId] || { successCount: 0, failureCount: 0, blockedCount: 0 };
        state.successCount += 1;
        state.failureCount = 0;
        state.cooldownUntilMs = undefined;
        healthMap[proxyId] = state;
        logger.info('[ProxyManager] Marked runtime proxy success', {
          proxyId,
          competitorWebsiteId,
          responseTimeMs: details?.responseTimeMs,
        });
        return;
      }

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

      await this.recordProxyHealthSummary(proxyId, {
        success: true,
        responseTimeMs: details?.responseTimeMs,
        blocked: false,
      });
    } catch (error) {
      logger.error('Error marking proxy as successful', { error });
    }
  }

  private async recordProxyHealthSummary(
    proxyId: string,
    params: { success: boolean; blocked: boolean; responseTimeMs?: number }
  ): Promise<void> {
    const existing = await prisma.proxyHealthSummary.findUnique({
      where: { proxyId },
    });

    const nextTotalAttempts = (existing?.totalAttempts || 0) + 1;
    const nextSuccessfulAttempts = (existing?.successfulAttempts || 0) + (params.success ? 1 : 0);
    const nextBlockedAttempts = (existing?.blockedAttempts || 0) + (params.blocked ? 1 : 0);
    const nextSuccessRate = nextTotalAttempts > 0 ? nextSuccessfulAttempts / nextTotalAttempts : 0;
    const nextBlockRate = nextTotalAttempts > 0 ? nextBlockedAttempts / nextTotalAttempts : 0;

    const previousAvg = existing?.avgResponseTime || 0;
    const measuredResponseTime = typeof params.responseTimeMs === 'number' && params.responseTimeMs > 0
      ? params.responseTimeMs
      : previousAvg;
    const nextAvgResponseTime = nextTotalAttempts > 0
      ? ((previousAvg * (nextTotalAttempts - 1)) + measuredResponseTime) / nextTotalAttempts
      : measuredResponseTime;

    const disableByLowSuccess = nextTotalAttempts >= 20 && nextSuccessRate < 0.1;
    const disableByBlockRate = nextTotalAttempts >= 10 && nextBlockRate > 0.6;
    const shouldDisable = disableByLowSuccess || disableByBlockRate;

    await prisma.proxyHealthSummary.upsert({
      where: { proxyId },
      create: {
        proxyId,
        totalAttempts: nextTotalAttempts,
        successfulAttempts: nextSuccessfulAttempts,
        blockedAttempts: nextBlockedAttempts,
        successRate: nextSuccessRate,
        blockRate: nextBlockRate,
        avgResponseTime: nextAvgResponseTime,
        lastFailureAt: params.success ? null : new Date(),
        disabledAt: shouldDisable ? new Date() : null,
      },
      update: {
        totalAttempts: nextTotalAttempts,
        successfulAttempts: nextSuccessfulAttempts,
        blockedAttempts: nextBlockedAttempts,
        successRate: nextSuccessRate,
        blockRate: nextBlockRate,
        avgResponseTime: nextAvgResponseTime,
        lastFailureAt: params.success ? existing?.lastFailureAt || null : new Date(),
        disabledAt: shouldDisable ? (existing?.disabledAt || new Date()) : null,
      },
    });

    if (shouldDisable) {
      await prisma.proxy.update({
        where: { id: proxyId },
        data: { status: 'disabled' },
      });
      logger.warn(`Auto-disabled unhealthy proxy ${proxyId}`, {
        successRate: nextSuccessRate,
        blockRate: nextBlockRate,
        totalAttempts: nextTotalAttempts,
      });
    }
  }

  /**
   * Get health information for a specific proxy
   */
  async getProxyHealth(proxyId: string): Promise<ProxyHealth> {
    if (this.isEnvProxyId(proxyId)) {
      const state = this.getRuntimeHealthMap()[proxyId];
      const total = (state?.successCount || 0) + (state?.failureCount || 0);
      const successRate = total > 0 ? (state?.successCount || 0) / total : 0;
      return {
        proxyId,
        globalSuccessRate: successRate,
        siteSpecificRates: new Map<string, number>(),
        lastSuccess: null,
        lastFailure: state?.lastFailureAtMs ? new Date(state.lastFailureAtMs) : null,
        isBlocked: (state?.blockedCount || 0) > 0 && successRate < 0.2,
        cooldownUntil: state?.cooldownUntilMs ? new Date(state.cooldownUntilMs) : null,
      };
    }

    const proxyRecord = await prisma.proxy.findUnique({
      where: { id: proxyId },
      include: { ProxySiteHealth: true },
    });

    if (!proxyRecord) throw new Error(`Proxy ${proxyId} not found`);

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
  }

  /**
   * Check if all DB-backed proxies are blocked for a competitor website and trigger alert.
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

      if (!allBlocked) return;

      logger.error(`All proxies blocked for competitor website ${competitorWebsiteId}`);
      const site = await prisma.site.findUnique({
        where: { id: competitorWebsiteId },
        select: { tenantId: true, baseUrl: true },
      });

      if (!site) return;

      await prisma.scrapingAlert.create({
        data: {
          tenantId: site.tenantId,
          competitorWebsiteId,
          severity: 'critical',
          type: 'all_proxies_blocked',
          title: 'All Proxies Blocked',
          message: `All proxies are currently blocked or in cooldown for ${site.baseUrl}. Scraping operations cannot proceed until proxies recover or new proxies are added.`,
          metadata: { activeProxyCount: activeProxies.length, timestamp: now.toISOString() },
        },
      });
      logger.info(`Created critical alert for all proxies blocked on site ${competitorWebsiteId}`);
    } catch (error) {
      logger.error('Error checking if all proxies blocked', { error });
    }
  }
}
