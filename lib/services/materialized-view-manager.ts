/**
 * Materialized View Manager
 * 
 * Manages materialized views for analytics queries to improve performance.
 * Implements automatic refresh scheduling and query routing.
 * 
 * Requirement 5.6: Use materialized views for aggregating price history data
 */

import { PrismaClient } from '@prisma/client';
import { optimizedPrisma } from '@/lib/database/optimized-prisma';

export interface MaterializedViewConfig {
    name: string;
    refreshIntervalMinutes: number;
    lastRefreshed?: Date;
}

export interface MaterializedViewStats {
    name: string;
    rowCount: number;
    sizeBytes: number;
    lastRefreshed: Date;
    nextRefresh: Date;
}

/**
 * Materialized View Manager Implementation
 */
export class MaterializedViewManager {
    private prisma: PrismaClient;
    private refreshIntervals: Map<string, NodeJS.Timeout> = new Map();

    constructor(prisma?: PrismaClient) {
        this.prisma = prisma || optimizedPrisma;
    }

    /**
     * Create the daily price comparison summary materialized view
     */
    async createDailyPriceComparisonView(): Promise<void> {
        const sql = `
            CREATE MATERIALIZED VIEW IF NOT EXISTS daily_price_comparison_summary AS
            SELECT 
                up.id as user_product_id,
                up."tenantId",
                up.title as product_name,
                up."currentPrice" as user_price,
                up.currency,
                COUNT(DISTINCT pm."competitorProductId") as competitor_count,
                AVG(cp."currentPrice") as avg_competitor_price,
                MIN(cp."currentPrice") as min_competitor_price,
                MAX(cp."currentPrice") as max_competitor_price,
                CASE 
                    WHEN MIN(cp."currentPrice") < up."currentPrice" THEN 'RED'
                    WHEN MIN(cp."currentPrice") > up."currentPrice" THEN 'GREEN'
                    ELSE 'NEUTRAL'
                END as price_status,
                NOW() as refreshed_at
            FROM "Product" up
            JOIN "ProductMatch" pm ON pm."userProductId" = up.id AND pm.status = 'APPROVED'
            JOIN "Product" cp ON cp.id = pm."competitorProductId"
            JOIN "Site" us ON us.id = up."siteId" AND us.type = 'USER'
            JOIN "Site" cs ON cs.id = cp."siteId" AND cs.type = 'COMPETITOR'
            WHERE up."siteId" IN (SELECT id FROM "Site" WHERE type = 'USER')
            GROUP BY up.id, up."tenantId", up.title, up."currentPrice", up.currency;

            CREATE UNIQUE INDEX IF NOT EXISTS idx_dpcs_user_product 
                ON daily_price_comparison_summary(user_product_id);
            
            CREATE INDEX IF NOT EXISTS idx_dpcs_tenant_status 
                ON daily_price_comparison_summary("tenantId", price_status);
            
            CREATE INDEX IF NOT EXISTS idx_dpcs_tenant 
                ON daily_price_comparison_summary("tenantId");
        `;

        await this.prisma.$executeRawUnsafe(sql);
    }

    /**
     * Refresh a materialized view
     */
    async refreshView(viewName: string): Promise<void> {
        const sql = `REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`;
        await this.prisma.$executeRawUnsafe(sql);
    }

    /**
     * Refresh the daily price comparison summary view
     */
    async refreshDailyPriceComparisonView(): Promise<void> {
        await this.refreshView('daily_price_comparison_summary');
    }

    /**
     * Schedule automatic refresh for a materialized view
     */
    scheduleRefresh(viewName: string, intervalMinutes: number): void {
        // Clear existing interval if any
        this.stopRefresh(viewName);

        // Schedule new refresh
        const intervalMs = intervalMinutes * 60 * 1000;
        const interval = setInterval(async () => {
            try {
                await this.refreshView(viewName);
                console.log(`[MaterializedViewManager] Refreshed view: ${viewName}`);
            } catch (error) {
                console.error(`[MaterializedViewManager] Error refreshing view ${viewName}:`, error);
            }
        }, intervalMs);

        this.refreshIntervals.set(viewName, interval);
    }

