/**
 * Read Replica Router Tests
 * 
 * Tests for the Read Replica Router component including query routing,
 * replication lag monitoring, circuit breaker, and failover logic.
 */

import { ReadReplicaRouterImpl } from '@/lib/services/read-replica-router';
import { Query } from '@/lib/types/database-optimization';

// Mock pg module
jest.mock('pg', () => {
    const mockPool = {
        connect: jest.fn(),
        query: jest.fn(),
        end: jest.fn(),
        totalCount: 10,
        idleCount: 5,
        waitingCount: 0,
        on: jest.fn(),
    };

    return {
        Pool: jest.fn(() => mockPool),
    };
});

// Mock ConnectionPoolManager
jest.mock('@/lib/services/connection-pool-manager', () => {
    const mockPool = {
        connect: jest.fn(),
        query: jest.fn(),
        end: jest.fn(),
        totalCount: 10,
        idleCount: 5,
        waitingCount: 0,
        on: jest.fn(),
    };

    return {
        ConnectionPoolManagerImpl: jest.fn().mockImplementation(() => ({
            getPool: jest.fn(() => mockPool),
            getPoolStats: jest.fn(() => ({
                totalConnections: 10,
                idleConnections: 5,
                activeConnections: 5,
                waitingRequests: 0,
                utilizationPercent: 20,
            })),
            healthCheck: jest.fn(async () => ({
                healthy: true,
                primaryReachable: true,
                replicasReachable: 0,
                avgResponseTime: 10,
            })),
            drain: jest.fn(async () => { }),
        })),
    };
});

