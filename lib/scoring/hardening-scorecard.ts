/**
 * System Hardening Score Calculator
 *
 * Evaluates system performance across 6 hardening dimensions:
 * - Security (0-10)
 * - Queue Stability (0-10)
 * - Scraper Stability (0-10)
 * - Scalability (0-10)
 * - Observability (0-10)
 * - Overall (0-10) = average of all dimensions
 */

export interface ScoreCriteria {
  name: string;
  maxScore: number;
  weight: number;
  description: string;
}

export interface DimensionScore {
  dimension: string;
  score: number;
  maxScore: number;
  passed: boolean;
  target: number;
  components: Record<string, number>;
  details: string[];
}

export interface HardeningScorecard {
  timestamp: Date;
  security: DimensionScore;
  queueStability: DimensionScore;
  scraperStability: DimensionScore;
  scalability: DimensionScore;
  observability: DimensionScore;
  overall: DimensionScore;
}

/**
 * Security Score (Target ≥ 8.5)
 *
 * Components:
 * - SSRF Protection (2 pts): Valid/invalid URL blocking
 * - Environment Separation (2 pts): INTERNAL_MODE enforcement
 * - Rate Limiting (2 pts): Multi-level enforcement
 * - Authentication (2 pts): Session validation
 * - Data Validation (2 pts): Input sanitization
 */
export function calculateSecurityScore(metrics: Record<string, any>): DimensionScore {
  const components: Record<string, number> = {
    ssrf_protection: 0,
    environment_separation: 0,
    rate_limiting: 0,
    authentication: 0,
    data_validation: 0,
  };

  const details: string[] = [];

  // SSRF Protection (2 pts)
  if (metrics.ssrf_blocked_private_ips > 0) {
    components.ssrf_protection = 1.5;
    details.push("✓ SSRF blocks private IPs");
  }
  if (metrics.ssrf_blocked_metadata > 0) {
    components.ssrf_protection = 2.0;
    details.push("✓ SSRF blocks metadata endpoints");
  }

  // Environment Separation (2 pts)
  if (metrics.internal_mode_disabled_production === true) {
    components.environment_separation = 1.5;
    details.push("✓ INTERNAL_MODE disabled in production");
  }
  if (metrics.debug_code_excluded_build === true) {
    components.environment_separation = 2.0;
    details.push("✓ Debug code excluded from production builds");
  }

  // Rate Limiting (2 pts)
  if (metrics.rate_limit_enforced_tenant === true) {
    components.rate_limiting = 1.0;
    details.push("✓ Per-tenant rate limiting active");
  }
  if (metrics.rate_limit_enforced_ip === true) {
    components.rate_limiting = 2.0;
    details.push("✓ Per-IP rate limiting active");
  }

  // Authentication (2 pts)
  if (metrics.auth_session_validation_success_rate >= 0.95) {
    components.authentication = 2.0;
    details.push(`✓ Authentication: 95%+ success rate (${metrics.auth_session_validation_success_rate * 100}%)`);
  } else if (metrics.auth_session_validation_success_rate >= 0.90) {
    components.authentication = 1.5;
    details.push(`✓ Authentication: 90%+ success rate (${metrics.auth_session_validation_success_rate * 100}%)`);
  }

  // Data Validation (2 pts)
  if (metrics.invalid_requests_blocked > 0) {
    components.data_validation = 1.5;
    details.push("✓ Invalid requests blocked");
  }
  if (metrics.injection_attempts_blocked > 0) {
    components.data_validation = 2.0;
    details.push("✓ Injection attempts blocked");
  }

  const score = Object.values(components).reduce((a, b) => a + b, 0);

  return {
    dimension: "Security",
    score: Math.min(score, 10),
    maxScore: 10,
    passed: score >= 8.5,
    target: 8.5,
    components,
    details: details.length > 0 ? details : ["No security metrics collected yet"],
  };
}

/**
 * Queue Stability Score (Target ≥ 8.0)
 *
 * Components:
 * - Job Success Rate (2 pts): % of jobs completed
 * - DLQ Health (2 pts): DLQ growth rate
 * - Retry Logic (2 pts): Retry effectiveness
 * - Error Classification (2 pts): Transient vs permanent
 * - Lock Reliability (2 pts): Lock acquisition/release
 */
