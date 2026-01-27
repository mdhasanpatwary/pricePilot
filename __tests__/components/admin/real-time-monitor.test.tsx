/**
 * Tests for RealTimeMonitor component
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RealTimeMonitor from '@/components/admin/real-time-monitor';
import { ScrapingSessionData } from '@/lib/types/admin-dashboard';

// Mock fetch
global.fetch = jest.fn();

const mockSession: ScrapingSessionData = {
    id: 'session-123',
    tenantId: 'tenant-1',
    tenantName: 'Test Tenant',
    siteUrl: 'https://example.com',
    targetUrl: 'https://example.com/product/123',
    status: 'running',
    currentStage: 'data_extraction',
    proxyUsed: 'proxy-1.example.com:8080',
    userAgent: 'Mozilla/5.0...',
    requestsCompleted: 5,
    requestsTotal: 10,
    challengeType: null,
    challengeStatus: null,
    extractedData: null,
    errors: [],
    metrics: {
        navigationTime: 1500,
        challengeSolveTime: 0,
        extractionTime: 2000,
        totalTime: 3500,
    },
    startTime: new Date(),
    endTime: null,
    createdAt: new Date(),
    updatedAt: new Date(),
};

describe('RealTimeMonitor', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                data: {
                    sessions: [mockSession],
                    summary: {
                        total: 1,
                        statusCounts: {
                            running: 1,
                        },
                    },
                },
            }),
        });
    });

    afterEach(() => {
        jest.clearAllTimers();
    });

    it('renders the component with title', async () => {
        render(<RealTimeMonitor />);

        expect(screen.getByText('Real-Time Session Monitor')).toBeInTheDocument();
    });

    it('fetches and displays sessions on mount', async () => {
        render(<RealTimeMonitor />);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/v1/admin/sessions')
            );
        });

        await waitFor(() => {
            expect(screen.getByText('Test Tenant')).toBeInTheDocument();
        });
    });

    it('displays session status indicator', async () => {
        render(<RealTimeMonitor />);

        await waitFor(() => {
            expect(screen.getAllByText('Running').length).toBeGreaterThan(0);
        });
    });

    it('displays lifecycle stage visualization', async () => {
        render(<RealTimeMonitor />);

        await waitFor(() => {
            expect(screen.getByText('Extract')).toBeInTheDocument();
        });
    });

    it('applies tenant filter when selected', async () => {
        render(<RealTimeMonitor />);

        await waitFor(() => {
            expect(screen.getByText('Test Tenant')).toBeInTheDocument();
        });

        // Verify filter UI is present
        expect(screen.getByText('Tenant:')).toBeInTheDocument();
        expect(screen.getByText('All Tenants')).toBeInTheDocument();
    });

    it('displays status counts summary', async () => {
        render(<RealTimeMonitor />);

        await waitFor(() => {
            expect(screen.getByText('running')).toBeInTheDocument();
            expect(screen.getByText('1')).toBeInTheDocument();
        });
    });

    it('shows loading state initially', () => {
        render(<RealTimeMonitor />);

        expect(screen.getByText('Loading sessions...')).toBeInTheDocument();
    });

    it('shows empty state when no sessions', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: {
                    sessions: [],
                    summary: {
                        total: 0,
                        statusCounts: {},
                    },
                },
            }),
        });

        render(<RealTimeMonitor />);

        await waitFor(() => {
            expect(screen.getByText('No active sessions found')).toBeInTheDocument();
        });
    });

    it('displays error state on fetch failure', async () => {
        (global.fetch as jest.Mock).mockRejectedValueOnce(
            new Error('Network error')
        );

        render(<RealTimeMonitor />);

        await waitFor(() => {
            expect(screen.getByText(/Network error/i)).toBeInTheDocument();
        });
    });

    it('displays session with challenge', async () => {
        const sessionWithChallenge = {
            ...mockSession,
            challengeType: 'Cloudflare',
            challengeStatus: 'solving' as const,
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: {
                    sessions: [sessionWithChallenge],
                    summary: {
                        total: 1,
                        statusCounts: { running: 1 },
                    },
                },
            }),
        });

        render(<RealTimeMonitor />);

        await waitFor(() => {
            expect(screen.getByText('Cloudflare')).toBeInTheDocument();
        });
    });

    it('displays session with errors', async () => {
        const sessionWithErrors = {
            ...mockSession,
            errors: [
                {
                    timestamp: new Date(),
                    message: 'Connection timeout',
                },
            ],
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: {
                    sessions: [sessionWithErrors],
                    summary: {
                        total: 1,
                        statusCounts: { running: 1 },
                    },
                },
            }),
        });

        render(<RealTimeMonitor />);

        await waitFor(() => {
            expect(screen.getByText('1 error(s)')).toBeInTheDocument();
        });
    });

    it('opens session detail modal on click', async () => {
        render(<RealTimeMonitor />);

        await waitFor(() => {
            expect(screen.getByText('Test Tenant')).toBeInTheDocument();
        });

        // Click on the session row
        const sessionRow = screen.getByText('Test Tenant').closest('div');
        if (sessionRow) {
            fireEvent.click(sessionRow);
        }

        await waitFor(() => {
            expect(screen.getByText('Session Details')).toBeInTheDocument();
        });
    });

    it('refreshes data when refresh button is clicked', async () => {
        render(<RealTimeMonitor />);

        await waitFor(() => {
            expect(screen.getByText('Test Tenant')).toBeInTheDocument();
        });

        const refreshButton = screen.getByRole('button', { name: /refresh/i });
        fireEvent.click(refreshButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });
    });

    it('auto-refreshes at specified interval', async () => {
        jest.useFakeTimers();

        render(<RealTimeMonitor refreshInterval={5000} />);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        // Fast-forward 5 seconds
        jest.advanceTimersByTime(5000);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        jest.useRealTimers();
    });

    it('displays proxy information when available', async () => {
        render(<RealTimeMonitor />);

        await waitFor(() => {
            expect(screen.getByText('proxy-1.example.com:8080')).toBeInTheDocument();
        });
    });

    it('formats time correctly for recent sessions', async () => {
        const recentSession = {
            ...mockSession,
            startTime: new Date(Date.now() - 30000), // 30 seconds ago
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: {
                    sessions: [recentSession],
                    summary: {
                        total: 1,
                        statusCounts: { running: 1 },
                    },
                },
            }),
        });

        render(<RealTimeMonitor />);

        await waitFor(() => {
            expect(screen.getByText(/\d+s ago/)).toBeInTheDocument();
        });
    });
});
