export const QUEUE_NAMES = {
  SYNC: "sync-queue",
  NOTIFICATIONS: "notification-queue",
} as const;

export interface SyncJobData {
  siteId?: string;
  tenantId?: string; // If syncing all sites for a tenant
  type: "FULL" | "SINGLE" | "MAINTENANCE";
}

export interface NotificationJobData {
  type: "EMAIL" | "WEBHOOK";
  payload: any;
  recipient: string;
}
