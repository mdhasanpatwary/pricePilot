/**
 * Security Monitoring Service
 *
 * Tracks security-related events including authentication failures, rate limit violations,
 * suspicious patterns, and unauthorized access attempts. Integrates with the metrics
 * collector and alert system to provide comprehensive security monitoring.
 *
 * Features:
 * - Authentication failure tracking with IP-based detection
 * - Rate limit violation monitoring
 * - Suspicious pattern detection (brute force, credential stuffing)
 * - Unauthorized access attempt tracking
 * - Security-specific alert rules
 * - Context-rich security event logging
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 *
 * @module lib/services/monitoring/security-monitoring
 */

import { metricsCollector } from './metrics-collector';
import { logger } from '@/lib/logger';
import type { Redis } from "ioredis";
import { getRedisConnection } from "@/lib/queue/connection";

/**
 * Security event types
 */
export enum SecurityEventType {
    AUTH_FAILURE = 'auth_failure',
    RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
    SUSPICIOUS_PATTERN = 'suspicious_pattern',
    UNAUTHORIZED_ACCESS = 'unauthorized_access',
    BRUTE_FORCE_ATTEMPT = 'brute_force_attempt',
    CREDENTIAL_STUFFING = 'credential_stuffing',
    INVALID_TOKEN = 'invalid_token',
    SESSION_HIJACK_ATTEMPT = 'session_hijack_attempt',
}

/**
 * Security event context
 */
export interface SecurityEventContext {
    ipAddress: string;
    userAgent?: string;
    endpoint?: string;
    userId?: string;
    tenantId?: string;
    email?: string;
    method?: string;
    statusCode?: number;
    requestId?: string;
    additionalData?: Record<string, any>;
}

/**
 * Security event record
 */
export interface SecurityEvent {
    type: SecurityEventType;
    timestamp: Date;
    severity: 'low' | 'medium' | 'high' | 'critical';
    context: SecurityEventContext;
    description: string;
}

/**
 * Suspicious pattern detection result
 */
export interface SuspiciousPatternResult {
    detected: boolean;
    patternType?: string;
    confidence: number;
    details?: string;
}

/**
 * Security Monitoring Service Interface
 */
export interface ISecurityMonitoringService {
    recordAuthFailure(context: SecurityEventContext): Promise<void>;
    recordRateLimitViolation(context: SecurityEventContext): Promise<void>;
    recordUnauthorizedAccess(context: SecurityEventContext): Promise<void>;
    detectSuspiciousPattern(context: SecurityEventContext): Promise<SuspiciousPatternResult>;
    getSecurityEvents(timeWindow: number, ipAddress?: string): Promise<SecurityEvent[]>;
    getAuthFailureCount(ipAddress: string, timeWindow: number): Promise<number>;
}

/**
 * Security Monitoring Service Implementation
 */
export class SecurityMonitoringService implements ISecurityMonitoringService {
    private redis: Redis | null;
    private readonly BRUTE_FORCE_THRESHOLD = 5; // failures in time window
    private readonly BRUTE_FORCE_WINDOW = 5 * 60 * 1000; // 5 minutes
    private readonly CREDENTIAL_STUFFING_THRESHOLD = 10; // different emails from same IP
    private readonly CREDENTIAL_STUFFING_WINDOW = 10 * 60 * 1000; // 10 minutes

    constructor() {
        this.redis = getRedisConnection();
    }

