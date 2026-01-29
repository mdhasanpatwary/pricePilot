/**
 * Tests for Connection Pool Stats API Endpoint
 * 
 * Integration tests for the connection pool monitoring endpoint.
 */

import { GET } from '@/app/api/v1/admin/performance/pool-stats/route';
import { NextRequest } from 'next/server';

// Mock the dependencies
jest.mock('@/lib/services/connection-pool-manager', () => ({
    getConnectionPoolManager: jest.fn(() => ({
        getPoolStats: jest.fn().mockReturnValue({
            totalConnections: 30,
            idleConnections: 15,
            activeConnections: 15,
            waitingRequests: 0,
            utilizationPercent: 60,
        }),
        healthCheck: jest.fn().mockResolvedValue({
            healthy: true,
            primaryReachable: true,
            replicasReachable: 2,
            avgResponseTime: 50,
        }),
    })),
}));

describe('GET /api/v1/admin/performance/pool-stats', () => {
    it('should return pool statistics with health status', async () => {
        const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/pool-stats');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('poolHealth');
        expect(data.data).toHaveProperty('connections');
        expect(data.data).toHaveProperty('health');
        expect(data.data).toHaveProperty('alerts');
        expect(data.meta).toHaveProperty('timestamp');
    });
});
