/**
 * Security Incident Prevention Service
 *
 * Proactive security monitoring and automated incident prevention system.
 * Implements real-time threat detection, automated response, and comprehensive
 * security controls to achieve zero security incidents post-deployment.
 *
 * Features:
 * - Real-time threat detection and blocking
 * - Automated incident response
 * - IP reputation tracking
 * - Anomaly detection
 * - Security policy enforcement
 * - Incident logging and reporting
 *
 * @module lib/services/security/incident-prevention
 */

import { logger } from '@/lib/logger';
import { securityMonitoringService, SecurityEventContext } from '../monitoring/security-monitoring';
import { prisma } from '@/lib/prisma';
import type { Redis } from "ioredis";
import { getRedisConnection } from "@/lib/queue/connection";

/**
 * Threat level classification
 */
export enum ThreatLevel {
    NONE = 'none',
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical',
}

/**
 * Automated response action
 */
export enum ResponseAction {
    LOG = 'log',
    WARN = 'warn',
    BLOCK_TEMPORARY = 'block_temporary',
    BLOCK_PERMANENT = 'block_permanent',
    NOTIFY_ADMIN = 'notify_admin',
    REQUIRE_CAPTCHA = 'require_captcha',
}

/**
 * Security incident record
 */
export interface SecurityIncident {
    id: string;
    timestamp: Date;
    threatLevel: ThreatLevel;
    incidentType: string;
    ipAddress: string;
    context: SecurityEventContext;
    responseActions: ResponseAction[];
    resolved: boolean;
    resolvedAt?: Date;
    resolvedBy?: string;
}

/**
 * IP reputation score
 */
export interface IPReputation {
    ipAddress: string;
    score: number; // 0-100, lower is worse
    lastUpdated: Date;
    incidents: number;
    blocked: boolean;
    blockedUntil?: Date;
}

/**
 * Security policy configuration
 */
export interface SecurityPolicy {
    maxAuthFailures: number;
    authFailureWindow: number; // milliseconds
    maxRateLimitViolations: number;
    rateLimitWindow: number;
    autoBlockThreshold: number; // reputation score threshold
    blockDuration: number; // milliseconds
    permanentBlockThreshold: number; // incidents before permanent block
    maxTenantsPerIP: number;
    tenantTrackingWindow: number;
}

/**
 * Security Incident Prevention Service
 */
export class IncidentPreventionService {
    private redis: Redis | null;
    private readonly DEFAULT_POLICY: SecurityPolicy = {
        maxAuthFailures: 5,
        authFailureWindow: 5 * 60 * 1000, // 5 minutes
        maxRateLimitViolations: 10,
        rateLimitWindow: 5 * 60 * 1000, // 5 minutes
        autoBlockThreshold: 30, // block if reputation < 30
        blockDuration: 60 * 60 * 1000, // 1 hour
        permanentBlockThreshold: 5, // 5 incidents = permanent block
        maxTenantsPerIP: 5, // Max distinct tenants an IP can access in a window
        tenantTrackingWindow: 10 * 60 * 1000, // 10 minutes
    };

    constructor() {
        this.redis = getRedisConnection();
    }

    /**
     * Check if IP address is blocked
     *
     * @param ipAddress - IP address to check
     * @returns True if blocked, false otherwise
     */
    async isBlocked(ipAddress: string): Promise<boolean> {
        if (!this.redis) return false;

        try {
            const key = `security:blocked:${ipAddress}`;
            const blockedUntil = await this.redis.get(key);

            if (!blockedUntil) return false;

            const blockedUntilTime = typeof blockedUntil === 'number'
                ? blockedUntil
                : parseInt(blockedUntil as string);

            if (Date.now() > blockedUntilTime) {
                // Block expired, remove it
                await this.redis.del(key);
                return false;
            }

            return true;
        } catch (error) {
            logger.error('Failed to check if IP is blocked', {
                error: error instanceof Error ? error.message : String(error),
                ipAddress,
            });
            return false;
        }
    }

