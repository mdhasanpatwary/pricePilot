/**
 * Configuration for Advanced Scraping Resilience Features
 * 
 * This module validates and provides access to environment variables
 * for captcha solving, retry strategy, concurrency management, and alerting.
 */

import { logger } from '@/lib/logger';

export interface CaptchaSolverConfig {
    enabled: boolean;
    apiKey: string;
    timeout: number;
}

export interface RetryStrategyConfig {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
}

export interface ConcurrencyConfig {
    min: number;
    max: number;
    initial: number;
}

export interface AlertThresholdsConfig {
    blockRateThreshold: number;
    solveRateThreshold: number;
    proxyFailureThreshold: number;
    responseTimeThreshold: number;
}

export interface ResilienceConfig {
    captchaSolver: CaptchaSolverConfig;
    retryStrategy: RetryStrategyConfig;
    concurrency: ConcurrencyConfig;
    alertThresholds: AlertThresholdsConfig;
}

/**
 * Parse environment variable as boolean
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true';
}

/**
 * Parse environment variable as number
 */
function parseNumber(value: string | undefined, defaultValue: number, min?: number, max?: number): number {
    if (!value) return defaultValue;

    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
        logger.warn(`Invalid number value: ${value}, using default: ${defaultValue}`);
        return defaultValue;
    }

    if (min !== undefined && parsed < min) {
        logger.warn(`Value ${parsed} is below minimum ${min}, using minimum`);
        return min;
    }

    if (max !== undefined && parsed > max) {
        logger.warn(`Value ${parsed} is above maximum ${max}, using maximum`);
        return max;
    }

    return parsed;
}

/**
 * Validate captcha solver configuration
 */
function validateCaptchaSolverConfig(): CaptchaSolverConfig {
    const enabled = parseBoolean(process.env.CAPTCHA_SOLVER_ENABLED, false);
    const apiKey = process.env.CAPTCHA_SOLVER_API_KEY || '';
    const timeout = parseNumber(process.env.CAPTCHA_SOLVER_TIMEOUT, 120000, 10000, 300000);

    if (enabled && !apiKey) {
        logger.warn('CAPTCHA_SOLVER_ENABLED is true but CAPTCHA_SOLVER_API_KEY is not set. Captcha solving will be disabled.');
    }

    return {
        enabled: enabled && !!apiKey,
        apiKey,
        timeout,
    };
}

/**
 * Validate retry strategy configuration
 */
function validateRetryStrategyConfig(): RetryStrategyConfig {
    const maxAttempts = parseNumber(process.env.RETRY_MAX_ATTEMPTS, 3, 1, 10);
    const initialDelay = parseNumber(process.env.RETRY_INITIAL_DELAY, 1000, 100, 10000);
    const maxDelay = parseNumber(process.env.RETRY_MAX_DELAY, 30000, 1000, 300000);
    const backoffMultiplier = parseNumber(process.env.RETRY_BACKOFF_MULTIPLIER, 2, 1.1, 5);

    // Validate that maxDelay is greater than initialDelay
    if (maxDelay < initialDelay) {
        logger.warn(`RETRY_MAX_DELAY (${maxDelay}) is less than RETRY_INITIAL_DELAY (${initialDelay}). Using initialDelay as maxDelay.`);
        return {
            maxAttempts,
            initialDelay,
            maxDelay: initialDelay,
            backoffMultiplier,
        };
    }

    return {
        maxAttempts,
        initialDelay,
        maxDelay,
        backoffMultiplier,
    };
}

/**
 * Validate concurrency configuration
 */