export function calculateQueueStabilityScore(metrics: Record<string, any>): DimensionScore {
  const components: Record<string, number> = {
    job_success_rate: 0,
    dlq_health: 0,
    retry_logic: 0,
    error_classification: 0,
    lock_reliability: 0,
  };

  const details: string[] = [];

  // Job Success Rate (2 pts)
  const successRate = metrics.jobs_completed / (metrics.jobs_completed + metrics.jobs_failed + 1);
  if (successRate >= 0.99) {
    components.job_success_rate = 2.0;
    details.push(`✓ Job success rate: ${(successRate * 100).toFixed(2)}%`);
  } else if (successRate >= 0.95) {
    components.job_success_rate = 1.5;
    details.push(`✓ Job success rate: ${(successRate * 100).toFixed(2)}%`);
  } else if (successRate >= 0.90) {
    components.job_success_rate = 1.0;
    details.push(`⚠ Job success rate: ${(successRate * 100).toFixed(2)}%`);
  }

  // DLQ Health (2 pts)
  const dlqRate = metrics.jobs_dlq / (metrics.jobs_completed + 1);
  if (dlqRate < 0.01) {
    components.dlq_health = 2.0;
    details.push(`✓ DLQ rate: ${(dlqRate * 100).toFixed(3)}%`);
  } else if (dlqRate < 0.05) {
    components.dlq_health = 1.5;
    details.push(`✓ DLQ rate: ${(dlqRate * 100).toFixed(3)}%`);
  } else {
    components.dlq_health = 1.0;
    details.push(`⚠ DLQ rate: ${(dlqRate * 100).toFixed(3)}%`);
  }

  // Retry Logic (2 pts)
  const retrySuccess = metrics.retries_successful / (metrics.retries_total + 1);
  if (retrySuccess >= 0.85) {
    components.retry_logic = 2.0;
    details.push(`✓ Retry success rate: ${(retrySuccess * 100).toFixed(2)}%`);
  } else if (retrySuccess >= 0.70) {
    components.retry_logic = 1.5;
    details.push(`✓ Retry success rate: ${(retrySuccess * 100).toFixed(2)}%`);
  }

  // Error Classification (2 pts)
  if (metrics.errors_classified_transient > 0 && metrics.errors_classified_permanent > 0) {
    components.error_classification = 2.0;
    details.push("✓ Errors classified by type");
  }

  // Lock Reliability (2 pts)
  if (metrics.lock_acquisition_rate >= 0.99) {
    components.lock_reliability = 2.0;
    details.push(`✓ Lock acquisition: ${(metrics.lock_acquisition_rate * 100).toFixed(2)}%`);
  } else if (metrics.lock_acquisition_rate >= 0.95) {
    components.lock_reliability = 1.5;
    details.push(`✓ Lock acquisition: ${(metrics.lock_acquisition_rate * 100).toFixed(2)}%`);
  }

  const score = Object.values(components).reduce((a, b) => a + b, 0);

  return {
    dimension: "Queue Stability",
    score: Math.min(score, 10),
    maxScore: 10,
    passed: score >= 8.0,
    target: 8.0,
    components,
    details: details.length > 0 ? details : ["No queue metrics collected yet"],
  };
}

/**
 * Scraper Stability Score (Target ≥ 8.0)
 *
 * Components:
 * - Browser Uptime (2 pts): Browser pool availability
 * - Memory Stability (2 pts): Memory growth bounded
 * - Job Completion (2 pts): Scrape job success rate
 * - Context Isolation (2 pts): Multi-tenant safety
 * - Crash Recovery (2 pts): Recovery time < 60s
 */