    /**
     * Block IP address temporarily or permanently
     *
     * @param ipAddress - IP address to block
     * @param duration - Block duration in milliseconds (0 for permanent)
     * @param reason - Reason for blocking
     */
    async blockIP(ipAddress: string, duration: number, reason: string): Promise<void> {
        if (!this.redis) return;

        try {
            const key = `security:blocked:${ipAddress}`;
            const blockedUntil = duration === 0 ? Number.MAX_SAFE_INTEGER : Date.now() + duration;

            await this.redis.set(key, blockedUntil);

            if (duration > 0) {
                // Set TTL for temporary blocks
                await this.redis.expire(key, Math.ceil(duration / 1000));
            }

            // Log the block
            await this.logIncident({
                id: `block-${ipAddress}-${Date.now()}`,
                timestamp: new Date(),
                threatLevel: duration === 0 ? ThreatLevel.CRITICAL : ThreatLevel.HIGH,
                incidentType: duration === 0 ? 'permanent_block' : 'temporary_block',
                ipAddress,
                context: { ipAddress },
                responseActions: [
                    duration === 0 ? ResponseAction.BLOCK_PERMANENT : ResponseAction.BLOCK_TEMPORARY,
                    ResponseAction.NOTIFY_ADMIN,
                ],
                resolved: false,
            });

            logger.warn('IP address blocked', {
                ipAddress,
                duration: duration === 0 ? 'permanent' : `${duration}ms`,
                reason,
            });

            // Send admin notification
            await this.notifyAdmins({
                type: 'ip_blocked',
                ipAddress,
                duration: duration === 0 ? 'permanent' : `${duration / 1000}s`,
                reason,
            });
        } catch (error) {
            logger.error('Failed to block IP', {
                error: error instanceof Error ? error.message : String(error),
                ipAddress,
            });
        }
    }

    /**
     * Unblock IP address
     *
     * @param ipAddress - IP address to unblock
     * @param unblockReason - Reason for unblocking
     */
    async unblockIP(ipAddress: string, unblockReason: string): Promise<void> {
        if (!this.redis) return;

        try {
            const key = `security:blocked:${ipAddress}`;
            await this.redis.del(key);

            logger.info('IP address unblocked', {
                ipAddress,
                reason: unblockReason,
            });

            // Update reputation
            await this.updateIPReputation(ipAddress, 10); // Boost reputation slightly
        } catch (error) {
            logger.error('Failed to unblock IP', {
                error: error instanceof Error ? error.message : String(error),
                ipAddress,
            });
        }
    }

    /**
     * Get IP reputation score
     *
     * @param ipAddress - IP address
     * @returns IP reputation information
     */
    async getIPReputation(ipAddress: string): Promise<IPReputation> {
        if (!this.redis) {
            return {
                ipAddress,
                score: 100,
                lastUpdated: new Date(),
                incidents: 0,
                blocked: false,
            };
        }

        try {
            const key = `security:reputation:${ipAddress}`;
            const data = await this.redis.get(key);

            if (!data) {
                // New IP, start with neutral reputation
                return {
                    ipAddress,
                    score: 100,
                    lastUpdated: new Date(),
                    incidents: 0,
                    blocked: false,
                };
            }

            const reputation = typeof data === 'string' ? JSON.parse(data) : data;
            return reputation as IPReputation;
        } catch (error) {
            logger.error('Failed to get IP reputation', {
                error: error instanceof Error ? error.message : String(error),
                ipAddress,
            });

            return {
                ipAddress,
                score: 100,
                lastUpdated: new Date(),
                incidents: 0,
                blocked: false,
            };
        }
    }

    /**
     * Update IP reputation score
     *
     * @param ipAddress - IP address
     * @param delta - Change in reputation score (negative for bad behavior)
     */
    async updateIPReputation(ipAddress: string, delta: number): Promise<void> {
        if (!this.redis) return;

        try {
            const reputation = await this.getIPReputation(ipAddress);

            // Update score (clamp between 0 and 100)
            reputation.score = Math.max(0, Math.min(100, reputation.score + delta));
            reputation.lastUpdated = new Date();

            if (delta < 0) {
                reputation.incidents += 1;
            }

            // Store updated reputation
            const key = `security:reputation:${ipAddress}`;
            await this.redis.set(key, JSON.stringify(reputation));
            await this.redis.expire(key, 30 * 24 * 60 * 60); // 30 days TTL

            logger.debug('IP reputation updated', {
                ipAddress,
                score: reputation.score,
                delta,
                incidents: reputation.incidents,
            });

            // Check if automatic blocking is needed
            const policy = this.DEFAULT_POLICY;

            if (reputation.score < policy.autoBlockThreshold && !reputation.blocked) {
                await this.blockIP(
                    ipAddress,
                    policy.blockDuration,
                    `Reputation score below threshold (${reputation.score})`
                );
            }

            if (reputation.incidents >= policy.permanentBlockThreshold) {
                await this.blockIP(
                    ipAddress,
                    0, // permanent
                    `Too many incidents (${reputation.incidents})`
                );
            }
        } catch (error) {
            logger.error('Failed to update IP reputation', {
                error: error instanceof Error ? error.message : String(error),
                ipAddress,
            });
        }
    }

