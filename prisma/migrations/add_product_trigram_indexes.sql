-- Migration: Add GIN trigram indexes for fast ILIKE text search on Product
-- Run with: npx prisma db execute --file prisma/migrations/add_product_trigram_indexes.sql
--
-- After this migration, ILIKE '%query%' on title, sku, brand, model will use
-- a GIN Bitmap Index Scan instead of a Sequential Scan.
-- Benchmark: 10–100x improvement for text search on large product tables.

-- Enable pg_trgm extension (required for trigram indexes)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on title (most commonly searched field)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_title_trgm
    ON "Product" USING GIN (title gin_trgm_ops);

-- GIN trigram index on sku
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_sku_trgm
    ON "Product" USING GIN (sku gin_trgm_ops);

-- GIN trigram index on brand
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_brand_trgm
    ON "Product" USING GIN (brand gin_trgm_ops);

-- GIN trigram index on model
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_model_trgm
    ON "Product" USING GIN (model gin_trgm_ops);
