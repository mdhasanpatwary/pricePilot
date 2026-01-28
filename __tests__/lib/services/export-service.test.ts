/**
 * Export Service Tests
 * Tests for data export functionality in multiple formats
 * 
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
 */

import { ExportService } from "@/lib/services/export-service";
import { ScrapingSessionData } from "@/lib/types/admin-dashboard";

describe("ExportService", () => {
    // Sample session data for testing
    const sampleSessions: ScrapingSessionData[] = [
        {
            id: "session-1",
            tenantId: "tenant-1",
            tenantName: "Test Tenant",
            siteUrl: "https://example.com",
            targetUrl: "https://example.com/product/123",
            status: "completed",
            currentStage: "data_extraction",
            proxyUsed: "http://proxy1.example.com:8080",
            userAgent: "Mozilla/5.0...",
            requestsCompleted: 5,
            requestsTotal: 5,
            challengeType: null,
            challengeStatus: null,
            extractedData: { title: "Product 1", price: 99.99 },
            errors: [],
            metrics: {
                navigationTime: 1000,
                challengeSolveTime: 0,
                extractionTime: 500,
                totalTime: 1500,
            },
            startTime: new Date("2024-01-01T10:00:00Z"),
            endTime: new Date("2024-01-01T10:00:01.5Z"),
            createdAt: new Date("2024-01-01T10:00:00Z"),
            updatedAt: new Date("2024-01-01T10:00:01.5Z"),
        },
    ];

    describe("exportSessions", () => {
        it("should export sessions as JSON", async () => {
            const result = await ExportService.exportSessions(sampleSessions, {
                format: "json",
            });

            expect(result.contentType).toBe("application/json");
            expect(result.filename).toContain(".json");
            expect(typeof result.data).toBe("string");

            const parsed = JSON.parse(result.data as string);
            expect(Array.isArray(parsed)).toBe(true);
            expect(parsed.length).toBe(1);
            expect(parsed[0].id).toBe("session-1");
        });

        it("should export sessions as CSV", async () => {
            const result = await ExportService.exportSessions(sampleSessions, {
                format: "csv",
            });

            expect(result.contentType).toBe("text/csv");
            expect(result.filename).toContain(".csv");
            expect(typeof result.data).toBe("string");

            const csv = result.data as string;
            expect(csv).toContain("ID");
            expect(csv).toContain("Tenant ID");
            expect(csv).toContain("session-1");
            expect(csv).toContain("tenant-1");
        });

        it("should export sessions as PDF", async () => {
            const result = await ExportService.exportSessions(sampleSessions, {
                format: "pdf",
            });

            expect(result.contentType).toBe("application/pdf");
            expect(result.filename).toContain(".pdf");
            expect(Buffer.isBuffer(result.data)).toBe(true);
        });

        it("should use custom filename when provided", async () => {
            const result = await ExportService.exportSessions(sampleSessions, {
                format: "json",
                filename: "custom-export",
            });

            expect(result.filename).toBe("custom-export.json");
        });

        it("should throw error for unsupported format", async () => {
            await expect(
                ExportService.exportSessions(sampleSessions, {
                    format: "xml" as any,
                })
            ).rejects.toThrow("Unsupported export format");
        });
    });

    describe("exportProxyMetrics", () => {
        const sampleMetrics = [
            {
                proxyUrl: "http://proxy1.example.com:8080",
                type: "residential",
                successRate: 95.5,
                failureRate: 4.5,
                avgResponseTime: 1200,
                totalRequests: 1000,
                successCount: 955,
                failureCount: 45,
                lastCheckTime: "2024-01-01T10:00:00Z",
            },
        ];

        it("should export proxy metrics as JSON", async () => {
            const result = await ExportService.exportProxyMetrics(sampleMetrics, {
                format: "json",
            });

            expect(result.contentType).toBe("application/json");
            expect(result.filename).toContain(".json");

            const parsed = JSON.parse(result.data as string);
            expect(Array.isArray(parsed)).toBe(true);
            expect(parsed[0].proxyUrl).toBe("http://proxy1.example.com:8080");
        });

        it("should export proxy metrics as CSV", async () => {
            const result = await ExportService.exportProxyMetrics(sampleMetrics, {
                format: "csv",
            });

            expect(result.contentType).toBe("text/csv");
            expect(result.filename).toContain(".csv");

            const csv = result.data as string;
            expect(csv).toContain("Proxy URL");
            expect(csv).toContain("Success Rate");
            expect(csv).toContain("95.5");
        });
    });

    describe("exportErrors", () => {
        const sampleErrors = [
            {
                timestamp: "2024-01-01T10:00:00Z",
                sessionId: "session-1",
                tenantId: "tenant-1",
                type: "proxy_failure",
                message: "Connection timeout",
                siteUrl: "https://example.com",
                proxyUsed: "http://proxy1.example.com:8080",
            },
        ];

        it("should export errors as JSON", async () => {
            const result = await ExportService.exportErrors(sampleErrors, {
                format: "json",
            });

            expect(result.contentType).toBe("application/json");
            expect(result.filename).toContain(".json");

            const parsed = JSON.parse(result.data as string);
            expect(Array.isArray(parsed)).toBe(true);
            expect(parsed[0].type).toBe("proxy_failure");
        });

        it("should export errors as CSV", async () => {
            const result = await ExportService.exportErrors(sampleErrors, {
                format: "csv",
            });

            expect(result.contentType).toBe("text/csv");
            expect(result.filename).toContain(".csv");

            const csv = result.data as string;
            expect(csv).toContain("Error Type");
            expect(csv).toContain("proxy_failure");
        });
    });

    describe("exportAnalytics", () => {
        const sampleAnalytics = {
            platform: {
                activeSessions: 10,
                requestsPerMinute: 50,
                avgSessionDuration: 2.5,
            },
            scraping: {
                successRate: 95,
                blockRate: 3,
                challengeRate: 2,
            },
        };

        it("should export analytics as JSON", async () => {
            const result = await ExportService.exportAnalytics(sampleAnalytics, {
                format: "json",
            });

            expect(result.contentType).toBe("application/json");
            expect(result.filename).toContain(".json");

            const parsed = JSON.parse(result.data as string);
            expect(parsed.platform.activeSessions).toBe(10);
        });

        it("should export analytics as CSV", async () => {
            const result = await ExportService.exportAnalytics(sampleAnalytics, {
                format: "csv",
            });

            expect(result.contentType).toBe("text/csv");
            expect(result.filename).toContain(".csv");

            const csv = result.data as string;
            expect(csv).toContain("Metric");
            expect(csv).toContain("Value");
            expect(csv).toContain("platform.activeSessions");
        });
    });
});