    /**
     * Analyze security event and determine threat level
     *
     * @param context - Security event context
     * @returns Threat level and recommended actions
     */
    async analyzeThreat(context: SecurityEventContext): Promise<{
        threatLevel: ThreatLevel;
        actions: ResponseAction[];
        reason: string;
    }> {
        try {
            const reputation = await this.getIPReputation(context.ipAddress);
            const policy = this.DEFAULT_POLICY;

            // Check for immediate threats
            const authFailures = await securityMonitoringService.getAuthFailureCount(
                context.ipAddress,
                policy.authFailureWindow
            );

            // Check for multi-tenant scanning
            const tenantCount = await this.getTenantAccessCount(context.ipAddress);

            // Determine threat level
            let threatLevel = ThreatLevel.NONE;
            const actions: ResponseAction[] = [ResponseAction.LOG];
            let reason = 'Normal activity';

            if (reputation.blocked) {
                threatLevel = ThreatLevel.CRITICAL;
                actions.push(ResponseAction.BLOCK_PERMANENT);
                reason = 'IP is blocked';
            } else if (authFailures >= policy.maxAuthFailures) {
                threatLevel = ThreatLevel.HIGH;
                actions.push(ResponseAction.BLOCK_TEMPORARY, ResponseAction.NOTIFY_ADMIN);
                reason = `Excessive authentication failures (${authFailures})`;
            } else if (reputation.score < 30) {
                threatLevel = ThreatLevel.HIGH;
                actions.push(ResponseAction.BLOCK_TEMPORARY, ResponseAction.NOTIFY_ADMIN);
                reason = `Low reputation score (${reputation.score})`;
            } else if (reputation.score < 50) {
                threatLevel = ThreatLevel.MEDIUM;
                actions.push(ResponseAction.REQUIRE_CAPTCHA, ResponseAction.WARN);
                reason = `Medium reputation score (${reputation.score})`;
            } else if (tenantCount >= policy.maxTenantsPerIP) {
                threatLevel = ThreatLevel.CRITICAL;
                actions.push(ResponseAction.BLOCK_PERMANENT, ResponseAction.NOTIFY_ADMIN);
                reason = `Multi-tenant scanning detected (${tenantCount} tenants)`;
            } else if (authFailures > 0) {
                threatLevel = ThreatLevel.LOW;
                actions.push(ResponseAction.WARN);
                reason = `Some authentication failures (${authFailures})`;
            }

            return { threatLevel, actions, reason };
        } catch (error) {
            logger.error('Failed to analyze threat', {
                error: error instanceof Error ? error.message : String(error),
                context,
            });

            return {
                threatLevel: ThreatLevel.NONE,
                actions: [ResponseAction.LOG],
                reason: 'Analysis failed',
            };
        }
    }

    /**
     * Handle security event with automated response
     *
     * @param eventType - Type of security event
     * @param context - Security event context
     */
    async handleSecurityEvent(eventType: string, context: SecurityEventContext): Promise<void> {
        try {
            // Analyze threat
            const { threatLevel, actions, reason } = await this.analyzeThreat(context);

            // Update reputation based on event type
            let reputationDelta = 0;
            switch (eventType) {
                case 'auth_failure':
                    reputationDelta = -5;
                    break;
                case 'rate_limit_exceeded':
                    reputationDelta = -3;
                    break;
                case 'unauthorized_access':
                    reputationDelta = -10;
                    break;
                case 'suspicious_pattern':
                    reputationDelta = -15;
                    break;
                default:
                    reputationDelta = -2;
            }

            await this.updateIPReputation(context.ipAddress, reputationDelta);

            // Track tenant access for scanner detection
            if (context.tenantId) {
                await this.trackTenantAccess(context.ipAddress, context.tenantId);
            }

            // Execute response actions
            for (const action of actions) {
                await this.executeResponseAction(action, context, reason);
            }

            // Log incident if threat level is medium or higher
            if (
                threatLevel === ThreatLevel.MEDIUM ||
                threatLevel === ThreatLevel.HIGH ||
                threatLevel === ThreatLevel.CRITICAL
            ) {
                await this.logIncident({
                    id: `incident-${context.ipAddress}-${Date.now()}`,
                    timestamp: new Date(),
                    threatLevel,
                    incidentType: eventType,
                    ipAddress: context.ipAddress,
                    context,
                    responseActions: actions,
                    resolved: false,
                });
            }

            logger.info('Security event handled', {
                eventType,
                ipAddress: context.ipAddress,
                threatLevel,
                actions,
                reason,
            });
        } catch (error) {
            logger.error('Failed to handle security event', {
                error: error instanceof Error ? error.message : String(error),
                eventType,
                context,
            });
        }
    }

