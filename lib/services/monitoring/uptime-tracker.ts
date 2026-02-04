/**
 * Uptime Tracker Service
 *
 * Tracks system uptime and availability to ensure 99.9% SLA compliance.
 * Records system status, calculates uptime percentages, and provides
 * historical uptime data for reporting and monitoring.
 *
 * Features:
 * - Continuous uptime monitoring with heartbeat checks
 * - Downtime detection and recording
 * - Uptime percentage calculation over various time periods
 * - SLA compliance tracking (99.9% target)
 * - Historical uptime data with incident tracking
 * - Automatic alerting when uptime falls below threshold
 *
 * SLA Target: 99.9% uptime = max 43.2 minutes downtime per month
 *
 * @module lib/services/monitoring/uptime-tracker
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { Redis } from '@upstash/redis';

/**
 * System status types
 */
export type SystemStatus = 'UP' | 'DOWN' | 'DEGRADED';

/**
 * Uptime check result
 */
export interface UptimeCheckResult {
    timestamp: Date;
    status: SystemStatus;
    responseTime: number;
    errorMessage?: string;
}

/**
 * Uptime statistics for a time period
 */
export interface UptimeStats {
    period: string;
    totalMinutes: number;
    uptimeMinutes: number;
    downtimeMinutes: number;
    uptimePercentage: number;
    slaCompliant: boolean;
    incidents: number;
    avgResponseTime: number;
}

/**
 * Downtime incident record
 */
export interface DowntimeIncident {
    id: string;
    startTime: Date;
    endTime?: Date;
    duration?: number; // in minutes
    reason?: string;
    resolved: boolean;
}

/**
 * Uptime Tracker Interface
 */
export interface IUptimeTracker {
    recordHeartbeat(status: SystemStatus, responseTime: number, errorMessage?: string): Promise<void>;
    getCurrentStatus(): Promise<SystemStatus>;
    getUptimeStats(periodDays: number): Promise<UptimeStats>;
    getDowntimeIncidents(periodDays: number): Promise<DowntimeIncident[]>;
    checkSLACompliance(periodDays: number): Promise<boolean>;
}

/**
 * Uptime Tracker Implementation
 */
export class UptimeTracker implements IUptimeTracker {
    private redis: Redis | null;
    private readonly HEARTBEAT_KEY = 'system:heartbeat';
    private readonly UPTIME_KEY_PREFIX = 'system:uptime';
    // private readonly DOWNTIME_KEY_PREFIX = 'system:downtime'; // Reserved for future use
    private readonly SLA_TARGET = 99.9; // 99.9% uptime target
    // private readonly HEARTBEAT_INTERVAL = 60; // 1 minute - Reserved for future use
    private readonly HEARTBEAT_TTL = 300; // 5 minutes

    constructor() {
        // Initialize Redis client if configured
        this.redis =
            process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
                ? new Redis({
                    url: process.env.UPSTASH_REDIS_REST_URL,
                    token: process.env.UPSTASH_REDIS_REST_TOKEN,
                })
                : null;
    }

    /**
     * Record a system heartbeat check
     *
     * This should be called every minute by a cron job or health check endpoint.
     * Records the current system status and response time.
     *
     * @param status - Current system status (UP, DOWN, DEGRADED)
     * @param responseTime - Response time in milliseconds
     * @param errorMessage - Optional error message if status is DOWN or DEGRADED
     */
    async recordHeartbeat(
        status: SystemStatus,
        responseTime: number,
        errorMessage?: string
    ): Promise<void> {
        const timestamp = new Date();

        try {
            // Store heartbeat in Redis for quick access
            if (this.redis) {
                const heartbeatData = {
                    status,
                    responseTime,
                    timestamp: timestamp.toISOString(),
                    errorMessage,
                };

                await this.redis.setex(
                    this.HEARTBEAT_KEY,
                    this.HEARTBEAT_TTL,
                    JSON.stringify(heartbeatData)
                );

                // Store in time-series for historical tracking
                const minuteKey = this.getMinuteKey(timestamp);
                await this.redis.setex(
                    minuteKey,
                    30 * 24 * 60 * 60, // 30 days TTL
                    JSON.stringify(heartbeatData)
                );
            }

            // Record in database for long-term storage
            await prisma.systemUptimeLog.create({
                data: {
                    timestamp,
                    status,
                    responseTime,
                    errorMessage,
                },
            });

            // Handle status changes
            await this.handleStatusChange(status, timestamp, errorMessage);

            logger.info('System heartbeat recorded', {
                status,
                responseTime,
                timestamp: timestamp.toISOString(),
            });
        } catch (error) {
            logger.error('Failed to record heartbeat', {
                error: error instanceof Error ? error.message : String(error),
                status,
                responseTime,
            });
        }
    }

