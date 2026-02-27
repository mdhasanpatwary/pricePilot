import { prisma } from "@/lib/prisma";
import { subDays } from "date-fns";
import { MonitoringService } from "@/lib/services/monitoring/monitoring-service";

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

      // 7. Enforce GDPR Deletion & Anonymization
      console.log("🔒 [Maintenance] Running GDPR compliance tasks...");
      try {
        const { GDPRService } = await import("@/lib/services/gdpr-service");

        // Find users marked for deletion who have passed the grace period
        const thirtyDaysAgo = subDays(now, 30);
        const deletionRequests = await prisma.tenantAuditLog.findMany({
          where: {
            action: 'GDPR_DELETION_REQUESTED',
            createdAt: { lt: thirtyDaysAgo },
            // We need to ensure we don't re-process if already deleted, 
            // but the GDPRService.permanentlyDeleteAccount handles "User not found"
          },
          select: { userId: true },
        });

        for (const request of deletionRequests) {
          try {
            await GDPRService.permanentlyDeleteAccount(request.userId);
            console.log(`🗑️ [Maintenance] Permanently deleted user: ${request.userId}`);
          } catch (deleteError: any) {
            if (deleteError.message !== 'User not found') {
              console.error(`❌ [Maintenance] Failed to delete user ${request.userId}:`, deleteError);
            }
          }
        }

        // Batch process active users to anonymize logs (memory-efficient)
        let lastUserId: string | undefined;
        const BATCH_SIZE = 50;

        while (true) {
          const users = await prisma.user.findMany({
            take: BATCH_SIZE,
            skip: lastUserId ? 1 : 0,
            cursor: lastUserId ? { id: lastUserId } : undefined,
            select: { id: true },
            orderBy: { id: 'asc' },
          });

          if (users.length === 0) break;

          for (const user of users) {
            try {
              await GDPRService.anonymizeAuditLogs(user.id);
            } catch (anonError) {
              console.error(`❌ [Maintenance] Failed to anonymize logs for user ${user.id}:`, anonError);
            }
          }

          lastUserId = users[users.length - 1].id;
          if (users.length < BATCH_SIZE) break;
        }
      } catch (gdprError) {
        console.error("❌ [Maintenance] GDPR compliance tasks failed:", gdprError);
      }

      console.log(
        "✅ [Maintenance] Data retention cleanup completed successfully.",
      );

      // 8. Run System Monitoring & Cleanup
      console.log("📊 [Maintenance] Running system monitoring & cleanup...");
      try {
        await MonitoringService.detectStarvation();
        await MonitoringService.cleanupZombieBrowsers();
      } catch (monitorError) {
        console.error("❌ [Maintenance] Monitoring tasks failed:", monitorError);
        // Don't fail the whole maintenance run if monitoring fails
      }

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
