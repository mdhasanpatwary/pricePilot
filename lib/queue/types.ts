export const QUEUE_NAMES = {
  SYNC_FULL: "sync-queue-full", // For discovery and large batch syncs
  SYNC_DELTA: "sync-queue-delta", // For individual product updates or small changes
  NOTIFICATIONS: "notification-queue",
  SCRAPE_HIGH_PRIO: "scrape-queue-high", // For urgent/recent products
  SCRAPE_LOW_PRIO: "scrape-queue-low",   // For background/old product maintenance
} as const;

export interface SyncJobData {
  siteId?: string;
  tenantId: string; // Now mandatory for fairness grouping
  productId?: string;
  productIds?: string[]; // IDs for chunked processing
  syncSessionStart?: number; // Session tracker for chunk finalization
  isGoldenRule?: boolean; // Determines if proxy/rate limit rules apply aggressively
  isCron?: boolean;
  force?: boolean;
  type: "FULL" | "SINGLE" | "CHUNK" | "MAINTENANCE" | "SOURCE_SYNC" | "RETRY" | "PRODUCT";
}

export interface NotificationJobData {
  tenantId?: string; // Optional for system-wide notices, but recommended
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
      tenantId?: string;
    };