export function calculateScraperStabilityScore(metrics: Record<string, any>): DimensionScore {
  const components: Record<string, number> = {
    browser_uptime: 0,
    memory_stability: 0,
    job_completion: 0,
    context_isolation: 0,
    crash_recovery: 0,
  };

  const details: string[] = [];

  // Browser Uptime (2 pts)
  const browserUptime = metrics.browser_uptime_percent || 0;
  if (browserUptime >= 99.5) {
    components.browser_uptime = 2.0;
    details.push(`✓ Browser uptime: ${browserUptime.toFixed(2)}%`);
  } else if (browserUptime >= 99.0) {
    components.browser_uptime = 1.5;
    details.push(`✓ Browser uptime: ${browserUptime.toFixed(2)}%`);
  } else if (browserUptime >= 98.0) {
    components.browser_uptime = 1.0;
    details.push(`⚠ Browser uptime: ${browserUptime.toFixed(2)}%`);
  }

  // Memory Stability (2 pts)
  const memoryDelta = metrics.memory_delta_mb || 0;
  if (memoryDelta < 50) {
    components.memory_stability = 2.0;
    details.push(`✓ Memory delta: ${memoryDelta}MB (bounded)`);
  } else if (memoryDelta < 100) {
    components.memory_stability = 1.5;
    details.push(`✓ Memory delta: ${memoryDelta}MB`);
  } else if (memoryDelta < 200) {
    components.memory_stability = 1.0;
    details.push(`⚠ Memory delta: ${memoryDelta}MB`);
  }

  // Job Completion (2 pts)
  const scrapeSuccess = metrics.scrape_jobs_completed / (metrics.scrape_jobs_completed + metrics.scrape_jobs_failed + 1);
  if (scrapeSuccess >= 0.95) {
    components.job_completion = 2.0;
    details.push(`✓ Scrape success: ${(scrapeSuccess * 100).toFixed(2)}%`);
  } else if (scrapeSuccess >= 0.90) {
    components.job_completion = 1.5;
    details.push(`✓ Scrape success: ${(scrapeSuccess * 100).toFixed(2)}%`);
  }

  // Context Isolation (2 pts)
  if (metrics.tenant_isolation_violations === 0) {
    components.context_isolation = 2.0;
    details.push("✓ No tenant isolation violations");
  } else {
    components.context_isolation = Math.max(0, 2.0 - metrics.tenant_isolation_violations * 0.5);
    details.push(`⚠ Tenant isolation: ${metrics.tenant_isolation_violations} violations`);
  }

  // Crash Recovery (2 pts)
  const recoveryTime = metrics.average_crash_recovery_ms || 0;
  if (recoveryTime < 10000) {
    components.crash_recovery = 2.0;
    details.push(`✓ Crash recovery: ${recoveryTime}ms (< 10s)`);
  } else if (recoveryTime < 30000) {
    components.crash_recovery = 1.5;
    details.push(`✓ Crash recovery: ${recoveryTime}ms (< 30s)`);
  } else if (recoveryTime < 60000) {
    components.crash_recovery = 1.0;
    details.push(`⚠ Crash recovery: ${recoveryTime}ms (< 60s)`);
  }

  const score = Object.values(components).reduce((a, b) => a + b, 0);

  return {
    dimension: "Scraper Stability",
    score: Math.min(score, 10),
    maxScore: 10,
    passed: score >= 8.0,
    target: 8.0,
    components,
    details: details.length > 0 ? details : ["No scraper metrics collected yet"],
  };
}

/**
 * Scalability Score (Target ≥ 7.5)
 *
 * Components:
 * - Large Dataset Handling (2 pts): 100k+ items
 * - Pagination Performance (2 pts): Cursor-based, < 1s
 * - Memory Efficiency (2 pts): Memory growth bounded
 * - Concurrent Load (2 pts): Handles concurrent requests
 * - Latency Stability (2 pts): P95 < 1s under load
 */
