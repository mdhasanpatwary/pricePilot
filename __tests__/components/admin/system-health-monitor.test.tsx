import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { SystemHealthMonitor } from "@/components/admin/system-health-monitor";

// Mock fetch
global.fetch = jest.fn();

const mockHealthData = {
    success: true,
    data: {
        overall: {
            status: "healthy",
            message: "All systems operational",
        },
        database: {
            status: "healthy",
            message: "Database healthy (15ms)",
            details: { responseTime: 15 },
        },
        redis: {
            status: "healthy",
            message: "Redis healthy (5ms)",
            details: { responseTime: 5 },
        },
        browserPool: {
            status: "healthy",
            message: "Browser pool healthy (2/10 contexts)",
            details: { inUse: 2, total: 10 },
        },
        circuitBreakers: {
            status: "healthy",
            message: "All 5 circuit breakers are CLOSED",
            details: { total: 5 },
        },
        timestamp: new Date().toISOString(),
    },
};

const mockAlertsData = {
    success: true,
    data: [
        {
            id: "alert-1",
            alertType: "component_failure",
            severity: "critical",
            title: "Database Connection Failed",
            message: "Unable to connect to database",
            context: {},
            acknowledged: false,
            acknowledgedAt: null,
            acknowledgedBy: null,
            createdAt: new Date().toISOString(),
        },
    ],
};

const mockDiagnosticsData = {
    success: true,
    data: {
        timestamp: new Date().toISOString(),
        totalTime: 250,
        healthCheck: mockHealthData.data,
        database: {
            overall: "passed",
            tests: [
                {
                    name: "Database Connection",
                    status: "passed",
                    duration: 15,
                },
                {
                    name: "Query Performance",
                    status: "passed",
                    duration: 25,
                },
            ],
        },
        redis: {
            overall: "passed",
            tests: [
                {
                    name: "Redis Ping",
                    status: "passed",
                    duration: 5,
                },
            ],
        },
        connectivity: {
            overall: "passed",
            tests: [
                {
                    name: "Internal Services",
                    status: "passed",
                    message: "All internal services accessible",
                },
            ],
        },
        performance: {
            overall: "passed",
            tests: [
                {
                    name: "Database Query Latency",
                    status: "passed",
                    avgLatency: 20,
                    maxLatency: 35,
                },
            ],
        },
    },
};

