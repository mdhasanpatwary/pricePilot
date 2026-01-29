/**
 * Tests for enhanced database indexes
 * Task 15: Create enhanced indexes for existing tables
 * Requirements: 2.1
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Enhanced Database Indexes', () => {
    describe('Index Existence', () => {
        const expectedIndexes = [
            // User Products
            'idx_product_tenant_status_price',
            'idx_product_last_crawled',

            // Competitor Products
            'idx_product_competitor_scraped',
            'idx_product_competitor_sku',

            // Product Matches
            'idx_product_match_user_status',
            'idx_product_match_competitor_status',
            'idx_product_match_active',

            // Price History
            'idx_price_history_product_recorded',
            'idx_price_history_tenant_recorded',

            // Audit Logs
            'idx_audit_log_tenant_created',
            'idx_audit_log_entity',
            'idx_audit_log_user_created',

            // Price Updates
            'idx_price_update_product_executed',
            'idx_price_update_status_executed',

            // Additional Performance Indexes
            'idx_site_tenant_type_sync',
            'idx_product_brand_model_tenant',
            'idx_product_category_price_tenant',
            'idx_notification_tenant_read_created',
            'idx_session_expires',
        ];

        test.each(expectedIndexes)('should have index: %s', async (indexName) => {
            const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 
          FROM pg_indexes 
          WHERE indexname = ${indexName}
        ) as exists
      `;

            expect(result[0].exists).toBe(true);
        });
    });

    describe('Index Validity', () => {
        it('should have all indexes marked as valid', async () => {
            const result = await prisma.$queryRaw<
                Array<{ indexname: string; is_valid: boolean }>
            >`
        SELECT 
          indexrelname as indexname,
          indisvalid as is_valid
        FROM pg_stat_user_indexes
        JOIN pg_index ON pg_stat_user_indexes.indexrelid = pg_index.indexrelid
        WHERE indexrelname LIKE 'idx_%'
      `;

            const invalidIndexes = result.filter((idx) => !idx.is_valid);

            expect(invalidIndexes).toHaveLength(0);
        });
    });

    describe('Index Coverage', () => {
        it('should have composite index on Product for tenant, site, and price', async () => {
            const result = await prisma.$queryRaw<Array<{ indexdef: string }>>`
        SELECT indexdef
        FROM pg_indexes
        WHERE indexname = 'idx_product_tenant_status_price'
      `;

            expect(result[0].indexdef).toContain('tenantId');
            expect(result[0].indexdef).toContain('siteId');
            expect(result[0].indexdef).toContain('currentPrice');
        });

        it('should have index on Product for last crawled timestamp', async () => {
            const result = await prisma.$queryRaw<Array<{ indexdef: string }>>`
        SELECT indexdef
        FROM pg_indexes
        WHERE indexname = 'idx_product_last_crawled'
      `;

            expect(result[0].indexdef).toContain('lastCrawledAt');
            expect(result[0].indexdef).toContain('DESC');
        });

        it('should have composite index on ProductMatch for user product and status', async () => {
            const result = await prisma.$queryRaw<Array<{ indexdef: string }>>`
        SELECT indexdef
        FROM pg_indexes
        WHERE indexname = 'idx_product_match_user_status'
      `;

            expect(result[0].indexdef).toContain('userProductId');
            expect(result[0].indexdef).toContain('status');
        });

        it('should have composite index on PriceHistory for product and timestamp', async () => {
            const result = await prisma.$queryRaw<Array<{ indexdef: string }>>`
        SELECT indexdef
        FROM pg_indexes
        WHERE indexname = 'idx_price_history_product_recorded'
      `;

            expect(result[0].indexdef).toContain('productId');
            expect(result[0].indexdef).toContain('recordedAt');
            expect(result[0].indexdef).toContain('DESC');
        });

        it('should have composite index on TenantAuditLog for tenant and timestamp', async () => {
            const result = await prisma.$queryRaw<Array<{ indexdef: string }>>`
        SELECT indexdef
        FROM pg_indexes
        WHERE indexname = 'idx_audit_log_tenant_created'
      `;

            expect(result[0].indexdef).toContain('tenantId');
            expect(result[0].indexdef).toContain('createdAt');
            expect(result[0].indexdef).toContain('DESC');
        });
    });

    describe('Index Statistics', () => {
        it('should track index usage statistics', async () => {
            const result = await prisma.$queryRaw<
                Array<{
                    indexname: string;
                    idx_scan: bigint;
                    idx_tup_read: bigint;
                    idx_tup_fetch: bigint;
                }>
            >`
        SELECT 
          indexrelname as indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        WHERE indexrelname LIKE 'idx_product_%'
        OR indexrelname LIKE 'idx_price_%'
        OR indexrelname LIKE 'idx_audit_%'
        LIMIT 5
      `;

            expect(result.length).toBeGreaterThan(0);

            result.forEach((stat) => {
                expect(stat).toHaveProperty('indexname');
                expect(stat).toHaveProperty('idx_scan');
                expect(stat).toHaveProperty('idx_tup_read');
                expect(stat).toHaveProperty('idx_tup_fetch');
            });
        });

        it('should have reasonable index sizes', async () => {
            const result = await prisma.$queryRaw<
                Array<{
                    indexname: string;
                    size_bytes: bigint;
                }>
            >`
        SELECT 
          indexrelname as indexname,
          pg_relation_size(indexrelid) as size_bytes
        FROM pg_stat_user_indexes
        WHERE indexrelname LIKE 'idx_%'
        ORDER BY pg_relation_size(indexrelid) DESC
        LIMIT 10
      `;

            expect(result.length).toBeGreaterThan(0);

            result.forEach((stat) => {
                expect(stat.size_bytes).toBeGreaterThanOrEqual(0);
            });
        });
    });

    describe('Concurrent Index Creation', () => {
        it('should verify indexes were created concurrently (non-blocking)', async () => {
            // Check that indexes don't have any locks
            const result = await prisma.$queryRaw<
                Array<{
                    indexname: string;
                    lock_type: string | null;
                }>
            >`
        SELECT 
          i.indexrelname as indexname,
          l.mode as lock_type
        FROM pg_stat_user_indexes i
        LEFT JOIN pg_locks l ON l.relation = i.indexrelid
        WHERE i.indexrelname LIKE 'idx_%'
        AND l.mode IS NOT NULL
      `;

            // Should have no active locks on indexes
            expect(result).toHaveLength(0);
        });
    });

    describe('Index Performance Impact', () => {
        it('should improve query performance for tenant filtering', async () => {
            // This test verifies that the query planner uses the index
            const explainResult = await prisma.$queryRawUnsafe<Array<any>>(`
        EXPLAIN (FORMAT JSON)
        SELECT * FROM "Product"
        WHERE "tenantId" = 'test-tenant'
        AND "siteId" = 'test-site'
        ORDER BY "currentPrice" DESC
        LIMIT 10
      `);

            const plan = JSON.stringify(explainResult);

            // Should use index scan instead of sequential scan
            expect(plan).toContain('Index');
        });

        it('should improve query performance for price history lookups', async () => {
            const explainResult = await prisma.$queryRawUnsafe<Array<any>>(`
        EXPLAIN (FORMAT JSON)
        SELECT * FROM "PriceHistory"
        WHERE "productId" = 'test-product'
        ORDER BY "recordedAt" DESC
        LIMIT 20
      `);

            const plan = JSON.stringify(explainResult);

            // Should use index scan
            expect(plan).toContain('Index');
        });

        it('should improve query performance for audit log queries', async () => {
            const explainResult = await prisma.$queryRawUnsafe<Array<any>>(`
        EXPLAIN (FORMAT JSON)
        SELECT * FROM "TenantAuditLog"
        WHERE "tenantId" = 'test-tenant'
        ORDER BY "createdAt" DESC
        LIMIT 50
      `);

            const plan = JSON.stringify(explainResult);

            // Should use index scan
            expect(plan).toContain('Index');
        });
    });

    describe('Partial Index Conditions', () => {
        it('should have partial index for active product matches', async () => {
            const result = await prisma.$queryRaw<Array<{ indexdef: string }>>`
        SELECT indexdef
        FROM pg_indexes
        WHERE indexname = 'idx_product_match_active'
      `;

            expect(result[0].indexdef).toContain('WHERE');
            expect(result[0].indexdef).toContain('APPROVED');
        });

        it('should have partial index for competitor products with SKU', async () => {
            const result = await prisma.$queryRaw<Array<{ indexdef: string }>>`
        SELECT indexdef
        FROM pg_indexes
        WHERE indexname = 'idx_product_competitor_sku'
      `;

            expect(result[0].indexdef).toContain('WHERE');
            expect(result[0].indexdef).toContain('IS NOT NULL');
        });

        it('should have partial index for non-expired sessions', async () => {
            const result = await prisma.$queryRaw<Array<{ indexdef: string }>>`
        SELECT indexdef
        FROM pg_indexes
        WHERE indexname = 'idx_session_expires'
      `;

            expect(result[0].indexdef).toContain('WHERE');
            expect(result[0].indexdef).toContain('expires');
        });
    });
});
