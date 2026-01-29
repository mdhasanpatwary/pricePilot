-- Database Optimization Extensions Setup
-- This migration sets up the required PostgreSQL extensions for database optimization

-- Enable pg_stat_statements for query performance monitoring
-- This extension tracks execution statistics of all SQL statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Enable pgstattuple for table and index bloat analysis
-- This extension provides functions to obtain tuple-level statistics
CREATE EXTENSION IF NOT EXISTS pgstattuple;

-- Configure pg_stat_statements
-- Track up to 10,000 distinct queries
ALTER SYSTEM SET pg_stat_statements.max = 10000;

-- Track all queries (not just top-level)
ALTER SYSTEM SET pg_stat_statements.track = 'all';

-- Save query text (required for analysis)
ALTER SYSTEM SET pg_stat_statements.save = true;

-- Note: After running this migration, you may need to restart PostgreSQL
-- or reload the configuration for the ALTER SYSTEM settings to take effect.
-- Run: SELECT pg_reload_conf(); to reload without restart.