    /**
     * Record authentication failure event
     * Requirement 11.1: Track repeated authentication failures
     *
     * @param context - Security event context with IP, user agent, etc.
     */
    async recordAuthFailure(context: SecurityEventContext): Promise<void> {
        try {
            // Record metric for alert evaluation
            await metricsCollector.recordAuthFailure(context.ipAddress);

            // Store detailed event in Redis
            const event: SecurityEvent = {
                type: SecurityEventType.AUTH_FAILURE,
                timestamp: new Date(),
                severity: 'medium',
                context,
                description: `Authentication failure from ${context.ipAddress}`,
            };

            await this.storeSecurityEvent(event);

            // Check for brute force pattern
            const failureCount = await this.getAuthFailureCount(
                context.ipAddress,
                this.BRUTE_FORCE_WINDOW
            );

            if (failureCount >= this.BRUTE_FORCE_THRESHOLD) {
                await this.recordSuspiciousPattern(
                    context,
                    'brute_force',
                    `${failureCount} authentication failures detected`
                );
            }

            // Track unique emails attempted from this IP for credential stuffing detection
            if (context.email) {
                await this.trackEmailAttempt(context.ipAddress, context.email);
            }

            logger.warn('Authentication failure recorded', {
                ipAddress: context.ipAddress,
                email: context.email,
                userAgent: context.userAgent,
                failureCount,
            });
        } catch (error) {
            logger.error('Failed to record auth failure', {
                error: error instanceof Error ? error.message : String(error),
                context,
            });
        }
    }

    /**
     * Record rate limit violation event
     * Requirement 11.2: Track API rate limit violations
     *
     * @param context - Security event context
     */
    async recordRateLimitViolation(context: SecurityEventContext): Promise<void> {
        try {
            // Record metric
            if (this.redis) {
                const timestamp = Date.now();
                const key = `metrics:rate_limit_violation:${context.ipAddress}`;

                await this.redis.zadd(
                    key,
                    timestamp,
                    JSON.stringify({
                        timestamp,
                        value: 1,
                        labels: {
                            ipAddress: context.ipAddress,
                            endpoint: context.endpoint,
                            userId: context.userId,
                        },
                    })
                );

                await this.redis.expire(key, 60 * 60); // 1 hour TTL
            }

            // Store detailed event
            const event: SecurityEvent = {
                type: SecurityEventType.RATE_LIMIT_EXCEEDED,
                timestamp: new Date(),
                severity: 'medium',
                context,
                description: `Rate limit exceeded from ${context.ipAddress} on ${context.endpoint}`,
            };

            await this.storeSecurityEvent(event);

            logger.warn('Rate limit violation recorded', {
                ipAddress: context.ipAddress,
                endpoint: context.endpoint,
                userId: context.userId,
            });
        } catch (error) {
            logger.error('Failed to record rate limit violation', {
                error: error instanceof Error ? error.message : String(error),
                context,
            });
        }
    }

    /**
     * Record unauthorized access attempt
     * Requirement 11.4: Track unauthorized access attempts
     *
     * @param context - Security event context
     */
    async recordUnauthorizedAccess(context: SecurityEventContext): Promise<void> {
        try {
            // Record metric
            if (this.redis) {
                const timestamp = Date.now();
                const key = `metrics:unauthorized_access:all`;

                await this.redis.zadd(
                    key,
                    timestamp,
                    JSON.stringify({
                        timestamp,
                        value: 1,
                        labels: {
                            ipAddress: context.ipAddress,
                            endpoint: context.endpoint,
                            userId: context.userId,
                            statusCode: context.statusCode,
                        },
                    })
                );

                await this.redis.expire(key, 60 * 60); // 1 hour TTL
            }

            // Store detailed event
            const event: SecurityEvent = {
                type: SecurityEventType.UNAUTHORIZED_ACCESS,
                timestamp: new Date(),
                severity: 'high',
                context,
                description: `Unauthorized access attempt from ${context.ipAddress} to ${context.endpoint}`,
            };

            await this.storeSecurityEvent(event);

            logger.warn('Unauthorized access attempt recorded', {
                ipAddress: context.ipAddress,
                endpoint: context.endpoint,
                userId: context.userId,
                statusCode: context.statusCode,
            });
        } catch (error) {
            logger.error('Failed to record unauthorized access', {
                error: error instanceof Error ? error.message : String(error),
                context,
            });
        }
    }