    /**
     * Get current system status
     *
     * Returns the most recent heartbeat status. If no recent heartbeat
     * is found (within last 5 minutes), assumes system is DOWN.
     *
     * @returns Current system status
     */
    async getCurrentStatus(): Promise<SystemStatus> {
        try {
            // Try to get from Redis first (fastest)
            if (this.redis) {
                const heartbeatData = await this.redis.get(this.HEARTBEAT_KEY);

                if (heartbeatData) {
                    const data = JSON.parse(heartbeatData as string);
                    return data.status as SystemStatus;
                }
            }

            // Fall back to database
            const latestHeartbeat = await prisma.systemUptimeLog.findFirst({
                orderBy: { timestamp: 'desc' },
                take: 1,
            });

            if (!latestHeartbeat) {
                return 'DOWN'; // No heartbeat found
            }

            // Check if heartbeat is recent (within last 5 minutes)
            const age = Date.now() - latestHeartbeat.timestamp.getTime();
            if (age > 5 * 60 * 1000) {
                return 'DOWN'; // Stale heartbeat
            }

            return latestHeartbeat.status as SystemStatus;
        } catch (error) {
            logger.error('Failed to get current status', {
                error: error instanceof Error ? error.message : String(error),
            });
            return 'DOWN'; // Assume down on error
        }
    }

    /**
     * Get uptime statistics for a given period
     *
     * Calculates uptime percentage, downtime minutes, incident count,
     * and SLA compliance for the specified time period.
     *
     * @param periodDays - Number of days to calculate stats for
     * @returns Uptime statistics
     */
    async getUptimeStats(periodDays: number): Promise<UptimeStats> {
        try {
            const endTime = new Date();
            const startTime = new Date(endTime.getTime() - periodDays * 24 * 60 * 60 * 1000);

            // Get all heartbeats for the period
            const heartbeats = await prisma.systemUptimeLog.findMany({
                where: {
                    timestamp: {
                        gte: startTime,
                        lte: endTime,
                    },
                },
                orderBy: { timestamp: 'asc' },
            });

            if (heartbeats.length === 0) {
                return {
                    period: `${periodDays} days`,
                    totalMinutes: periodDays * 24 * 60,
                    uptimeMinutes: 0,
                    downtimeMinutes: 0,
                    uptimePercentage: 0,
                    slaCompliant: false,
                    incidents: 0,
                    avgResponseTime: 0,
                };
            }

            // Calculate uptime and downtime minutes
            let uptimeMinutes = 0;
            let downtimeMinutes = 0;
            let totalResponseTime = 0;
            let responseTimeCount = 0;

            for (const heartbeat of heartbeats) {
                if (heartbeat.status === 'UP') {
                    uptimeMinutes += 1; // Each heartbeat represents 1 minute
                    totalResponseTime += heartbeat.responseTime;
                    responseTimeCount++;
                } else {
                    downtimeMinutes += 1;
                }
            }

            const totalMinutes = periodDays * 24 * 60;
            const uptimePercentage = (uptimeMinutes / totalMinutes) * 100;
            const slaCompliant = uptimePercentage >= this.SLA_TARGET;
            const avgResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;

            // Get incident count
            const incidents = await prisma.downtimeIncident.count({
                where: {
                    startTime: {
                        gte: startTime,
                        lte: endTime,
                    },
                },
            });

            return {
                period: `${periodDays} days`,
                totalMinutes,
                uptimeMinutes,
                downtimeMinutes,
                uptimePercentage,
                slaCompliant,
                incidents,
                avgResponseTime,
            };
        } catch (error) {
            logger.error('Failed to get uptime stats', {
                error: error instanceof Error ? error.message : String(error),
                periodDays,
            });

            return {
                period: `${periodDays} days`,
                totalMinutes: periodDays * 24 * 60,
                uptimeMinutes: 0,
                downtimeMinutes: 0,
                uptimePercentage: 0,
                slaCompliant: false,
                incidents: 0,
                avgResponseTime: 0,
            };
        }
    }

    /**
     * Get downtime incidents for a given period
     *
     * Returns all recorded downtime incidents including start time,
     * end time, duration, and resolution status.
     *
     * @param periodDays - Number of days to retrieve incidents for
     * @returns Array of downtime incidents
     */
    async getDowntimeIncidents(periodDays: number): Promise<DowntimeIncident[]> {
        try {
            const endTime = new Date();
            const startTime = new Date(endTime.getTime() - periodDays * 24 * 60 * 60 * 1000);

            const incidents = await prisma.downtimeIncident.findMany({
                where: {
                    startTime: {
                        gte: startTime,
                        lte: endTime,
                    },
                },
                orderBy: { startTime: 'desc' },
            });

            return incidents.map((incident) => ({
                id: incident.id,
                startTime: incident.startTime,
                endTime: incident.endTime || undefined,
                duration: incident.duration || undefined,
                reason: incident.reason || undefined,
                resolved: incident.resolved,
            }));
        } catch (error) {
            logger.error('Failed to get downtime incidents', {
                error: error instanceof Error ? error.message : String(error),
                periodDays,
            });
            return [];
        }
    }

