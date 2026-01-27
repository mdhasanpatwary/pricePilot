/**
 * Admin Dashboard Enhancement Services
 * 
 * This module exports all services related to the admin dashboard enhancement:
 * - Session tracking and management
 * - Proxy simulation
 * - System alerts
 * - Redis session management
 * - Metrics aggregation
 */

export { SessionRepository, sessionRepository } from '../session-repository';
export { SimulationRepository, simulationRepository } from '../simulation-repository';
export { AlertRepository, alertRepository } from '../alert-repository';
export { RedisSessionManager, redisSessionManager } from '../redis-session-manager';
export { SessionTracker, sessionTracker } from '../session-tracker';
export { MetricsAggregator, metricsAggregator } from '../metrics-aggregator';

// Re-export types
export * from '@/lib/types/admin-dashboard';