    /**
     * Detect suspicious patterns in security events
     * Requirement 11.3: Detect suspicious API access patterns
     *
     * @param context - Security event context
     * @returns Detection result with pattern type and confidence
     */
    async detectSuspiciousPattern(
        context: SecurityEventContext
    ): Promise<SuspiciousPatternResult> {
        try {
            // Check for brute force pattern
            const authFailures = await this.getAuthFailureCount(
                context.ipAddress,
                this.BRUTE_FORCE_WINDOW
            );

            if (authFailures >= this.BRUTE_FORCE_THRESHOLD) {
                return {
                    detected: true,
                    patternType: 'brute_force',
                    confidence: Math.min(authFailures / this.BRUTE_FORCE_THRESHOLD, 1.0),
                    details: `${authFailures} authentication failures in ${this.BRUTE_FORCE_WINDOW / 60000} minutes`,
                };
            }

            // Check for credential stuffing pattern
            const uniqueEmails = await this.getUniqueEmailAttempts(
                context.ipAddress,
                this.CREDENTIAL_STUFFING_WINDOW
            );

            if (uniqueEmails >= this.CREDENTIAL_STUFFING_THRESHOLD) {
                return {
                    detected: true,
                    patternType: 'credential_stuffing',
                    confidence: Math.min(uniqueEmails / this.CREDENTIAL_STUFFING_THRESHOLD, 1.0),
                    details: `${uniqueEmails} different email attempts in ${this.CREDENTIAL_STUFFING_WINDOW / 60000} minutes`,
                };
            }

            // Check for rapid rate limit violations (potential DoS)
            const rateLimitViolations = await this.getRateLimitViolationCount(
                context.ipAddress,
                5 * 60 * 1000 // 5 minutes
            );

            if (rateLimitViolations >= 10) {
                return {
                    detected: true,
                    patternType: 'potential_dos',
                    confidence: 0.8,
                    details: `${rateLimitViolations} rate limit violations in 5 minutes`,
                };
            }

            return {
                detected: false,
                confidence: 0,
            };
        } catch (error) {
            logger.error('Failed to detect suspicious pattern', {
                error: error instanceof Error ? error.message : String(error),
                context,
            });

            return {
                detected: false,
                confidence: 0,
            };
        }
    }