function validateConcurrencyConfig(): ConcurrencyConfig {
    const min = parseNumber(process.env.CONCURRENCY_MIN, 1, 1, 100);
    const max = parseNumber(process.env.CONCURRENCY_MAX, 10, 1, 100);
    const initial = parseNumber(process.env.CONCURRENCY_INITIAL, 3, 1, 100);

    // Validate that max >= min
    if (max < min) {
        logger.warn(`CONCURRENCY_MAX (${max}) is less than CONCURRENCY_MIN (${min}). Using min as max.`);
        return {
            min,
            max: min,
            initial: min,
        };
    }

    // Validate that initial is between min and max
    let validatedInitial = initial;
    if (initial < min) {
        logger.warn(`CONCURRENCY_INITIAL (${initial}) is less than CONCURRENCY_MIN (${min}). Using min.`);
        validatedInitial = min;
    } else if (initial > max) {
        logger.warn(`CONCURRENCY_INITIAL (${initial}) is greater than CONCURRENCY_MAX (${max}). Using max.`);
        validatedInitial = max;
    }

    return {
        min,
        max,
        initial: validatedInitial,
    };
}

/**
 * Validate alert thresholds configuration
 */
function validateAlertThresholdsConfig(): AlertThresholdsConfig {
    const blockRateThreshold = parseNumber(process.env.ALERT_BLOCK_RATE_THRESHOLD, 0.3, 0, 1);
    const solveRateThreshold = parseNumber(process.env.ALERT_SOLVE_RATE_THRESHOLD, 0.7, 0, 1);
    const proxyFailureThreshold = parseNumber(process.env.ALERT_PROXY_FAILURE_THRESHOLD, 0.5, 0, 1);
    const responseTimeThreshold = parseNumber(process.env.ALERT_RESPONSE_TIME_THRESHOLD, 5000, 1000, 60000);

    return {
        blockRateThreshold,
        solveRateThreshold,
        proxyFailureThreshold,
        responseTimeThreshold,
    };
}

/**
 * Load and validate all resilience configuration
 */
export function loadResilienceConfig(): ResilienceConfig {
    const config: ResilienceConfig = {
        captchaSolver: validateCaptchaSolverConfig(),
        retryStrategy: validateRetryStrategyConfig(),
        concurrency: validateConcurrencyConfig(),
        alertThresholds: validateAlertThresholdsConfig(),
    };

    return config;
}

/**
 * Log configuration on startup
 */
export function logResilienceConfig(config: ResilienceConfig): void {
    logger.info('=== Advanced Scraping Resilience Configuration ===');

    logger.info('Captcha Solver:', {
        enabled: config.captchaSolver.enabled,
        apiKeySet: !!config.captchaSolver.apiKey,
        timeout: `${config.captchaSolver.timeout}ms`,
    });

    logger.info('Retry Strategy:', {
        maxAttempts: config.retryStrategy.maxAttempts,
        initialDelay: `${config.retryStrategy.initialDelay}ms`,
        maxDelay: `${config.retryStrategy.maxDelay}ms`,
        backoffMultiplier: config.retryStrategy.backoffMultiplier,
    });

    logger.info('Concurrency:', {
        min: config.concurrency.min,
        max: config.concurrency.max,
        initial: config.concurrency.initial,
    });

    logger.info('Alert Thresholds:', {
        blockRate: `${(config.alertThresholds.blockRateThreshold * 100).toFixed(0)}%`,
        solveRate: `${(config.alertThresholds.solveRateThreshold * 100).toFixed(0)}%`,
        proxyFailure: `${(config.alertThresholds.proxyFailureThreshold * 100).toFixed(0)}%`,
        responseTime: `${config.alertThresholds.responseTimeThreshold}ms`,
    });

    logger.info('==================================================');
}

/**
 * Singleton instance of resilience configuration
 */
let resilienceConfigInstance: ResilienceConfig | null = null;

/**
 * Get resilience configuration (singleton)
 */
export function getResilienceConfig(): ResilienceConfig {
    if (!resilienceConfigInstance) {
        resilienceConfigInstance = loadResilienceConfig();
        logResilienceConfig(resilienceConfigInstance);
    }
    return resilienceConfigInstance;
}

/**
 * Reset configuration (useful for testing)
 */
export function resetResilienceConfig(): void {
    resilienceConfigInstance = null;
}
