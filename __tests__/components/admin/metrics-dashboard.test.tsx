import { render, screen, waitFor } from "@testing-library/react";
import MetricsDashboard from "@/components/admin/metrics-dashboard";
import { metricsCache, analyticsCache } from "@/lib/utils/cache";

// Mock fetch
global.fetch = jest.fn();

describe("MetricsDashboard", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Clear caches to prevent test interference
        metricsCache.clear();
        analyticsCache.clear();
    });

    it("renders loading state initially", () => {
        (global.fetch as jest.Mock).mockImplementation(() =>
            new Promise(() => { }) // Never resolves
        );

        render(<MetricsDashboard />);
        // Check for loading spinner by class name
        const spinner = document.querySelector(".animate-spin");
        expect(spinner).toBeInTheDocument();
    });

    it("renders metrics dashboard with data", async () => {
        const mockMetrics = {
            platform: {
                activeSessions: 5,
                requestsPerMinute: 12.5,
                avgSessionDuration: 3.2,
                totalTenants: 10,
                activeTenants: 7,
            },
            scraping: {
                successRate: 85.5,
                blockRate: 5.2,
                challengeRate: 9.3,
                avgResponseTime: 1250,
                requestsLast24h: 1500,
            },
            proxies: {
                totalProxies: 20,
                healthyProxies: 18,
                avgSuccessRate: 88.5,
                avgResponseTime: 850,
            },
            challenges: {
                totalChallenges: 45,
                solveRate: 92.5,
                avgSolveTime: 2500,
            },
        };

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, data: mockMetrics }),
        });

        render(<MetricsDashboard />);

        await waitFor(() => {
            expect(screen.getByText("Metrics Dashboard")).toBeInTheDocument();
        });

        // Check platform metrics
        expect(screen.getByText("Active Sessions")).toBeInTheDocument();
        expect(screen.getByText("5")).toBeInTheDocument();
        expect(screen.getByText("12.5")).toBeInTheDocument();

        // Check scraping metrics
        expect(screen.getByText("85.5%")).toBeInTheDocument();
        expect(screen.getByText("5.2%")).toBeInTheDocument();

        // Check proxy metrics
        expect(screen.getByText("20")).toBeInTheDocument();
        expect(screen.getByText("18 healthy")).toBeInTheDocument();
    });

    it("renders error state when fetch fails", async () => {
        (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

        render(<MetricsDashboard />);

        await waitFor(() => {
            expect(screen.getByText(/Network error/i)).toBeInTheDocument();
        });
    });

    it("displays time range selector", async () => {
        const mockMetrics = {
            platform: {
                activeSessions: 0,
                requestsPerMinute: 0,
                avgSessionDuration: 0,
                totalTenants: 0,
                activeTenants: 0,
            },
            scraping: {
                successRate: 0,
                blockRate: 0,
                challengeRate: 0,
                avgResponseTime: 0,
                requestsLast24h: 0,
            },
            proxies: {
                totalProxies: 0,
                healthyProxies: 0,
                avgSuccessRate: 0,
                avgResponseTime: 0,
            },
            challenges: {
                totalChallenges: 0,
                solveRate: 0,
                avgSolveTime: 0,
            },
        };

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, data: mockMetrics }),
        });

        render(<MetricsDashboard />);

        await waitFor(() => {
            expect(screen.getByText("Metrics Dashboard")).toBeInTheDocument();
        });

        // Check for time range selector
        expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("displays all metric tabs", async () => {
        const mockMetrics = {
            platform: {
                activeSessions: 0,
                requestsPerMinute: 0,
                avgSessionDuration: 0,
                totalTenants: 0,
                activeTenants: 0,
            },
            scraping: {
                successRate: 0,
                blockRate: 0,
                challengeRate: 0,
                avgResponseTime: 0,
                requestsLast24h: 0,
            },
            proxies: {
                totalProxies: 0,
                healthyProxies: 0,
                avgSuccessRate: 0,
                avgResponseTime: 0,
            },
            challenges: {
                totalChallenges: 0,
                solveRate: 0,
                avgSolveTime: 0,
            },
        };

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, data: mockMetrics }),
        });

        render(<MetricsDashboard />);

        await waitFor(() => {
            expect(screen.getByText("Metrics Dashboard")).toBeInTheDocument();
        });

        // Check for tabs
        expect(screen.getByRole("tab", { name: /Proxy Health/i })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /Challenges/i })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /Top Failures/i })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /Trends/i })).toBeInTheDocument();
    });
});
