/**
 * Database Optimization Module
 * 
 * Central export point for all database optimization components.
 */

// Connection Pool Manager
export {
    ConnectionPoolManagerImpl,
    getConnectionPoolManager,
    shutdownConnectionPoolManager,
} from '@/lib/services/connection-pool-manager';

// Query Analyzer
export {
    QueryAnalyzerImpl,
    getQueryAnalyzer,
    resetQueryAnalyzer,
} from '@/lib/services/query-analyzer';

// Materialized View Manager
export {
    MaterializedViewManager,
    getMaterializedViewManager,
    resetMaterializedViewManager,
} from '@/lib/services/materialized-view-manager';

// Optimized Prisma Client
export {
    optimizedPrisma,
    getOptimizedPrisma,
    disconnectOptimizedPrisma,
} from './optimized-prisma';

// Replica-Aware Prisma Client
export {
    replicaAwarePrisma,
    getReplicaAwarePrisma,
    disconnectReplicaAwarePrisma,
    getReplicaRouter,
    getReplicationStatus,
    getRoutingStats,
} from './replica-aware-prisma';

// Constants and Utilities
export * from './optimization-constants';

// Type Definitions
export * from '@/lib/types/database-optimization';
