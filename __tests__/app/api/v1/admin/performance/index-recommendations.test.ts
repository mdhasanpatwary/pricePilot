/**
 * Tests for Index Recommendations API Endpoint
 * 
 * Integration tests for the index recommendations monitoring endpoint.
 */

import { GET } from '@/app/api/v1/admin/performance/index-recommendations/route';
import { NextRequest } from 'next/server';

// Mock the dependencies
jest.mock('@/lib/services/index-manager', () => ({
    getIndexManager: jest.fn(() => ({
        suggestIndexes: jest.fn().mockResolvedValue([
            {
                tableName: 'users',
                columns: ['tenant_id', 'status'],
                reason: 'Frequent queries on these columns',
                estimatedImpact: 'high',
                createStatement: 'CREATE INDEX CONCURRENTLY idx_users_tenant_status ON users(tenant_id, status)',
            },
        ]),
        findUnusedIndexes: jest.fn().mockResolvedValue([]),
        getIndexStats: jest.fn().mockResolvedValue([]),
    })),
}));

describe('GET /api/v1/admin/performance/index-recommendations', () => {
    it('should return index recommendations with statistics', async () => {
        const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/index-recommendations');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('suggestions');
        expect(data.data).toHaveProperty('unusedIndexes');
        expect(data.data).toHaveProperty('statistics');
        expect(data.data).toHaveProperty('healthStatus');
        expect(data.meta).toHaveProperty('timestamp');
    });

    it('should handle includeUnused parameter', async () => {
        const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/index-recommendations?includeUnused=false');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
    });
});
