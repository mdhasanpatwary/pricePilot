export const QUEUE_NAMES = {
  SYNC: "sync-queue",
  NOTIFICATIONS: "notification-queue",
  SCRAPE: "scrape-queue",
} as const;

export interface SyncJobData {
  siteId?: string;
  tenantId?: string;
  productId?: string;
  productIds?: string[]; // IDs for chunked processing
  isCron?: boolean;
  force?: boolean;
  type: "FULL" | "SINGLE" | "CHUNK" | "MAINTENANCE" | "SOURCE_SYNC" | "RETRY" | "PRODUCT";
}

export interface NotificationJobData {
  type: "EMAIL" | "WEBHOOK" | "CUSTOM_WEBHOOK";
  payload: any;
  recipient: string;
}

export type ScrapeJobData =
  | {
      type: "SCRAPE_PRODUCT";
      tenantId: string;
      productId: string;
      competitorWebsiteId: string;
      url: string;
      priorityScore?: number;
      lastScheduledAt?: string;
    }
  | {
      type: "SEED";
    };
