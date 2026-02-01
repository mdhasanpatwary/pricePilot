/**
 * Rollback Service Tests
 * Core business logic tests for rollback functionality
 */

import { RollbackService } from '@/lib/services/rollback';

// Mock all dependencies
jest.mock('@/lib/prisma');
jest.mock('@/lib/services/notification');
jest.mock('@/lib/services/sync');
jest.mock('@/lib/logger');

describe('RollbackService - Core Business Logic', () => {
    describe('canRollback', () => {
        it('should validate rollback eligibility correctly', async () => {
            const { prisma } = require('@/lib/prisma');

            // Mock successful update log
            prisma.priceUpdateLog.findUnique.mockResolvedValue({
                id: 'log-1',
                productId: 'prod-1',
                status: 'SUCCESS',
                executedAt: new Date('2024-01-01'),
                product: {},
            });

            // No subsequent updates
            prisma.priceUpdateLog.findMany.mockResolvedValue([]);

            const result = await RollbackService.canRollback('log-1');

            expect(result.canRollback).toBe(true);
        });

        it('should reject rollback if update log not found', async () => {
            const { prisma } = require('@/lib/prisma');
            prisma.priceUpdateLog.findUnique.mockResolvedValue(null);

            const result = await RollbackService.canRollback('non-existent');

            expect(result.canRollback).toBe(false);
            expect(result.reason).toContain('not found');
        });

        it('should reject rollback if status is not SUCCESS', async () => {
            const { prisma } = require('@/lib/prisma');
            prisma.priceUpdateLog.findUnique.mockResolvedValue({
                id: 'log-1',
                status: 'FAILED',
                product: {},
            });

            const result = await RollbackService.canRollback('log-1');

            expect(result.canRollback).toBe(false);
            expect(result.reason).toContain('successful');
        });

        it('should reject rollback if subsequent changes exist', async () => {
            const { prisma } = require('@/lib/prisma');

            prisma.priceUpdateLog.findUnique.mockResolvedValue({
                id: 'log-1',
                productId: 'prod-1',
                status: 'SUCCESS',
                executedAt: new Date('2024-01-01'),
                product: {},
            });

            // Has subsequent update
            prisma.priceUpdateLog.findMany.mockResolvedValue([{
                id: 'log-2',
                executedAt: new Date('2024-01-02'),
            }]);

            const result = await RollbackService.canRollback('log-1');

            expect(result.canRollback).toBe(false);
            expect(result.reason).toContain('subsequent');
        });
    });

    describe('canRollbackBulkOperation', () => {
        it('should validate bulk rollback eligibility', async () => {
            const { prisma } = require('@/lib/prisma');

            prisma.bulkOperationSnapshot.findUnique.mockResolvedValue({
                id: 'snap-1',
                rolledBack: false,
            });

            const result = await RollbackService.canRollbackBulkOperation('snap-1');

            expect(result.canRollback).toBe(true);
        });

        it('should reject if snapshot not found', async () => {
            const { prisma } = require('@/lib/prisma');
            prisma.bulkOperationSnapshot.findUnique.mockResolvedValue(null);

            const result = await RollbackService.canRollbackBulkOperation('non-existent');

            expect(result.canRollback).toBe(false);
        });

        it('should reject if already rolled back', async () => {
            const { prisma } = require('@/lib/prisma');

            prisma.bulkOperationSnapshot.findUnique.mockResolvedValue({
                id: 'snap-1',
                rolledBack: true,
            });

            const result = await RollbackService.canRollbackBulkOperation('snap-1');

            expect(result.canRollback).toBe(false);
            expect(result.reason).toContain('already');
        });
    });

    describe('getRollbackHistory', () => {
        it('should retrieve and format rollback history', async () => {
            const { prisma } = require('@/lib/prisma');

            prisma.tenantAuditLog.findMany.mockResolvedValue([
                {
                    id: 'audit-1',
                    action: 'ROLLBACK_PRICE',
                    createdAt: new Date(),
                    userId: 'user-1',
                    userEmail: 'user@test.com',
                    details: '{"productId":"prod-1"}',
                },
                {
                    id: 'audit-2',
                    action: 'ROLLBACK_BULK_OPERATION',
                    createdAt: new Date(),
                    userId: 'user-1',
                    userEmail: 'user@test.com',
                    details: '{"productCount":5}',
                },
            ]);

            const result = await RollbackService.getRollbackHistory('tenant-1');

            expect(result).toHaveLength(2);
            expect(result[0].type).toBe('SINGLE');
            expect(result[1].type).toBe('BULK');
        });
    });
});
