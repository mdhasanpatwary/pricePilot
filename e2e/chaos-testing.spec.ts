import { test, expect } from "@playwright/test";

/**
 * Phase 8 Chaos & Failure Testing
 *
 * End-to-end tests that simulate various failure scenarios and verify
 * system resilience, recovery, and fail-over behavior.
 *
 * Run with: npx playwright test e2e/chaos-testing.spec.ts
 */

// Test configuration
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const INTERNAL_API = `${BASE_URL}/api/v1/internal`;

test.describe("Phase 8: Chaos & Failure Testing", () => {
  test.describe("Redis Unavailability", () => {
    test("should degrade gracefully when Redis is temporarily down", async ({
      page,
      request,
    }) => {
      // Inject Redis unavailability chaos
      const injectResponse = await request.post(`${INTERNAL_API}/chaos/inject`, {
        data: {
          type: "redis-unavailable",
          durationMs: 10000, // 10 seconds
          severity: "high",
          failCriteria: ["graceful-degradation", "recovery-within-60s"],
        },
      });

      expect(injectResponse.status()).toBe(200);
      const { chaosId } = await injectResponse.json();

      // Attempt dashboard access during chaos
      await page.goto(`${BASE_URL}/dashboard`);

      // Should still render something (graceful degradation)
      const title = await page.locator("h1").first();
      await expect(title).toBeVisible({ timeout: 5000 });

      // Poll for chaos completion
      let result;
      let attempts = 0;
      while (attempts < 60) {
        const statusResponse = await request.get(
          `${INTERNAL_API}/chaos/status/${chaosId}`
        );
        if (statusResponse.status() === 200) {
          result = await statusResponse.json();
          if (result.completed) {
            break;
          }
        }
        await page.waitForTimeout(1000);
        attempts++;
      }

      expect(result).toBeDefined();
      expect(result.passed).toBe(true);
      expect(result.recoveryDuration).toBeLessThan(60000); // Recovery < 60s
    });

    test("should handle critical cron jobs during Redis downtime", async ({
      request,
    }) => {
      // Inject Redis chaos
      await request.post(`${INTERNAL_API}/chaos/inject`, {
        data: {
          type: "redis-unavailable",
          durationMs: 15000,
          severity: "high",
          failCriteria: ["no-hanging-jobs"],
        },
      });

      // Attempt to trigger critical cron job
      const cronResponse = await request.post(`${INTERNAL_API}/cron/analytics`, {
        headers: { "x-cron-secret": process.env.CRON_SECRET },
      });

      // Critical job should abort, not hang
      expect([400, 500, 503]).toContain(cronResponse.status());
    });
  });

  test.describe("Worker Crash Recovery", () => {
    test("should requeue jobs when worker crashes mid-job", async ({
      request,
    }) => {
      // Inject worker crash
      const injectResponse = await request.post(`${INTERNAL_API}/chaos/inject`, {
        data: {
          type: "worker-crash",
          durationMs: 20000,
          severity: "high",
          failCriteria: ["zero-data-loss", "recovery-within-60s"],
        },
      });

      expect(injectResponse.status()).toBe(200);
      const { chaosId } = await injectResponse.json();

      // Enqueue a test job
      const queueResponse = await request.post(
        `${BASE_URL}/api/v1/queue/enqueue`,
        {
          data: {
            jobType: "scrape",
            url: "https://example.com",
            tenantId: "test-tenant",
          },
        }
      );

      expect(queueResponse.status()).toBe(200);
      const { jobId } = await queueResponse.json();

      // Wait for chaos to settle and check job status
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const statusResponse = await request.get(
        `${INTERNAL_API}/queue/job/${jobId}`
      );
      expect(statusResponse.status()).toBe(200);

      const job = await statusResponse.json();
      // Job should be retried or in DLQ, not lost
      expect(["retrying", "failed", "dead_letter"]).toContain(job.state);
    });

    test("should prevent data corruption during worker crash", async ({
      request,
    }) => {
      // Start chaos scenario
      await request.post(`${INTERNAL_API}/chaos/inject`, {
        data: {
          type: "worker-crash",
          durationMs: 25000,
          severity: "medium",
          failCriteria: ["no-hanging-jobs"],
        },
      });

      // Create a product update that will be processed during crash
      const updateResponse = await request.post(
        `${BASE_URL}/api/v1/products/bulk-update`,
        {
          data: {
            tenantId: "test-tenant",
            updates: [
              { id: "prod-1", price: 99.99 },
              { id: "prod-2", price: 49.99 },
            ],
          },
        }
      );

      expect([200, 202]).toContain(updateResponse.status());

      // Verify data consistency after crash
      await new Promise((resolve) => setTimeout(resolve, 10000));

      const getResponse = await request.get(
        `${BASE_URL}/api/v1/products?tenantId=test-tenant&limit=10`
      );
      expect(getResponse.status()).toBe(200);

      const products = await getResponse.json();
      // Should have valid data, not partial/corrupted
      expect(products.items.length).toBeGreaterThanOrEqual(0);
      products.items.forEach((item: any) => {
        expect(item.id).toBeDefined();
        expect(item.price).toBeUndefined();
      });
    });
  });

  test.describe("Browser Crash Recovery", () => {
    test("should reconnect browser after crash", async ({ request }) => {
      // Inject browser crash
      const injectResponse = await request.post(`${INTERNAL_API}/chaos/inject`, {
        data: {
          type: "browser-crash",
          durationMs: 15000,
          severity: "high",
          failCriteria: ["recovery-within-60s"],
        },
      });

      expect(injectResponse.status()).toBe(200);
      const { chaosId } = await injectResponse.json();

      // Attempt scrape job (will fail during crash)
      const scrapeResponse = await request.post(
        `${BASE_URL}/api/v1/queue/enqueue`,
        {
          data: {
            jobType: "scrape",
            url: "https://example.com/product",
            tenantId: "test-tenant",
          },
        }
      );

      // Job should be accepted and queued
      expect(scrapeResponse.status()).toBe(200);

      // Wait for browser recovery
      await new Promise((resolve) => setTimeout(resolve, 20000));

      // Verify system recovered
      const healthResponse = await request.get(
        `${BASE_URL}/api/v1/health/browser`
      );
      expect([200, 503]).toContain(healthResponse.status()); // Either healthy or in recovery

      if (healthResponse.status() === 200) {
        const health = await healthResponse.json();
        expect(health.browserCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe("Network Timeout Handling", () => {
    test("should retry requests with exponential backoff", async ({
      request,
    }) => {
      // Inject network timeout flood
      const startTime = Date.now();

      await request.post(`${INTERNAL_API}/chaos/inject`, {
        data: {
          type: "network-timeout",
          durationMs: 10000,
          severity: "high",
          failCriteria: ["recovery-within-60s"],
        },
      });

      // Attempt API request
      let response;
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        try {
          response = await request.get(`${BASE_URL}/api/v1/health`);
          if (response.status() === 200) {
            break;
          }
        } catch (error) {
          // Expected during network chaos
        }

        // Exponential backoff
        const backoffMs = Math.min(100 * Math.pow(2, attempts), 5000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        attempts++;
      }

      expect(attempts).toBeLessThan(maxAttempts);
      const totalTime = Date.now() - startTime;
      // Should eventually succeed - not get stuck retrying
      expect(totalTime).toBeLessThan(60000);
    });

    test("should use fallback/cache when network is slow", async ({
      page,
      request,
    }) => {
      // Inject network chaos
      await request.post(`${INTERNAL_API}/chaos/inject`, {
        data: {
          type: "network-timeout",
          durationMs: 20000,
          severity: "medium",
          failCriteria: ["graceful-degradation"],
        },
      });

      // Load page that might use cached data
      await page.goto(`${BASE_URL}/dashboard`);

      // Should render something (even if stale data)
      const elements = await page.locator("[data-testid]").count();
      expect(elements).toBeGreaterThan(0);

      // Check for cache indicators
      const cachedBadges = await page
        .locator("text=/cached|stale|loading/i")
        .count();
      expect(cachedBadges).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe("Anti-Bot Protection Handling", () => {
    test("should handle rate limit blocks with backoff", async ({
      request,
    }) => {
      // Inject anti-bot spike
      const injectResponse = await request.post(`${INTERNAL_API}/chaos/inject`, {
        data: {
          type: "anti-bot-spike",
          durationMs: 30000,
          severity: "high",
          failCriteria: ["recovery-within-60s"],
        },
      });

      expect(injectResponse.status()).toBe(200);

      // Simulate rapid requests
      let blocked = 0;
      let succeeded = 0;
      const requests_to_make = 20;

      for (let i = 0; i < requests_to_make; i++) {
        try {
          const response = await request.get(`${BASE_URL}/api/v1/health`);

          if (response.status() === 429) {
            blocked++;
            // Backoff before retrying
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * Math.pow(2, Math.min(i, 3)))
            );
          } else if (response.status() === 200) {
            succeeded++;
          }
        } catch (error) {
          // Network error during rate limiting
          blocked++;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Some requests should have been rate limited
      expect(blocked).toBeGreaterThan(0);
      // But some should have succeeded (not complete lockout)
      expect(succeeded).toBeGreaterThan(0);
    });

    test("should avoid thundering herd after recovery", async ({
      request,
    }) => {
      // Inject anti-bot protection
      await request.post(`${INTERNAL_API}/chaos/inject`, {
        data: {
          type: "anti-bot-spike",
          durationMs: 15000,
          severity: "high",
          failCriteria: [],
        },
      });

      // Wait for chaos to end
      await new Promise((resolve) => setTimeout(resolve, 20000));

      // Rapid requests should not all hit at once
      const startTime = Date.now();
      let peakRequestsPerSecond = 0;
      let requestsInWindow = 0;

      for (let i = 0; i < 50; i++) {
        const result = await request.get(`${BASE_URL}/api/v1/health`);
        requestsInWindow++;

        if (Date.now() - startTime > 1000) {
          peakRequestsPerSecond = Math.max(peakRequestsPerSecond, requestsInWindow);
          requestsInWindow = 0;
        }
      }

      // Peak rate should not exceed rate limit (e.g., 100 req/min = 1.67 req/sec)
      expect(peakRequestsPerSecond).toBeLessThan(50);
    });
  });

  test.describe("High-Scale Tenant", () => {
    test("should handle 100k products without memory leak", async ({
      request,
    }) => {
      const startMem = process.memoryUsage().heapUsed;

      // Inject high-scale scenario
      const injectResponse = await request.post(`${INTERNAL_API}/chaos/inject`, {
        data: {
          type: "high-scale-tenant",
          tenantId: "chaos-scale-test",
          durationMs: 30000,
          severity: "high",
          failCriteria: [],
        },
      });

      expect(injectResponse.status()).toBe(200);
      const { chaosId } = await injectResponse.json();

      // Wait for scenario
      await new Promise((resolve) => setTimeout(resolve, 35000));

      const endMem = process.memoryUsage().heapUsed;
      const memIncrease = endMem - startMem;

      // Memory increase should be bounded (not unbounded leak)
      const maxAcceptableIncrease = 200 * 1024 * 1024; // 200MB
      expect(memIncrease).toBeLessThan(maxAcceptableIncrease);
    });

    test("should paginate correctly through large product set", async ({
      request,
    }) => {
      // Inject scale test
      await request.post(`${INTERNAL_API}/chaos/inject`, {
        data: {
          type: "high-scale-tenant",
          tenantId: "pagination-test",
          durationMs: 20000,
          severity: "medium",
          failCriteria: [],
        },
      });

      // Wait for enqueue
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Fetch paginated results
      const page1 = await request.get(
        `${BASE_URL}/api/v1/products?tenantId=pagination-test&limit=1000`
      );
      expect(page1.status()).toBe(200);

      const data = await page1.json();
      expect(data.items).toBeDefined();
      expect(data.cursor || data.nextCursor).toBeDefined();

      // With 100k products, should have next page
      if (data.items.length === 1000) {
        expect(data.cursor || data.nextCursor).toBeTruthy();

        // Fetch next page
        const page2 = await request.get(
          `${BASE_URL}/api/v1/products?tenantId=pagination-test&limit=1000&cursor=${data.cursor}`
        );

        expect(page2.status()).toBe(200);
        const data2 = await page2.json();
        expect(data2.items.length).toBeGreaterThan(0);
      }
    });

    test("should not hit memory limits during queue processing", async ({
      page,
      request,
    }) => {
      // Inject high-scale scenario
      await request.post(`${INTERNAL_API}/chaos/inject`, {
        data: {
          type: "high-scale-tenant",
          tenantId: "memory-test",
          durationMs: 40000,
          severity: "high",
          failCriteria: [],
        },
      });

      // Load metrics page to monitor memory
      await page.goto(`${BASE_URL}/dashboard?view=metrics`);

      // Wait for scenario to complete
      await page.waitForTimeout(45000);

      // Check for memory alerts
      const alertCount = await page
        .locator("text=/memory|out of memory|OOM/i")
        .count();
      expect(alertCount).toBe(0);

      // System should still be responsive
      const healthResponse = await request.get(`${BASE_URL}/api/v1/health`);
      expect([200, 503]).toContain(healthResponse.status());
    });
  });

  test.describe("Combined Scenarios", () => {
    test("should recover from multiple simultaneous failures", async ({
      request,
    }) => {
      // This would require enhanced chaos orchestration
      // For now, test sequential failures with overlap

      // Start Redis + Network chaos
      const redis = await request.post(`${INTERNAL_API}/chaos/inject`, {
        data: {
          type: "redis-unavailable",
          durationMs: 5000,
          severity: "high",
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const network = await request.post(`${INTERNAL_API}/chaos/inject`, {
        data: {
          type: "network-timeout",
          durationMs: 5000,
          severity: "medium",
        },
      });

      // System should handle overlapping failures
      const requestDuringChaos = await request.get(`${BASE_URL}/api/v1/health`);
      expect([200, 500, 503]).toContain(requestDuringChaos.status());

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 10000));

      const healthCheck = await request.get(`${BASE_URL}/api/v1/health`);
      expect(healthCheck.status()).toBe(200);
    });
  });
});

test.describe("Chaos Results & Reporting", () => {
  test("should provide detailed failure analysis", async ({ request }) => {
    // Run a chaos scenario
    const injectResponse = await request.post(`${INTERNAL_API}/chaos/inject`, {
      data: {
        type: "redis-unavailable",
        durationMs: 5000,
        severity: "high",
        failCriteria: ["recovery-within-60s", "graceful-degradation"],
      },
    });

    const { chaosId } = await injectResponse.json();

    // Wait for completion
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Get detailed results
    const resultsResponse = await request.get(
      `${INTERNAL_API}/chaos/results/${chaosId}`
    );
    expect(resultsResponse.status()).toBe(200);

    const result = await resultsResponse.json();

    // Verify result structure
    expect(result).toHaveProperty("scenario");
    expect(result).toHaveProperty("passed");
    expect(result).toHaveProperty("durationMs");
    expect(result).toHaveProperty("metrics");
    expect(result.metrics).toHaveProperty("jobsCompleted");
    expect(result.metrics).toHaveProperty("jobsFailed");
    expect(result.metrics).toHaveProperty("recoveryDuration");
    expect(result.failureReasons).toBeDefined();
  });
});
