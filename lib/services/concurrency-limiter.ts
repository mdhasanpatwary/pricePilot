import { logger } from '../logger';
import { getRedisConnection } from '@/lib/queue/connection';

/**
 * Configuration options for the ConcurrencyLimiter
 */
export interface ConcurrencyConfig {
    minConcurrency: number; // Minimum concurrent requests (default: 1)
    maxConcurrency: number; // Maximum concurrent requests (default: 10)
    initialConcurrency: number; // Initial concurrent requests (default: 3)
    adjustmentThreshold: number; // Threshold for adjustment (default: 0.2 = 20%)
}

/**
 * Site metrics used for concurrency adjustment decisions
 */
export interface SiteMetrics {
    blockRate: number; // Percentage of blocked requests (0-1)
    successRate: number; // Percentage of successful requests (0-1)
    avgResponseTime: number; // Average response time in milliseconds
    recentRequests: number; // Number of recent requests
}

/**
 * State tracking for a specific site
 */
interface SiteState {
    currentConcurrency: number;
    activeRequests: number;
    requestQueue: Array<() => void>;
    lastAdjustedAt: number;
    recentResults: RequestResult[];
}

/**
 * Result of a single request
 */
interface RequestResult {
    success: boolean;
    blocked: boolean;
    responseTime: number;
    timestamp: number;
}

/**
 * ConcurrencyLimiter dynamically adjusts concurrent request limits based on site behavior.
 *
 * Features:
 * - Semaphore-based slot acquisition for concurrent request limiting
 * - Dynamic adjustment based on block rate, success rate, and response time
 * - Per-site concurrency tracking
 * - Automatic reduction on rate limits (HTTP 429)
 * - Gradual increase on high success rates
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 *
 * @example
 * ```typescript
 * const limiter = new ConcurrencyLimiter({
 *   minConcurrency: 1,
 *   maxConcurrency: 10,
 *   initialConcurrency: 3
 * });
 *
 * // Acquire slot before making request
 * await limiter.acquireSlot('example.com');
 * try {
 *   // Make request
 *   const response = await fetch(url);
 *
 *   // Adjust based on metrics
 *   limiter.adjustConcurrency('example.com', {
 *     blockRate: 0.1,
 *     successRate: 0.9,
 *     avgResponseTime: 500,
 *     recentRequests: 100
 *   });
 * } finally {
 *   limiter.releaseSlot('example.com');
 * }
 * ```
 */
export class ConcurrencyLimiter {
    private config: ConcurrencyConfig;
    private siteStates: Map<string, SiteState> = new Map();
    // Event-driven waiters: replaces 50ms spin-poll with zero-overhead Promise parking
    private waiters: Map<string, Array<() => void>> = new Map();
    private static readonly DISTRIBUTED_KEY_PREFIX = 'pp:concurrency:site:';
    private readonly leaseTtlMs: number;


    /**
     * Create a new ConcurrencyLimiter
     *
     * @param config - Configuration options (optional, uses defaults if not provided)
     */
    constructor(config?: Partial<ConcurrencyConfig>) {
        this.config = {
            minConcurrency: config?.minConcurrency ?? 1,
            maxConcurrency: config?.maxConcurrency ?? 10,
            initialConcurrency: config?.initialConcurrency ?? 3,
            adjustmentThreshold: config?.adjustmentThreshold ?? 0.2,
        };
        const leaseTtlRaw = Number(process.env.SCRAPE_SITE_CONCURRENCY_LEASE_TTL_MS || '600000');
        this.leaseTtlMs =
            Number.isFinite(leaseTtlRaw) && leaseTtlRaw >= 30_000 ? Math.floor(leaseTtlRaw) : 600000;


        // Validate and sanitize configuration
        if (this.config.minConcurrency < 1) {
            this.config.minConcurrency = 1;
            logger.warn('[ConcurrencyLimiter] minConcurrency must be at least 1, resetting to 1');
        }

        if (this.config.maxConcurrency < this.config.minConcurrency) {
            this.config.maxConcurrency = this.config.minConcurrency;
            logger.warn('[ConcurrencyLimiter] maxConcurrency must be >= minConcurrency, resetting to minConcurrency');
        }

        if (this.config.initialConcurrency < this.config.minConcurrency) {
            this.config.initialConcurrency = this.config.minConcurrency;
            logger.warn('[ConcurrencyLimiter] initialConcurrency was below min, clamping to minConcurrency');
        } else if (this.config.initialConcurrency > this.config.maxConcurrency) {
            this.config.initialConcurrency = this.config.maxConcurrency;
            logger.warn('[ConcurrencyLimiter] initialConcurrency was above max, clamping to maxConcurrency');
        }

        logger.info('[ConcurrencyLimiter] Initialized', {
            minConcurrency: this.config.minConcurrency,
            maxConcurrency: this.config.maxConcurrency,
            initialConcurrency: this.config.initialConcurrency,
        });
    }

