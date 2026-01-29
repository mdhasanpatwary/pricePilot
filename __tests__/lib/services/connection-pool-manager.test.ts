/**
 * Connection Pool Manager Tests
 * 
 * Tests for database connection pooling with health monitoring,
 * metrics tracking, and automatic connection lifecycle management.
 */

import { ConnectionPoolManagerImpl } from '@/lib/services/connection-pool-manager';
import pg from 'pg';

// Mock pg module
jest.mock('pg', () => {
    const mockPool = {
        connect: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
        totalCount: 0,
        idleCount: 0,
        waitingCount: 0,
    };

    return {
        Pool: jest.fn(() => mockPool),
    };
});

describe('ConnectionPoolManager', () => {
    let poolManager: ConnectionPoolManagerImpl;
    let mockPool: any;
    const testConnectionString = 'postgresql://test:test@localhost:5432/testdb';

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        jest.spyOn(global, 'setInterval');
        jest.spyOn(global, 'clearInterval');

        // Get the mock pool instance
        poolManager = new ConnectionPoolManagerImpl(testConnectionString);
        mockPool = (poolManager as any).pool;
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('Task 5.1: Pool Configuration', () => {
        it('should configure pool with min=10, max=50 connections by default', () => {
            expect(pg.Pool).toHaveBeenCalledWith(
                expect.objectContaining({
                    connectionString: testConnectionString,
                    min: 10,
                    max: 50,
                })
            );
        });

        it('should configure pool with custom min/max connections', () => {
            const customPoolManager = new ConnectionPoolManagerImpl(testConnectionString, {
                min: 5,
                max: 25,
            });

            expect(pg.Pool).toHaveBeenCalledWith(
                expect.objectContaining({
                    min: 5,
                    max: 25,
                })
            );
        });

        it('should configure connection timeout to 30 seconds', () => {
            expect(pg.Pool).toHaveBeenCalledWith(
                expect.objectContaining({
                    connectionTimeoutMillis: 30000,
                })
            );
        });

        it('should configure idle timeout to 1 minute', () => {
            expect(pg.Pool).toHaveBeenCalledWith(
                expect.objectContaining({
                    idleTimeoutMillis: 60000,
                })
            );
        });

        it('should enable keep-alive for connection health', () => {
            expect(pg.Pool).toHaveBeenCalledWith(
                expect.objectContaining({
                    keepAlive: true,
                    keepAliveInitialDelayMillis: 10000,
                })
            );
        });

        it('should implement getPool() method', () => {
            const pool = poolManager.getPool();
            expect(pool).toBe(mockPool);
        });

        it('should implement getPoolStats() method', () => {
            mockPool.totalCount = 20;
            mockPool.idleCount = 5;
            mockPool.waitingCount = 2;

            const stats = poolManager.getPoolStats();

            expect(stats).toEqual({
                totalConnections: 20,
                idleConnections: 5,
                activeConnections: 15,
                waitingRequests: 2,
                utilizationPercent: 40, // 20/50 * 100
            });
        });

        it('should track connection creation times', () => {
            const mockClient = { query: jest.fn() };
            const connectHandler = mockPool.on.mock.calls.find(
                (call: any) => call[0] === 'connect'
            )?.[1];

            expect(connectHandler).toBeDefined();

            // Simulate connection event
            connectHandler(mockClient);

            const creationTimes = (poolManager as any).connectionCreationTimes;
            expect(creationTimes.has(mockClient)).toBe(true);
            expect(creationTimes.get(mockClient)).toBeGreaterThan(0);
        });

        it('should clean up connection tracking on removal', () => {
            const mockClient = { query: jest.fn() };

            // Get event handlers
            const connectHandler = mockPool.on.mock.calls.find(
                (call: any) => call[0] === 'connect'
            )?.[1];
            const removeHandler = mockPool.on.mock.calls.find(
                (call: any) => call[0] === 'remove'
            )?.[1];

            // Add connection
            connectHandler(mockClient);
            const creationTimes = (poolManager as any).connectionCreationTimes;
            expect(creationTimes.has(mockClient)).toBe(true);

            // Remove connection
            removeHandler(mockClient);
            expect(creationTimes.has(mockClient)).toBe(false);
        });
    });

    describe('Task 5.3: Connection Health Monitoring', () => {
        it('should implement healthCheck() with SELECT 1 query', async () => {
            const mockClient = {
                query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
                release: jest.fn(),
            };
            mockPool.connect.mockResolvedValue(mockClient);

            const health = await poolManager.healthCheck();

            expect(mockClient.query).toHaveBeenCalledWith('SELECT 1');
            expect(health.healthy).toBe(true);
            expect(health.primaryReachable).toBe(true);
            expect(mockClient.release).toHaveBeenCalled();
        });

        it('should return unhealthy status when health check fails', async () => {
            mockPool.connect.mockRejectedValue(new Error('Connection failed'));

            const health = await poolManager.healthCheck();

            expect(health.healthy).toBe(false);
            expect(health.primaryReachable).toBe(false);
        });

        it('should measure response time in health check', async () => {
            const mockClient = {
                query: jest.fn().mockImplementation(() =>
                    new Promise(resolve => setTimeout(() => resolve({ rows: [] }), 50))
                ),
                release: jest.fn(),
            };
            mockPool.connect.mockResolvedValue(mockClient);

            jest.useRealTimers();
            const health = await poolManager.healthCheck();
            jest.useFakeTimers();

            expect(health.avgResponseTime).toBeGreaterThan(0);
        });

        it('should start periodic health checks on initialization', () => {
            expect(setInterval).toHaveBeenCalledWith(
                expect.any(Function),
                30000 // healthCheckIntervalMillis
            );
        });

        it('should perform health check and detect stale connections', async () => {
            const mockClient = {
                query: jest.fn().mockResolvedValue({ rows: [] }),
                release: jest.fn(),
            };
            mockPool.connect.mockResolvedValue(mockClient);

            // Set connection creation time to 31 minutes ago (exceeds 30-minute max)
            const creationTimes = (poolManager as any).connectionCreationTimes;
            const oldTimestamp = Date.now() - (31 * 60 * 1000);
            creationTimes.set(mockClient, oldTimestamp);

            // Trigger health check
            const performHealthCheck = (poolManager as any).performHealthCheck.bind(poolManager);
            await performHealthCheck();

            // Should release with destroy flag (true)
            expect(mockClient.release).toHaveBeenCalledWith(true);
        });

        it('should log warning when pool utilization exceeds 80%', () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

            mockPool.totalCount = 45; // 90% utilization (45/50)
            mockPool.idleCount = 5;
            mockPool.waitingCount = 3;

            // Get the acquire handler
            const acquireHandler = mockPool.on.mock.calls.find(
                (call: any) => call[0] === 'acquire'
            )?.[1];

            // Trigger acquire event
            acquireHandler();

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('High connection pool utilization: 90.0%'),
                expect.objectContaining({
                    total: 45,
                    active: 40,
                    idle: 5,
                    waiting: 3,
                })
            );

            consoleWarnSpy.mockRestore();
        });

        it('should not log warning when pool utilization is below 80%', () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

            mockPool.totalCount = 30; // 60% utilization (30/50)
            mockPool.idleCount = 10;
            mockPool.waitingCount = 0;

            // Get the acquire handler
            const acquireHandler = mockPool.on.mock.calls.find(
                (call: any) => call[0] === 'acquire'
            )?.[1];

            // Trigger acquire event
            acquireHandler();

            expect(consoleWarnSpy).not.toHaveBeenCalled();

            consoleWarnSpy.mockRestore();
        });

        it('should handle connection errors gracefully', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            const mockClient = { query: jest.fn() };
            const error = new Error('Connection lost');

            // Get the error handler
            const errorHandler = mockPool.on.mock.calls.find(
                (call: any) => call[0] === 'error'
            )?.[1];

            // Add connection to tracking
            const creationTimes = (poolManager as any).connectionCreationTimes;
            creationTimes.set(mockClient, Date.now());

            // Trigger error event
            errorHandler(error, mockClient);

            expect(consoleErrorSpy).toHaveBeenCalledWith('Unexpected pool error:', error);
            expect(creationTimes.has(mockClient)).toBe(false);

            consoleErrorSpy.mockRestore();
        });
    });

    describe('Task 5.7: Exponential Backoff Retry', () => {
        it('should implement retry mechanism with exponential delays', async () => {
            const mockClient = {
                query: jest.fn(),
                release: jest.fn(),
            };

            let attemptCount = 0;
            mockPool.connect.mockImplementation(() => {
                attemptCount++;
                if (attemptCount < 3) {
                    return Promise.reject(new Error('Connection failed'));
                }
                return Promise.resolve(mockClient);
            });

            const queryFn = jest.fn().mockResolvedValue({ rows: [] });

            const promise = poolManager.executeWithRetry(queryFn);

            // Fast-forward through delays
            await jest.advanceTimersByTimeAsync(100); // First retry after 100ms
            await jest.advanceTimersByTimeAsync(200); // Second retry after 200ms

            const result = await promise;

            expect(attemptCount).toBe(3);
            expect(queryFn).toHaveBeenCalledWith(mockClient);
            expect(mockClient.release).toHaveBeenCalled();
        });

        it('should use exponential backoff delays: 100ms, 200ms, 400ms, 800ms', async () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

            mockPool.connect.mockRejectedValue(new Error('Connection failed'));

            const queryFn = jest.fn();

            // Start the retry process
            poolManager.executeWithRetry(queryFn, 5).catch(() => { });

            // Advance through all retry delays
            await jest.advanceTimersByTimeAsync(100);
            await jest.advanceTimersByTimeAsync(200);
            await jest.advanceTimersByTimeAsync(400);
            await jest.advanceTimersByTimeAsync(800);

            // Verify exponential backoff messages
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('retrying in 100ms'),
                expect.any(Error)
            );
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('retrying in 200ms'),
                expect.any(Error)
            );
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('retrying in 400ms'),
                expect.any(Error)
            );
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('retrying in 800ms'),
                expect.any(Error)
            );

            consoleWarnSpy.mockRestore();
        });

        it('should limit retry attempts to maximum 5 by default', async () => {
            mockPool.connect.mockRejectedValue(new Error('Connection failed'));

            const queryFn = jest.fn();

            // Start the retry process
            poolManager.executeWithRetry(queryFn).catch(() => { });

            // Fast-forward through all retries
            for (let i = 0; i < 5; i++) {
                await jest.advanceTimersByTimeAsync(100 * Math.pow(2, i));
            }

            expect(mockPool.connect).toHaveBeenCalledTimes(5);
        });

        it('should allow custom maximum retry attempts', async () => {
            mockPool.connect.mockRejectedValue(new Error('Connection failed'));

            const queryFn = jest.fn();

            // Start the retry process with 3 max retries
            poolManager.executeWithRetry(queryFn, 3).catch(() => { });

            // Fast-forward through retries
            for (let i = 0; i < 3; i++) {
                await jest.advanceTimersByTimeAsync(100 * Math.pow(2, i));
            }

            expect(mockPool.connect).toHaveBeenCalledTimes(3);
        });

        it('should succeed on first attempt if connection is healthy', async () => {
            const mockClient = {
                query: jest.fn(),
                release: jest.fn(),
            };
            mockPool.connect.mockResolvedValue(mockClient);

            const queryFn = jest.fn().mockResolvedValue({ rows: [{ id: 1 }] });

            const result = await poolManager.executeWithRetry(queryFn);

            expect(mockPool.connect).toHaveBeenCalledTimes(1);
            expect(queryFn).toHaveBeenCalledWith(mockClient);
            expect(mockClient.release).toHaveBeenCalled();
        });

        it('should release connection even if query fails', async () => {
            const mockClient = {
                query: jest.fn(),
                release: jest.fn(),
            };
            mockPool.connect.mockResolvedValue(mockClient);

            const queryFn = jest.fn().mockRejectedValue(new Error('Query error'));

            // Start the retry process
            poolManager.executeWithRetry(queryFn, 2).catch(() => { });

            // Fast-forward through retries
            await jest.advanceTimersByTimeAsync(100);
            await jest.advanceTimersByTimeAsync(200);

            // Should release connection on each attempt
            expect(mockClient.release).toHaveBeenCalledTimes(2);
        });
    });

    describe('Graceful Shutdown', () => {
        it('should implement drain() method for graceful shutdown', async () => {
            mockPool.end.mockResolvedValue(undefined);

            await poolManager.drain();

            expect(mockPool.end).toHaveBeenCalled();
        });

        it('should clear health check interval on drain', async () => {
            mockPool.end.mockResolvedValue(undefined);

            await poolManager.drain();

            expect(clearInterval).toHaveBeenCalled();
        });

        it('should clear connection tracking on drain', async () => {
            mockPool.end.mockResolvedValue(undefined);

            const creationTimes = (poolManager as any).connectionCreationTimes;
            creationTimes.set({ id: 1 }, Date.now());
            creationTimes.set({ id: 2 }, Date.now());

            expect(creationTimes.size).toBe(2);

            await poolManager.drain();

            expect(creationTimes.size).toBe(0);
        });
    });

    describe('Pool Statistics', () => {
        it('should calculate utilization percentage correctly', () => {
            mockPool.totalCount = 25;
            mockPool.idleCount = 10;
            mockPool.waitingCount = 5;

            const stats = poolManager.getPoolStats();

            expect(stats.utilizationPercent).toBe(50); // 25/50 * 100
        });

        it('should calculate active connections correctly', () => {
            mockPool.totalCount = 30;
            mockPool.idleCount = 12;
            mockPool.waitingCount = 3;

            const stats = poolManager.getPoolStats();

            expect(stats.activeConnections).toBe(18); // 30 - 12
        });

        it('should handle zero connections', () => {
            mockPool.totalCount = 0;
            mockPool.idleCount = 0;
            mockPool.waitingCount = 0;

            const stats = poolManager.getPoolStats();

            expect(stats).toEqual({
                totalConnections: 0,
                idleConnections: 0,
                activeConnections: 0,
                waitingRequests: 0,
                utilizationPercent: 0,
            });
        });

        it('should handle maximum connections', () => {
            mockPool.totalCount = 50;
            mockPool.idleCount = 0;
            mockPool.waitingCount = 10;

            const stats = poolManager.getPoolStats();

            expect(stats).toEqual({
                totalConnections: 50,
                idleConnections: 0,
                activeConnections: 50,
                waitingRequests: 10,
                utilizationPercent: 100,
            });
        });
    });
});
