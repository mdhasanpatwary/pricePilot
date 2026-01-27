import { prisma } from "@/lib/prisma";
import {
    SystemAlertData,
    AlertSeverity,
    AlertType
} from "@/lib/types/admin-dashboard";
import { logger } from "@/lib/logger";

/**
 * Repository for SystemAlert database operations
 * Handles persistence of system alerts and notifications
 */
export class AlertRepository {
    /**
     * Create a new system alert
     */
    async createAlert(data: {
        alertType: AlertType;
        severity: AlertSeverity;
        title: string;
        message: string;
        context?: Record<string, any>;
    }): Promise<SystemAlertData> {
        try {
            const alert = await prisma.systemAlert.create({
                data: {
                    alertType: data.alertType,
                    severity: data.severity,
                    title: data.title,
                    message: data.message,
                    context: data.context || undefined,
                    acknowledged: false,
                },
            });

            return this.mapToAlertData(alert);
        } catch (error) {
            logger.error("[AlertRepository] Error creating alert", { error, data });
            throw error;
        }
    }

    /**
     * Get alert by ID
     */
    async getAlert(alertId: string): Promise<SystemAlertData | null> {
        try {
            const alert = await prisma.systemAlert.findUnique({
                where: { id: alertId },
            });

            return alert ? this.mapToAlertData(alert) : null;
        } catch (error) {
            logger.error("[AlertRepository] Error getting alert", { error, alertId });
            return null;
        }
    }

    /**
     * Get unacknowledged alerts
     */
    async getUnacknowledgedAlerts(severity?: AlertSeverity): Promise<SystemAlertData[]> {
        try {
            const where: any = {
                acknowledged: false,
            };

            if (severity) {
                where.severity = severity;
            }

            const alerts = await prisma.systemAlert.findMany({
                where,
                orderBy: [
                    { severity: 'asc' }, // critical first
                    { createdAt: 'desc' },
                ],
            });

            return alerts.map(a => this.mapToAlertData(a));
        } catch (error) {
            logger.error("[AlertRepository] Error getting unacknowledged alerts", { error, severity });
            return [];
        }
    }

    /**
     * Get recent alerts
     */
    async getRecentAlerts(limit: number = 50, acknowledged?: boolean): Promise<SystemAlertData[]> {
        try {
            const where: any = {};
            if (acknowledged !== undefined) {
                where.acknowledged = acknowledged;
            }

            const alerts = await prisma.systemAlert.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
            });

            return alerts.map(a => this.mapToAlertData(a));
        } catch (error) {
            logger.error("[AlertRepository] Error getting recent alerts", { error, limit, acknowledged });
            return [];
        }
    }

    /**
     * Acknowledge an alert
     */
    async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<SystemAlertData> {
        try {
            const alert = await prisma.systemAlert.update({
                where: { id: alertId },
                data: {
                    acknowledged: true,
                    acknowledgedAt: new Date(),
                    acknowledgedBy,
                },
            });

            return this.mapToAlertData(alert);
        } catch (error) {
            logger.error("[AlertRepository] Error acknowledging alert", { error, alertId, acknowledgedBy });
            throw error;
        }
    }

    /**
     * Acknowledge multiple alerts
     */
    async acknowledgeAlerts(alertIds: string[], acknowledgedBy: string): Promise<number> {
        try {
            const result = await prisma.systemAlert.updateMany({
                where: {
                    id: {
                        in: alertIds,
                    },
                },
                data: {
                    acknowledged: true,
                    acknowledgedAt: new Date(),
                    acknowledgedBy,
                },
            });

            return result.count;
        } catch (error) {
            logger.error("[AlertRepository] Error acknowledging alerts", { error, alertIds, acknowledgedBy });
            return 0;
        }
    }

    /**
     * Delete old alerts (cleanup)
     */
    async deleteOldAlerts(olderThanDays: number = 30): Promise<number> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

            const result = await prisma.systemAlert.deleteMany({
                where: {
                    createdAt: {
                        lt: cutoffDate,
                    },
                    acknowledged: true, // Only delete acknowledged alerts
                },
            });

            return result.count;
        } catch (error) {
            logger.error("[AlertRepository] Error deleting old alerts", { error, olderThanDays });
            return 0;
        }
    }

    /**
     * Get alert count by severity
     */
    async getAlertCountBySeverity(acknowledged?: boolean): Promise<Record<string, number>> {
        try {
            const where: any = {};
            if (acknowledged !== undefined) {
                where.acknowledged = acknowledged;
            }

            const alerts = await prisma.systemAlert.groupBy({
                by: ['severity'],
                where,
                _count: true,
            });

            const counts: Record<string, number> = {};
            alerts.forEach(a => {
                counts[a.severity] = a._count;
            });

            return counts;
        } catch (error) {
            logger.error("[AlertRepository] Error getting alert count by severity", { error, acknowledged });
            return {};
        }
    }

    /**
     * Map Prisma model to typed interface
     */
    private mapToAlertData(alert: any): SystemAlertData {
        return {
            id: alert.id,
            alertType: alert.alertType as AlertType,
            severity: alert.severity as AlertSeverity,
            title: alert.title,
            message: alert.message,
            context: alert.context,
            acknowledged: alert.acknowledged,
            acknowledgedAt: alert.acknowledgedAt,
            acknowledgedBy: alert.acknowledgedBy,
            createdAt: alert.createdAt,
        };
    }
}

// Export singleton instance
export const alertRepository = new AlertRepository();
