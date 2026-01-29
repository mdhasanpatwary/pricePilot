-- Database Statistics History Table
-- Tracks database statistics over time for capacity planning and trend analysis
-- Requirements: 8.5

-- Create database_statistics_history table
CREATE TABLE IF NOT EXISTS database_statistics_history (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL,
    row_count BIGINT,
    index_size_bytes BIGINT,
    bloat_percent NUMERIC(5, 2),
    last_vacuum TIMESTAMP,
    last_analyze TIMESTAMP,
    collected_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_statistics_history_table_collected ON database_statistics_history (table_name, collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_statistics_history_collected ON database_statistics_history (collected_at DESC);

-- Create index_statistics_history table for index-specific stats
CREATE TABLE IF NOT EXISTS index_statistics_history (
    id SERIAL PRIMARY KEY,
    index_name VARCHAR(255) NOT NULL,
    table_name VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL,
    scans BIGINT,
    tuples_read BIGINT,
    tuples_fetched BIGINT,
    collected_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_index_statistics_history_index_collected ON index_statistics_history (index_name, collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_index_statistics_history_table_collected ON index_statistics_history (table_name, collected_at DESC);

-- Create function to clean up old statistics (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_statistics()
RETURNS void AS $$
BEGIN
    DELETE FROM database_statistics_history 
    WHERE collected_at < NOW() - INTERVAL '90 days';
    
    DELETE FROM index_statistics_history 
    WHERE collected_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Comment on tables
COMMENT ON
TABLE database_statistics_history IS 'Historical database statistics for capacity planning and trend analysis';

COMMENT ON
TABLE index_statistics_history IS 'Historical index statistics for performance monitoring';