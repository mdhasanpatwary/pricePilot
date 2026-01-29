/**
 * Database Optimization Constants
 * 
 * Central location for all configuration constants used in database optimization.
 */

// ============================================================================
// Query Performance Thresholds
// ============================================================================

export const SLOW_QUERY_THRESHOLD_MS = 1000; // Queries slower than 1 second
export const VERY_SLOW_QUERY_THRESHOLD_MS = 5000; // Queries slower than 5 seconds
export const TOP_SLOW_QUERIES_LIMIT = 20; // Number of slow queries to display

// ============================================================================
// Connection Pool Configuration
// ============================================================================

export const CONNECTION_POOL_MIN = 10;
export const CONNECTION_POOL_MAX = 50;
export const CONNECTION_IDLE_TIMEOUT_MS = 60000; // 1 minute
export const CONNECTION_TIMEOUT_MS = 30000; // 30 seconds
export const CONNECTION_MAX_LIFETIME_MS = 1800000; // 30 minutes
export const CONNECTION_HEALTH_CHECK_INTERVAL_MS = 30000; // 30 seconds
export const CONNECTION_POOL_HIGH_UTILIZATION_THRESHOLD = 0.8; // 80%
export const CONNECTION_POOL_CRITICAL_UTILIZATION_THRESHOLD = 0.9; // 90%

// ============================================================================
// Retry Configuration
// ============================================================================

export const MAX_RETRY_ATTEMPTS = 5;
export const INITIAL_RETRY_DELAY_MS = 100;
export const RETRY_BACKOFF_MULTIPLIER = 2;

// ============================================================================
// Index Management
// ============================================================================

export const INDEX_FRAGMENTATION_THRESHOLD = 0.3; // 30%
export const UNUSED_INDEX_DAYS_THRESHOLD = 30; // 30 days
export const LARGE_TABLE_ROW_THRESHOLD = 10000; // Tables with > 10k rows

// ============================================================================
// Cache Configuration
// ============================================================================

export const CACHE_TTL_PRODUCT_COMPARISON = 300; // 5 minutes
export const CACHE_TTL_COMPETITOR_PRODUCTS = 900; // 15 minutes
export const CACHE_TTL_PRICE_HISTORY = 600; // 10 minutes
export const CACHE_HIT_RATE_WARNING_THRESHOLD = 0.6; // 60%
export const CACHE_HIT_RATE_CRITICAL_THRESHOLD = 0.5; // 50%

// ============================================================================
// Archival Configuration
// ============================================================================

export const PRICE_HISTORY_RETENTION_DAYS = 90;
export const AUDIT_LOG_RETENTION_DAYS = 365;
export const ARCHIVE_BATCH_SIZE = 10000;
export const ARCHIVE_MAINTENANCE_WINDOW_START_HOUR = 2; // 2 AM UTC
export const ARCHIVE_MAINTENANCE_WINDOW_END_HOUR = 4; // 4 AM UTC

// ============================================================================
// Bulk Operations
// ============================================================================

export const BULK_INSERT_BATCH_SIZE = 1000;
export const BULK_UPDATE_BATCH_SIZE = 1000;
export const BULK_OPERATION_CHUNK_SIZE = 10000;
export const COPY_OPERATION_THRESHOLD = 50000; // Use COPY for > 50k records

// ============================================================================
// Pagination
// ============================================================================

export const CURSOR_PAGINATION_THRESHOLD = 10000; // Use cursor for > 10k rows
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ============================================================================
// Maintenance
// ============================================================================

export const TABLE_BLOAT_WARNING_THRESHOLD = 0.2; // 20%
export const TABLE_BLOAT_CRITICAL_THRESHOLD = 0.3; // 30%
export const TABLE_GROWTH_ALERT_THRESHOLD = 0.2; // 20% per week
export const STATISTICS_HISTORY_RETENTION_DAYS = 90;
export const ANALYZE_SCHEDULE_HOUR = 3; // 3 AM UTC daily
export const VACUUM_SCHEDULE_DAY = 0; // Sunday (0 = Sunday in cron)

// ============================================================================
// Read Replica Configuration
// ============================================================================

export const REPLICATION_LAG_WARNING_THRESHOLD_SECONDS = 5;
export const REPLICATION_LAG_CRITICAL_THRESHOLD_SECONDS = 30;
export const REPLICA_HEALTH_CHECK_INTERVAL_MS = 10000; // 10 seconds
export const REPLICA_CIRCUIT_BREAKER_THRESHOLD = 5; // failures before circuit opens

// ============================================================================
// Performance Testing
// ============================================================================

export const PERFORMANCE_TEST_CONCURRENT_CONNECTIONS = 100;
export const PERFORMANCE_REGRESSION_THRESHOLD = 0.2; // 20% degradation
export const PERFORMANCE_BASELINE_SAMPLE_SIZE = 1000;

// ============================================================================
// Materialized View Refresh
// ============================================================================

export const MATERIALIZED_VIEW_REFRESH_INTERVAL_MINUTES = 15;

// ============================================================================
// Query Fingerprinting
// ============================================================================

/**
 * Generate a fingerprint for a query by normalizing it
 * (removing specific values, whitespace, etc.)
 */
export function generateQueryFingerprint(query: string): string {
    return query
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/\$\d+/g, '$?') // Replace parameter placeholders
        .replace(/\d+/g, '?') // Replace numeric literals
        .replace(/'[^']*'/g, '?') // Replace string literals
        .trim()
        .toLowerCase();
}

/**
 * Detect query type from SQL statement
 */
export function detectQueryType(query: string): 'read' | 'write' {
    const normalizedQuery = query.trim().toLowerCase();

    if (normalizedQuery.startsWith('select')) {
        return 'read';
    }

    if (
        normalizedQuery.startsWith('insert') ||
        normalizedQuery.startsWith('update') ||
        normalizedQuery.startsWith('delete') ||
        normalizedQuery.startsWith('create') ||
        normalizedQuery.startsWith('alter') ||
        normalizedQuery.startsWith('drop')
    ) {
        return 'write';
    }

    // Default to write for safety
    return 'write';
}

/**
 * Check if current time is within maintenance window
 */
export function isMaintenanceWindow(): boolean {
    const now = new Date();
    const hour = now.getUTCHours();

    return (
        hour >= ARCHIVE_MAINTENANCE_WINDOW_START_HOUR &&
        hour < ARCHIVE_MAINTENANCE_WINDOW_END_HOUR
    );
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoffDelay(attempt: number): number {
    return INITIAL_RETRY_DELAY_MS * Math.pow(RETRY_BACKOFF_MULTIPLIER, attempt);
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Calculate percentile from sorted array of numbers
 */
export function calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
}
