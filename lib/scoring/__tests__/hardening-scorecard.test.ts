/**
 * Target Score Validation Tests
 */

// Add global test types for TypeScript
declare const describe: {
  (name: string, fn: () => void): void;
};
declare const it: {
  (name: string, fn: () => void | Promise<void>): void;
};
declare const expect: {
  (actual: unknown): {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeNull(): void;
    toBeGreaterThanOrEqual(number: number): void;
    toBeLessThanOrEqual(number: number): void;
    toBeGreaterThan(number: number): void;
    toContain(expected: unknown): void;
  };
};

import { calculateHardeningScorecard } from "@/lib/scoring/hardening-scorecard";
import { generateValidationReport } from "@/lib/scoring/target-score-validator";

describe("Hardening Scorecard", () => {
  it("should calculate security score correctly", () => {
    const metrics = {
      ssrf_blocked_private_ips: 10,
      ssrf_blocked_metadata: 5,
      internal_mode_disabled_production: true,
      debug_code_excluded_build: true,
      rate_limit_enforced_tenant: true,
      rate_limit_enforced_ip: true,
      auth_session_validation_success_rate: 0.98,
      invalid_requests_blocked: 20,
      injection_attempts_blocked: 5,
      jobs_completed: 9950,
      jobs_failed: 50,
      jobs_dlq: 10,
      retries_valid: 1000,
      retries_total: 1100,
      retries_successful: 850,
      errors_classified_transient: 50,
      errors_classified_permanent: 30,
      lock_acquisition_rate: 0.99,
      browser_uptime_percent: 99.5,
      memory_delta_mb: 50,
      scrape_jobs_completed: 9850,
      scrape_jobs_failed: 150,
      tenant_isolation_violations: 0,
      average_crash_recovery_ms: 5000,
      largest_dataset_size: 100000,
      pagination_p95_latency_ms: 250,
      memory_per_item_kb: 0.1,
      concurrent_users_handled: 1000,
      latency_p95_ms: 500,
      metrics_collected_count: 7,
      alert_rules_count: 4,
      logs_include_critical_events: true,
      logs_include_errors: true,
      logs_include_retries: true,
      chaos_scenarios_passed: 6,
      failure_detection_latency_ms: 500,
    };

    const scorecard = calculateHardeningScorecard(metrics);

    // Verify all dimensions meet targets
    expect(scorecard.security.passed).toBe(true);
    expect(scorecard.queueStability.passed).toBe(true);
    expect(scorecard.scraperStability.passed).toBe(true);
    expect(scorecard.scalability.passed).toBe(true);
    expect(scorecard.observability.passed).toBe(true);
    expect(scorecard.overall.passed).toBe(true);

    // Verify scores are within range
    expect(scorecard.overall.score).toBeGreaterThanOrEqual(8.0);
    expect(scorecard.overall.score).toBeLessThanOrEqual(10);
  });

  it("should generate validation report", () => {
    const metrics = {
      ssrf_blocked_private_ips: 10,
      ssrf_blocked_metadata: 5,
      internal_mode_disabled_production: true,
      debug_code_excluded_build: true,
      rate_limit_enforced_tenant: true,
      rate_limit_enforced_ip: true,
      auth_session_validation_success_rate: 0.98,
      invalid_requests_blocked: 20,
      injection_attempts_blocked: 5,
      jobs_completed: 9950,
      jobs_failed: 50,
      jobs_dlq: 10,
      retries_valid: 1000,
      retries_total: 1100,
      retries_successful: 850,
      errors_classified_transient: 50,
      errors_classified_permanent: 30,
      lock_acquisition_rate: 0.99,
      browser_uptime_percent: 99.5,
      memory_delta_mb: 50,
      scrape_jobs_completed: 9850,
      scrape_jobs_failed: 150,
      tenant_isolation_violations: 0,
      average_crash_recovery_ms: 5000,
      largest_dataset_size: 100000,
      pagination_p95_latency_ms: 250,
      memory_per_item_kb: 0.1,
      concurrent_users_handled: 1000,
      latency_p95_ms: 500,
      metrics_collected_count: 7,
      alert_rules_count: 4,
      logs_include_critical_events: true,
      logs_include_errors: true,
      logs_include_retries: true,
      chaos_scenarios_passed: 6,
      failure_detection_latency_ms: 500,
    };

    const scorecard = calculateHardeningScorecard(metrics);
    const report = generateValidationReport(scorecard);

    expect(report.summary.overallScore).toBeGreaterThanOrEqual(8.0);
    expect(report.summary.allTargetsMet).toBe(true);
    expect(report.details.length).toBe(5);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it("should identify missing targets", () => {
    const metrics = {
      ssrf_blocked_private_ips: 0,
      ssrf_blocked_metadata: 0,
      internal_mode_disabled_production: false,
      debug_code_excluded_build: false,
      rate_limit_enforced_tenant: false,
      rate_limit_enforced_ip: false,
      auth_session_validation_success_rate: 0.85,
      invalid_requests_blocked: 0,
      injection_attempts_blocked: 0,
      jobs_completed: 500,
      jobs_failed: 500,
      jobs_dlq: 100,
      retries_valid: 100,
      retries_total: 500,
      retries_successful: 40,
      errors_classified_transient: 0,
      errors_classified_permanent: 0,
      lock_acquisition_rate: 0.80,
      browser_uptime_percent: 95.0,
      memory_delta_mb: 500,
      scrape_jobs_completed: 400,
      scrape_jobs_failed: 600,
      tenant_isolation_violations: 5,
      average_crash_recovery_ms: 120000,
      largest_dataset_size: 1000,
      pagination_p95_latency_ms: 5000,
      memory_per_item_kb: 5.0,
      concurrent_users_handled: 50,
      latency_p95_ms: 10000,
      metrics_collected_count: 1,
      alert_rules_count: 0,
      logs_include_critical_events: false,
      logs_include_errors: false,
      logs_include_retries: false,
      chaos_scenarios_passed: 0,
      failure_detection_latency_ms: 30000,
    };

    const scorecard = calculateHardeningScorecard(metrics);

    // All dimensions should fail
    expect(scorecard.security.passed).toBe(false);
    expect(scorecard.queueStability.passed).toBe(false);
    expect(scorecard.scraperStability.passed).toBe(false);
    expect(scorecard.scalability.passed).toBe(false);
    expect(scorecard.observability.passed).toBe(false);
    expect(scorecard.overall.passed).toBe(false);
  });
});
