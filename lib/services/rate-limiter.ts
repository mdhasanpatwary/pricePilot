/**
 * Token Bucket Rate Limiter
 * 
 * Implements the token bucket algorithm for rate limiting requests per domain.
 * Tokens are added at a constant rate, and each request consumes one token.
 * If no tokens are available, the request must wait.
 */

export interface RateLimiterConfig {
    requestsPerMinute: number;
    maxBurst?: number; // Maximum tokens that can accumulate (defaults to requestsPerMinute)
}

interface TokenBucket {
    tokens: number;
    lastRefill: number;
    config: RateLimiterConfig;
}

export class RateLimiter {
    private buckets: Map<string, TokenBucket> = new Map();

    /**
     * Wait for a token to become available for the given domain
     * @param domain The domain to rate limit
     * @param config Rate limit configuration
     * @returns Promise that resolves when a token is available
     */
    async waitForToken(domain: string, config: RateLimiterConfig): Promise<void> {
        const bucket = this.getOrCreateBucket(domain, config);

        // Refill tokens based on time elapsed
        this.refillBucket(bucket);

        // If we have tokens, consume one and return immediately
        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            return;
        }

        // Calculate how long to wait for the next token
        const tokensPerMs = config.requestsPerMinute / 60000; // Convert to tokens per millisecond
        const timeToNextToken = (1 - bucket.tokens) / tokensPerMs;

        // Wait for the next token
        await new Promise(resolve => setTimeout(resolve, timeToNextToken));

        // Refill and consume
        this.refillBucket(bucket);
        bucket.tokens = Math.max(0, bucket.tokens - 1);
    }

    /**
     * Check if a token is available without consuming it
     * @param domain The domain to check
     * @param config Rate limit configuration
     * @returns True if a token is available
     */
    hasToken(domain: string, config: RateLimiterConfig): boolean {
        const bucket = this.getOrCreateBucket(domain, config);
        this.refillBucket(bucket);
        return bucket.tokens >= 1;
    }

    /**
     * Get or create a token bucket for a domain
     */
    private getOrCreateBucket(domain: string, config: RateLimiterConfig): TokenBucket {
        let bucket = this.buckets.get(domain);

        if (!bucket) {
            const maxBurst = config.maxBurst ?? config.requestsPerMinute;
            bucket = {
                tokens: maxBurst, // Start with full bucket
                lastRefill: Date.now(),
                config: { ...config, maxBurst }
            };
            this.buckets.set(domain, bucket);
        }

        // Update config if it changed
        if (bucket.config.requestsPerMinute !== config.requestsPerMinute) {
            bucket.config = { ...config, maxBurst: config.maxBurst ?? config.requestsPerMinute };
        }

        return bucket;
    }

    /**
     * Refill tokens based on time elapsed since last refill
     */
    private refillBucket(bucket: TokenBucket): void {
        const now = Date.now();
        const elapsed = now - bucket.lastRefill;

        if (elapsed <= 0) return;

        // Calculate tokens to add based on elapsed time
        const tokensPerMs = bucket.config.requestsPerMinute / 60000;
        const tokensToAdd = elapsed * tokensPerMs;

        // Add tokens up to max burst
        const maxBurst = bucket.config.maxBurst ?? bucket.config.requestsPerMinute;
        bucket.tokens = Math.min(maxBurst, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;
    }

    /**
     * Reset rate limiter for a specific domain
     */
    reset(domain: string): void {
        this.buckets.delete(domain);
    }

    /**
     * Reset all rate limiters
     */
    resetAll(): void {
        this.buckets.clear();
    }

    /**
     * Get current token count for a domain (for debugging/monitoring)
     */
    getTokenCount(domain: string): number {
        const bucket = this.buckets.get(domain);
        if (!bucket) return 0;

        this.refillBucket(bucket);
        return bucket.tokens;
    }
}
