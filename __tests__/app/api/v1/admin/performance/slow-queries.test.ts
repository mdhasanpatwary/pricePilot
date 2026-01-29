/**
 * Tests for Slow Queries API Endpoint
 * 
 * Integration tests for the slow queries monitoring endpoint.
 */

import { GET } from '@/app/api/v1/admin/performance/slow-queries/route';
import { NextRequest } from 'next/server';

// Mock the dependencies
jest.mock('@/lib/database/optimized-prisma', () => ({
    getOptimizedPrisma: jest.fn(() => ({
        slowQuery: {
            findMany: jest.fn().mockResolvedValue([]),
        },
        queryPerformanceMetric: {
            findMany: jest.fn().mockResolvedValue([]),
        },
    })),
}));

jest.mock('@/lib/services/query-analyzer', () => ({
    getQueryAnalyzer: jest.fn(() => ({
        getTopSlowQueries: jest.fn().mockResolvedValue([
            {
                query: 'SELECT * FROM users WHERE tenant_id = $1',
                avgExecutionTime: 2500,
                maxExecutionTime: 5000,
                executionCount: 100,
                lastExecuted: new Date('2024-01-15T10:00:00Z'),
            },
        ]),
        getPerformanceTrends: jest.fn().mockResolvedValue([
            {
                date: new Date('2024-01-15'),
                avgExecutionTime: 2000,
                queryCount: 150,
            },
        ]),
    })),
}));

describe('GET /api/v1/admin/performance/slow-queries', () => {
    it('should return slow queries with summary statistics', async () => {
        const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/slow-queries');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('queries');
        expect(data.data).toHaveProperty('summary');
        expect(data.data).toHaveProperty('healthStatus');
        expect(data.meta).toHaveProperty('timestamp');
    });

    it('should handle query parameters', async () => {
        const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/slow-queries?limit=10&days=30');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
    });
});
