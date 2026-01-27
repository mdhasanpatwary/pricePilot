/**
 * Type definitions for Admin Dashboard Enhancement
 * These types align with the Prisma schema and design document
 */

// Scraping Session Types
export type SessionStatus =
    | 'initializing'
    | 'running'
    | 'waiting_challenge'
    | 'completed'
    | 'failed';

export type SessionStage =
    | 'proxy_selection'
    | 'navigation'
    | 'challenge_detection'
    | 'challenge_solving'
    | 'data_extraction'
    | 'validation';

export type ChallengeStatus =
    | 'waiting'
    | 'solving'
    | 'solved'
    | 'failed';

export interface SessionError {
    timestamp: Date;
    message: string;
    stack?: string;
}

export interface SessionMetrics {
    navigationTime: number;
    challengeSolveTime: number;
    extractionTime: number;
    totalTime: number;
}

export interface ScrapingSessionData {
    id: string;
    tenantId: string;
    tenantName: string;
    siteUrl: string;
    targetUrl: string;
    status: SessionStatus;
    currentStage: SessionStage;
    proxyUsed: string | null;
    userAgent: string | null;
    requestsCompleted: number;
    requestsTotal: number;
    challengeType: string | null;
    challengeStatus: ChallengeStatus | null;
    extractedData: any | null;
    errors: SessionError[];
    metrics: SessionMetrics;
    startTime: Date;
    endTime: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

// Simulation Types
export type SimulationScenario =
    | 'rotation'
    | 'failure'
    | 'exclusion'
    | 'prioritization'
    | 'recovery'
    | 'cascading_failure'
    | 'all_fail'
    | 'single_success'
    | 'intermittent';

export type ProxyType = 'residential' | 'datacenter';

export type FailureType =
    | 'timeout'
    | 'connection_refused'
    | 'http_error'
    | 'challenge';

export interface ProxyConfig {
    url: string;
    type: ProxyType;
}

export interface SimulationConfig {
    scenario: SimulationScenario;
    targetSite: string;
    proxyPool: ProxyConfig[];
    failureRate?: number; // 0-1
    failureType?: FailureType;
    requestCount: number;
    delayBetweenRequests?: number;
}

export interface SimulationRequest {
    requestNumber: number;
    proxyUsed: string;
    success: boolean;
    responseTime: number;
    error?: string;
    retryCount: number;
}

export interface SimulationSummary {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    proxiesUsed: number;
    rotationPattern: string[];
}

export interface SimulationResultData {
    id: string;
    scenario: SimulationScenario;
    config: SimulationConfig;
    requests: SimulationRequest[];
    summary: SimulationSummary;
    recommendations: string[];
    startTime: Date;
    endTime: Date;
    createdAt: Date;
}

// System Alert Types
export type AlertSeverity = 'critical' | 'warning' | 'info';

export type AlertType =
    | 'component_failure'
    | 'performance_degradation'
    | 'capacity_warning'
    | 'security_issue'
    | 'data_quality'
    | 'proxy_failure'
    | 'challenge_failure';

export interface SystemAlertData {
    id: string;
    alertType: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    context: Record<string, any> | null;
    acknowledged: boolean;
    acknowledgedAt: Date | null;
    acknowledgedBy: string | null;
    createdAt: Date;
}

// Dashboard Metrics Types
export interface PlatformMetrics {
    activeSessions: number;
    requestsPerMinute: number;
    avgSessionDuration: number;
    totalTenants: number;
    activeTenants: number;
}

export interface ScrapingMetrics {
    successRate: number;
    blockRate: number;
    challengeRate: number;
    avgResponseTime: number;
    requestsLast24h: number;
}

export interface ProxyMetrics {
    totalProxies: number;
    healthyProxies: number;
    avgSuccessRate: number;
    avgResponseTime: number;
}

export interface ChallengeMetrics {
    totalChallenges: number;
    solveRate: number;
    avgSolveTime: number;
}

export interface DashboardMetrics {
    platform: PlatformMetrics;
    scraping: ScrapingMetrics;
    proxies: ProxyMetrics;
    challenges: ChallengeMetrics;
}

// Session Filters
export interface SessionFilters {
    tenantId?: string;
    status?: SessionStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}

// Time Series Data
export interface TimeSeriesDataPoint {
    timestamp: Date;
    value: number;
}

export interface TimeSeriesData {
    metric: string;
    dataPoints: TimeSeriesDataPoint[];
}

// Failure Statistics
export interface FailureStats {
    identifier: string; // site URL or proxy URL
    totalRequests: number;
    failedRequests: number;
    failureRate: number;
    lastFailure: Date;
}

// Tenant Metrics
export interface TenantMetrics {
    tenantId: string;
    tenantName: string;
    activeSessions: number;
    successRate: number;
    avgScrapeTime: number;
    dataQualityScore: number;
    resourceUsage: {
        requestsToday: number;
        quotaLimit: number;
        quotaUsed: number;
    };
}

// System Health Types
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ComponentHealth {
    status: HealthStatus;
    message: string;
    responseTime?: number;
    details?: Record<string, any>;
}

export interface SystemHealth {
    overall: HealthStatus;
    database: ComponentHealth;
    redis: ComponentHealth;
    browserPool: ComponentHealth;
    circuitBreakers: ComponentHealth;
}
