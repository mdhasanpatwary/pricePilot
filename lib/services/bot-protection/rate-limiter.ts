/**
 * Rate Limiter for Bot Protection Handling
 *
 * Implements rate limiting with exponential backoff for scraping operations.
 * Tracks per-site rate limits, consecutive failures, and enforces delays.
 * Supports configurable rate limits per site from database.
 *
 * Requirements: 4.1, 4.4, 4.5
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { getRedisConnection } from '@/lib/queue/connection';
import { calculateDelay } from './backoff-calculator';

/**
 * Rate limit configuration interface
 */
export interface RateLimitConfig {
    baseDelay: number; // milliseconds
    maxDelay: number; // milliseconds
    backoffMultiplier: number;
    jitterRange: number; // percentage
}

/**
 * Site rate limit state
 */
interface SiteRateLimitState {
    lastRequestTime: Date | null;
    consecutiveFailures: number;
    nextAvailableTime: Date;
    config: RateLimitConfig;
}

/**
 * Default rate limit configuration
 */
const DEFAULT_CONFIG: RateLimitConfig = {
    baseDelay: 2000, // 2 seconds
    maxDelay: 300000, // 5 minutes
    backoffMultiplier: 2.0,
    jitterRange: 20, // 20%
};

/**
 * Protection type enum for failure recording
 */
export enum ProtectionType {
    IP_BLOCK = 'ip_block',
    RATE_LIMIT = 'rate_limit',
    CAPTCHA = 'captcha',
    FAKE_DATA = 'fake_data',
    REDIRECT_BLOCK = 'redirect_block',
    DELAYED_RESPONSE = 'delayed_response',
    EMPTY_RESPONSE = 'empty_response',
    JAVASCRIPT_CHALLENGE = 'javascript_challenge',
    UNKNOWN = 'unknown'
}

/**
 * RateLimiter class
 *
 * Multi-worker safety:
 * - state is stored in Redis (not process memory)
 * - per-site updates are protected by a Redis distributed lock
 */
export class RateLimiter {
    private static readonly STATE_PREFIX = 'pp:bot:rate:state:';
    private static readonly CONFIG_PREFIX = 'pp:bot:rate:config:';
    private static readonly LOCK_PREFIX = 'pp:bot:rate:lock:';
    private static readonly CONFIG_CACHE_TTL_SECONDS = 300;
    private static readonly STATE_TTL_SECONDS = 24 * 60 * 60;
    private static readonly LOCK_TTL_MS = 10_000;

    private getStateKey(competitorWebsiteId: string): string {
        return `${RateLimiter.STATE_PREFIX}${competitorWebsiteId}`;
    }

    private getConfigKey(competitorWebsiteId: string): string {
        return `${RateLimiter.CONFIG_PREFIX}${competitorWebsiteId}`;
    }

    private getLockKey(competitorWebsiteId: string): string {
        return `${RateLimiter.LOCK_PREFIX}${competitorWebsiteId}`;
    }

