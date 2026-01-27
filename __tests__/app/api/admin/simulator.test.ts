import { POST as runSimulation } from '@/app/api/v1/admin/simulator/run/route';
import { GET as getSimulationResults } from '@/app/api/v1/admin/simulator/results/route';
import { GET as getSimulationResult } from '@/app/api/v1/admin/simulator/results/[id]/route';

// Mock NextAuth
jest.mock('next-auth', () => ({
    getServerSession: jest.fn(),
}));

// Mock authOptions
jest.mock('@/lib/auth', () => ({
    authOptions: {},
}));

// Mock ProxySimulator
jest.mock('@/lib/services/proxy-simulator', () => ({
    proxySimulator: {
        runSimulation: jest.fn(),
        listSimulations: jest.fn(),
        getSimulationResult: jest.fn(),
    },
}));

// Mock Next.js Request/Response
jest.mock('next/server', () => ({
    NextRequest: jest.fn().mockImplementation((url, options) => ({
        url,
        method: options?.method || 'GET',
        nextUrl: new URL(url),
        json: jest.fn(),
    })),
    NextResponse: {
        json: jest.fn().mockImplementation((data, init) => ({
            status: init?.status || 200,
            json: jest.fn().mockResolvedValue(data),
            headers: new Map(),
        })),
    },
}));

import { getServerSession } from 'next-auth';
import { proxySimulator } from '@/lib/services/proxy-simulator';