    /**
     * Stop scheduled refresh for a materialized view
     */
    stopRefresh(viewName: string): void {
        const interval = this.refreshIntervals.get(viewName);
        if (interval) {
            clearInterval(interval);
            this.refreshIntervals.delete(viewName);
        }
    }

    /**
     * Stop all scheduled refreshes
     */
    stopAllRefreshes(): void {
        for (const [viewName] of this.refreshIntervals) {
            this.stopRefresh(viewName);
        }
    }

    /**
     * Get statistics for a materialized view
     */
    async getViewStats(viewName: string): Promise<MaterializedViewStats | null> {
        try {
            const result = await this.prisma.$queryRawUnsafe<any[]>(`
                SELECT 
                    schemaname,
                    matviewname as name,
                    pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size,
                    pg_total_relation_size(schemaname||'.'||matviewname) as size_bytes
                FROM pg_matviews
                WHERE matviewname = $1
            `, viewName);

            if (result.length === 0) {
                return null;
            }

            // Get row count
            const countResult = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT COUNT(*) as count FROM ${viewName}`
            );

            // Get last refresh time from the view itself
            const refreshResult = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT refreshed_at FROM ${viewName} LIMIT 1`
            );

            const lastRefreshed = refreshResult[0]?.refreshed_at || new Date();
            const nextRefresh = new Date(lastRefreshed.getTime() + 15 * 60 * 1000); // +15 minutes

            return {
                name: viewName,
                rowCount: parseInt(countResult[0].count),
                sizeBytes: parseInt(result[0].size_bytes),
                lastRefreshed,
                nextRefresh,
            };
        } catch (error) {
            console.error(`[MaterializedViewManager] Error getting stats for ${viewName}:`, error);
            return null;
        }
    }

    /**
     * Check if a materialized view exists
     */
    async viewExists(viewName: string): Promise<boolean> {
        const result = await this.prisma.$queryRawUnsafe<any[]>(`
            SELECT COUNT(*) as count
            FROM pg_matviews
            WHERE matviewname = $1
        `, viewName);

        return parseInt(result[0].count) > 0;
    }

    /**
     * Drop a materialized view
     */
    async dropView(viewName: string): Promise<void> {
        await this.prisma.$executeRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS ${viewName} CASCADE`);
    }

    /**
     * Query the daily price comparison summary view
     */
    async queryDailyPriceComparison(options: {
        tenantId: string;
        priceStatus?: 'RED' | 'GREEN' | 'NEUTRAL';
        limit?: number;
        offset?: number;
    }): Promise<any[]> {
        const { tenantId, priceStatus, limit = 100, offset = 0 } = options;

        let sql = `
            SELECT * FROM daily_price_comparison_summary
            WHERE "tenantId" = $1
        `;

        const params: any[] = [tenantId];

        if (priceStatus) {
            sql += ` AND price_status = $${params.length + 1}`;
            params.push(priceStatus);
        }

        sql += ` ORDER BY user_price DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        return this.prisma.$queryRawUnsafe(sql, ...params);
    }

    /**
     * Initialize materialized views and start refresh schedules
     */
    async initialize(): Promise<void> {
        // Create views if they don't exist
        const exists = await this.viewExists('daily_price_comparison_summary');
        if (!exists) {
            await this.createDailyPriceComparisonView();
            // Initial refresh
            await this.refreshDailyPriceComparisonView();
        }

        // Schedule refresh every 15 minutes
        this.scheduleRefresh('daily_price_comparison_summary', 15);
    }

    /**
     * Cleanup resources
     */
    async cleanup(): Promise<void> {
        this.stopAllRefreshes();
    }
}

// Singleton instance
let materializedViewManagerInstance: MaterializedViewManager | null = null;

/**
 * Get the singleton MaterializedViewManager instance
 */
export function getMaterializedViewManager(): MaterializedViewManager {
    if (!materializedViewManagerInstance) {
        materializedViewManagerInstance = new MaterializedViewManager();
    }
    return materializedViewManagerInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetMaterializedViewManager(): void {
    if (materializedViewManagerInstance) {
        materializedViewManagerInstance.cleanup();
        materializedViewManagerInstance = null;
    }
}

/**
 * Export the singleton instance
 */
export const materializedViewManager = getMaterializedViewManager();
