import { CacheMonitoringService } from '@/lib/services/cache-monitoring';
import { CacheLayer } from '@/lib/services/cache-layer';
import { getRedisConnection } from '@/lib/queue/connection';

// Mock dependencies
jest.mock('@/lib/queue/connection');
jest.mock('@/lib/services/cache-layer');
jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

describe('CacheMonitoringService', () => {
    let monitoringService: CacheMonitoringService;
    let mockRedis: any;
    let mockCacheLayer: any;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Mock Redis connection
        mockRedis = {
            status: 'ready',
            connect: jest.fn().mockResolvedValue(undefined),
            ping: jest.fn().mockResolvedValue('PONG'),
            info: jest.fn().mockResolvedValue('used_memory:104857600\nevicted_keys:0'),
            keys: jest.fn().mockResolvedValue(['key1', 'key2', 'key3']),
            set: jest.fn().mockResolvedValue('OK'),
            get: jest.fn().mockResolvedValue('test'),
            del: jest.fn().mockResolvedValue(1),
        };

        (getRedisConnection as jest.Mock).mockReturnValue(mockRedis);

        // Mock CacheLayer
        mockCacheLayer = {
            getCacheStats: jest.fn().mockResolvedValue({
                hitRate: 0.75,
                missRate: 0.25,
                totalKeys: 100,
                memoryUsedBytes: 104857600, // 100MB
                evictions: 0,
            }),
        };

        (CacheLayer.getInstance as jest.Mock).mockReturnValue(mockCacheLayer);

        // Create service instance
        monitoringService = new CacheMonitoringService();
    });

    describe('getHealthStatus', () => {
        it('should return healthy status when Redis is connected', async () => {
            const health = await monitoringService.getHealthStatus();

            expect(health.status).toBe('healthy');
            expect(health.redis?.connected).toBe(true);
            expect(health.performance?.hitRate).toBe(0.75);
            expect(mockRedis.ping).toHaveBeenCalled();
        });

        it('should return unhealthy status when Redis is disconnected', async () => {
            mockRedis.ping.mockRejectedValue(new Error('Connection failed'));

            const health = await monitoringService.getHealthStatus();

            expect(health.status).toBe('unhealthy');
            expect(health.error).toBe('Redis connection failed');
        });

        it('should include memory usage information', async () => {
            const health = await monitoringService.getHealthStatus();

            expect(health.redis?.memoryUsage).toBe(104857600); // 100MB
            expect(health.redis?.memoryLimit).toBe(500 * 1024 * 1024); // 500MB
            expect(health.redis?.memoryUsagePercent).toBeCloseTo(0.2, 1); // 20%
        });

        it('should include performance metrics', async () => {
            const health = await monitoringService.getHealthStatus();

            expect(health.performance?.hitRate).toBe(0.75);
            expect(health.performance?.totalKeys).toBe(100);
            expect(health.performance?.evictions).toBe(0);
        });
    });

    describe('generateAlerts', () => {
        it('should generate warning when hit rate is below threshold', () => {
            const stats = {
                hitRate: 0.5, // Below 60% threshold
                missRate: 0.5,
                totalKeys: 100,
                memoryUsedBytes: 100 * 1024 * 1024,
                evictions: 0,
            };

            const alerts = monitoringService.generateAlerts(stats, 100 * 1024 * 1024);

            const hitRateAlert = alerts.find(a => a.metric === 'hitRate');
            expect(hitRateAlert).toBeDefined();
            expect(hitRateAlert?.level).toBe('warning');
            expect(hitRateAlert?.message).toContain('50.0%');
        });

        it('should generate warning when memory usage is above 80%', () => {
            const stats = {
                hitRate: 0.75,
                missRate: 0.25,
                totalKeys: 100,
                memoryUsedBytes: 100 * 1024 * 1024,
                evictions: 0,
            };

            const memoryUsage = 450 * 1024 * 1024; // 450MB (90% of 500MB)
            const alerts = monitoringService.generateAlerts(stats, memoryUsage);

            const memoryAlert = alerts.find(a => a.metric === 'memoryUsage');
            expect(memoryAlert).toBeDefined();
            expect(memoryAlert?.level).toBe('warning');
            expect(memoryAlert?.message).toContain('450MB');
        });

        it('should generate error when memory usage is above 95%', () => {
            const stats = {
                hitRate: 0.75,
                missRate: 0.25,
                totalKeys: 100,
                memoryUsedBytes: 100 * 1024 * 1024,
                evictions: 0,
            };

            const memoryUsage = 480 * 1024 * 1024; // 480MB (96% of 500MB)
            const alerts = monitoringService.generateAlerts(stats, memoryUsage);

            const memoryAlert = alerts.find(a => a.metric === 'memoryUsage');
            expect(memoryAlert).toBeDefined();
            expect(memoryAlert?.level).toBe('error');
        });

        it('should generate info alert when evictions are detected', () => {
            const stats = {
                hitRate: 0.75,
                missRate: 0.25,
                totalKeys: 100,
                memoryUsedBytes: 100 * 1024 * 1024,
                evictions: 50,
            };

            const alerts = monitoringService.generateAlerts(stats, 100 * 1024 * 1024);

            const evictionAlert = alerts.find(a => a.metric === 'evictions');
            expect(evictionAlert).toBeDefined();
            expect(evictionAlert?.level).toBe('info');
            expect(evictionAlert?.message).toContain('50 keys evicted');
        });

        it('should generate warning when cache is empty', () => {
            const stats = {
                hitRate: 0,
                missRate: 0,
                totalKeys: 0,
                memoryUsedBytes: 0,
                evictions: 0,
            };

            const alerts = monitoringService.generateAlerts(stats, 0);

            const emptyAlert = alerts.find(a => a.metric === 'totalKeys');
            expect(emptyAlert).toBeDefined();
            expect(emptyAlert?.level).toBe('warning');
            expect(emptyAlert?.message).toContain('Cache is empty');
        });
    });

    describe('logStats', () => {
        it('should log cache statistics', async () => {
            const { logger } = require('@/lib/logger');

            await monitoringService.logStats();

            expect(logger.info).toHaveBeenCalledWith(
                '[CacheMonitoring] Cache Statistics',
                expect.objectContaining({
                    status: 'healthy',
                    redis: expect.any(Object),
                    performance: expect.any(Object),
                })
            );
        });

        it('should log alerts separately', async () => {
            const { logger } = require('@/lib/logger');

            // Set up low hit rate to trigger alert
            mockCacheLayer.getCacheStats.mockResolvedValue({
                hitRate: 0.5, // Below threshold
                missRate: 0.5,
                totalKeys: 100,
                memoryUsedBytes: 100 * 1024 * 1024,
                evictions: 0,
            });

            await monitoringService.logStats();

            expect(logger.warn).toHaveBeenCalledWith(
                '[CacheMonitoring] Alert',
                expect.objectContaining({
                    message: expect.stringContaining('hit rate'),
                    metric: 'hitRate',
                })
            );
        });
    });

    describe('getTenantStats', () => {
        it('should return tenant-specific statistics', async () => {
            const tenantId = 'tenant_123';
            mockRedis.keys.mockResolvedValue(['cache:tenant_123:key1', 'cache:tenant_123:key2']);

            const stats = await monitoringService.getTenantStats(tenantId);

            expect(stats.tenantId).toBe(tenantId);
            expect(stats.totalKeys).toBe(2);
            expect(mockRedis.keys).toHaveBeenCalledWith('cache:tenant_123:*');
        });

        it('should handle errors gracefully', async () => {
            const tenantId = 'tenant_123';
            mockRedis.keys.mockRejectedValue(new Error('Redis error'));

            const stats = await monitoringService.getTenantStats(tenantId);

            expect(stats.tenantId).toBe(tenantId);
            expect(stats.totalKeys).toBe(0);
            expect(stats.error).toBeDefined();
        });
    });

    describe('checkPerformance', () => {
        it('should return healthy when operations are fast', async () => {
            const result = await monitoringService.checkPerformance();

            expect(result.healthy).toBe(true);
            expect(result.latency).toBeLessThan(100);
            expect(mockRedis.set).toHaveBeenCalled();
            expect(mockRedis.get).toHaveBeenCalled();
            expect(mockRedis.del).toHaveBeenCalled();
        });

        it('should return unhealthy when operations are slow', async () => {
            // Simulate slow operations
            mockRedis.set.mockImplementation(() =>
                new Promise(resolve => setTimeout(() => resolve('OK'), 150))
            );

            const result = await monitoringService.checkPerformance();

            expect(result.healthy).toBe(false);
            expect(result.latency).toBeGreaterThan(100);
        });

        it('should handle errors gracefully', async () => {
            mockRedis.set.mockRejectedValue(new Error('Operation failed'));

            const result = await monitoringService.checkPerformance();

            expect(result.healthy).toBe(false);
            expect(result.latency).toBe(-1);
        });
    });

    describe('configuration', () => {
        it('should allow updating configuration', () => {
            monitoringService.updateConfig({
                hitRateThreshold: 0.7,
                memoryUsageThreshold: 0.9,
            });

            const config = monitoringService.getConfig();

            expect(config.hitRateThreshold).toBe(0.7);
            expect(config.memoryUsageThreshold).toBe(0.9);
            expect(config.responseTimeThreshold).toBe(100); // Unchanged
        });

        it('should return current configuration', () => {
            const config = monitoringService.getConfig();

            expect(config.hitRateThreshold).toBe(0.6);
            expect(config.memoryUsageThreshold).toBe(0.8);
            expect(config.responseTimeThreshold).toBe(100);
            expect(config.memoryLimit).toBe(500 * 1024 * 1024);
        });
    });
});