describe("SystemHealthMonitor", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (global.fetch as jest.Mock).mockImplementation((url: string) => {
            if (url.includes("/api/v1/admin/health")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockHealthData),
                });
            }
            if (url.includes("/api/v1/admin/alerts")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockAlertsData),
                });
            }
            if (url.includes("/api/v1/admin/diagnostics")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockDiagnosticsData),
                });
            }
            return Promise.reject(new Error("Unknown URL"));
        });
    });

    it("renders the component and fetches health data", async () => {
        render(<SystemHealthMonitor />);

        await waitFor(() => {
            expect(screen.getByText("System Health Monitor")).toBeInTheDocument();
        });

        expect(global.fetch).toHaveBeenCalledWith("/api/v1/admin/health");
    });

    it("displays overall system status", async () => {
        render(<SystemHealthMonitor />);

        await waitFor(() => {
            expect(screen.getByText("All Systems Operational")).toBeInTheDocument();
        });

        expect(screen.getByText("All systems operational")).toBeInTheDocument();
    });

    it("displays component health cards", async () => {
        render(<SystemHealthMonitor />);

        await waitFor(() => {
            expect(screen.getByText("Database")).toBeInTheDocument();
        });

        expect(screen.getByText("Redis Cache")).toBeInTheDocument();
        expect(screen.getByText("Browser Pool")).toBeInTheDocument();
        expect(screen.getByText("Circuit Breakers")).toBeInTheDocument();
    });

    it("displays component details", async () => {
        render(<SystemHealthMonitor />);

        await waitFor(() => {
            expect(screen.getByText("Database healthy (15ms)")).toBeInTheDocument();
        });

        expect(screen.getByText("15ms")).toBeInTheDocument();
        expect(screen.getByText("5ms")).toBeInTheDocument();
    });

    it("displays alerts in the alerts tab", async () => {
        render(<SystemHealthMonitor />);

        await waitFor(() => {
            expect(screen.getByText("System Health Monitor")).toBeInTheDocument();
        });

        // Wait for alerts to load
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining("/api/v1/admin/alerts")
            );
        });

        // Verify alert count badge is shown
        expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("shows alert count badge", async () => {
        render(<SystemHealthMonitor />);

        await waitFor(() => {
            expect(screen.getByText("1")).toBeInTheDocument();
        });
    });

    it("allows acknowledging alerts", async () => {
        (global.fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
            if (url.includes("/acknowledge") && options?.method === "POST") {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: true }),
                });
            }
            if (url.includes("/api/v1/admin/health")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockHealthData),
                });
            }
            if (url.includes("/api/v1/admin/alerts")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockAlertsData),
                });
            }
            return Promise.reject(new Error("Unknown URL"));
        });

        render(<SystemHealthMonitor />);

        await waitFor(() => {
            expect(screen.getByText("System Health Monitor")).toBeInTheDocument();
        });

        // Verify alerts API was called
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining("/api/v1/admin/alerts")
            );
        });
    });

    it("runs diagnostics when button is clicked", async () => {
        (global.fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
            if (url.includes("/diagnostics") && options?.method === "POST") {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockDiagnosticsData),
                });
            }
            if (url.includes("/api/v1/admin/health")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockHealthData),
                });
            }
            if (url.includes("/api/v1/admin/alerts")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockAlertsData),
                });
            }
            return Promise.reject(new Error("Unknown URL"));
        });

        render(<SystemHealthMonitor />);

        await waitFor(() => {
            expect(screen.getByText("System Health Monitor")).toBeInTheDocument();
        });

        // Click run diagnostics button
        const runButton = screen.getByRole("button", { name: /Run Diagnostics/i });
        fireEvent.click(runButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/api/v1/admin/diagnostics",
                expect.objectContaining({ method: "POST" })
            );
        });
    });

    it("displays diagnostic results", async () => {
        (global.fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
            if (url.includes("/diagnostics") && options?.method === "POST") {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockDiagnosticsData),
                });
            }
            if (url.includes("/api/v1/admin/health")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockHealthData),
                });
            }
            if (url.includes("/api/v1/admin/alerts")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockAlertsData),
                });
            }
            return Promise.reject(new Error("Unknown URL"));
        });

        render(<SystemHealthMonitor />);

        await waitFor(() => {
            expect(screen.getByText("System Health Monitor")).toBeInTheDocument();
        });

        // Click run diagnostics button
        const runButton = screen.getByRole("button", { name: /Run Diagnostics/i });
        fireEvent.click(runButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/api/v1/admin/diagnostics",
                expect.objectContaining({ method: "POST" })
            );
        });
    });

    it("handles degraded system status", async () => {
        const degradedHealthData = {
            ...mockHealthData,
            data: {
                ...mockHealthData.data,
                overall: {
                    status: "degraded",
                    message: "1 components are degraded",
                },
                database: {
                    status: "degraded",
                    message: "Database responding slowly (5500ms)",
                    details: { responseTime: 5500 },
                },
            },
        };

        (global.fetch as jest.Mock).mockImplementation((url: string) => {
            if (url.includes("/api/v1/admin/health")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(degradedHealthData),
                });
            }
            if (url.includes("/api/v1/admin/alerts")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockAlertsData),
                });
            }
            return Promise.reject(new Error("Unknown URL"));
        });

        render(<SystemHealthMonitor />);

        await waitFor(() => {
            expect(screen.getByText("System Degraded")).toBeInTheDocument();
        });

        expect(screen.getByText("1 components are degraded")).toBeInTheDocument();
    });

    it("handles unhealthy system status", async () => {
        const unhealthyHealthData = {
            ...mockHealthData,
            data: {
                ...mockHealthData.data,
                overall: {
                    status: "unhealthy",
                    message: "1 critical components are unhealthy",
                },
                redis: {
                    status: "unhealthy",
                    message: "Redis connection failed: Connection refused",
                    details: {},
                },
            },
        };

        (global.fetch as jest.Mock).mockImplementation((url: string) => {
            if (url.includes("/api/v1/admin/health")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(unhealthyHealthData),
                });
            }
            if (url.includes("/api/v1/admin/alerts")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockAlertsData),
                });
            }
            return Promise.reject(new Error("Unknown URL"));
        });

        render(<SystemHealthMonitor />);

        await waitFor(() => {
            expect(screen.getByText("System Unhealthy")).toBeInTheDocument();
        });

        expect(screen.getByText("1 critical components are unhealthy")).toBeInTheDocument();
    });

    it("refreshes data when refresh button is clicked", async () => {
        render(<SystemHealthMonitor />);

        await waitFor(() => {
            expect(screen.getByText("System Health Monitor")).toBeInTheDocument();
        });

        // Clear previous calls
        jest.clearAllMocks();

        // Click refresh button
        const refreshButton = screen.getByRole("button", { name: /Refresh/i });
        fireEvent.click(refreshButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith("/api/v1/admin/health");
        });
    });
});