export function calculateScalabilityScore(metrics: Record<string, any>): DimensionScore {
  const components: Record<string, number> = {
    large_dataset_handling: 0,
    pagination_performance: 0,
    memory_efficiency: 0,
    concurrent_load: 0,
    latency_stability: 0,
  };

  const details: string[] = [];

  // Large Dataset Handling (2 pts)
  const datasetSize = metrics.largest_dataset_size || 0;
  if (datasetSize >= 100000) {
    components.large_dataset_handling = 2.0;
    details.push(`✓ Dataset size: ${(datasetSize / 1000).toFixed(0)}k items`);
  } else if (datasetSize >= 10000) {
    components.large_dataset_handling = 1.5;
    details.push(`✓ Dataset size: ${(datasetSize / 1000).toFixed(0)}k items`);
  } else if (datasetSize >= 1000) {
    components.large_dataset_handling = 1.0;
    details.push(`⚠ Dataset size: ${datasetSize} items`);
  }

  // Pagination Performance (2 pts)
  const paginationLatency = metrics.pagination_p95_latency_ms || 0;
  if (paginationLatency < 500) {
    components.pagination_performance = 2.0;
    details.push(`✓ Pagination P95: ${paginationLatency}ms`);
  } else if (paginationLatency < 1000) {
    components.pagination_performance = 2.0;
    details.push(`✓ Pagination P95: ${paginationLatency}ms`);
  } else if (paginationLatency < 2000) {
    components.pagination_performance = 1.5;
    details.push(`✓ Pagination P95: ${paginationLatency}ms`);
  } else if (paginationLatency < 5000) {
    components.pagination_performance = 1.0;
    details.push(`⚠ Pagination P95: ${paginationLatency}ms`);
  }

  // Memory Efficiency (2 pts)
  const memoryPerItem = metrics.memory_per_item_kb || 0;
  if (memoryPerItem < 0.5) {
    components.memory_efficiency = 2.0;
    details.push(`✓ Memory/item: ${memoryPerItem}KB (efficient)`);
  } else if (memoryPerItem < 1.0) {
    components.memory_efficiency = 1.5;
    details.push(`✓ Memory/item: ${memoryPerItem}KB`);
  } else {
    components.memory_efficiency = 1.0;
    details.push(`⚠ Memory/item: ${memoryPerItem}KB`);
  }

  // Concurrent Load (2 pts)
  const concurrentUsers = metrics.concurrent_users_handled || 0;
  if (concurrentUsers >= 1000) {
    components.concurrent_load = 2.0;
    details.push(`✓ Concurrent users: ${concurrentUsers}`);
  } else if (concurrentUsers >= 500) {
    components.concurrent_load = 1.5;
    details.push(`✓ Concurrent users: ${concurrentUsers}`);
  } else if (concurrentUsers >= 100) {
    components.concurrent_load = 1.0;
    details.push(`⚠ Concurrent users: ${concurrentUsers}`);
  }

  // Latency Stability (2 pts)
  const latencyP95 = metrics.latency_p95_ms || 0;
  if (latencyP95 < 500) {
    components.latency_stability = 2.0;
    details.push(`✓ Latency P95: ${latencyP95}ms (< 500ms)`);
  } else if (latencyP95 < 1000) {
    components.latency_stability = 2.0;
    details.push(`✓ Latency P95: ${latencyP95}ms (< 1s)`);
  } else if (latencyP95 < 2000) {
    components.latency_stability = 1.5;
    details.push(`✓ Latency P95: ${latencyP95}ms (< 2s)`);
  } else {
    components.latency_stability = 1.0;
    details.push(`⚠ Latency P95: ${latencyP95}ms`);
  }

  const score = Object.values(components).reduce((a, b) => a + b, 0);

  return {
    dimension: "Scalability",
    score: Math.min(score, 10),
    maxScore: 10,
    passed: score >= 7.5,
    target: 7.5,
    components,
    details: details.length > 0 ? details : ["No scalability metrics collected yet"],
  };
}

/**
 * Observability Score (Target ≥ 8.0)
 *
 * Components:
 * - Metrics Collection (2 pts): 7+ metrics collected
 * - Alert Rules (2 pts): 4+ alert rules configured
 * - Log Coverage (2 pts): Key events logged
 * - Chaos Testing (2 pts): All 6 scenarios pass
 * - Recovery Detection (2 pts): Failure detection < 1s
 */
