/**
 * Bot Protection Handling Module
 * 
 * Exports all bot protection detection and mitigation components.
 */

export {
    DetectionEngine,
    ProtectionType,
    type HttpResponse,
    type ProtectionIndicators,
    type DetectionResult,
} from './detection-engine';

export {
    DetectionTracker,
    getDetectionTracker,
} from './detection-tracker';

export {
    ProxyManager,
    type Proxy,
    type ProxyHealth,
} from './proxy-manager';

export {
    SessionManager,
    type Cookie,
} from './session-manager';

export {
    RateLimiter,
    type RateLimitConfig,
} from './rate-limiter';

export {
    calculateDelay,
} from './backoff-calculator';

export {
    HttpScraper,
    type ScrapeConfig,
    type ScrapeResponse,
    type ProxyConfig,
} from './http-scraper';

export {
    UserAgentPool,
    userAgentPool,
    type UserAgentType,
} from './user-agent-pool';

export {
    generateHeaders,
    generateDesktopHeaders,
    generateMobileHeaders,
    generateHeadersAuto,
    detectProfileFromUserAgent,
    type HeaderProfile,
    type HeaderOptions,
} from './header-generator';

export {
    DataExtractor,
    type SelectorConfig,
    type ExtractionResult,
} from './data-extractor';

export {
    HeadlessBrowserScraper,
    type BrowserScrapeConfig,
    type BrowserScrapeResponse,
    type Viewport,
    type NetworkRequest,
} from './headless-browser-scraper';

export {
    BrowserPool,
    type BrowserPoolConfig,
} from './browser-pool';

export {
    StrategySelector,
    ScrapingStrategy,
    type SiteConfiguration,
    type ScrapeAttempt,
    type StrategyContext,
    type FailureContext,
} from './strategy-selector';

export {
    ScrapeOrchestrator,
    type ScrapeRequest,
    type ScrapeResult,
} from './scrape-orchestrator';

export {
    LoggingService,
    type ScrapeAttemptLog,
    type DetectionLog,
    type LogQuery,
} from './logging-service';

export {
    ScreenshotStorage,
} from './screenshot-storage';

export {
    LogRetentionJob,
    runLogRetentionCleanup,
} from './log-retention-job';

export {
    MetricsCollector,
    TimeWindow,
    type ScrapeMetric,
    type MetricsSummary,
    type SiteMetrics,
    metricsCollector,
} from './metrics-collector';

export {
    getSuccessRate,
    getAverageResponseTime,
    getMultiGranularityStats,
    getPerMethodStats,
    getPerSiteStats,
} from './success-rate-calculator';

export {
    runHourlyAggregation,
    updateRealTimeCounters,
    getRealTimeMetrics,
    generateBreakdowns,
    cleanupOldMetrics,
} from './metric-aggregation-job';