    /**
     * Check if system is meeting SLA compliance
     *
     * Verifies that uptime percentage is at or above the 99.9% target
     * for the specified time period.
     *
     * @param periodDays - Number of days to check compliance for
     * @returns True if SLA is met, false otherwise
     */
    async checkSLACompliance(periodDays: number): Promise<boolean> {
        try {
            const stats = await this.getUptimeStats(periodDays);
            return stats.slaCompliant;
        } catch (error) {
            logger.error('Failed to check SLA compliance', {
                error: error instanceof Error ? error.message : String(error),
                periodDays,
            });
            return false;
        }
    }

    /**
     * Handle system status changes
     *
     * Detects when system goes down or comes back up, and creates/updates
     * downtime incident records accordingly.
     *
     * @param newStatus - New system status
     * @param timestamp - Timestamp of status change
     * @param errorMessage - Optional error message
     */
    private async handleStatusChange(
        newStatus: SystemStatus,
        timestamp: Date,
        errorMessage?: string
    ): Promise<void> {
        try {
            // Get previous status
            const previousHeartbeat = await prisma.systemUptimeLog.findFirst({
                where: {
                    timestamp: {
                        lt: timestamp,
                    },
                },
                orderBy: { timestamp: 'desc' },
                take: 1,
            });

            const previousStatus = previousHeartbeat?.status as SystemStatus | undefined;

            // System went down
            if (previousStatus === 'UP' && (newStatus === 'DOWN' || newStatus === 'DEGRADED')) {
                await this.createDowntimeIncident(timestamp, errorMessage);
                logger.warn('System went down', {
                    previousStatus,
                    newStatus,
                    timestamp: timestamp.toISOString(),
                    errorMessage,
                });
            }

            // System came back up
            if ((previousStatus === 'DOWN' || previousStatus === 'DEGRADED') && newStatus === 'UP') {
                await this.resolveDowntimeIncident(timestamp);
                logger.info('System recovered', {
                    previousStatus,
                    newStatus,
                    timestamp: timestamp.toISOString(),
                });
            }
        } catch (error) {
            logger.error('Failed to handle status change', {
                error: error instanceof Error ? error.message : String(error),
                newStatus,
                timestamp: timestamp.toISOString(),
            });
        }
    }

    /**
     * Create a new downtime incident
     *
     * @param startTime - When the downtime started
     * @param reason - Optional reason for the downtime
     */
    private async createDowntimeIncident(startTime: Date, reason?: string): Promise<void> {
        try {
            await prisma.downtimeIncident.create({
                data: {
                    startTime,
                    reason,
                    resolved: false,
                },
            });

            logger.info('Downtime incident created', {
                startTime: startTime.toISOString(),
                reason,
            });
        } catch (error) {
            logger.error('Failed to create downtime incident', {
                error: error instanceof Error ? error.message : String(error),
                startTime: startTime.toISOString(),
            });
        }
    }

    /**
     * Resolve the most recent unresolved downtime incident
     *
     * @param endTime - When the downtime ended
     */
    private async resolveDowntimeIncident(endTime: Date): Promise<void> {
        try {
            // Find the most recent unresolved incident
            const incident = await prisma.downtimeIncident.findFirst({
                where: { resolved: false },
                orderBy: { startTime: 'desc' },
            });

            if (!incident) {
                logger.warn('No unresolved downtime incident found to resolve');
                return;
            }

            // Calculate duration in minutes
            const duration = Math.round((endTime.getTime() - incident.startTime.getTime()) / (60 * 1000));

            // Update incident
            await prisma.downtimeIncident.update({
                where: { id: incident.id },
                data: {
                    endTime,
                    duration,
                    resolved: true,
                },
            });

            logger.info('Downtime incident resolved', {
                incidentId: incident.id,
                startTime: incident.startTime.toISOString(),
                endTime: endTime.toISOString(),
                duration,
            });
        } catch (error) {
            logger.error('Failed to resolve downtime incident', {
                error: error instanceof Error ? error.message : String(error),
                endTime: endTime.toISOString(),
            });
        }
    }

    /**
     * Get Redis key for a specific minute
     *
     * @param timestamp - Timestamp to get key for
     * @returns Redis key string
     */
    private getMinuteKey(timestamp: Date): string {
        const minuteTimestamp = Math.floor(timestamp.getTime() / (60 * 1000));
        return `${this.UPTIME_KEY_PREFIX}:${minuteTimestamp}`;
    }
}

/**
 * Export singleton instance
 */
export const uptimeTracker = new UptimeTracker();
