import { Site } from "@prisma/client";

/**
 * Standardized API response for Site (Competitor) objects
 * Prevents "site" vs "Site" type mismatches between frontend and backend.
 */
export interface SiteResponseDTO {
  id: string;
  name: string;
  url: string;
  baseUrl: string; // Providing both for compatibility
  type: string;
  status: "SYNCING" | "ACTIVE" | "NO MATCHES" | "PENDING";
  health: number;
  products: number;
  totalScraped?: number;

  // Sync Status
  isSyncing: boolean;
  syncTotal: number;
  syncProcessed: number;
  syncLastAction: string | null;
  syncStartedAt: Date | null;
  lastSyncAt: Date | null;

  // Advanced Protection
  isAdvancedProtected: boolean;
  lastSecurityBlockAt: Date | null;
  advancedAccessStatus: string;
  advancedAccessRequiredAt: Date | null;
  advancedAccessReason: string | null;

  // Configuration
  searchQueryPattern: string | null;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Optional statistics to enrich the Site DTO
 */
export interface SiteStats {
  matchedProductsCount?: number;
  totalScrapedProductsCount?: number;
  totalUserProductsCount?: number;
}

type SiteDTOInput = Pick<
  Site,
  | "id"
  | "baseUrl"
  | "type"
  | "isSyncing"
  | "syncTotal"
  | "syncProcessed"
  | "syncLastAction"
  | "syncStartedAt"
  | "lastSyncAt"
  | "isAdvancedProtected"
  | "lastSecurityBlockAt"
  | "searchQueryPattern"
  | "currency"
  | "createdAt"
  | "updatedAt"
> & {
  advancedAccessStatus?: string | null;
  advancedAccessRequiredAt?: Date | null;
  advancedAccessReason?: string | null;
};

/**
 * Transforms a raw Prisma Site model into a standardized API Response DTO.
 * This guarantees consistent shape across GET/POST/PUT endpoints.
 */
export function toSiteDTO(site: SiteDTOInput, stats: SiteStats = {}): SiteResponseDTO {
  // Extract Name from URL
  let name = "Unknown";
  try {
    if (site.baseUrl) {
      const match = site.baseUrl.match(/^(?:https?:\/\/)?(?:www\.)?([^\/:]+)/i);
      const hostname = match ? match[1] : site.baseUrl;
      const parts = hostname.split(".");
      const rawName = parts.length > 1 ? parts[0] : hostname;
      name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    }
  } catch (e) {
    console.error(`Invalid baseUrl for site ${site.id}: ${site.baseUrl}`);
    name = site.baseUrl || "Unknown";
  }

  const matchedCount = stats.matchedProductsCount || 0;
  const totalUser = stats.totalUserProductsCount || 0;

  // Determine Status
  let status: SiteResponseDTO["status"] = "PENDING";
  if (site.isSyncing) {
    status = "SYNCING";
  } else if (matchedCount > 0) {
    status = "ACTIVE";
  } else if (site.lastSyncAt) {
    status = "NO MATCHES";
  }

  // Calculate Health (Matched / Total User Products)
  const health = totalUser > 0
    ? Math.round((matchedCount / totalUser) * 100)
    : 0;

  return {
    id: site.id,
    name,
    url: site.baseUrl,
    baseUrl: site.baseUrl,
    type: site.type,
    status,
    health,
    products: matchedCount,
    totalScraped: stats.totalScrapedProductsCount || 0,

    isSyncing: site.isSyncing,
    syncTotal: site.syncTotal,
    syncProcessed: site.syncProcessed,
    syncLastAction: site.syncLastAction,
    syncStartedAt: site.syncStartedAt,
    lastSyncAt: site.lastSyncAt,

    isAdvancedProtected: site.isAdvancedProtected,
    lastSecurityBlockAt: site.lastSecurityBlockAt,
    advancedAccessStatus: site.advancedAccessStatus || "NOT_REQUIRED",
    advancedAccessRequiredAt: site.advancedAccessRequiredAt || null,
    advancedAccessReason: site.advancedAccessReason || null,

    searchQueryPattern: site.searchQueryPattern,
    currency: site.currency,
    createdAt: site.createdAt,
    updatedAt: site.updatedAt,
  };
}