export function calculateObservabilityScore(metrics: Record<string, any>): DimensionScore {
  const components: Record<string, number> = {
    metrics_collection: 0,
    alert_rules: 0,
    log_coverage: 0,
    chaos_testing: 0,
    recovery_detection: 0,
  };

  const details: string[] = [];

  // Metrics Collection (2 pts)
  const metricsCount = metrics.metrics_collected_count || 0;
  if (metricsCount >= 7) {
    components.metrics_collection = 2.0;
    details.push(`✓ Metrics collected: ${metricsCount}`);
  } else if (metricsCount >= 5) {
    components.metrics_collection = 1.5;
    details.push(`✓ Metrics collected: ${metricsCount}`);
  } else if (metricsCount >= 3) {
    components.metrics_collection = 1.0;
    details.push(`⚠ Metrics collected: ${metricsCount}`);
  }

  // Alert Rules (2 pts)
  const alertRulesCount = metrics.alert_rules_count || 0;
  if (alertRulesCount >= 4) {
    components.alert_rules = 2.0;
    details.push(`✓ Alert rules: ${alertRulesCount}`);
  } else if (alertRulesCount >= 2) {
    components.alert_rules = 1.5;
    details.push(`✓ Alert rules: ${alertRulesCount}`);
  } else if (alertRulesCount >= 1) {
    components.alert_rules = 1.0;
    details.push(`⚠ Alert rules: ${alertRulesCount}`);
  }

  // Log Coverage (2 pts)
  if (metrics.logs_include_critical_events === true) {
    components.log_coverage = 1.5;
    details.push("✓ Logs include critical events");
  }
  if (metrics.logs_include_errors === true && metrics.logs_include_retries === true) {
    components.log_coverage = 2.0;
    details.push("✓ Logs include errors and retries");
  }

  // Chaos Testing (2 pts)
  const chaosScenariosPassed = metrics.chaos_scenarios_passed || 0;
  if (chaosScenariosPassed >= 6) {
    components.chaos_testing = 2.0;
    details.push(`✓ Chaos scenarios passed: ${chaosScenariosPassed}/6`);
  } else if (chaosScenariosPassed >= 4) {
    components.chaos_testing = 1.5;
    details.push(`✓ Chaos scenarios passed: ${chaosScenariosPassed}/6`);
  } else if (chaosScenariosPassed >= 2) {
    components.chaos_testing = 1.0;
    details.push(`⚠ Chaos scenarios passed: ${chaosScenariosPassed}/6`);
  }

  // Recovery Detection (2 pts)
  const detectionLatency = metrics.failure_detection_latency_ms || 0;
  if (detectionLatency < 1000) {
    components.recovery_detection = 2.0;
    details.push(`✓ Failure detection: ${detectionLatency}ms (< 1s)`);
  } else if (detectionLatency < 5000) {
    components.recovery_detection = 1.5;
    details.push(`✓ Failure detection: ${detectionLatency}ms (< 5s)`);
  } else if (detectionLatency < 10000) {
    components.recovery_detection = 1.0;
    details.push(`⚠ Failure detection: ${detectionLatency}ms (< 10s)`);
  }

  const score = Object.values(components).reduce((a, b) => a + b, 0);

  return {
    dimension: "Observability",
    score: Math.min(score, 10),
    maxScore: 10,
    passed: score >= 8.0,
    target: 8.0,
    components,
    details: details.length > 0 ? details : ["No observability metrics collected yet"],
  };
}

/**
 * Calculate overall hardening scorecard
 */
export function calculateHardeningScorecard(metrics: Record<string, any>): HardeningScorecard {
  const security = calculateSecurityScore(metrics);
  const queueStability = calculateQueueStabilityScore(metrics);
  const scraperStability = calculateScraperStabilityScore(metrics);
  const scalability = calculateScalabilityScore(metrics);
  const observability = calculateObservabilityScore(metrics);

  const dimensionScores = [
    security.score,
    queueStability.score,
    scraperStability.score,
    scalability.score,
    observability.score,
  ];

  const overallScore = dimensionScores.reduce((a, b) => a + b, 0) / dimensionScores.length;

  return {
    timestamp: new Date(),
    security,
    queueStability,
    scraperStability,
    scalability,
    observability,
    overall: {
      dimension: "Overall",
      score: overallScore,
      maxScore: 10,
      passed: overallScore >= 8.0,
      target: 8.0,
      components: {},
      details: [
        `Security: ${security.score.toFixed(1)}/10 (target: 8.5)`,
        `Queue Stability: ${queueStability.score.toFixed(1)}/10 (target: 8.0)`,
        `Scraper Stability: ${scraperStability.score.toFixed(1)}/10 (target: 8.0)`,
        `Scalability: ${scalability.score.toFixed(1)}/10 (target: 7.5)`,
        `Observability: ${observability.score.toFixed(1)}/10 (target: 8.0)`,
      ],
    },
  };
}
