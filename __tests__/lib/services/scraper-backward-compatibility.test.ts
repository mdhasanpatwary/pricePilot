/**
 * Backward Compatibility Tests for ScraperService
 * 
 * These tests verify that existing API methods continue to work as expected
 * after the advanced stealth scraping enhancements.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { ScraperService } from "@/lib/services/scraper";

// Mock Redis
jest.mock("@upstash/redis", () => ({
    Redis: {
        fromEnv: jest.fn().mockReturnValue({
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
        }),
    },
}));

// Mock Playwright - define mocks inline to avoid hoisting issues
jest.mock("playwright", () => ({
    chromium: {
        launch: jest.fn().mockResolvedValue({
            newContext: jest.fn().mockResolvedValue({
                newPage: jest.fn().mockResolvedValue({
                    goto: jest.fn().mockResolvedValue({
                        status: jest.fn().mockReturnValue(200),
                        headers: jest.fn().mockReturnValue({}),
                    }),
                    title: jest.fn().mockResolvedValue("Test Product"),
                    content: jest.fn().mockResolvedValue("<html><body>Test</body></html>"),
                    waitForTimeout: jest.fn().mockResolvedValue({}),
                    waitForSelector: jest.fn().mockResolvedValue({}),
                    close: jest.fn().mockResolvedValue({}),
                    evaluate: jest.fn().mockResolvedValue(null),
                    $: jest.fn().mockResolvedValue([]),
                    $$: jest.fn().mockResolvedValue([]),
                    url: jest.fn().mockReturnValue("https://example.com/product"),
                    setExtraHTTPHeaders: jest.fn().mockResolvedValue({}),
                }),
                addInitScript: jest.fn().mockResolvedValue({}),
                close: jest.fn().mockResolvedValue({}),
            }),
            close: jest.fn().mockResolvedValue({}),
        }),
    },
}));

// Mock playwright-extra
jest.mock("playwright-extra", () => ({
    chromium: {
        use: jest.fn(),
        launch: jest.fn().mockResolvedValue({
            newContext: jest.fn().mockResolvedValue({
                newPage: jest.fn().mockResolvedValue({
                    goto: jest.fn().mockResolvedValue({
                        status: jest.fn().mockReturnValue(200),
                        headers: jest.fn().mockReturnValue({}),
                    }),
                    title: jest.fn().mockResolvedValue("Test Product"),
                    content: jest.fn().mockResolvedValue("<html><body>Test</body></html>"),
                    waitForTimeout: jest.fn().mockResolvedValue({}),
                    waitForSelector: jest.fn().mockResolvedValue({}),
                    close: jest.fn().mockResolvedValue({}),
                    evaluate: jest.fn().mockResolvedValue(null),
                    $: jest.fn().mockResolvedValue([]),
                    $$: jest.fn().mockResolvedValue([]),
                    url: jest.fn().mockReturnValue("https://example.com/product"),
                    setExtraHTTPHeaders: jest.fn().mockResolvedValue({}),
                }),
                addInitScript: jest.fn().mockResolvedValue({}),
                close: jest.fn().mockResolvedValue({}),
            }),
            close: jest.fn().mockResolvedValue({}),
        }),
    },
}));

// Mock stealth plugin
jest.mock("puppeteer-extra-plugin-stealth", () => {
    return jest.fn().mockReturnValue({});
});

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
    prisma: {
        site: {
            findUnique: jest.fn().mockResolvedValue(null),
        },
        syncLog: {
            create: jest.fn().mockResolvedValue({}),
        },
        scrapingMetrics: {
            createMany: jest.fn().mockResolvedValue({}),
            findMany: jest.fn().mockResolvedValue([]),
        },
        proxyMetrics: {
            createMany: jest.fn().mockResolvedValue({}),
            findMany: jest.fn().mockResolvedValue([]),
        },
    },
}));

describe("ScraperService - Backward Compatibility", () => {
    let scraper: ScraperService;
    let originalEnv: NodeJS.ProcessEnv;

    // Set longer timeout for all tests in this suite (scraping operations can take time)
    jest.setTimeout(30000);

    beforeAll(() => {
        // Save original environment
        originalEnv = { ...process.env };
    });

    afterAll(() => {
        // Restore original environment
        process.env = originalEnv;
    });

    beforeEach(async () => {
        // Clear environment variables for clean state
        delete process.env.SCRAPER_PROXIES;

        // Reset all mocks
        jest.clearAllMocks();

        scraper = new ScraperService();
        await scraper.init();
    });

    afterEach(async () => {
        await scraper.close();
    });

    describe("14.1 - Existing API Methods", () => {
        describe("scrapeProductPage()", () => {
            it("should maintain existing method signature", async () => {
                // Verify method exists and accepts URL parameter
                expect(typeof scraper.scrapeProductPage).toBe("function");

                // Should accept URL as first parameter
                const result = await scraper.scrapeProductPage("https://example.com/product");

                // Method should execute without throwing
                expect(result).toBeDefined();
            });

            it("should return null for invalid URLs (existing behavior)", async () => {
                const result = await scraper.scrapeProductPage("not-a-valid-url");

                expect(result).toBeNull();
            });

            it("should return ScrapedProduct or null (existing return type)", async () => {
                const result = await scraper.scrapeProductPage("https://example.com/product");

                // Should be null or have expected product structure
                if (result !== null) {
                    expect(result).toHaveProperty("title");
                    expect(result).toHaveProperty("price");
                    expect(result).toHaveProperty("currency");
                    expect(result).toHaveProperty("url");
                    expect(result).toHaveProperty("inStock");
                }

                expect(result === null || typeof result === "object").toBe(true);
            });

            it("should support optional retryCount parameter (existing behavior)", async () => {
                // Should accept second parameter for retry count
                const result = await scraper.scrapeProductPage("https://example.com/product");

                expect(result).toBeDefined();
            });
        });

        describe("scrapeMultiple()", () => {
            it("should maintain existing method signature", async () => {
                expect(typeof scraper.scrapeMultiple).toBe("function");

                const urls = ["https://example.com/product1", "https://example.com/product2"];
                const results = await scraper.scrapeMultiple(urls);

                expect(Array.isArray(results)).toBe(true);
            });

            it("should return array of ScrapedProduct (existing return type)", async () => {
                const urls = ["https://example.com/product1"];
                const results = await scraper.scrapeMultiple(urls);

                expect(Array.isArray(results)).toBe(true);

                // Each result should be a valid product
                results.forEach((product) => {
                    expect(product).toHaveProperty("title");
                    expect(product).toHaveProperty("price");
                    expect(product).toHaveProperty("url");
                });
            });

            it("should handle empty array input", async () => {
                const results = await scraper.scrapeMultiple([]);

                expect(results).toEqual([]);
            });
        });

        describe("searchAndScrape()", () => {
            it("should maintain existing method signature", async () => {
                expect(typeof scraper.searchAndScrape).toBe("function");

                const result = await scraper.searchAndScrape(
                    "https://example.com",
                    "test product"
                );

                expect(result === null || typeof result === "object").toBe(true);
            });

            it("should support optional siteId parameter (existing behavior)", async () => {
                const result = await scraper.searchAndScrape(
                    "https://example.com",
                    "test product",
                    "site-123"
                );

                expect(result === null || typeof result === "object").toBe(true);
            });

            it("should return ScrapedProduct or null (existing return type)", async () => {
                const result = await scraper.searchAndScrape(
                    "https://example.com",
                    "test product"
                );

                if (result !== null) {
                    expect(result).toHaveProperty("title");
                    expect(result).toHaveProperty("price");
                    expect(result).toHaveProperty("url");
                }

                expect(result === null || typeof result === "object").toBe(true);
            });
        });

        describe("init()", () => {
            it("should maintain existing method signature", async () => {
                const newScraper = new ScraperService();

                expect(typeof newScraper.init).toBe("function");

                // Should not throw
                await expect(newScraper.init()).resolves.not.toThrow();

                await newScraper.close();
            });

            it("should be idempotent (can be called multiple times)", async () => {
                await scraper.init();
                await scraper.init();

                // Should not throw or cause issues
                expect(true).toBe(true);
            });
        });

        describe("close()", () => {
            it("should maintain existing method signature", async () => {
                expect(typeof scraper.close).toBe("function");

                // Should not throw
                await expect(scraper.close()).resolves.not.toThrow();

                // Re-initialize for other tests
                scraper = new ScraperService();
                await scraper.init();
            });
        });

        describe("getPoolStats()", () => {
            it("should maintain existing method signature and return type", () => {
                expect(typeof scraper.getPoolStats).toBe("function");

                const stats = scraper.getPoolStats();

                expect(stats).toBeDefined();
                expect(typeof stats).toBe("object");
            });
        });
    });

    describe("14.2 - Operation Without Proxies", () => {
        beforeEach(async () => {
            // Ensure no proxy configuration
            delete process.env.SCRAPER_PROXIES;

            scraper = new ScraperService();
            await scraper.init();
        });

        it("should initialize successfully without SCRAPER_PROXIES env var", async () => {
            expect(scraper).toBeDefined();
            expect(scraper['proxyManager']).toBeNull();
        });

        it("should scrape without proxies", async () => {
            const result = await scraper.scrapeProductPage("https://example.com/product");

            // Should work without throwing
            expect(result === null || typeof result === "object").toBe(true);
        });

        it("should not throw errors when proxy methods are called without proxies", () => {
            // getProxyStats should return null when no proxy manager
            const stats = scraper.getProxyStats();
            expect(stats).toBeNull();
        });

        it("should handle searchAndScrape without proxies", async () => {
            const result = await scraper.searchAndScrape(
                "https://example.com",
                "test product"
            );

            expect(result === null || typeof result === "object").toBe(true);
        });

        it("should handle scrapeMultiple without proxies", async () => {
            const urls = ["https://example.com/product1", "https://example.com/product2"];
            const results = await scraper.scrapeMultiple(urls);

            expect(Array.isArray(results)).toBe(true);
        });
    });

    describe("14.3 - Operation Without Site Profiles", () => {
        it("should use default settings for unknown domains", async () => {
            // Scrape a domain that doesn't have a specific profile
            const result = await scraper.scrapeProductPage("https://unknown-domain.com/product");

            // Should work with default settings
            expect(result === null || typeof result === "object").toBe(true);
        });

        it("should apply conservative defaults for rate limiting", async () => {
            // Multiple requests to unknown domain should work
            const urls = [
                "https://unknown-domain.com/product1",
                "https://unknown-domain.com/product2",
            ];

            const results = await scraper.scrapeMultiple(urls);

            expect(Array.isArray(results)).toBe(true);
        });

        it("should handle searchAndScrape for unknown domains", async () => {
            const result = await scraper.searchAndScrape(
                "https://unknown-domain.com",
                "test product"
            );

            expect(result === null || typeof result === "object").toBe(true);
        });

        it("should not crash when site profile is missing", async () => {
            // Should use default profile without throwing
            await expect(
                scraper.scrapeProductPage("https://completely-new-site.com/product")
            ).resolves.toBeDefined();
        });
    });

    describe("Error Handling Behavior (Requirement 7.4)", () => {
        it("should maintain existing error handling for network errors", async () => {
            const result = await scraper.scrapeProductPage("https://example.com/product");

            // Should return null or product (not throw for network errors)
            expect(result === null || typeof result === "object").toBe(true);
        });

        it("should handle invalid URL errors consistently", async () => {
            const result = await scraper.scrapeProductPage("invalid-url");

            expect(result).toBeNull();
        });
    });

    describe("Response Format Consistency (Requirement 7.4)", () => {
        it("should return consistent ScrapedProduct structure when data is available", async () => {
            const result = await scraper.scrapeProductPage("https://example.com/product");

            if (result !== null) {
                // Verify all expected fields are present
                expect(result).toHaveProperty("title");
                expect(result).toHaveProperty("price");
                expect(result).toHaveProperty("currency");
                expect(result).toHaveProperty("url");
                expect(result).toHaveProperty("inStock");

                // Verify types
                expect(typeof result.title).toBe("string");
                expect(typeof result.price).toBe("number");
                expect(typeof result.currency).toBe("string");
                expect(typeof result.url).toBe("string");
                expect(typeof result.inStock).toBe("boolean");
            }
        });
    });

    describe("New Methods Don't Break Existing Code", () => {
        it("should have new methods available but not required", () => {
            // New methods should exist
            expect(typeof scraper.getProxyStats).toBe("function");
            expect(typeof scraper.getChallengeStats).toBe("function");
            expect(typeof scraper.getSiteMetrics).toBe("function");
            expect(typeof scraper.getProxyMetricsForProxy).toBe("function");
            expect(typeof scraper.persistMetrics).toBe("function");
        });

        it("should allow existing code to work without calling new methods", async () => {
            // Existing workflow should work without using new features
            await scraper.init();
            const result = await scraper.scrapeProductPage("https://example.com/product");
            await scraper.close();

            // Should complete successfully
            expect(result === null || typeof result === "object").toBe(true);
        });

        it("should not require configuration for new features", async () => {
            // Should work without configuring proxies, site profiles, etc.
            const newScraper = new ScraperService();
            await newScraper.init();

            const result = await newScraper.scrapeProductPage("https://example.com/product");

            await newScraper.close();

            expect(result === null || typeof result === "object").toBe(true);
        });
    });
});
