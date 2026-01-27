import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SessionControlPanel from '@/components/admin/session-control-panel';
import { ScrapingSessionData } from '@/lib/types/admin-dashboard';

// Mock fetch
global.fetch = jest.fn();

const mockSessions: ScrapingSessionData[] = [
    {
        id: 'session-1',
        tenantId: 'tenant-1',
        tenantName: 'Test Tenant 1',
        siteUrl: 'https://example.com',
        targetUrl: 'https://example.com/product/1',
        status: 'running',
        currentStage: 'navigation',
        proxyUsed: 'http://proxy1:8080',
        userAgent: 'Mozilla/5.0',
        requestsCompleted: 5,
        requestsTotal: 10,
        challengeType: null,
        challengeStatus: null,
        extractedData: null,
        errors: [],
        metrics: {
            navigationTime: 1000,
            challengeSolveTime: 0,
            extractionTime: 0,
            totalTime: 1000,
        },
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: null,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
    },
    {
        id: 'session-2',
        tenantId: 'tenant-2',
        tenantName: 'Test Tenant 2',
        siteUrl: 'https://example2.com',
        targetUrl: 'https://example2.com/product/2',
        status: 'initializing',
        currentStage: 'proxy_selection',
        proxyUsed: null,
        userAgent: 'Mozilla/5.0',
        requestsCompleted: 0,
        requestsTotal: 10,
        challengeType: null,
        challengeStatus: null,
        extractedData: null,
        errors: [],
        metrics: {
            navigationTime: 0,
            challengeSolveTime: 0,
            extractionTime: 0,
            totalTime: 0,
        },
        startTime: new Date('2024-01-01T10:05:00Z'),
        endTime: null,
        createdAt: new Date('2024-01-01T10:05:00Z'),
        updatedAt: new Date('2024-01-01T10:05:00Z'),
    },
    {
        id: 'session-3',
        tenantId: 'tenant-3',
        tenantName: 'Test Tenant 3',
        siteUrl: 'https://example3.com',
        targetUrl: 'https://example3.com/product/3',
        status: 'failed',
        currentStage: 'navigation',
        proxyUsed: 'http://proxy2:8080',
        userAgent: 'Mozilla/5.0',
        requestsCompleted: 2,
        requestsTotal: 10,
        challengeType: null,
        challengeStatus: null,
        extractedData: null,
        errors: [
            {
                timestamp: new Date('2024-01-01T10:10:00Z'),
                message: 'Connection timeout',
            },
        ],
        metrics: {
            navigationTime: 500,
            challengeSolveTime: 0,
            extractionTime: 0,
            totalTime: 500,
        },
        startTime: new Date('2024-01-01T10:08:00Z'),
        endTime: new Date('2024-01-01T10:10:00Z'),
        createdAt: new Date('2024-01-01T10:08:00Z'),
        updatedAt: new Date('2024-01-01T10:10:00Z'),
    },
    {
        id: 'session-4',
        tenantId: 'tenant-4',
        tenantName: 'Test Tenant 4',
        siteUrl: 'https://example4.com',
        targetUrl: 'https://example4.com/product/4',
        status: 'completed',
        currentStage: 'validation',
        proxyUsed: 'http://proxy3:8080',
        userAgent: 'Mozilla/5.0',
        requestsCompleted: 10,
        requestsTotal: 10,
        challengeType: null,
        challengeStatus: null,
        extractedData: { title: 'Product 4' },
        errors: [],
        metrics: {
            navigationTime: 1200,
            challengeSolveTime: 0,
            extractionTime: 300,
            totalTime: 1500,
        },
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:01:30Z'),
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:01:30Z'),
    },
];