    private normalizeSite(site: string): string {
        return (site || '').trim().toLowerCase().replace(/^www\./, '');
    }

    private getDistributedKey(site: string): string {
        return `${ConcurrencyLimiter.DISTRIBUTED_KEY_PREFIX}${this.normalizeSite(site)}`;
    }

    private async tryAcquireDistributed(site: string, limit: number): Promise<boolean> {
        const redis = getRedisConnection();
        const key = this.getDistributedKey(site);
        const ttlMs = this.leaseTtlMs;
        const cappedLimit = Math.max(1, Math.floor(limit));

        const lua = `
            local key = KEYS[1]
            local max = tonumber(ARGV[1])
            local ttl = tonumber(ARGV[2])
            local current = tonumber(redis.call("GET", key) or "0")
            if current >= max then
              return 0
            end
            local nextValue = redis.call("INCR", key)
            redis.call("PEXPIRE", key, ttl)
            return nextValue
        `;

        const result = (await redis.eval(lua, 1, key, cappedLimit, ttlMs)) as number;
        return result > 0;
    }

    private async releaseDistributed(site: string): Promise<void> {
        const redis = getRedisConnection();
        const key = this.getDistributedKey(site);
        const ttlMs = this.leaseTtlMs;
        const lua = `
            local key = KEYS[1]
            local ttl = tonumber(ARGV[1])
            local current = tonumber(redis.call("GET", key) or "0")
            if current <= 1 then
              redis.call("DEL", key)
              return 0
            end
            local nextValue = redis.call("DECR", key)
            if nextValue <= 0 then
              redis.call("DEL", key)
              return 0
            end
            redis.call("PEXPIRE", key, ttl)
            return nextValue
        `;
        await redis.eval(lua, 1, key, ttlMs);
    }

    /**
     * Get or create state for a site
     */
    private getState(site: string): SiteState {
        let state = this.siteStates.get(site);
        if (!state) {
            state = {
                currentConcurrency: this.config.initialConcurrency,
                activeRequests: 0,
                requestQueue: [],
                lastAdjustedAt: Date.now(),
                recentResults: [],
            };
            this.siteStates.set(site, state);
            logger.info(`[ConcurrencyLimiter] Initialized state for site: ${site}`, {
                initialConcurrency: this.config.initialConcurrency,
            });
        }
        return state;
    }

    /**
     * Acquire a slot for making a concurrent request.
     * Implements semaphore pattern - waits if limit is reached.
     * Must be paired with releaseSlot() in a try-finally block.
     *
     * Requirements: 6.4, 6.5
     *
     * @param site - Site identifier (e.g., 'example.com')
     * @returns Promise that resolves when slot is acquired
     *
     * @example
     * ```typescript
     * await limiter.acquireSlot('example.com');
     * try {
     *   // Make request
     * } finally {
     *   limiter.releaseSlot('example.com');
     * }
     * ```
     */
    async acquireSlot(site: string): Promise<void> {
        const state = this.getState(site);
        // Event-driven: try immediately, then park until releaseSlot() wakes us
        while (true) {
            if (state.activeRequests < state.currentConcurrency) {
                const acquired = await this.tryAcquireDistributed(site, state.currentConcurrency);
                if (acquired) {
                    state.activeRequests++;
                    return;
                }
            }
            // Park the caller — zero CPU/Redis while waiting
            await new Promise<void>((resolve) => {
                const q = this.waiters.get(site) ?? [];
                q.push(resolve);
                this.waiters.set(site, q);
            });
        }
    }

