import { prisma } from "@/lib/prisma";
import { subDays } from "date-fns";

export class MaintenanceService {
  /**
   * Enforces data retention policies by purging old records
   */
  static async runDataRetention() {
    console.log("🚀 [Maintenance] Starting data retention cleanup...");

    try {
      // 1. Fetch retention configs
      const configs = await prisma.systemConfig.findMany({
        where: {
          key: {
            startsWith: "RETENTION_",
          },
        },
      });

      const retentionMap: Record<string, number> = {};
      configs.forEach((c) => {
        retentionMap[c.key] = parseInt(c.value) || 0;
      });

      const now = new Date();

      // 2. Enforce Price History Retention
      if (retentionMap["RETENTION_PRICE_HISTORY_DAYS"]) {
        const date = subDays(now, retentionMap["RETENTION_PRICE_HISTORY_DAYS"]);
        const { count } = await prisma.priceHistory.deleteMany({
          where: { recordedAt: { lt: date } },
        });
        console.log(
          `🧹 [Maintenance] Purged ${count} price history records older than ${retentionMap["RETENTION_PRICE_HISTORY_DAYS"]} days.`,
        );
      }

      // 3. Enforce Sync Log Retention
      if (retentionMap["RETENTION_SYNC_LOG_DAYS"]) {
        const date = subDays(now, retentionMap["RETENTION_SYNC_LOG_DAYS"]);
        const { count } = await prisma.syncLog.deleteMany({
          where: { createdAt: { lt: date } },
        });
        console.log(
          `🧹 [Maintenance] Purged ${count} sync logs older than ${retentionMap["RETENTION_SYNC_LOG_DAYS"]} days.`,
        );
      }

      // 4. Enforce Audit Log Retention (GDPR)
      if (retentionMap["RETENTION_AUDIT_LOG_DAYS"]) {
        const date = subDays(now, retentionMap["RETENTION_AUDIT_LOG_DAYS"]);
        const { count } = await prisma.tenantAuditLog.deleteMany({
          where: { createdAt: { lt: date } },
        });
        console.log(
          `🧹 [Maintenance] Purged ${count} audit logs older than ${retentionMap["RETENTION_AUDIT_LOG_DAYS"]} days.`,
        );
      }

      // 5. Enforce Notification Retention
      if (retentionMap["RETENTION_NOTIFICATION_DAYS"]) {
        const date = subDays(now, retentionMap["RETENTION_NOTIFICATION_DAYS"]);
        const { count } = await (prisma as any).notification.deleteMany({
          where: { createdAt: { lt: date } },
        });
        console.log(
          `🧹 [Maintenance] Purged ${count} notifications older than ${retentionMap["RETENTION_NOTIFICATION_DAYS"]} days.`,
        );
      }

      // 6. Enforce Bulk Snapshot Retention
      if (retentionMap["RETENTION_BULK_SNAPSHOT_DAYS"]) {
        const date = subDays(now, retentionMap["RETENTION_BULK_SNAPSHOT_DAYS"]);
        const { count } = await (
          prisma as any
        ).bulkOperationSnapshot.deleteMany({
          where: { createdAt: { lt: date } },
        });
        console.log(
          `🧹 [Maintenance] Purged ${count} bulk snapshots older than ${retentionMap["RETENTION_BULK_SNAPSHOT_DAYS"]} days.`,
        );
      }

      console.log(
        "✅ [Maintenance] Data retention cleanup completed successfully.",
      );

      // Track last run in system config
      await prisma.systemConfig.upsert({
        where: { key: "MAINTENANCE_LAST_RUN" },
        update: { value: now.toISOString() },
        create: {
          key: "MAINTENANCE_LAST_RUN",
          value: now.toISOString(),
          description: "Timestamp of last internal maintenance run",
          type: "string",
        },
      });

      return { success: true };
    } catch (error) {
      console.error("❌ [Maintenance] Data retention cleanup failed:", error);
      throw error;
    }
  }
}
