/**
 * Tests for encryption performance optimizations
 * Tests caching and performance monitoring
 */

import { TokenCache } from '@/lib/services/encryption/token-cache';
import { EncryptionPerformanceMonitor } from '@/lib/services/encryption/performance-monitor';

describe('Encryption Performance Optimizations', () => {
    describe('TokenCache', () => {
        let cache: TokenCache;

        beforeEach(() => {
            cache = new TokenCache();
        });

        afterEach(() => {
            cache.clear();
        });

        it('should cache and retrieve tokens', () => {
            const websiteId = 'test-website-1';
            const token = 'test-token-123';

            cache.set(websiteId, token);
            const retrieved = cache.get(websiteId);

            expect(retrieved).toBe(token);
        });

        it('should return null for non-existent cache entries', () => {
            const retrieved = cache.get('non-existent');
            expect(retrieved).toBeNull();
        });

        it('should expire cache entries after TTL', async () => {
            const websiteId = 'test-website-2';
            const token = 'test-token-456';

            // Set with 100ms TTL
            cache.set(websiteId, token, 100);

            // Should be available immediately
            expect(cache.get(websiteId)).toBe(token);

            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 150));

            // Should be expired
            expect(cache.get(websiteId)).toBeNull();
        });

        it('should clear all cache entries', () => {
            cache.set('site-1', 'token-1');
            cache.set('site-2', 'token-2');

            expect(cache.size()).toBe(2);

            cache.clear();

            expect(cache.size()).toBe(0);
            expect(cache.get('site-1')).toBeNull();
            expect(cache.get('site-2')).toBeNull();
        });

        it('should delete specific cache entries', () => {
            cache.set('site-1', 'token-1');
            cache.set('site-2', 'token-2');

            cache.delete('site-1');

            expect(cache.get('site-1')).toBeNull();
            expect(cache.get('site-2')).toBe('token-2');
        });

        it('should cleanup expired entries', async () => {
            // Set entries with short TTL
            cache.set('site-1', 'token-1', 50);
            cache.set('site-2', 'token-2', 50);
            cache.set('site-3', 'token-3', 10000); // Long TTL

            expect(cache.size()).toBe(3);

            // Wait for some to expire
            await new Promise(resolve => setTimeout(resolve, 100));

            // Run cleanup
            cache.cleanup();

            // Only the long TTL entry should remain
            expect(cache.size()).toBe(1);
            expect(cache.get('site-3')).toBe('token-3');
        });
    });

    describe('EncryptionPerformanceMonitor', () => {
        let monitor: EncryptionPerformanceMonitor;

        beforeEach(() => {
            monitor = new EncryptionPerformanceMonitor();
        });

        afterEach(() => {
            monitor.reset();
        });

        it('should record encryption operations', () => {
            monitor.recordOperation('encrypt', 5.2, true);
            monitor.recordOperation('encrypt', 3.8, true);

            const metrics = monitor.getMetrics('encrypt');

            expect(metrics.count).toBe(2);
            expect(metrics.avgLatency).toBeCloseTo(4.5, 1);
            expect(metrics.successRate).toBe(1);
            expect(metrics.failureRate).toBe(0);
        });

        it('should record decryption operations', () => {
            monitor.recordOperation('decrypt', 4.1, true);
            monitor.recordOperation('decrypt', 5.9, true);
            monitor.recordOperation('decrypt', 3.5, false);

            const metrics = monitor.getMetrics('decrypt');

            expect(metrics.count).toBe(3);
            expect(metrics.avgLatency).toBeCloseTo(4.5, 1);
            expect(metrics.successRate).toBeCloseTo(0.667, 2);
            expect(metrics.failureRate).toBeCloseTo(0.333, 2);
        });

        it('should track min and max latency', () => {
            monitor.recordOperation('encrypt', 2.5, true);
            monitor.recordOperation('encrypt', 8.3, true);
            monitor.recordOperation('encrypt', 4.7, true);

            const metrics = monitor.getMetrics('encrypt');

            expect(metrics.minLatency).toBe(2.5);
            expect(metrics.maxLatency).toBe(8.3);
        });

        it('should record migration attempts', () => {
            monitor.recordMigration(true, false);
            monitor.recordMigration(true, false);
            monitor.recordMigration(false, false);
            monitor.recordMigration(true, true); // Skipped

            const metrics = monitor.getMigrationMetrics();

            expect(metrics.totalAttempts).toBe(4);
            expect(metrics.successfulMigrations).toBe(2);
            expect(metrics.failedMigrations).toBe(1);
            expect(metrics.skippedMigrations).toBe(1);
            expect(metrics.successRate).toBeCloseTo(0.667, 2);
        });

        it('should return all metrics', () => {
            monitor.recordOperation('encrypt', 5, true);
            monitor.recordOperation('decrypt', 4, true);
            monitor.recordMigration(true, false);

            const allMetrics = monitor.getAllMetrics();

            expect(allMetrics.encryption.count).toBe(1);
            expect(allMetrics.decryption.count).toBe(1);
            expect(allMetrics.migration.totalAttempts).toBe(1);
        });

        it('should reset all metrics', () => {
            monitor.recordOperation('encrypt', 5, true);
            monitor.recordOperation('decrypt', 4, true);
            monitor.recordMigration(true, false);

            monitor.reset();

            const allMetrics = monitor.getAllMetrics();

            expect(allMetrics.encryption.count).toBe(0);
            expect(allMetrics.decryption.count).toBe(0);
            expect(allMetrics.migration.totalAttempts).toBe(0);
        });

        it('should handle zero operations gracefully', () => {
            const metrics = monitor.getMetrics('encrypt');

            expect(metrics.count).toBe(0);
            expect(metrics.avgLatency).toBe(0);
            expect(metrics.successRate).toBe(0);
            expect(metrics.failureRate).toBe(0);
        });
    });
});
