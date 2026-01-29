/**
 * Database Optimization Types and Interfaces
 * 
 * This file contains all TypeScript interfaces and types for the database
 * optimization feature, including query analysis, index management, connection
 * pooling, caching, archival, and read replica routing.
 */

// ============================================================================
// Query Analyzer Types
// ============================================================================

export interface SlowQueryData {
    query: string;
    params: any[];
    executionTime: number;
    affectedRows: number;
    tenantId: string;
    timestamp: Date;
    executionPlan: string;
}

export interface SlowQuery {
    query: string;
    avgExecutionTime: number;
    maxExecutionTime: number;
    executionCount: number;
    lastExecuted: Date;
}

export interface QueryPlan {
    planText: string;
    estimatedCost: number;
    actualCost: number;
    indexesUsed: string[];
    sequentialScans: boolean;
}

export interface Recommendation {
    type: 'index' | 'rewrite' | 'partition' | 'cache';
    description: string;
    estimatedImprovement: string;
    implementation: string;
}

export interface PerformanceTrend {
    date: Date;
    avgExecutionTime: number;
    executionCount: number;
    p95ExecutionTime: number;
}

export interface TimeRange {
    start: Date;
    end: Date;
}

export interface QueryAnalyzer {
    logSlowQuery(query: SlowQueryData): Promise<void>;
    getTopSlowQueries(limit: number, timeRange: TimeRange): Promise<SlowQuery[]>;
    analyzeQueryPlan(query: string, params: any[]): Promise<QueryPlan>;
    generateRecommendations(query: string): Promise<Recommendation[]>;
    getPerformanceTrends(timeRange: TimeRange): Promise<PerformanceTrend[]>;
}

// ============================================================================
// Index Manager Types
// ============================================================================

export interface IndexSuggestion {
    tableName: string;
    columns: string[];
    reason: string;
    estimatedImpact: 'high' | 'medium' | 'low';
    createStatement: string;
}

export interface UnusedIndex {
    indexName: string;
    tableName: string;
    sizeBytes: number;
    lastUsed: Date | null;
    dropStatement: string;
}

export interface IndexDefinition {
    name: string;
    tableName: string;
    columns: string[];
    unique: boolean;
    where?: string;
}

export interface IndexStats {
    indexName: string;
    tableName: string;
    sizeBytes: number;
    scans: number;
    tuplesRead: number;
    tuplesReturned: number;
    fragmentation: number;
}

export interface IndexManager {
    suggestIndexes(): Promise<IndexSuggestion[]>;
    findUnusedIndexes(minDaysSinceUse: number): Promise<UnusedIndex[]>;
    createIndexConcurrently(indexDef: IndexDefinition): Promise<void>;
    rebuildFragmentedIndexes(fragmentationThreshold: number): Promise<void>;
    getIndexStats(): Promise<IndexStats[]>;
}

// ============================================================================
// Connection Pool Manager Types
// ============================================================================

export interface PoolStats {
    totalConnections: number;
    idleConnections: number;
    activeConnections: number;
    waitingRequests: number;
    utilizationPercent: number;
}

export interface HealthStatus {
    healthy: boolean;
    primaryReachable: boolean;
    replicasReachable: number;
    avgResponseTime: number;
}

export interface PoolConfig {
    min: number;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
    maxLifetimeMillis: number;
    healthCheckIntervalMillis: number;
}

export interface ConnectionPoolManager {
    getPool(): any; // pg.Pool type
    getPoolStats(): PoolStats;
    healthCheck(): Promise<HealthStatus>;
    drain(): Promise<void>;
}

// ============================================================================
// Cache Layer Types
// ============================================================================

export interface CacheStats {
    hitRate: number;
    missRate: number;
    totalKeys: number;
    memoryUsedBytes: number;
    evictions: number;
}

export interface CacheKey {
    productComparison(tenantId: string, filters: any): string;
    competitorProducts(competitorId: string): string;
    priceHistory(productId: string, range: TimeRange): string;
}