    /**
     * Get security events within a time window
     *
     * @param timeWindow - Time window in milliseconds
     * @param ipAddress - Optional IP address filter
     * @returns Array of security events
     */
    async getSecurityEvents(
        timeWindow: number,
        ipAddress?: string
    ): Promise<SecurityEvent[]> {
        if (!this.redis) return [];

        try {
            const now = Date.now();
            const startTime = now - timeWindow;

            // For simplicity, we'll use a single key for all events
            const key = 'security:events:all';
            const members = await this.redis.zrange(key, 0, -1);

            const events: SecurityEvent[] = [];

            for (const member of members) {
                try {
                    const event = JSON.parse(member as string) as SecurityEvent;

                    // Normalize timestamp to number (ms)
                    const eventTs = typeof event.timestamp === 'string'
                        ? Date.parse(event.timestamp)
                        : event.timestamp instanceof Date
                            ? event.timestamp.getTime()
                            : (event.timestamp as unknown as number);

                    // Filter by timestamp and IP if specified
                    if (eventTs >= startTime && (!ipAddress || event.context.ipAddress === ipAddress)) {
                        events.push(event);
                    }
                } catch (error) {
                    logger.error('Failed to parse security event', { error });
                }
            }

            return events;
        } catch (error) {
            logger.error('Failed to get security events', {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }

    /**
     * Get authentication failure count for an IP address
     *
     * @param ipAddress - IP address to check
     * @param timeWindow - Time window in milliseconds
     * @returns Number of authentication failures
     */
    async getAuthFailureCount(ipAddress: string, timeWindow: number): Promise<number> {
        if (!this.redis) return 0;

        try {
            const now = Date.now();
            const startTime = now - timeWindow;
            const key = `metrics:auth_failure:${ipAddress}`;

            const count = await this.redis.zcount(key, startTime, now);
            return count;
        } catch (error) {
            logger.error('Failed to get auth failure count', {
                error: error instanceof Error ? error.message : String(error),
                ipAddress,
            });
            return 0;
        }
    }

    /**
     * Store security event in Redis
     *
     * @param event - Security event to store
     */
    private async storeSecurityEvent(event: SecurityEvent): Promise<void> {
        if (!this.redis) return;

        try {
            const key = 'security:events:all';
            const timestamp = event.timestamp.getTime();

            await this.redis.zadd(key, timestamp, JSON.stringify(event));

            // Set TTL for security events (7 days)
            await this.redis.expire(key, 7 * 24 * 60 * 60);
        } catch (error) {
            logger.error('Failed to store security event', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Record suspicious pattern detection
     *
     * @param context - Security event context
     * @param patternType - Type of suspicious pattern
     * @param details - Additional details
     */
    private async recordSuspiciousPattern(
        context: SecurityEventContext,
        patternType: string,
        details: string
    ): Promise<void> {
        try {
            const event: SecurityEvent = {
                type: SecurityEventType.SUSPICIOUS_PATTERN,
                timestamp: new Date(),
                severity: 'critical',
                context: {
                    ...context,
                    additionalData: {
                        patternType,
                        details,
                    },
                },
                description: `Suspicious pattern detected: ${patternType} - ${details}`,
            };

            await this.storeSecurityEvent(event);

            // Record metric for alert evaluation
            if (this.redis) {
                const timestamp = Date.now();
                const key = `metrics:suspicious_pattern:${context.ipAddress}`;

                await this.redis.zadd(
                    key,
                    timestamp,
                    JSON.stringify({
                        timestamp,
                        value: 1,
                        labels: {
                            ipAddress: context.ipAddress,
                            patternType,
                        },
                    })
                );

                await this.redis.expire(key, 60 * 60); // 1 hour TTL
            }

            logger.error('Suspicious pattern detected', {
                ipAddress: context.ipAddress,
                patternType,
                details,
            });
        } catch (error) {
            logger.error('Failed to record suspicious pattern', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Track email attempt from IP address for credential stuffing detection
     *
     * @param ipAddress - IP address
     * @param email - Email attempted
     */
    private async trackEmailAttempt(ipAddress: string, email: string): Promise<void> {
        if (!this.redis) return;

        try {
            const key = `security:email_attempts:${ipAddress}`;
            const timestamp = Date.now();

            await this.redis.zadd(key, timestamp, email);

            // Set TTL for email attempts (10 minutes)
            await this.redis.expire(key, 10 * 60);
        } catch (error) {
            logger.error('Failed to track email attempt', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Get unique email attempts from IP address
     *
     * @param ipAddress - IP address
     * @param timeWindow - Time window in milliseconds
     * @returns Number of unique email attempts
     */
    private async getUniqueEmailAttempts(
        ipAddress: string,
        timeWindow: number
    ): Promise<number> {
        if (!this.redis) return 0;

        try {
            const now = Date.now();
            const startTime = now - timeWindow;
            const key = `security:email_attempts:${ipAddress}`;

            const emails = await this.redis.zrange(key, 0, -1);
            const recentEmails: string[] = [];

            for (const email of emails) {
                try {
                    const scoreRaw = await this.redis.zscore(key, email as string);
                    const score = scoreRaw == null ? null : Number(scoreRaw);
                    if (score != null && Number.isFinite(score) && score >= startTime && score <= now) {
                        recentEmails.push(email as string);
                    }
                } catch (err) {
                    // ignore individual failures
                }
            }

            const uniqueEmails = new Set(recentEmails);

            return uniqueEmails.size;
        } catch (error) {
            logger.error('Failed to get unique email attempts', {
                error: error instanceof Error ? error.message : String(error),
            });
            return 0;
        }
    }

    /**
     * Get rate limit violation count for an IP address
     *
     * @param ipAddress - IP address
     * @param timeWindow - Time window in milliseconds
     * @returns Number of rate limit violations
     */
    private async getRateLimitViolationCount(
        ipAddress: string,
        timeWindow: number
    ): Promise<number> {
        if (!this.redis) return 0;

        try {
            const now = Date.now();
            const startTime = now - timeWindow;
            const key = `metrics:rate_limit_violation:${ipAddress}`;

            const count = await this.redis.zcount(key, startTime, now);
            return count;
        } catch (error) {
            logger.error('Failed to get rate limit violation count', {
                error: error instanceof Error ? error.message : String(error),
            });
            return 0;
        }
    }
}

// Export singleton instance
export const securityMonitoringService = new SecurityMonitoringService();