    private async sleep(ms: number): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }

    private parseIntField(value: string | undefined, fallback: number): number {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
    }

    private parseFloatField(value: string | undefined, fallback: number): number {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    private async withSiteLock<T>(competitorWebsiteId: string, fn: () => Promise<T>): Promise<T> {
        const redis = getRedisConnection();
        const lockKey = this.getLockKey(competitorWebsiteId);
        const token = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

        while (true) {
            const acquired = await redis.set(lockKey, token, 'PX', RateLimiter.LOCK_TTL_MS, 'NX');
            if (acquired === 'OK') {
                break;
            }
            await this.sleep(50);
        }

        try {
            return await fn();
        } finally {
            const releaseLua = `
                local key = KEYS[1]
                local token = ARGV[1]
                if redis.call("GET", key) == token then
                    return redis.call("DEL", key)
                end
                return 0
            `;
            await redis.eval(releaseLua, 1, lockKey, token).catch(() => undefined);
        }
    }

    private async loadDbConfigAndState(competitorWebsiteId: string): Promise<{ config: RateLimitConfig; state: Partial<SiteRateLimitState> }> {
        let config: RateLimitConfig = DEFAULT_CONFIG;
        let state: Partial<SiteRateLimitState> = {
            consecutiveFailures: 0,
            lastRequestTime: null,
            nextAvailableTime: new Date(),
        };

        try {
            const scrapingConfig = await prisma.scrapingConfig.findUnique({
                where: { competitorWebsiteId },
                select: {
                    baseDelayMs: true,
                    maxDelayMs: true,
                    backoffMultiplier: true,
                    consecutiveFailures: true,
                    lastRequestAt: true,
                    nextAvailableAt: true,
                },
            });

            if (scrapingConfig) {
                config = {
                    baseDelay: scrapingConfig.baseDelayMs,
                    maxDelay: scrapingConfig.maxDelayMs,
                    backoffMultiplier: Number(scrapingConfig.backoffMultiplier),
                    jitterRange: 20,
                };

                state = {
                    consecutiveFailures: scrapingConfig.consecutiveFailures,
                    lastRequestTime: scrapingConfig.lastRequestAt,
                    nextAvailableTime: scrapingConfig.nextAvailableAt || new Date(),
                };
            }
        } catch (error) {
            logger.error(`Failed to load rate limit config/state for site ${competitorWebsiteId}`, { error });
        }

        return { config, state };
    }

    private async getCachedConfig(competitorWebsiteId: string): Promise<RateLimitConfig | null> {
        const redis = getRedisConnection();
        const raw = await redis.get(this.getConfigKey(competitorWebsiteId));
        if (!raw) return null;

        try {
            const parsed = JSON.parse(raw) as Partial<RateLimitConfig>;
            return {
                baseDelay: this.parseIntField(String(parsed.baseDelay), DEFAULT_CONFIG.baseDelay),
                maxDelay: this.parseIntField(String(parsed.maxDelay), DEFAULT_CONFIG.maxDelay),
                backoffMultiplier: this.parseFloatField(String(parsed.backoffMultiplier), DEFAULT_CONFIG.backoffMultiplier),
                jitterRange: this.parseIntField(String(parsed.jitterRange), DEFAULT_CONFIG.jitterRange),
            };
        } catch {
            return null;
        }
    }

    private async cacheConfig(competitorWebsiteId: string, config: RateLimitConfig): Promise<void> {
        const redis = getRedisConnection();
        await redis.set(
            this.getConfigKey(competitorWebsiteId),
            JSON.stringify(config),
            'EX',
            RateLimiter.CONFIG_CACHE_TTL_SECONDS,
        );
    }

    private async readState(competitorWebsiteId: string, config: RateLimitConfig, fallback?: Partial<SiteRateLimitState>): Promise<SiteRateLimitState> {
        const redis = getRedisConnection();
        const key = this.getStateKey(competitorWebsiteId);
        const raw = await redis.hgetall(key);

        if (raw && Object.keys(raw).length > 0) {
            return {
                lastRequestTime: raw.lastRequestMs ? new Date(this.parseIntField(raw.lastRequestMs, 0)) : null,
                consecutiveFailures: this.parseIntField(raw.consecutiveFailures, 0),
                nextAvailableTime: new Date(this.parseIntField(raw.nextAvailableMs, Date.now())),
                config: {
                    baseDelay: this.parseIntField(raw.baseDelay, config.baseDelay),
                    maxDelay: this.parseIntField(raw.maxDelay, config.maxDelay),
                    backoffMultiplier: this.parseFloatField(raw.backoffMultiplier, config.backoffMultiplier),
                    jitterRange: this.parseIntField(raw.jitterRange, config.jitterRange),
                },
            };
        }

        const seeded: SiteRateLimitState = {
            lastRequestTime: fallback?.lastRequestTime || null,
            consecutiveFailures: fallback?.consecutiveFailures || 0,
            nextAvailableTime: fallback?.nextAvailableTime || new Date(),
            config,
        };
        await this.writeState(competitorWebsiteId, seeded);
        return seeded;
    }

    private async writeState(competitorWebsiteId: string, state: SiteRateLimitState): Promise<void> {
        const redis = getRedisConnection();
        const key = this.getStateKey(competitorWebsiteId);

        await redis.hset(
            key,
            'lastRequestMs',
            state.lastRequestTime ? String(state.lastRequestTime.getTime()) : '0',
            'consecutiveFailures',
            String(state.consecutiveFailures),
            'nextAvailableMs',
            String(state.nextAvailableTime.getTime()),
            'baseDelay',
            String(state.config.baseDelay),
            'maxDelay',
            String(state.config.maxDelay),
            'backoffMultiplier',
            String(state.config.backoffMultiplier),
            'jitterRange',
            String(state.config.jitterRange),
        );
        await redis.expire(key, RateLimiter.STATE_TTL_SECONDS);
    }

    private async loadSiteConfigAndState(competitorWebsiteId: string): Promise<{ config: RateLimitConfig; state: SiteRateLimitState }> {
        const cachedConfig = await this.getCachedConfig(competitorWebsiteId);

        if (cachedConfig) {
            const state = await this.readState(competitorWebsiteId, cachedConfig);
            return { config: cachedConfig, state };
        }

        const { config, state: dbState } = await this.loadDbConfigAndState(competitorWebsiteId);
        await this.cacheConfig(competitorWebsiteId, config);
        const state = await this.readState(competitorWebsiteId, config, dbState);
        return { config, state };
    }

    private async upsertScrapingConfigState(
        competitorWebsiteId: string,
        data: {
            lastRequestAt?: Date;
            nextAvailableAt?: Date;
            consecutiveFailures?: number;
        }
    ): Promise<void> {
        const site = await prisma.site.findUnique({
            where: { id: competitorWebsiteId },
            select: { tenantId: true },
        });

        if (!site) {
            logger.warn(`Cannot persist rate limit state: site not found (${competitorWebsiteId})`);
            return;
        }

        await prisma.scrapingConfig.upsert({
            where: { competitorWebsiteId },
            create: {
                tenantId: site.tenantId,
                competitorWebsiteId,
                preferredStrategy: 'http_client',
                requiresJavascript: false,
                proxyRequired: false,
                baseDelayMs: DEFAULT_CONFIG.baseDelay,
                maxDelayMs: DEFAULT_CONFIG.maxDelay,
                backoffMultiplier: DEFAULT_CONFIG.backoffMultiplier,
                maxRetries: 3,
                priceSelectors: ['.price', '[itemprop="price"]', '.product-price'],
                currencySelector: null,
                fallbackRegex: null,
                consecutiveFailures: data.consecutiveFailures ?? 0,
                lastRequestAt: data.lastRequestAt,
                nextAvailableAt: data.nextAvailableAt,
            },
            update: data,
        });
    }

    private calculateDelay(
        consecutiveFailures: number,
        config: RateLimitConfig
    ): number {
        return calculateDelay(consecutiveFailures, config);
    }

    async acquirePermit(
        competitorWebsiteId: string,
        config?: RateLimitConfig
    ): Promise<void> {
        const loaded = await this.loadSiteConfigAndState(competitorWebsiteId);
        const finalConfig = config || loaded.config;

        while (true) {
            const waitMs = await this.withSiteLock(competitorWebsiteId, async () => {
                const state = await this.readState(competitorWebsiteId, finalConfig, loaded.state);
                state.config = finalConfig;

                const nowMs = Date.now();
                const delay = this.calculateDelay(state.consecutiveFailures, finalConfig);
                const nextFromLastMs = (state.lastRequestTime?.getTime() || 0) + delay;
                const enforcedNextMs = Math.max(state.nextAvailableTime.getTime(), nextFromLastMs);

                if (enforcedNextMs > nowMs) {
                    state.nextAvailableTime = new Date(enforcedNextMs);
                    await this.writeState(competitorWebsiteId, state);
                    return enforcedNextMs - nowMs;
                }

                state.lastRequestTime = new Date(nowMs);
                state.nextAvailableTime = new Date(nowMs + delay);
                await this.writeState(competitorWebsiteId, state);

                await this.upsertScrapingConfigState(competitorWebsiteId, {
                    lastRequestAt: state.lastRequestTime,
                    nextAvailableAt: state.nextAvailableTime,
                }).catch((error) => {
                    logger.error(`Failed to update rate limit state in DB for site ${competitorWebsiteId}`, { error });
                });

                return 0;
            });

            if (waitMs <= 0) {
                logger.debug(`Permit acquired for site ${competitorWebsiteId}`, { config: finalConfig });
                return;
            }

            logger.debug(`Rate limiting: waiting ${waitMs}ms for site ${competitorWebsiteId}`);
            await this.sleep(waitMs);
        }
    }

    async recordFailure(
        competitorWebsiteId: string,
        protectionType?: ProtectionType
    ): Promise<void> {
        const loaded = await this.loadSiteConfigAndState(competitorWebsiteId);

        await this.withSiteLock(competitorWebsiteId, async () => {
            const state = await this.readState(competitorWebsiteId, loaded.config, loaded.state);
            // Keep failure backoff aligned with the active permit config persisted in Redis state.
            const effectiveConfig = state.config || loaded.config;

            state.consecutiveFailures += 1;
            if (protectionType === ProtectionType.RATE_LIMIT) {
                state.consecutiveFailures += 1;
            }

            const delay = this.calculateDelay(state.consecutiveFailures, effectiveConfig);
            state.nextAvailableTime = new Date(Date.now() + delay);
            state.config = effectiveConfig;

            await this.writeState(competitorWebsiteId, state);
            await this.upsertScrapingConfigState(competitorWebsiteId, {
                consecutiveFailures: state.consecutiveFailures,
                nextAvailableAt: state.nextAvailableTime,
            });

            logger.info(`Recorded failure for site ${competitorWebsiteId} in database`, {
                consecutiveFailures: state.consecutiveFailures,
                protectionType: protectionType || 'unknown',
                nextAvailable: state.nextAvailableTime.toISOString(),
            });
        });
    }

    async recordSuccess(competitorWebsiteId: string): Promise<void> {
        const loaded = await this.loadSiteConfigAndState(competitorWebsiteId);

        await this.withSiteLock(competitorWebsiteId, async () => {
            const state = await this.readState(competitorWebsiteId, loaded.config, loaded.state);
            const previousFailures = state.consecutiveFailures;

            state.consecutiveFailures = 0;
            state.config = loaded.config;
            await this.writeState(competitorWebsiteId, state);

            await this.upsertScrapingConfigState(competitorWebsiteId, {
                consecutiveFailures: 0,
            });

            if (previousFailures > 0) {
                logger.info(`Recorded success for site ${competitorWebsiteId} in database, reset failure count`, {
                    previousFailures,
                });
            }
        });
    }

    async getNextAvailableTime(competitorWebsiteId: string): Promise<Date> {
        const loaded = await this.loadSiteConfigAndState(competitorWebsiteId);
        return loaded.state.nextAvailableTime;
    }

    async reset(competitorWebsiteId: string): Promise<void> {
        const redis = getRedisConnection();
        await redis.del(this.getStateKey(competitorWebsiteId), this.getConfigKey(competitorWebsiteId));
        logger.debug(`Reset rate limit state for site ${competitorWebsiteId}`);
    }

    async resetAll(): Promise<void> {
        const redis = getRedisConnection();
        const patterns = [RateLimiter.STATE_PREFIX, RateLimiter.CONFIG_PREFIX];

        for (const prefix of patterns) {
            let cursor = '0';
            do {
                const [nextCursor, keys] = (await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200)) as [string, string[]];
                cursor = nextCursor;
                if (keys.length > 0) {
                    await redis.del(...keys);
                }
            } while (cursor !== '0');
        }

        logger.debug('Reset all rate limit states');
    }

    async clearConfigCache(competitorWebsiteId: string): Promise<void> {
        const redis = getRedisConnection();
        await redis.del(this.getConfigKey(competitorWebsiteId));
        logger.debug(`Cleared config cache for site ${competitorWebsiteId}`);
    }

    async clearAllConfigCache(): Promise<void> {
        const redis = getRedisConnection();
        let cursor = '0';
        do {
            const [nextCursor, keys] = (await redis.scan(cursor, 'MATCH', `${RateLimiter.CONFIG_PREFIX}*`, 'COUNT', 200)) as [string, string[]];
            cursor = nextCursor;
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } while (cursor !== '0');

        logger.debug('Cleared all config cache');
    }

    async getConsecutiveFailures(competitorWebsiteId: string): Promise<number> {
        const loaded = await this.loadSiteConfigAndState(competitorWebsiteId);
        return loaded.state.consecutiveFailures;
    }
}