    /**
     * Execute automated response action
     *
     * @param action - Response action to execute
     * @param context - Security event context
     * @param reason - Reason for action
     */
    private async executeResponseAction(
        action: ResponseAction,
        context: SecurityEventContext,
        reason: string
    ): Promise<void> {
        try {
            switch (action) {
                case ResponseAction.LOG:
                    logger.info('Security event logged', { context, reason });
                    break;

                case ResponseAction.WARN:
                    logger.warn('Security warning', { context, reason });
                    break;

                case ResponseAction.BLOCK_TEMPORARY:
                    await this.blockIP(
                        context.ipAddress,
                        this.DEFAULT_POLICY.blockDuration,
                        reason
                    );
                    break;

                case ResponseAction.BLOCK_PERMANENT:
                    await this.blockIP(context.ipAddress, 0, reason);
                    break;

                case ResponseAction.NOTIFY_ADMIN:
                    await this.notifyAdmins({
                        type: 'security_incident',
                        context,
                        reason,
                    });
                    break;

                case ResponseAction.REQUIRE_CAPTCHA:
                    // Set flag in Redis to require CAPTCHA for this IP
                    if (this.redis) {
                        const key = `security:require_captcha:${context.ipAddress}`;
                        await this.redis.set(key, '1');
                        await this.redis.expire(key, 60 * 60); // 1 hour
                    }
                    break;
            }
        } catch (error) {
            logger.error('Failed to execute response action', {
                error: error instanceof Error ? error.message : String(error),
                action,
                context,
            });
        }
    }

    /**
     * Log security incident
     *
     * @param incident - Security incident to log
     */
    private async logIncident(incident: SecurityIncident): Promise<void> {
        if (!this.redis) return;

        try {
            const key = 'security:incidents:all';
            await this.redis.zadd(
                key,
                incident.timestamp.getTime(),
                JSON.stringify(incident)
            );

            // Set TTL for incidents (90 days)
            await this.redis.expire(key, 90 * 24 * 60 * 60);

            logger.warn('Security incident logged', {
                id: incident.id,
                threatLevel: incident.threatLevel,
                incidentType: incident.incidentType,
                ipAddress: incident.ipAddress,
            });
        } catch (error) {
            logger.error('Failed to log incident', {
                error: error instanceof Error ? error.message : String(error),
                incident,
            });
        }
    }

    /**
     * Notify administrators of security incident
     *
     * @param notification - Notification details
     */
    private async notifyAdmins(notification: any): Promise<void> {
        try {
            // Get all admin users
            const admins = await prisma.user.findMany({
                where: {
                    role: 'ADMIN',
                    emailNotifications: true,
                },
            });

            // Create notifications for each admin
            for (const admin of admins) {
                await prisma.notification.create({
                    data: {
                        tenantId: admin.tenantId,
                        type: 'SECURITY_ALERT',
                        title: 'Security Incident Detected',
                        message: JSON.stringify(notification),
                        isRead: false,
                    },
                });
            }

            logger.info('Admin notifications sent', {
                adminCount: admins.length,
                notification,
            });
        } catch (error) {
            logger.error('Failed to notify admins', {
                error: error instanceof Error ? error.message : String(error),
                notification,
            });
        }
    }

