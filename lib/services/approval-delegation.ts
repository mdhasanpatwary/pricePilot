/**
 * Approval Delegation Service
 * 
 * Handles delegation of price approval authority from one user to another.
 * Useful for vacation coverage, team collaboration, and workflow flexibility.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface DelegationParams {
    tenantId: string;
    fromUserId: string;
    toUserId: string;
    startDate: Date;
    endDate: Date;
}

export interface DelegationInfo {
    id: string;
    fromUser: {
        id: string;
        name: string | null;
        email: string;
    };
    toUser: {
        id: string;
        name: string | null;
        email: string;
    };
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    createdAt: Date;
}

export class ApprovalDelegationService {
    /**
     * Check if a user can approve price changes
     * Returns true if:
     * 1. User is an ADMIN or EDITOR in their tenant
     * 2. User has an active delegation from another user
     */
    static async canApprove(userId: string, tenantId: string): Promise<boolean> {
        try {
            // Check user's own role
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, tenantId: true }
            });

            if (!user || user.tenantId !== tenantId) {
                return false;
            }

            // ADMIN and EDITOR roles can always approve
            if (user.role === 'ADMIN' || user.role === 'EDITOR') {
                return true;
            }

            // Check if user has active delegation
            const now = new Date();
            const delegation = await prisma.approvalDelegation.findFirst({
                where: {
                    tenantId,
                    toUserId: userId,
                    isActive: true,
                    startDate: { lte: now },
                    endDate: { gte: now }
                }
            });

            return !!delegation;
        } catch (error) {
            logger.error('Error checking approval permission', { error, userId, tenantId });
            return false;
        }
    }

    /**
     * Create a new delegation
     * Allows fromUser to delegate their approval authority to toUser
     */
    static async createDelegation(params: DelegationParams): Promise<DelegationInfo> {
        const { tenantId, fromUserId, toUserId, startDate, endDate } = params;

        // Validate dates
        if (startDate >= endDate) {
            throw new Error('Start date must be before end date');
        }

        if (endDate < new Date()) {
            throw new Error('End date must be in the future');
        }

        // Validate users exist and belong to tenant
        const [fromUser, toUser] = await Promise.all([
            prisma.user.findUnique({
                where: { id: fromUserId },
                select: { id: true, name: true, email: true, tenantId: true, role: true }
            }),
            prisma.user.findUnique({
                where: { id: toUserId },
                select: { id: true, name: true, email: true, tenantId: true }
            })
        ]);

        if (!fromUser || fromUser.tenantId !== tenantId) {
            throw new Error('From user not found or does not belong to tenant');
        }

        if (!toUser || toUser.tenantId !== tenantId) {
            throw new Error('To user not found or does not belong to tenant');
        }

        // Only ADMIN and EDITOR can delegate
        if (fromUser.role !== 'ADMIN' && fromUser.role !== 'EDITOR') {
            throw new Error('Only ADMIN and EDITOR users can delegate approval authority');
        }

        // Cannot delegate to yourself
        if (fromUserId === toUserId) {
            throw new Error('Cannot delegate to yourself');
        }

        // Create delegation
        const delegation = await prisma.approvalDelegation.create({
            data: {
                tenantId,
                fromUserId,
                toUserId,
                startDate,
                endDate,
                isActive: true
            },
            include: {
                fromUser: {
                    select: { id: true, name: true, email: true }
                },
                toUser: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        logger.info('Delegation created', {
            delegationId: delegation.id,
            fromUserId,
            toUserId,
            tenantId,
            startDate,
            endDate
        });

        // Send email notification to the delegate
        try {
            const { mailService } = await import('@/lib/mail');
            await mailService.sendDelegationNotification(
                toUser.email,
                toUser.name,
                fromUser.name,
                startDate,
                endDate
            );
        } catch (error) {
            // Log error but don't fail the delegation creation
            logger.error('Failed to send delegation notification email', { error, delegationId: delegation.id });
        }

        return {
            id: delegation.id,
            fromUser: delegation.fromUser,
            toUser: delegation.toUser,
            startDate: delegation.startDate,
            endDate: delegation.endDate,
            isActive: delegation.isActive,
            createdAt: delegation.createdAt
        };
    }

    /**
     * Get all delegations for a tenant
     */
    static async getDelegations(tenantId: string): Promise<DelegationInfo[]> {
        const delegations = await prisma.approvalDelegation.findMany({
            where: { tenantId },
            include: {
                fromUser: {
                    select: { id: true, name: true, email: true }
                },
                toUser: {
                    select: { id: true, name: true, email: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return delegations.map(d => ({
            id: d.id,
            fromUser: d.fromUser,
            toUser: d.toUser,
            startDate: d.startDate,
            endDate: d.endDate,
            isActive: d.isActive,
            createdAt: d.createdAt
        }));
    }

    /**
     * Get active delegations for a specific user (where they are the delegate)
     */
    static async getActiveDelegationsForUser(userId: string, tenantId: string): Promise<DelegationInfo[]> {
        const now = new Date();

        const delegations = await prisma.approvalDelegation.findMany({
            where: {
                tenantId,
                toUserId: userId,
                isActive: true,
                startDate: { lte: now },
                endDate: { gte: now }
            },
            include: {
                fromUser: {
                    select: { id: true, name: true, email: true }
                },
                toUser: {
                    select: { id: true, name: true, email: true }
                }
            },
            orderBy: { startDate: 'asc' }
        });

        return delegations.map(d => ({
            id: d.id,
            fromUser: d.fromUser,
            toUser: d.toUser,
            startDate: d.startDate,
            endDate: d.endDate,
            isActive: d.isActive,
            createdAt: d.createdAt
        }));
    }

    /**
     * Revoke a delegation
     */
    static async revokeDelegation(delegationId: string, tenantId: string): Promise<void> {
        const delegation = await prisma.approvalDelegation.findUnique({
            where: { id: delegationId }
        });

        if (!delegation) {
            throw new Error('Delegation not found');
        }

        if (delegation.tenantId !== tenantId) {
            throw new Error('Delegation does not belong to tenant');
        }

        await prisma.approvalDelegation.update({
            where: { id: delegationId },
            data: { isActive: false }
        });

        logger.info('Delegation revoked', { delegationId, tenantId });
    }

    /**
     * Update delegation dates
     */
    static async updateDelegation(
        delegationId: string,
        tenantId: string,
        startDate: Date,
        endDate: Date
    ): Promise<DelegationInfo> {
        // Validate dates
        if (startDate >= endDate) {
            throw new Error('Start date must be before end date');
        }

        const delegation = await prisma.approvalDelegation.findUnique({
            where: { id: delegationId }
        });

        if (!delegation) {
            throw new Error('Delegation not found');
        }

        if (delegation.tenantId !== tenantId) {
            throw new Error('Delegation does not belong to tenant');
        }

        const updated = await prisma.approvalDelegation.update({
            where: { id: delegationId },
            data: { startDate, endDate },
            include: {
                fromUser: {
                    select: { id: true, name: true, email: true }
                },
                toUser: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        logger.info('Delegation updated', { delegationId, tenantId, startDate, endDate });

        return {
            id: updated.id,
            fromUser: updated.fromUser,
            toUser: updated.toUser,
            startDate: updated.startDate,
            endDate: updated.endDate,
            isActive: updated.isActive,
            createdAt: updated.createdAt
        };
    }

    /**
     * Clean up expired delegations (can be run as a cron job)
     */
    static async cleanupExpiredDelegations(): Promise<number> {
        const now = new Date();

        const result = await prisma.approvalDelegation.updateMany({
            where: {
                isActive: true,
                endDate: { lt: now }
            },
            data: { isActive: false }
        });

        logger.info('Expired delegations cleaned up', { count: result.count });

        return result.count;
    }
}
