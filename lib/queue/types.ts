export const QUEUE_NAMES = {
  SYNC: "sync-queue",
  NOTIFICATIONS: "notification-queue",
} as const;

export interface SyncJobData {
  siteId?: string;
  tenantId?: string;
  productIds?: string[]; // IDs for chunked processing
  isCron?: boolean;
  type: "FULL" | "SINGLE" | "CHUNK" | "MAINTENANCE" | "SOURCE_SYNC" | "RETRY";
}

export interface NotificationJobData {
  type: "EMAIL" | "WEBHOOK" | "CUSTOM_WEBHOOK";
  payload: any;
  recipient: string;
}
