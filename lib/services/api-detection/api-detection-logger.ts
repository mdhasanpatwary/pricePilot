/**
 * Structured logging utility for API detection operations
 * Provides JSON-formatted logs for detection attempts, discovered APIs, and fallback events
 * 
 * Requirements: 4.3, 7.1, 9.1, 9.2, 9.4
 */

import { logger } from '@/lib/logger';
import { ApiDetectionMetrics } from './api-detection-metrics';

export interface DetectionAttemptLog {
    competitorWebsiteId: string;
    websiteUrl: string;
    tenantId: string;
    success: boolean;
    discoveredApiCount: number;
    detectionTimeMs: number;
    error?: string;
    timestamp: string;
}

export interface DiscoveredApiLog {
    competitorWebsiteId: string;
    apiUrl: string;
    method: string;
    responseFormat: 'json' | 'xml';
    confidenceScore: number;
    hasAuthentication: boolean;
    hasPagination: boolean;
    fieldCount: number;
    timestamp: string;
}

export interface FallbackEventLog {
    competitorWebsiteId: string;
    websiteUrl: string;
    tenantId: string;
    reason: 'timeout' | 'no_api_found' | 'api_failed' | 'validation_failed' | 'extraction_failed';
    error?: string;
    attemptedApis?: number;
    timestamp: string;
}

export interface ApiExtractionLog {
    competitorWebsiteId: string;
    apiUrl: string;
    success: boolean;
    productCount: number;
    extractionTimeMs: number;
    error?: string;
    timestamp: string;
}

export interface CacheOperationLog {
    competitorWebsiteId: string;
    operation: 'hit' | 'miss' | 'store' | 'invalidate';
    success: boolean;
    error?: string;
    timestamp: string;
}

/**
 * API Detection Logger
 * Provides structured logging methods for all API detection operations
 */
export class ApiDetectionLogger {
    /**
     * Log a detection attempt with success/failure status
     */
    static logDetectionAttempt(data: Omit<DetectionAttemptLog, 'timestamp'>): void {
        const log: DetectionAttemptLog = {
            ...data,
            timestamp: new Date().toISOString(),
        };

        if (data.success) {
            logger.info('API detection attempt completed', {
                event: 'api_detection_attempt',
                ...log,
            });
        } else {
            logger.error('API detection attempt failed', {
                event: 'api_detection_attempt',
                ...log,
            });
        }
    }

    /**
     * Log a discovered API with details
     */
    static logDiscoveredApi(data: Omit<DiscoveredApiLog, 'timestamp'>): void {
        const log: DiscoveredApiLog = {
            ...data,
            timestamp: new Date().toISOString(),
        };

        logger.info('API endpoint discovered', {
            event: 'api_discovered',
            ...log,
        });
    }

    /**
     * Log a fallback event with reason and errors
     */
    static logFallbackEvent(data: Omit<FallbackEventLog, 'timestamp'>): void {
        const log: FallbackEventLog = {
            ...data,
            timestamp: new Date().toISOString(),
        };

        logger.warn('Falling back to HTML scraping', {
            event: 'api_fallback',
            ...log,
        });

        // Track fallback metric
        ApiDetectionMetrics.trackFallback({
            tenantId: data.tenantId,
            competitorWebsiteId: data.competitorWebsiteId,
        }).catch((error) => {
            // Silently ignore metrics tracking errors
            console.error('Failed to track fallback metric:', error);
        });
    }

    /**
     * Log an API extraction attempt
     */
    static logApiExtraction(data: Omit<ApiExtractionLog, 'timestamp'>): void {
        const log: ApiExtractionLog = {
            ...data,
            timestamp: new Date().toISOString(),
        };

        if (data.success) {
            logger.info('API extraction completed', {
                event: 'api_extraction',
                ...log,
            });
        } else {
            logger.error('API extraction failed', {
                event: 'api_extraction',
                ...log,
            });
        }
    }

    /**
     * Log cache operations
     */
    static logCacheOperation(data: Omit<CacheOperationLog, 'timestamp'>): void {
        const log: CacheOperationLog = {
            ...data,
            timestamp: new Date().toISOString(),
        };

        logger.debug('Cache operation', {
            event: 'api_cache_operation',
            ...log,
        });
    }

    /**
     * Log validation results
     */
    static logValidation(data: {
        competitorWebsiteId: string;
        apiUrl: string;
        isValid: boolean;
        confidenceScore: number;
        errors: string[];
    }): void {
        const log = {
            ...data,
            timestamp: new Date().toISOString(),
        };

        if (data.isValid) {
            logger.info('API validation successful', {
                event: 'api_validation',
                ...log,
            });
        } else {
            logger.warn('API validation failed', {
                event: 'api_validation',
                ...log,
            });
        }
    }

    /**
     * Log network interception events
     */
    static logNetworkInterception(data: {
        competitorWebsiteId: string;
        capturedRequestCount: number;
        filteredRequestCount: number;
        interceptionTimeMs: number;
    }): void {
        const log = {
            ...data,
            timestamp: new Date().toISOString(),
        };

        logger.debug('Network interception completed', {
            event: 'network_interception',
            ...log,
        });
    }

    /**
     * Log pattern analysis events
     */
    static logPatternAnalysis(data: {
        competitorWebsiteId: string;
        requestsAnalyzed: number;
        patternsFound: number;
        analysisTimeMs: number;
    }): void {
        const log = {
            ...data,
            timestamp: new Date().toISOString(),
        };

        logger.debug('Pattern analysis completed', {
            event: 'pattern_analysis',
            ...log,
        });
    }
}