describe('/api/v1/admin/simulator', () => {
    const mockAdminSession = {
        user: {
            id: 'admin-123',
            email: 'admin@example.com',
            role: 'ADMIN',
            isSuperAdmin: true,
        },
    };

    const mockSimulationConfig = {
        scenario: 'rotation' as const,
        targetSite: 'https://example.com',
        proxyPool: [
            { url: 'http://proxy1.com:8080', type: 'residential' as const },
            { url: 'http://proxy2.com:8080', type: 'datacenter' as const },
        ],
        requestCount: 10,
        delayBetweenRequests: 100,
    };

    const mockSimulationResult = {
        id: 'sim-123',
        scenario: 'rotation' as const,
        config: mockSimulationConfig,
        requests: [
            {
                requestNumber: 1,
                proxyUsed: 'http://proxy1.com:8080',
                success: true,
                responseTime: 250,
                retryCount: 0,
            },
            {
                requestNumber: 2,
                proxyUsed: 'http://proxy2.com:8080',
                success: true,
                responseTime: 300,
                retryCount: 0,
            },
        ],
        summary: {
            totalRequests: 2,
            successfulRequests: 2,
            failedRequests: 0,
            averageResponseTime: 275,
            proxiesUsed: 2,
            rotationPattern: ['http://proxy1.com:8080', 'http://proxy2.com:8080'],
        },
        recommendations: ['Excellent: Success rate is above 95%. Current proxy configuration is performing well.'],
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:01:00Z'),
        createdAt: new Date('2024-01-01T10:01:00Z'),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/v1/admin/simulator/run', () => {
        it('should return 401 if not authenticated', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(null);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/simulator/run',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/simulator/run'),
                json: jest.fn().mockResolvedValue(mockSimulationConfig),
            } as any;

            const response = await runSimulation(req);

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.error).toBe('Unauthorized');
        });

        it('should return 401 if user is not admin', async () => {
            (getServerSession as jest.Mock).mockResolvedValue({
                user: {
                    id: 'user-123',
                    email: 'user@example.com',
                    role: 'USER',
                },
            });

            const req = {
                url: 'http://localhost:3000/api/v1/admin/simulator/run',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/simulator/run'),
                json: jest.fn().mockResolvedValue(mockSimulationConfig),
            } as any;

            const response = await runSimulation(req);

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.error).toBe('Unauthorized - Admin access required');
        });

        it('should return 400 for invalid configuration', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);

            const invalidConfig = {
                scenario: 'invalid_scenario',
                targetSite: 'not-a-url',
                proxyPool: [],
                requestCount: -1,
            };

            const req = {
                url: 'http://localhost:3000/api/v1/admin/simulator/run',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/simulator/run'),
                json: jest.fn().mockResolvedValue(invalidConfig),
            } as any;

            const response = await runSimulation(req);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error).toBe('Invalid simulation configuration');
            expect(data.details).toBeDefined();
        });

        it('should run simulation successfully', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (proxySimulator.runSimulation as jest.Mock).mockResolvedValue(mockSimulationResult);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/simulator/run',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/simulator/run'),
                json: jest.fn().mockResolvedValue(mockSimulationConfig),
            } as any;

            const response = await runSimulation(req);

            expect(response.status).toBe(200);
            const data = await response.json();

            expect(data.success).toBe(true);
            expect(data.data.id).toBe('sim-123');
            expect(data.data.scenario).toBe('rotation');
            expect(proxySimulator.runSimulation).toHaveBeenCalledWith(mockSimulationConfig);
        });

        it('should validate proxy pool has at least one proxy', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);

            const configWithEmptyPool = {
                ...mockSimulationConfig,
                proxyPool: [],
            };

            const req = {
                url: 'http://localhost:3000/api/v1/admin/simulator/run',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/simulator/run'),
                json: jest.fn().mockResolvedValue(configWithEmptyPool),
            } as any;

            const response = await runSimulation(req);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toBe('Invalid simulation configuration');
        });

        it('should validate failure rate is between 0 and 1', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);

            const configWithInvalidFailureRate = {
                ...mockSimulationConfig,
                failureRate: 1.5,
            };

            const req = {
                url: 'http://localhost:3000/api/v1/admin/simulator/run',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/simulator/run'),
                json: jest.fn().mockResolvedValue(configWithInvalidFailureRate),
            } as any;

            const response = await runSimulation(req);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toBe('Invalid simulation configuration');
        });
    });

    describe('GET /api/v1/admin/simulator/results', () => {
        it('should return 401 if not authenticated', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(null);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/simulator/results',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/simulator/results'),
            } as any;

            const response = await getSimulationResults(req);

            expect(response.status).toBe(401);
        });

        it('should return simulation results for admin', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (proxySimulator.listSimulations as jest.Mock).mockResolvedValue([
                mockSimulationResult,
            ]);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/simulator/results',
                nextUrl: new URL('http://localhost:3000/api/v1/admin/simulator/results'),
            } as any;

            const response = await getSimulationResults(req);

            expect(response.status).toBe(200);
            const data = await response.json();

            expect(data.success).toBe(true);
            expect(data.data.results).toHaveLength(1);
            expect(data.data.count).toBe(1);
            expect(data.data.limit).toBe(50);
            expect(proxySimulator.listSimulations).toHaveBeenCalledWith(50);
        });

        it('should respect limit parameter', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (proxySimulator.listSimulations as jest.Mock).mockResolvedValue([]);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/simulator/results?limit=25',
                nextUrl: new URL(
                    'http://localhost:3000/api/v1/admin/simulator/results?limit=25'
                ),
            } as any;

            const response = await getSimulationResults(req);

            expect(response.status).toBe(200);
            expect(proxySimulator.listSimulations).toHaveBeenCalledWith(25);
        });

        it('should cap limit at 100', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (proxySimulator.listSimulations as jest.Mock).mockResolvedValue([]);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/simulator/results?limit=200',
                nextUrl: new URL(
                    'http://localhost:3000/api/v1/admin/simulator/results?limit=200'
                ),
            } as any;

            const response = await getSimulationResults(req);

            expect(response.status).toBe(200);
            expect(proxySimulator.listSimulations).toHaveBeenCalledWith(100);
        });

        it('should return 400 for invalid limit', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/simulator/results?limit=invalid',
                nextUrl: new URL(
                    'http://localhost:3000/api/v1/admin/simulator/results?limit=invalid'
                ),
            } as any;

            const response = await getSimulationResults(req);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toBe('Invalid limit parameter');
        });
    });

    describe('GET /api/v1/admin/simulator/results/[id]', () => {
        it('should return 401 if not authenticated', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(null);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/simulator/results/sim-123',
                nextUrl: new URL(
                    'http://localhost:3000/api/v1/admin/simulator/results/sim-123'
                ),
            } as any;

            const response = await getSimulationResult(req, { params: { id: 'sim-123' } });

            expect(response.status).toBe(401);
        });

        it('should return 400 for invalid UUID format', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);

            const req = {
                url: 'http://localhost:3000/api/v1/admin/simulator/results/invalid-id',
                nextUrl: new URL(
                    'http://localhost:3000/api/v1/admin/simulator/results/invalid-id'
                ),
            } as any;

            const response = await getSimulationResult(req, { params: { id: 'invalid-id' } });

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toBe('Invalid simulation ID format');
        });

        it('should return 404 if simulation not found', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (proxySimulator.getSimulationResult as jest.Mock).mockResolvedValue(null);

            const validUuid = '550e8400-e29b-41d4-a716-446655440000';
            const req = {
                url: `http://localhost:3000/api/v1/admin/simulator/results/${validUuid}`,
                nextUrl: new URL(
                    `http://localhost:3000/api/v1/admin/simulator/results/${validUuid}`
                ),
            } as any;

            const response = await getSimulationResult(req, { params: { id: validUuid } });

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe('Simulation not found');
        });

        it('should return simulation result for admin', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockAdminSession);
            (proxySimulator.getSimulationResult as jest.Mock).mockResolvedValue(
                mockSimulationResult
            );

            const validUuid = '550e8400-e29b-41d4-a716-446655440000';
            const req = {
                url: `http://localhost:3000/api/v1/admin/simulator/results/${validUuid}`,
                nextUrl: new URL(
                    `http://localhost:3000/api/v1/admin/simulator/results/${validUuid}`
                ),
            } as any;

            const response = await getSimulationResult(req, { params: { id: validUuid } });

            expect(response.status).toBe(200);
            const data = await response.json();

            expect(data.success).toBe(true);
            expect(data.data.id).toBe('sim-123');
            expect(proxySimulator.getSimulationResult).toHaveBeenCalledWith(validUuid);
        });
    });
});