    /**
     * Get security incidents within time window
     *
     * @param timeWindow - Time window in milliseconds
     * @param ipAddress - Optional IP address filter
     * @returns Array of security incidents
     */
    async getIncidents(
        timeWindow: number,
        ipAddress?: string
    ): Promise<SecurityIncident[]> {
        if (!this.redis) return [];

        try {
            const now = Date.now();
            const startTime = now - timeWindow;
            const key = 'security:incidents:all';

            const members = await this.redis.zrange(key, 0, -1);
            const incidents: SecurityIncident[] = [];

            for (const member of members) {
                try {
                    const incident = JSON.parse(member as string) as SecurityIncident;
                    const incidentTime = incident.timestamp.getTime
                        ? incident.timestamp.getTime()
                        : new Date(incident.timestamp).getTime();

                    if (
                        incidentTime >= startTime &&
                        (!ipAddress || incident.ipAddress === ipAddress)
                    ) {
                        incidents.push(incident);
                    }
                } catch (error) {
                    logger.error('Failed to parse incident', { error });
                }
            }

            return incidents;
        } catch (error) {
            logger.error('Failed to get incidents', {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }

    /**
     * Get security statistics
     *
     * @param timeWindow - Time window in milliseconds
     * @returns Security statistics
     */
    async getSecurityStats(timeWindow: number): Promise<{
        totalIncidents: number;
        incidentsByThreatLevel: Record<ThreatLevel, number>;
        blockedIPs: number;
        averageReputationScore: number;
    }> {
        try {
            const incidents = await this.getIncidents(timeWindow);

            const incidentsByThreatLevel: Record<ThreatLevel, number> = {
                [ThreatLevel.NONE]: 0,
                [ThreatLevel.LOW]: 0,
                [ThreatLevel.MEDIUM]: 0,
                [ThreatLevel.HIGH]: 0,
                [ThreatLevel.CRITICAL]: 0,
            };

            for (const incident of incidents) {
                incidentsByThreatLevel[incident.threatLevel]++;
            }

            // Count blocked IPs (use SCAN instead of KEYS to avoid blocking Redis)
            let blockedIPs = 0;
            if (this.redis) {
                const { scanKeys } = await import('@/lib/utils/redis');
                const keys = await scanKeys(this.redis, 'security:blocked:*');
                blockedIPs = keys.length;
            }

            return {
                totalIncidents: incidents.length,
                incidentsByThreatLevel,
                blockedIPs,
                averageReputationScore: 100, // Placeholder
            };
        } catch (error) {
            logger.error('Failed to get security stats', {
                error: error instanceof Error ? error.message : String(error),
            });

            return {
                totalIncidents: 0,
                incidentsByThreatLevel: {
                    [ThreatLevel.NONE]: 0,
                    [ThreatLevel.LOW]: 0,
                    [ThreatLevel.MEDIUM]: 0,
                    [ThreatLevel.HIGH]: 0,
                    [ThreatLevel.CRITICAL]: 0,
                },
                blockedIPs: 0,
                averageReputationScore: 100,
            };
        }
    }

    /**
     * Track tenant access from IP address
     */
    private async trackTenantAccess(ipAddress: string, tenantId: string): Promise<void> {
        if (!this.redis) return;
        try {
            const key = `security:tenant_access:${ipAddress}`;
            await this.redis.sadd(key, tenantId);
            await this.redis.expire(key, Math.ceil(this.DEFAULT_POLICY.tenantTrackingWindow / 1000));
        } catch (error) {
            logger.error('Failed to track tenant access', { error, ipAddress, tenantId });
        }
    }

    /**
     * Get count of distinct tenants accessed by an IP
     */
    private async getTenantAccessCount(ipAddress: string): Promise<number> {
        if (!this.redis) return 0;
        try {
            const key = `security:tenant_access:${ipAddress}`;
            return await this.redis.scard(key);
        } catch (error) {
            logger.error('Failed to get tenant access count', { error, ipAddress });
            return 0;
        }
    }
}

// Export singleton instance
// Lazy proxy avoids import-time side effects in build/dev workers.
let incidentPreventionInstance: IncidentPreventionService | null = null;
export const incidentPreventionService = new Proxy({} as IncidentPreventionService, {
    get(_target, property) {
        if (!incidentPreventionInstance) {
            incidentPreventionInstance = new IncidentPreventionService();
        }
        const value = (incidentPreventionInstance as any)[property];
        return typeof value === "function" ? value.bind(incidentPreventionInstance) : value;
    },
});
