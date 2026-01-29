-- Create archive tables for price history and audit logs
-- These tables use partitioning for efficient data management

-- Price history archive (partitioned by year)
CREATE TABLE IF NOT EXISTS price_history_archive (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    recorded_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL,
    archived_at TIMESTAMP DEFAULT NOW(),
    tenant_id TEXT,
    CONSTRAINT fk_archived_product FOREIGN KEY (product_id) REFERENCES "Product" (id) ON DELETE CASCADE
)
PARTITION BY
    RANGE (recorded_at);

-- Create partitions for price history archive (2023-2026)
CREATE TABLE IF NOT EXISTS price_history_archive_2023 PARTITION OF price_history_archive FOR
VALUES
FROM ('2023-01-01') TO ('2024-01-01');

CREATE TABLE IF NOT EXISTS price_history_archive_2024 PARTITION OF price_history_archive FOR
VALUES
FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE IF NOT EXISTS price_history_archive_2025 PARTITION OF price_history_archive FOR
VALUES
FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS price_history_archive_2026 PARTITION OF price_history_archive FOR
VALUES
FROM ('2026-01-01') TO ('2027-01-01');

-- Indexes for price history archive
CREATE INDEX IF NOT EXISTS idx_price_history_archive_product ON price_history_archive (product_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_archive_tenant ON price_history_archive (tenant_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_archive_recorded ON price_history_archive (recorded_at DESC);

-- Audit logs archive (partitioned by year)
CREATE TABLE IF NOT EXISTS audit_logs_archive (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at TIMESTAMP NOT NULL,
    archived_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_archived_tenant FOREIGN KEY (tenant_id) REFERENCES "Tenant" (id) ON DELETE CASCADE
)
PARTITION BY
    RANGE (created_at);

-- Create partitions for audit logs archive (2023-2026)
CREATE TABLE IF NOT EXISTS audit_logs_archive_2023 PARTITION OF audit_logs_archive FOR
VALUES
FROM ('2023-01-01') TO ('2024-01-01');

CREATE TABLE IF NOT EXISTS audit_logs_archive_2024 PARTITION OF audit_logs_archive FOR
VALUES
FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE IF NOT EXISTS audit_logs_archive_2025 PARTITION OF audit_logs_archive FOR
VALUES
FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS audit_logs_archive_2026 PARTITION OF audit_logs_archive FOR
VALUES
FROM ('2026-01-01') TO ('2027-01-01');

-- Indexes for audit logs archive
CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_tenant ON audit_logs_archive (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_entity ON audit_logs_archive (tenant_id, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_created ON audit_logs_archive (created_at DESC);

-- Enable compression on archive tables (PostgreSQL 14+)
-- This reduces storage costs for archived data
ALTER TABLE price_history_archive_2023 SET(toast_tuple_target = 128);

ALTER TABLE price_history_archive_2024 SET(toast_tuple_target = 128);

ALTER TABLE price_history_archive_2025 SET(toast_tuple_target = 128);

ALTER TABLE price_history_archive_2026 SET(toast_tuple_target = 128);

ALTER TABLE audit_logs_archive_2023 SET(toast_tuple_target = 128);

ALTER TABLE audit_logs_archive_2024 SET(toast_tuple_target = 128);

ALTER TABLE audit_logs_archive_2025 SET(toast_tuple_target = 128);

ALTER TABLE audit_logs_archive_2026 SET(toast_tuple_target = 128);