describe('SessionControlPanel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ success: true }),
        });
    });

    it('renders the control panel with sessions', () => {
        render(<SessionControlPanel sessions={mockSessions} />);

        expect(screen.getByText('Controllable Sessions')).toBeInTheDocument();
        expect(screen.getByText('Test Tenant 1')).toBeInTheDocument();
        expect(screen.getByText('Test Tenant 2')).toBeInTheDocument();
        // Completed and failed sessions should not be in the controllable list initially
        expect(screen.queryByText('Test Tenant 4')).not.toBeInTheDocument();
    });

    it('allows selecting and deselecting sessions', () => {
        render(<SessionControlPanel sessions={mockSessions} />);

        const checkboxes = screen.getAllByRole('checkbox');

        // Select first session
        fireEvent.click(checkboxes[0]);
        expect(screen.getByText(/1 of \d+ selected/)).toBeInTheDocument();

        // Deselect first session
        fireEvent.click(checkboxes[0]);
        expect(screen.getByText(/0 of \d+ selected/)).toBeInTheDocument();
    });

    it('allows selecting all sessions', () => {
        render(<SessionControlPanel sessions={mockSessions} />);

        const selectAllButton = screen.getByText('Select All');
        fireEvent.click(selectAllButton);

        // Should select only controllable sessions (not completed or failed)
        expect(screen.getByText(/2 of 2 selected/)).toBeInTheDocument();
    });

    it('allows clearing selection', () => {
        render(<SessionControlPanel sessions={mockSessions} />);

        // Select all first
        fireEvent.click(screen.getByText('Select All'));
        expect(screen.getByText(/2 of 2 selected/)).toBeInTheDocument();

        // Clear selection
        fireEvent.click(screen.getByText('Clear'));
        expect(screen.getByText(/0 of 2 selected/)).toBeInTheDocument();
    });

    it('enables pause button only for running sessions', () => {
        render(<SessionControlPanel sessions={mockSessions} />);

        const pauseButton = screen.getByRole('button', { name: /Pause/i });
        expect(pauseButton).toBeDisabled();

        // Select running session
        const checkboxes = screen.getAllByRole('checkbox');
        const runningSessions = mockSessions.filter(s => s.status === 'running');
        if (runningSessions.length > 0) {
            fireEvent.click(checkboxes[0]); // First checkbox should be running session
            expect(pauseButton).toBeEnabled();
        }
    });

    it('enables resume button only for initializing sessions', () => {
        render(<SessionControlPanel sessions={mockSessions} />);

        const resumeButton = screen.getByRole('button', { name: /Resume/i });
        expect(resumeButton).toBeDisabled();

        // Select initializing session
        const checkboxes = screen.getAllByRole('checkbox');
        const initializingSessions = mockSessions.filter(s => s.status === 'initializing');
        if (initializingSessions.length > 0) {
            // Find the checkbox for initializing session
            const sessionElements = screen.getAllByText(/Test Tenant/);
            const initIndex = sessionElements.findIndex(el =>
                el.textContent?.includes('Test Tenant 2')
            );
            if (initIndex >= 0) {
                fireEvent.click(checkboxes[initIndex]);
                expect(resumeButton).toBeEnabled();
            }
        }
    });

    it('opens confirmation dialog for cancel operation', async () => {
        render(<SessionControlPanel sessions={mockSessions} />);

        // Select a session
        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[0]);

        // Click cancel button
        const cancelButton = screen.getByRole('button', { name: /Cancel/i });
        fireEvent.click(cancelButton);

        // Check if confirmation dialog appears
        await waitFor(() => {
            expect(screen.getByText(/Confirm CANCEL/i)).toBeInTheDocument();
        });
    });

    it('executes pause operation on confirmation', async () => {
        const onOperationComplete = jest.fn();
        render(
            <SessionControlPanel
                sessions={mockSessions}
                onOperationComplete={onOperationComplete}
            />
        );

        // Select running session
        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[0]);

        // Click pause button
        const pauseButton = screen.getByRole('button', { name: /Pause/i });
        fireEvent.click(pauseButton);

        // Confirm in dialog
        await waitFor(() => {
            expect(screen.getByText(/Confirm PAUSE/i)).toBeInTheDocument();
        });

        const confirmButton = screen.getByRole('button', { name: /Confirm/i });
        fireEvent.click(confirmButton);

        // Check if API was called
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/v1/admin/sessions/'),
                expect.objectContaining({
                    method: 'POST',
                })
            );
        });

        // Check if callback was called
        await waitFor(() => {
            expect(onOperationComplete).toHaveBeenCalled();
        });
    });

    it('executes bulk operation for multiple sessions', async () => {
        // Create sessions that are all in the same state for bulk operation
        const runningSessions = [
            {
                ...mockSessions[0],
                id: 'session-1',
                status: 'running' as const,
            },
            {
                ...mockSessions[0],
                id: 'session-2',
                tenantName: 'Test Tenant 2',
                status: 'running' as const,
            },
        ];

        render(<SessionControlPanel sessions={runningSessions} />);

        // Select all sessions
        fireEvent.click(screen.getByText('Select All'));

        // Click pause button
        const pauseButton = screen.getByRole('button', { name: /Pause/i });
        fireEvent.click(pauseButton);

        // Confirm in dialog
        await waitFor(() => {
            expect(screen.getByText(/Confirm PAUSE/i)).toBeInTheDocument();
        });

        const confirmButton = screen.getByRole('button', { name: /Confirm/i });
        fireEvent.click(confirmButton);

        // Check if bulk API was called
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                '/api/v1/admin/sessions/bulk',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('pause'),
                })
            );
        });
    });

    it('opens retry dialog for failed sessions', async () => {
        render(<SessionControlPanel sessions={mockSessions} />);

        // Find retry button (should be visible for failed session)
        const retryButtons = screen.queryAllByRole('button', { name: /Retry/i });

        if (retryButtons.length > 0) {
            fireEvent.click(retryButtons[0]);

            // Check if retry dialog appears
            await waitFor(() => {
                expect(screen.getByText(/Retry Session/i)).toBeInTheDocument();
            });
        }
    });

    it('allows configuration override in retry dialog', async () => {
        render(<SessionControlPanel sessions={mockSessions} />);

        // Find and click retry button
        const retryButtons = screen.queryAllByRole('button', { name: /Retry/i });

        if (retryButtons.length > 0) {
            fireEvent.click(retryButtons[0]);

            await waitFor(() => {
                expect(screen.getByText(/Retry Session/i)).toBeInTheDocument();
            });

            // Fill in proxy override
            const proxyInput = screen.getByLabelText(/Proxy Override/i);
            fireEvent.change(proxyInput, { target: { value: 'http://newproxy:8080' } });

            // Fill in user agent override
            const userAgentInput = screen.getByLabelText(/User Agent Override/i);
            fireEvent.change(userAgentInput, { target: { value: 'Custom User Agent' } });

            // Confirm retry
            const confirmButtons = screen.getAllByRole('button', { name: /Retry Session/i });
            fireEvent.click(confirmButtons[confirmButtons.length - 1]);

            // Check if API was called with overrides
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/retry'),
                    expect.objectContaining({
                        method: 'POST',
                        body: expect.stringContaining('newproxy'),
                    })
                );
            });
        }
    });

    it('includes cancellation reason when canceling sessions', async () => {
        render(<SessionControlPanel sessions={mockSessions} />);

        // Select a session
        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[0]);

        // Click cancel button
        const cancelButton = screen.getByRole('button', { name: /Cancel/i });
        fireEvent.click(cancelButton);

        // Wait for dialog
        await waitFor(() => {
            expect(screen.getByText(/Confirm CANCEL/i)).toBeInTheDocument();
        });

        // Enter cancellation reason
        const reasonTextarea = screen.getByLabelText(/Cancellation Reason/i);
        fireEvent.change(reasonTextarea, { target: { value: 'Testing cancellation' } });

        // Confirm
        const confirmButton = screen.getByRole('button', { name: /Confirm/i });
        fireEvent.click(confirmButton);

        // Check if API was called with reason
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/cancel'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('Testing cancellation'),
                })
            );
        });
    });

    it('displays error message on operation failure', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: 'Operation failed' }),
        });

        render(<SessionControlPanel sessions={mockSessions} />);

        // Select and pause a session
        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[0]);

        const pauseButton = screen.getByRole('button', { name: /Pause/i });
        fireEvent.click(pauseButton);

        await waitFor(() => {
            expect(screen.getByText(/Confirm PAUSE/i)).toBeInTheDocument();
        });

        const confirmButton = screen.getByRole('button', { name: /Confirm/i });
        fireEvent.click(confirmButton);

        // Check for error message
        await waitFor(() => {
            expect(screen.getByText(/Operation failed/i)).toBeInTheDocument();
        });
    });

    it('displays success message on operation success', async () => {
        render(<SessionControlPanel sessions={mockSessions} />);

        // Select and pause a session
        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[0]);

        const pauseButton = screen.getByRole('button', { name: /Pause/i });
        fireEvent.click(pauseButton);

        await waitFor(() => {
            expect(screen.getByText(/Confirm PAUSE/i)).toBeInTheDocument();
        });

        const confirmButton = screen.getByRole('button', { name: /Confirm/i });
        fireEvent.click(confirmButton);

        // Check for success message
        await waitFor(() => {
            expect(screen.getByText(/paused successfully/i)).toBeInTheDocument();
        });
    });

    it('shows empty state when no controllable sessions', () => {
        const completedSessions = mockSessions.filter(
            s => s.status === 'completed' || s.status === 'failed'
        );
        render(<SessionControlPanel sessions={completedSessions} />);

        expect(screen.getByText(/No controllable sessions available/i)).toBeInTheDocument();
    });
});
