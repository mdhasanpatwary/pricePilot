/**
 * Exponential Backoff Calculator for Bot Protection Handling
 * 
 * Implements exponential backoff calculation with jitter randomization.
 * Used by rate limiter and retry strategies to calculate delays.
 * 
 * Requirements: 4.2, 4.3, 4.6
 */

import { logger } from '@/lib/logger';

/**
 * Backoff configuration interface
 */
export interface BackoffConfig {
    baseDelay: number; // milliseconds
    maxDelay: number; // milliseconds
    backoffMultiplier: number;
    jitterRange: number; // percentage (0-100)
}

/**
 * Default backoff configuration
 */
export const DEFAULT_BACKOFF_CONFIG: BackoffConfig = {
    baseDelay: 2000, // 2 seconds
    maxDelay: 300000, // 5 minutes
    backoffMultiplier: 2.0,
    jitterRange: 20, // 20%
};

/**
 * Calculate delay using exponential backoff formula
 * 
 * Formula: delay = min(baseDelay × (backoffMultiplier ^ failures), maxDelay) ± jitter
 * 
 * The exponential backoff increases delay exponentially with each consecutive failure:
 * - 0 failures: baseDelay (e.g., 2s)
 * - 1 failure: baseDelay × multiplier (e.g., 4s)
 * - 2 failures: baseDelay × multiplier² (e.g., 8s)
 * - 3 failures: baseDelay × multiplier³ (e.g., 16s)
 * - etc., capped at maxDelay
 * 
 * Jitter adds randomization to prevent thundering herd problem:
 * - Randomizes delay within ±jitterRange% of calculated delay
 * - Example: 20% jitter on 10s delay = 8s to 12s
 * 
 * Requirements: 4.2, 4.3, 4.6
 * 
 * @param consecutiveFailures - Number of consecutive failures
 * @param config - Backoff configuration
 * @returns Calculated delay in milliseconds
 */
export function calculateDelay(
    consecutiveFailures: number,
    config: BackoffConfig = DEFAULT_BACKOFF_CONFIG
): number {
    // Validate inputs
    if (consecutiveFailures < 0) {
        logger.warn('Negative consecutive failures provided, using 0', {
            consecutiveFailures,
        });
        consecutiveFailures = 0;
    }

    // Calculate exponential delay
    // delay = baseDelay × (backoffMultiplier ^ consecutiveFailures)
    const exponentialDelay =
        config.baseDelay * Math.pow(config.backoffMultiplier, consecutiveFailures);

    // Cap delay at maximum configured value
    const cappedDelay = Math.min(exponentialDelay, config.maxDelay);

    // Apply jitter randomization
    const delayWithJitter = applyJitter(cappedDelay, config.jitterRange);

    logger.debug('Calculated backoff delay', {
        consecutiveFailures,
        exponentialDelay,
        cappedDelay,
        delayWithJitter,
        config,
    });

    return delayWithJitter;
}

/**
 * Apply jitter randomization to a delay value
 * 
 * Jitter prevents multiple clients from retrying simultaneously (thundering herd).
 * Adds random variation within ±jitterRange% of the base delay.
 * 
 * Requirements: 4.6
 * 
 * @param delay - Base delay in milliseconds
 * @param jitterRange - Jitter range as percentage (0-100)
 * @returns Delay with jitter applied
 */
export function applyJitter(delay: number, jitterRange: number): number {
    // Calculate jitter amount
    const jitter = delay * (jitterRange / 100);

    // Generate random jitter between -jitter and +jitter
    // Math.random() * 2 - 1 generates value between -1 and 1
    const randomJitter = (Math.random() * 2 - 1) * jitter;

    // Apply jitter and ensure non-negative result
    return Math.max(0, delay + randomJitter);
}

/**
 * Calculate delay for a specific failure count with custom config
 * 
 * Convenience function for calculating delay with custom configuration.
 * 
 * Requirements: 4.2, 4.3
 * 
 * @param consecutiveFailures - Number of consecutive failures
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay in milliseconds
 * @param backoffMultiplier - Backoff multiplier (typically 2.0)
 * @param jitterRange - Jitter range as percentage (0-100)
 * @returns Calculated delay in milliseconds
 */
export function calculateDelayWithParams(
    consecutiveFailures: number,
    baseDelay: number,
    maxDelay: number,
    backoffMultiplier: number,
    jitterRange: number
): number {
    return calculateDelay(consecutiveFailures, {
        baseDelay,
        maxDelay,
        backoffMultiplier,
        jitterRange,
    });
}

/**
 * Get example delays for different failure counts
 * 
 * Useful for documentation and testing purposes.
 * Returns delays without jitter for predictability.
 * 
 * @param config - Backoff configuration
 * @param maxFailures - Maximum number of failures to calculate (default: 10)
 * @returns Array of [failureCount, delay] tuples
 */
export function getExampleDelays(
    config: BackoffConfig = DEFAULT_BACKOFF_CONFIG,
    maxFailures: number = 10
): Array<[number, number]> {
    const delays: Array<[number, number]> = [];

    for (let failures = 0; failures <= maxFailures; failures++) {
        // Calculate without jitter for predictable examples
        const exponentialDelay =
            config.baseDelay * Math.pow(config.backoffMultiplier, failures);
        const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
        delays.push([failures, cappedDelay]);
    }

    return delays;
}

/**
 * Validate backoff configuration
 * 
 * Ensures configuration values are valid and reasonable.
 * 
 * @param config - Backoff configuration to validate
 * @returns Validation result with error messages if invalid
 */
export function validateBackoffConfig(config: BackoffConfig): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (config.baseDelay <= 0) {
        errors.push('baseDelay must be greater than 0');
    }

    if (config.maxDelay <= 0) {
        errors.push('maxDelay must be greater than 0');
    }

    if (config.maxDelay < config.baseDelay) {
        errors.push('maxDelay must be greater than or equal to baseDelay');
    }

    if (config.backoffMultiplier <= 1) {
        errors.push('backoffMultiplier must be greater than 1');
    }

    if (config.jitterRange < 0 || config.jitterRange > 100) {
        errors.push('jitterRange must be between 0 and 100');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}
