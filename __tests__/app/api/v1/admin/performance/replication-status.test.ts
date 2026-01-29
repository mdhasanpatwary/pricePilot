/**
 * Replication Status API Endpoint Tests
 */

import { GET } from '@/app/api/v1/admin/performance/replication-status/route';
import { NextRequest } from 'next/server';

// Mock the read replica router
jest.mock('@/lib/services/read-replica-router', () => ({
    getReadReplicaRouter: jest.fn(() => ({
        checkReplicationLag: jest.fn(async () => [
            {
                replicaId: 'replica-1',
                lagSeconds: 2.5,
                healthy: true,
                lastCheck: new Date('2024-01-01T12:00:00Z'),
            },
            {
                replicaId: 'replica-2',
                lagSeconds: 8.3,
                healthy: true,
                lastCheck: new Date('2024-01-01T12:00:00Z'),
            },
        ]),
        getRoutingStats: jest.fn(async () => ({
            primaryQueries: 100,
            replicaQueries: 400,
            failoverCount: 5,
            avgReplicationLag: 5.4,
        })),
    })),
}));

describe('GET /api/v1/admin/performance/replication-status', () => {
    it('should return replication status successfully', async () => {
        const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/replication-status');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('overallStatus');
        expect(data.data).toHaveProperty('replicas');
        expect(data.data).toHaveProperty('routing');
        expect(data.data).toHaveProperty('metrics');
    });

    it('should return replica information', async () => {
        const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/replication-status');
        const response = await GET(request);
        const data = await response.json();

        expect(data.data.replicas).toHaveLength(2);
        expect(data.data.replicas[0]).toHaveProperty('id');
        expect(data.data.replicas[0]).toHaveProperty('healthy');
        expect(data.data.replicas[0]).toHaveProperty('lagSeconds');
        expect(data.data.replicas[0]).toHaveProperty('lagStatus');
        expect(data.data.replicas[0]).toHaveProperty('lastCheck');
    });

    it('should return routing statistics', async () => {
        const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/replication-status');
        const response = await GET(request);
        const data = await response.json();

        expect(data.data.routing).toHaveProperty('primaryQueries');
        expect(data.data.routing).toHaveProperty('replicaQueries');
        expect(data.data.routing).toHaveProperty('totalQueries');
        expect(data.data.routing).toHaveProperty('replicaQueryPercent');
        expect(data.data.routing).toHaveProperty('failoverCount');

        expect(data.data.routing.totalQueries).toBe(500);
        expect(data.data.routing.replicaQueryPercent).toBe('80.0');
    });

    it('should return metrics summary', async () => {
        const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/replication-status');
        const response = await GET(request);
        const data = await response.json();

        expect(data.data.metrics).toHaveProperty('totalReplicas');
        expect(data.data.metrics).toHaveProperty('healthyReplicas');
        expect(data.data.metrics).toHaveProperty('unhealthyReplicas');
        expect(data.data.metrics).toHaveProperty('avgReplicationLag');
        expect(data.data.metrics).toHaveProperty('maxReplicationLag');
        expect(data.data.metrics).toHaveProperty('minReplicationLag');

        expect(data.data.metrics.totalReplicas).toBe(2);
        expect(data.data.metrics.healthyReplicas).toBe(2);
        expect(data.data.metrics.unhealthyReplicas).toBe(0);
    });

    it('should determine overall status correctly', async () => {
        const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/replication-status');
        const response = await GET(request);
        const data = await response.json();

        // With avg lag of 5.4s, should be 'warning'
        expect(data.data.overallStatus).toBe('warning');
    });

    it('should include timestamp in metadata', async () => {
        const request = new NextRequest('http://localhost:3000/api/v1/admin/performance/replication-status');
        const response = await GET(request);
        const data = await response.json();

        expect(data.meta).toHaveProperty('timestamp');
        expect(typeof data.meta.timestamp).toBe('string');
    });
});