    /**
     * Release a concurrent request slot.
     * Processes the next queued request if any.
     * Should be called in a finally block after acquireSlot().
     *
     * Requirements: 6.4, 6.5
     *
     * @param site - Site identifier (e.g., 'example.com')
     *
     * @example
     * ```typescript
     * await limiter.acquireSlot('example.com');
     * try {
     *   // Make request
     * } finally {
     *   limiter.releaseSlot('example.com');
     * }
     * ```
     */
    releaseSlot(site: string): void {
        const state = this.siteStates.get(site);
        if (!state) {
            logger.warn(`[ConcurrencyLimiter] Attempted to release slot for unknown site: ${site}`);
            return;
        }

        state.activeRequests = Math.max(0, state.activeRequests - 1);
        void this.releaseDistributed(site).catch((error) => {
            logger.warn('[ConcurrencyLimiter] Failed to release distributed concurrency slot', {
                site,
                error: error instanceof Error ? error.message : String(error),
            });
        });

        // Wake one parked waiter (FIFO) so it can re-try acquireSlot
        const q = this.waiters.get(site);
        if (q && q.length > 0) {
            const next = q.shift()!;
            next();
        }
    }

    /**
     * Adjust concurrency based on site metrics.
     *
     * Adjustment rules:
     * - Reduce by 50% when block rate > 20%
     * - Reduce by 50% on HTTP 429 (rate limit)
     * - Increase by 10% when success rate > 80% and avg response time < 2000ms
     * - Enforce min/max bounds
     *
     * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
     *
     * @param site - Site identifier (e.g., 'example.com')
     * @param metrics - Site metrics for adjustment decision
     *
     * @example
     * ```typescript
     * limiter.adjustConcurrency('example.com', {
     *   blockRate: 0.25,
     *   successRate: 0.75,
     *   avgResponseTime: 1500,
     *   recentRequests: 100
     * });
     * ```
     */
    adjustConcurrency(site: string, metrics: SiteMetrics): void {
        const state = this.getState(site);
        const oldConcurrency = state.currentConcurrency;
        let newConcurrency = oldConcurrency;
        let reason = '';

        // Rule 1: Reduce by 50% if block rate exceeds 20%
        // Requirement 6.2
        if (metrics.blockRate > this.config.adjustmentThreshold) {
            newConcurrency = Math.max(
                this.config.minConcurrency,
                Math.floor(oldConcurrency * 0.5)
            );
            reason = `High block rate (${(metrics.blockRate * 100).toFixed(1)}%)`;
        }
        // Rule 2: Increase by 10% if success rate > 80% and fast responses
        // Requirement 6.3
        else if (metrics.successRate > 0.8 && metrics.avgResponseTime < 2000) {
            newConcurrency = Math.min(
                this.config.maxConcurrency,
                Math.ceil(oldConcurrency * 1.1)
            );
            reason = `High success rate (${(metrics.successRate * 100).toFixed(1)}%) and fast responses (${metrics.avgResponseTime.toFixed(0)}ms)`;
        }

        // Only apply adjustment if concurrency changed
        if (newConcurrency !== oldConcurrency) {
            state.currentConcurrency = newConcurrency;
            state.lastAdjustedAt = Date.now();

            logger.info(`[ConcurrencyLimiter] Adjusted concurrency for ${site}`, {
                oldConcurrency,
                newConcurrency,
                reason,
                blockRate: (metrics.blockRate * 100).toFixed(1) + '%',
                successRate: (metrics.successRate * 100).toFixed(1) + '%',
                avgResponseTime: metrics.avgResponseTime.toFixed(0) + 'ms',
            });
        }
    }

    /**
     * Immediately reduce concurrency by 50% (e.g., on HTTP 429).
     * This is a more aggressive reduction than the normal adjustment.
     *
     * Requirement 6.1
     *
     * @param site - Site identifier (e.g., 'example.com')
     * @param reason - Reason for reduction (e.g., 'HTTP 429 Rate Limit')
     *
     * @example
     * ```typescript
     * if (response.status === 429) {
     *   limiter.reduceImmediately('example.com', 'HTTP 429 Rate Limit');
     * }
     * ```
     */
    reduceImmediately(site: string, reason: string): void {
        const state = this.getState(site);
        const oldConcurrency = state.currentConcurrency;
        const newConcurrency = Math.max(
            this.config.minConcurrency,
            Math.floor(oldConcurrency * 0.5)
        );

        if (newConcurrency !== oldConcurrency) {
            state.currentConcurrency = newConcurrency;
            state.lastAdjustedAt = Date.now();

            logger.warn(`[ConcurrencyLimiter] Immediate concurrency reduction for ${site}`, {
                oldConcurrency,
                newConcurrency,
                reason,
            });
        }
    }

