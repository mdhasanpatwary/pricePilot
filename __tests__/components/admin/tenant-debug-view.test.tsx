import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import TenantDebugView from "@/components/admin/tenant-debug-view";

// Mock fetch
global.fetch = jest.fn();

// Mock next/navigation
jest.mock("next/navigation", () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        prefetch: jest.fn(),
    }),
    useSearchParams: () => ({
        get: jest.fn(),
    }),
    usePathname: () => "/admin/debug/tenant/test-tenant-id",
}));

describe("TenantDebugView Component", () => {
    const mockTenantData = {
        success: true,
        data: {
            tenant: {
                id: "test-tenant-id",
                name: "Test Tenant",
                planType: "PREMIUM",
                createdAt: new Date("2024-01-01"),
            },
            activeSessions: [
                {
                    id: "session-1",
                    siteUrl: "example.com",
                    targetUrl: "https://example.com/product/123",
                    status: "running",
                    currentStage: "data_extraction",
                    startTime: new Date(),
                    proxyUsed: "proxy1.example.com",
                },
            ],
            recentErrors: [
                {
                    type: "proxy_failure",
                    count: 5,
                    recentErrors: [
                        {
                            sessionId: "session-1",
                            timestamp: new Date(),
                            message: "Proxy connection failed",
                            siteUrl: "example.com",
                        },
                    ],
                },
            ],
            metrics: {
                tenantId: "test-tenant-id",
                tenantName: "Test Tenant",
                activeSessions: 1,
                successRate: 85.5,
                avgScrapeTime: 2.3,
                dataQualityScore: 92.1,
                resourceUsage: {
                    requestsToday: 150,
                    quotaLimit: 1000,
                    quotaUsed: 15,
                },
            },
            configuration: {
                sites: [
                    {
                        id: "site-1",
                        type: "competitor",
                        platform: "shopify",
                        baseUrl: "https://example.com",
                        lastSyncAt: new Date(),
                        isStale: false,
                    },
                ],
            },
            impactAssessment: {
                affectedSites: ["example.com"],
                staleSitesCount: 0,
                failureRate: 14.5,
                businessImpact: "low" as const,
            },
            staleSites: [],
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => mockTenantData,
        });
    });

    afterEach(() => {
        jest.clearAllTimers();
    });

    it("renders loading state initially", async () => {
        const { container } = render(<TenantDebugView tenantId="test-tenant-id" />);
        // The component renders a loading spinner
        expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it("fetches and displays tenant debug data", async () => {
        render(<TenantDebugView tenantId="test-tenant-id" />);

        await waitFor(() => {
            expect(screen.getByText("Test Tenant - Debug View")).toBeInTheDocument();
        });

        expect(global.fetch).toHaveBeenCalledWith(
            "/api/v1/admin/debug/tenant/test-tenant-id"
        );
    });

    it("displays impact assessment metrics", async () => {
        render(<TenantDebugView tenantId="test-tenant-id" />);

        await waitFor(() => {
            expect(screen.getByText("14.5%")).toBeInTheDocument(); // Failure rate
            expect(screen.getByText("Low Impact")).toBeInTheDocument();
        });
    });

    it("displays tenant metrics", async () => {
        render(<TenantDebugView tenantId="test-tenant-id" />);

        await waitFor(() => {
            expect(screen.getByText("85.5%")).toBeInTheDocument(); // Success rate
            expect(screen.getByText("2.3s")).toBeInTheDocument(); // Avg scrape time
            expect(screen.getByText("92.1%")).toBeInTheDocument(); // Data quality
        });
    });

    it("displays active sessions", async () => {
        render(<TenantDebugView tenantId="test-tenant-id" />);

        await waitFor(() => {
            expect(screen.getByText("example.com")).toBeInTheDocument();
            expect(screen.getByText("proxy1.example.com")).toBeInTheDocument();
        });
    });

    it("displays error groups", async () => {
        render(<TenantDebugView tenantId="test-tenant-id" />);

        // Wait for component to load
        await waitFor(() => {
            expect(screen.getByText("Test Tenant - Debug View")).toBeInTheDocument();
        });

        // Check that errors tab exists
        const errorsTab = screen.getByRole("tab", { name: /Errors/i });
        expect(errorsTab).toBeInTheDocument();
    });

    it("displays configuration sites", async () => {
        render(<TenantDebugView tenantId="test-tenant-id" />);

        // Wait for component to load
        await waitFor(() => {
            expect(screen.getByText("Test Tenant - Debug View")).toBeInTheDocument();
        });

        // Check that configuration tab exists
        const configTab = screen.getByRole("tab", { name: /Configuration/i });
        expect(configTab).toBeInTheDocument();
    });

    it("shows no stale data message when all sites are up to date", async () => {
        render(<TenantDebugView tenantId="test-tenant-id" />);

        // Wait for component to load
        await waitFor(() => {
            expect(screen.getByText("Test Tenant - Debug View")).toBeInTheDocument();
        });

        // Check that stale data tab exists
        const staleTab = screen.getByRole("tab", { name: /Stale Data/i });
        expect(staleTab).toBeInTheDocument();
    });

    it("handles fetch errors gracefully", async () => {
        (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

        render(<TenantDebugView tenantId="test-tenant-id" />);

        await waitFor(() => {
            expect(screen.getByText(/Network error/i)).toBeInTheDocument();
        });
    });

    it("allows manual refresh", async () => {
        render(<TenantDebugView tenantId="test-tenant-id" />);

        await waitFor(() => {
            expect(screen.getByText("Test Tenant - Debug View")).toBeInTheDocument();
        });

        const refreshButton = screen.getByRole("button", { name: /Refresh/i });
        fireEvent.click(refreshButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });
    });

    it("filters sessions by status", async () => {
        const dataWithMultipleSessions = {
            ...mockTenantData,
            data: {
                ...mockTenantData.data,
                activeSessions: [
                    ...mockTenantData.data.activeSessions,
                    {
                        id: "session-2",
                        siteUrl: "another.com",
                        targetUrl: "https://another.com/product/456",
                        status: "completed",
                        currentStage: "validation",
                        startTime: new Date(),
                        proxyUsed: "proxy2.example.com",
                    },
                ],
            },
        };

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => dataWithMultipleSessions,
        });

        render(<TenantDebugView tenantId="test-tenant-id" />);

        await waitFor(() => {
            expect(screen.getByText("example.com")).toBeInTheDocument();
            expect(screen.getByText("another.com")).toBeInTheDocument();
        });

        // Filter by running status
        const filterSelect = screen.getByRole("combobox");
        fireEvent.click(filterSelect);

        const runningOption = screen.getByRole("option", { name: /Running/i });
        fireEvent.click(runningOption);

        await waitFor(() => {
            expect(screen.getByText("example.com")).toBeInTheDocument();
            expect(screen.queryByText("another.com")).not.toBeInTheDocument();
        });
    });
});