export interface CacheLayer {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
    invalidate(pattern: string): Promise<number>;
    warmCache(tenantId: string): Promise<void>;
    getCacheStats(): Promise<CacheStats>;
}

// ============================================================================
// Archive Manager Types
// ============================================================================

export interface ArchiveResult {
    recordsArchived: number;
    recordsDeleted: number;
    durationMs: number;
    spaceFreedBytes: number;
}

export interface ArchiveStats {
    priceHistoryArchived: number;
    auditLogsArchived: number;
    totalArchiveSizeBytes: number;
    oldestArchivedRecord: Date;
}

export interface ArchivalConfig {
    table: string;
    retentionDays: number;
    scheduleTime: string; // Cron expression
    compressionEnabled: boolean;
}

export interface ArchiveManager {
    archivePriceHistory(olderThanDays: number): Promise<ArchiveResult>;
    archiveAuditLogs(olderThanDays: number): Promise<ArchiveResult>;
    queryArchive(table: string, filters: any): Promise<any[]>;
    getArchiveStats(): Promise<ArchiveStats>;
    scheduleArchival(config: ArchivalConfig): Promise<void>;
}

// ============================================================================
// Read Replica Router Types
// ============================================================================

export interface Query {
    sql: string;
    params: any[];
    type: 'read' | 'write';
    tenantId: string;
}

export interface ReplicationStatus {
    replicaId: string;
    lagSeconds: number;
    healthy: boolean;
    lastCheck: Date;
}

export interface RoutingStats {
    primaryQueries: number;
    replicaQueries: number;
    failoverCount: number;
    avgReplicationLag: number;
}

export interface ReadReplicaRouter {
    route(query: Query): Promise<any>; // Connection type
    checkReplicationLag(): Promise<ReplicationStatus[]>;
    markUnhealthy(replicaId: string): Promise<void>;
    getRoutingStats(): Promise<RoutingStats>;
}

// ============================================================================
// Performance Testing Types
// ============================================================================

export interface PerformanceBaseline {
    queryFingerprint: string;
    p50: number;
    p95: number;
    p99: number;
    establishedAt: Date;
}

export interface PerformanceComparison {
    queryFingerprint: string;
    baselineP95: number;
    currentP95: number;
    degradationPercent: number;
    isRegression: boolean;
}

export interface WorkloadSimulation {
    concurrentConnections: number;
    queriesPerSecond: number;
    durationSeconds: number;
    tenantCount: number;
}

// ============================================================================
// Bulk Operations Types
// ============================================================================

export interface BulkInsertOptions {
    batchSize: number;
    useTransaction: boolean;
    useCopy?: boolean;
}

export interface BulkUpdateOptions {
    batchSize: number;
    useTransaction: boolean;
    consolidateQueries: boolean;
}

export interface BulkOperationResult {
    totalRecords: number;
    successCount: number;
    failureCount: number;
    durationMs: number;
    errors: Array<{ record: any; error: string }>;
}

// ============================================================================
// Maintenance Types
// ============================================================================

export interface TableBloatInfo {
    tableName: string;
    bloatPercent: number;
    bloatBytes: number;
    shouldVacuum: boolean;
}

export interface GrowthAlert {
    tableName: string;
    currentSizeBytes: number;
    growthPercent: number;
    projectedSizeBytes: number;
    alertThreshold: number;
}

export interface MaintenanceSchedule {
    operation: 'ANALYZE' | 'VACUUM' | 'VACUUM_FULL' | 'REINDEX';
    tableName: string;
    scheduledTime: Date;
    estimatedDuration: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export type QueryType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER';

export interface QueryMetrics {
    executionTime: number;
    rowsAffected: number;
    planningTime: number;
    executionPlan: string;
}

export interface ConnectionMetrics {
    activeConnections: number;
    idleConnections: number;
    maxConnections: number;
    utilizationPercent: number;
    avgWaitTime: number;
}

export interface CacheMetrics {
    hits: number;
    misses: number;
    hitRate: number;
    avgGetTime: number;
    avgSetTime: number;
}
