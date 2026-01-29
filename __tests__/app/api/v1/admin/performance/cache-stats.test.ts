/**
 * Tests for Cache Stats API Endpoint
 * 
 * Integration tests for the cache statistics monitoring endpoint.
 */

import { GET } from '@/app/api/v1/admin/performance/cache-stats/route';
import { NextRequest } from 'next/server';

// Mock the dependencies
jest.mock('@/lib/services/cache-layer', () => ({
    cacheLayer: {
        getCacheStats: jest.fn().mockResolvedValue({
            hitRate: 700,
            missRate: 300,
            totalKeys: 5000,
            memoryUsedBytes: 104857600, // 100 MB
            evictions: 50,
        }),
    },
}));

describe('GET /api/v1/admin/performance/cache-stats', () => {
    it('should return cache statistics with health status', async () => {
        const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/cache-stats');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('cacheHealth');
        expect(data.data).toHaveProperty('performance');
        expect(data.data).toHaveProperty('memory');
        expect(data.data).toHaveProperty('keys');
        expect(data.data).toHaveProperty('alerts');
        expect(data.meta).toHaveProperty('timestamp');
    });
});