    /**
     * Get the current concurrency limit for a site.
     *
     * @param site - Site identifier (e.g., 'example.com')
     * @returns Current concurrency limit
     *
     * @example
     * ```typescript
     * const limit = limiter.getCurrentConcurrency('example.com');
     * console.log(`Current limit: ${limit}`);
     * ```
     */
    getCurrentConcurrency(site: string): number {
        const state = this.siteStates.get(site);
        return state?.currentConcurrency ?? this.config.initialConcurrency;
    }

    /**
     * Get the number of active requests for a site.
     *
     * @param site - Site identifier (e.g., 'example.com')
     * @returns Number of active requests
     */
    getActiveRequests(site: string): number {
        const state = this.siteStates.get(site);
        return state?.activeRequests ?? 0;
    }

    /**
     * Get the number of queued requests for a site.
     *
     * @param site - Site identifier (e.g., 'example.com')
     * @returns Number of queued requests
     */
    getQueuedRequests(site: string): number {
        const state = this.siteStates.get(site);
        return state?.requestQueue.length ?? 0;
    }

    /**
     * Get statistics for all sites.
     *
     * @returns Map of site to statistics
     */
    getStats(): Map<string, { currentConcurrency: number; activeRequests: number; queuedRequests: number }> {
        const stats = new Map();
        for (const [site, state] of this.siteStates.entries()) {
            stats.set(site, {
                currentConcurrency: state.currentConcurrency,
                activeRequests: state.activeRequests,
                queuedRequests: state.requestQueue.length,
            });
        }
        return stats;
    }

    /**
     * Record the result of a request and automatically adjust concurrency.
     *
     * @param site - Site identifier
     * @param success - Whether the request was successful
     * @param blocked - Whether the request was blocked
     * @param responseTime - Response time in milliseconds
     */
    recordResult(site: string, success: boolean, blocked: boolean, responseTime: number): void {
        const state = this.getState(site);

        // Add result to history
        state.recentResults.push({ success, blocked, responseTime, timestamp: Date.now() });

        // Keep only recent results (last 50)
        if (state.recentResults.length > 50) {
            state.recentResults.shift();
        }

        // Calculate metrics
        const historyLength = state.recentResults.length;
        if (historyLength < 5) return; // Need minimal sample size

        // Count blocked results
        const blockedCount = state.recentResults.filter(r => r.blocked).length;

        // Count successful results
        const successCount = state.recentResults.filter(r => r.success).length;

        // Calculate average response time
        const totalResponseTime = state.recentResults.reduce((sum, r) => sum + r.responseTime, 0);
        const avgResponseTime = totalResponseTime / historyLength;

        const metrics: SiteMetrics = {
            blockRate: blockedCount / historyLength,
            successRate: successCount / historyLength,
            avgResponseTime,
            recentRequests: historyLength
        };

        // Adjust concurrency based on metrics
        this.adjustConcurrency(site, metrics);
    }

    /**
     * Reset state for a specific site.
     * Useful for testing or when site configuration changes.
     *
     * @param site - Site identifier (e.g., 'example.com')
     */
    resetSite(site: string): void {
        this.siteStates.delete(site);
        const redis = getRedisConnection();
        void redis.del(this.getDistributedKey(site)).catch(() => undefined);
        logger.info(`[ConcurrencyLimiter] Reset state for site: ${site}`);
    }

    /**
     * Reset all site states.
     * Useful for testing or system restart.
     */
    resetAll(): void {
        this.siteStates.clear();
        const redis = getRedisConnection();
        let cursor = '0';
        const pattern = `${ConcurrencyLimiter.DISTRIBUTED_KEY_PREFIX}*`;
        const run = async () => {
            do {
                const [nextCursor, keys] = (await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200)) as [string, string[]];
                cursor = nextCursor;
                if (keys.length > 0) {
                    await redis.del(...keys);
                }
            } while (cursor !== '0');
        };
        void run().catch(() => undefined);
        logger.info('[ConcurrencyLimiter] Reset all site states');
    }
}
