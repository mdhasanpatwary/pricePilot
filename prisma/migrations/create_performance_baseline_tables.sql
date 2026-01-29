-- Performance Baselines Table
-- Stores baseline performance metrics for critical queries

CREATE TABLE IF NOT EXISTS performance_baselines (
    id SERIAL PRIMARY KEY,
    query_fingerprint VARCHAR(255) NOT NULL UNIQUE,
    query_name VARCHAR(255) NOT NULL,
    query_text TEXT NOT NULL,
    p50_ms NUMERIC(10, 2) NOT NULL,
    p95_ms NUMERIC(10, 2) NOT NULL,
    p99_ms NUMERIC(10, 2) NOT NULL,
    is_critical BOOLEAN DEFAULT false,
    established_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_performance_baselines_fingerprint ON performance_baselines (query_fingerprint);

CREATE INDEX idx_performance_baselines_critical ON performance_baselines (is_critical, p95_ms DESC);

COMMENT ON
TABLE performance_baselines IS 'Stores performance baselines for critical queries';

COMMENT ON COLUMN performance_baselines.query_fingerprint IS 'Unique identifier for the query pattern';

COMMENT ON COLUMN performance_baselines.p50_ms IS 'Median (50th percentile) execution time in milliseconds';

COMMENT ON COLUMN performance_baselines.p95_ms IS '95th percentile execution time in milliseconds';

COMMENT ON COLUMN performance_baselines.p99_ms IS '99th percentile execution time in milliseconds';

COMMENT ON COLUMN performance_baselines.is_critical IS 'Whether this is a critical query requiring monitoring';

-- Performance Regressions Table
-- Records detected performance regressions

CREATE TABLE IF NOT EXISTS performance_regressions (
    id SERIAL PRIMARY KEY,
    query_fingerprint VARCHAR(255) NOT NULL,
    baseline_p95_ms NUMERIC(10, 2) NOT NULL,
    current_p95_ms NUMERIC(10, 2) NOT NULL,
    degradation_percent NUMERIC(10, 2) NOT NULL,
    detected_at TIMESTAMP NOT NULL,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_performance_regressions_fingerprint ON performance_regressions (query_fingerprint);

CREATE INDEX idx_performance_regressions_detected ON performance_regressions (detected_at DESC);

CREATE INDEX idx_performance_regressions_unresolved ON performance_regressions (
    query_fingerprint,
    detected_at DESC
)
WHERE
    resolved_at IS NULL;

COMMENT ON
TABLE performance_regressions IS 'Records detected performance regressions for monitoring';

COMMENT ON COLUMN performance_regressions.degradation_percent IS 'Percentage degradation from baseline';

COMMENT ON COLUMN performance_regressions.resolved_at IS 'When the regression was resolved';

-- Performance Test Results Table
-- Stores results from performance test runs

CREATE TABLE IF NOT EXISTS performance_test_results (
    id SERIAL PRIMARY KEY,
    test_name VARCHAR(255) NOT NULL,
    duration_ms INTEGER NOT NULL,
    queries_executed INTEGER NOT NULL,
    success_count INTEGER NOT NULL,
    failure_count INTEGER NOT NULL,
    p50_ms NUMERIC(10, 2) NOT NULL,
    p95_ms NUMERIC(10, 2) NOT NULL,
    p99_ms NUMERIC(10, 2) NOT NULL,
    min_ms NUMERIC(10, 2) NOT NULL,
    max_ms NUMERIC(10, 2) NOT NULL,
    avg_ms NUMERIC(10, 2) NOT NULL,
    concurrent_connections INTEGER NOT NULL,
    test_config JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_performance_test_results_name ON performance_test_results (test_name, created_at DESC);

CREATE INDEX idx_performance_test_results_created ON performance_test_results (created_at DESC);

COMMENT ON
TABLE performance_test_results IS 'Stores results from performance test runs';

COMMENT ON COLUMN performance_test_results.test_config IS 'JSON configuration used for the test';