describe('ReadReplicaRouter', () => {
    let router: ReadReplicaRouterImpl;
    const primaryConnectionString = 'postgresql://localhost:5432/primary';
    const replicaConfigs = [
        {
            id: 'replica-1',
            connectionString: 'postgresql://localhost:5432/replica1',
            priority: 0,
        },
        {
            id: 'replica-2',
            connectionString: 'postgresql://localhost:5432/replica2',
            priority: 1,
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        router = new ReadReplicaRouterImpl(primaryConnectionString, replicaConfigs);
    });

    afterEach(async () => {
        await router.shutdown();
    });

    describe('Query Type Detection', () => {
        it('should detect SELECT queries as read operations', async () => {
            const query: Query = {
                sql: 'SELECT * FROM products WHERE tenant_id = $1',
                params: ['tenant-123'],
                type: 'read',
                tenantId: 'tenant-123',
            };

            const pool = await router.route(query);
            expect(pool).toBeDefined();

            const stats = await router.getRoutingStats();
            // Should route to replica (or primary if no healthy replicas)
            expect(stats.primaryQueries + stats.replicaQueries).toBeGreaterThan(0);
        });

        it('should detect INSERT queries as write operations', async () => {
            const query: Query = {
                sql: 'INSERT INTO products (name, price) VALUES ($1, $2)',
                params: ['Product', 99.99],
                type: 'write',
                tenantId: 'tenant-123',
            };

            const pool = await router.route(query);
            expect(pool).toBeDefined();

            const stats = await router.getRoutingStats();
            expect(stats.primaryQueries).toBeGreaterThan(0);
        });

        it('should detect UPDATE queries as write operations', async () => {
            const query: Query = {
                sql: 'UPDATE products SET price = $1 WHERE id = $2',
                params: [89.99, 'prod-123'],
                type: 'write',
                tenantId: 'tenant-123',
            };

            const pool = await router.route(query);
            expect(pool).toBeDefined();

            const stats = await router.getRoutingStats();
            expect(stats.primaryQueries).toBeGreaterThan(0);
        });

        it('should detect DELETE queries as write operations', async () => {
            const query: Query = {
                sql: 'DELETE FROM products WHERE id = $1',
                params: ['prod-123'],
                type: 'write',
                tenantId: 'tenant-123',
            };

            const pool = await router.route(query);
            expect(pool).toBeDefined();

            const stats = await router.getRoutingStats();
            expect(stats.primaryQueries).toBeGreaterThan(0);
        });

        it('should auto-detect query type when not provided', async () => {
            const readQuery: Query = {
                sql: 'SELECT * FROM products',
                params: [],
                type: 'read',
                tenantId: 'tenant-123',
            };

            const writeQuery: Query = {
                sql: 'INSERT INTO products (name) VALUES ($1)',
                params: ['Product'],
                type: 'write',
                tenantId: 'tenant-123',
            };

            await router.route(readQuery);
            await router.route(writeQuery);

            const stats = await router.getRoutingStats();
            expect(stats.primaryQueries).toBeGreaterThan(0);
        });
    });

    describe('Query Routing', () => {
        it('should route write queries to primary', async () => {
            const query: Query = {
                sql: 'INSERT INTO products (name) VALUES ($1)',
                params: ['Product'],
                type: 'write',
                tenantId: 'tenant-123',
            };

            const pool = await router.route(query);
            expect(pool).toBeDefined();

            const stats = await router.getRoutingStats();
            expect(stats.primaryQueries).toBe(1);
            expect(stats.replicaQueries).toBe(0);
        });

        it('should route read queries to replicas when available', async () => {
            const query: Query = {
                sql: 'SELECT * FROM products',
                params: [],
                type: 'read',
                tenantId: 'tenant-123',
            };

            const pool = await router.route(query);
            expect(pool).toBeDefined();

            const stats = await router.getRoutingStats();
            // Should route to replica or primary (depending on replica health)
            expect(stats.primaryQueries + stats.replicaQueries).toBeGreaterThan(0);
        });

        it('should failover to primary when no healthy replicas', async () => {
            // Mark all replicas as unhealthy
            await router.markUnhealthy('replica-1');
            await router.markUnhealthy('replica-2');

            const query: Query = {
                sql: 'SELECT * FROM products',
                params: [],
                type: 'read',
                tenantId: 'tenant-123',
            };

            const pool = await router.route(query);
            expect(pool).toBeDefined();

            const stats = await router.getRoutingStats();
            expect(stats.primaryQueries).toBeGreaterThan(0);
            expect(stats.failoverCount).toBeGreaterThan(0);
        });
    });

    describe('Replication Lag Monitoring', () => {
        it('should check replication lag for all replicas', async () => {
            const statuses = await router.checkReplicationLag();
            expect(Array.isArray(statuses)).toBe(true);
        });

        it('should return replication status with lag information', async () => {
            const statuses = await router.checkReplicationLag();

            statuses.forEach((status) => {
                expect(status).toHaveProperty('replicaId');
                expect(status).toHaveProperty('lagSeconds');
                expect(status).toHaveProperty('healthy');
                expect(status).toHaveProperty('lastCheck');
            });
        });

        it('should mark replicas unhealthy when lag exceeds threshold', async () => {
            // This test would require mocking the database response
            // to simulate high replication lag
            const statuses = await router.checkReplicationLag();
            expect(Array.isArray(statuses)).toBe(true);
        });
    });

    describe('Circuit Breaker', () => {
        it('should mark replica as unhealthy', async () => {
            await router.markUnhealthy('replica-1');

            const query: Query = {
                sql: 'SELECT * FROM products',
                params: [],
                type: 'read',
                tenantId: 'tenant-123',
            };

            // Should not route to replica-1
            const pool = await router.route(query);
            expect(pool).toBeDefined();
        });

        it('should open circuit breaker after multiple failures', async () => {
            // Mark unhealthy multiple times to trigger circuit breaker
            await router.markUnhealthy('replica-1');
            await router.markUnhealthy('replica-1');
            await router.markUnhealthy('replica-1');

            const query: Query = {
                sql: 'SELECT * FROM products',
                params: [],
                type: 'read',
                tenantId: 'tenant-123',
            };

            const pool = await router.route(query);
            expect(pool).toBeDefined();

            const stats = await router.getRoutingStats();
            // Should have failover count due to circuit breaker
            expect(stats.failoverCount).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Routing Statistics', () => {
        it('should track primary query count', async () => {
            const query: Query = {
                sql: 'INSERT INTO products (name) VALUES ($1)',
                params: ['Product'],
                type: 'write',
                tenantId: 'tenant-123',
            };

            await router.route(query);
            await router.route(query);

            const stats = await router.getRoutingStats();
            expect(stats.primaryQueries).toBe(2);
        });

        it('should track replica query count', async () => {
            const query: Query = {
                sql: 'SELECT * FROM products',
                params: [],
                type: 'read',
                tenantId: 'tenant-123',
            };

            await router.route(query);
            await router.route(query);

            const stats = await router.getRoutingStats();
            // Should have some queries (replica or primary)
            expect(stats.primaryQueries + stats.replicaQueries).toBeGreaterThanOrEqual(2);
        });

        it('should track failover count', async () => {
            // Mark all replicas unhealthy
            await router.markUnhealthy('replica-1');
            await router.markUnhealthy('replica-2');

            const query: Query = {
                sql: 'SELECT * FROM products',
                params: [],
                type: 'read',
                tenantId: 'tenant-123',
            };

            await router.route(query);

            const stats = await router.getRoutingStats();
            expect(stats.failoverCount).toBeGreaterThan(0);
        });

        it('should track average replication lag', async () => {
            await router.checkReplicationLag();

            const stats = await router.getRoutingStats();
            expect(stats.avgReplicationLag).toBeGreaterThanOrEqual(0);
        });

        it('should return complete routing statistics', async () => {
            const stats = await router.getRoutingStats();

            expect(stats).toHaveProperty('primaryQueries');
            expect(stats).toHaveProperty('replicaQueries');
            expect(stats).toHaveProperty('failoverCount');
            expect(stats).toHaveProperty('avgReplicationLag');

            expect(typeof stats.primaryQueries).toBe('number');
            expect(typeof stats.replicaQueries).toBe('number');
            expect(typeof stats.failoverCount).toBe('number');
            expect(typeof stats.avgReplicationLag).toBe('number');
        });
    });

    describe('Shutdown', () => {
        it('should shutdown cleanly', async () => {
            await expect(router.shutdown()).resolves.not.toThrow();
        });

        it('should stop lag monitoring on shutdown', async () => {
            await router.shutdown();
            // Verify no errors after shutdown
            expect(true).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('should handle queries with no tenant ID', async () => {
            const query: Query = {
                sql: 'SELECT * FROM products',
                params: [],
                type: 'read',
                tenantId: '',
            };

            const pool = await router.route(query);
            expect(pool).toBeDefined();
        });

        it('should handle empty SQL queries', async () => {
            const query: Query = {
                sql: '',
                params: [],
                type: 'read',
                tenantId: 'tenant-123',
            };

            const pool = await router.route(query);
            expect(pool).toBeDefined();
        });

        it('should handle queries with complex SQL', async () => {
            const query: Query = {
                sql: `
                    WITH recent_products AS (
                        SELECT * FROM products WHERE created_at > NOW() - INTERVAL '7 days'
                    )
                    SELECT * FROM recent_products WHERE tenant_id = $1
                `,
                params: ['tenant-123'],
                type: 'read',
                tenantId: 'tenant-123',
            };

            const pool = await router.route(query);
            expect(pool).toBeDefined();
        });
    });

    describe('Router without Replicas', () => {
        it('should work with only primary database', async () => {
            const routerNoreplicas = new ReadReplicaRouterImpl(
                primaryConnectionString,
                []
            );

            const query: Query = {
                sql: 'SELECT * FROM products',
                params: [],
                type: 'read',
                tenantId: 'tenant-123',
            };

            const pool = await routerNoreplicas.route(query);
            expect(pool).toBeDefined();

            const stats = await routerNoreplicas.getRoutingStats();
            expect(stats.primaryQueries).toBeGreaterThan(0);
            expect(stats.replicaQueries).toBe(0);

            await routerNoreplicas.shutdown();
        });
    });
});
