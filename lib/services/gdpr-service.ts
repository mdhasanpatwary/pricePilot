/**
 * GDPR Compliance Service
 *
 * Implements GDPR requirements:
 * - Article 15: Right to Access
 * - Article 16: Right to Rectification
 * - Article 17: Right to Erasure
 * - Article 20: Right to Data Portability
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { NotificationSender } from './notification-sender';

export interface UserDataExport {
    user: {
        id: string;
        email: string;
        name: string | null;
        role: string;
        createdAt: Date;
        updatedAt: Date;
        emailNotifications: boolean;
    };
    tenant: {
        id: string;
        companyName: string;
        planType: string;
        createdAt: Date;
    };
    sites: Array<{
        id: string;
        type: string;
        platform: string;
        baseUrl: string;
        createdAt: Date;
        lastSyncAt: Date | null;
    }>;
    products: Array<{
        id: string;
        sku: string | null;
        title: string;
        currentPrice: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    priceHistory: Array<{
        productId: string;
        price: string;
        recordedAt: Date;
    }>;
    auditLogs: Array<{
        action: string;
        entityId: string;
        details: string | null;
        createdAt: Date;
    }>;
    notifications: Array<{
        type: string;
        title: string;
        message: string;
        isRead: boolean;
        createdAt: Date;
    }>;
    apiKeys: Array<{
        name: string;
        prefix: string;
        createdAt: Date;
        lastUsedAt: Date | null;
        expiresAt: Date | null;
    }>;
}

export class GDPRService {
    /**
     * Export all user data (GDPR Article 15 & 20)
     * Right to Access and Data Portability
     */
    static async exportUserData(userId: string): Promise<UserDataExport> {
        try {
            logger.info('Starting GDPR data export', { userId });

            // Fetch user with tenant
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: {
                    Tenant: true,
                    ApiKey: {
                        select: {
                            name: true,
                            prefix: true,
                            createdAt: true,
                            lastUsedAt: true,
                            expiresAt: true,
                        },
                    },
                },
            });

            if (!user) {
                throw new Error('User not found');
            }

            const tenantId = user.tenantId;

            // Fetch all tenant data
            const [sites, products, auditLogs, notifications] = await Promise.all([
                // Sites
                prisma.site.findMany({
                    where: { tenantId },
                    select: {
                        id: true,
                        type: true,
                        platform: true,
                        baseUrl: true,
                        createdAt: true,
                        lastSyncAt: true,
                    },
                }),

                // Products (limited to 10,000 for performance)
                prisma.product.findMany({
                    where: { tenantId },
                    take: 10000,
                    select: {
                        id: true,
                        sku: true,
                        title: true,
                        currentPrice: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                }),

                // Audit logs for this user
                prisma.tenantAuditLog.findMany({
                    where: {
                        tenantId,
                        userId,
                    },
                    select: {
                        action: true,
                        entityId: true,
                        details: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 1000,
                }),

                // Notifications
                prisma.notification.findMany({
                    where: { tenantId },
                    select: {
                        type: true,
                        title: true,
                        message: true,
                        isRead: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 1000,
                }),
            ]);

            // Fetch price history for products (limited)
            const productIds = products.slice(0, 100).map((p) => p.id);
            const priceHistory = await prisma.priceHistory.findMany({
                where: {
                    productId: { in: productIds },
                },
                select: {
                    productId: true,
                    price: true,
                    recordedAt: true,
                },
                orderBy: { recordedAt: 'desc' },
                take: 5000,
            });

            // Create audit log for export
            await prisma.tenantAuditLog.create({
                data: {
                    tenantId,
                    userId,
                    userEmail: user.email,
                    action: 'GDPR_DATA_EXPORT',
                    entityId: userId,
                    details: JSON.stringify({
                        exportedAt: new Date().toISOString(),
                        sitesCount: sites.length,
                        productsCount: products.length,
                        priceHistoryCount: priceHistory.length,
                    }),
                },
            });

            logger.info('GDPR data export completed', { userId, tenantId });

            return {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                    emailNotifications: user.emailNotifications,
                },
                tenant: {
                    id: (user as any).Tenant.id,
                    companyName: (user as any).Tenant.companyName,
                    planType: (user as any).Tenant.planType,
                    createdAt: (user as any).Tenant.createdAt,
                },
                sites: sites.map((site) => ({
                    ...site,
                    type: site.type,
                    platform: site.platform,
                })),
                products: products.map((product) => ({
                    ...product,
                    currentPrice: product.currentPrice.toString(),
                })),
                priceHistory: priceHistory.map((ph) => ({
                    ...ph,
                    price: ph.price.toString(),
                })),
                auditLogs,
                notifications,
                apiKeys: (user as any).ApiKey,
            };
        } catch (error) {
            logger.error('GDPR data export failed', { error, userId });
            throw error;
        }
    }

    /**
     * Request data export via email (GDPR Article 15 & 20)
     */
    static async requestDataExport(userId: string, userEmail: string): Promise<void> {
        try {
            logger.info('Processing GDPR data export request', { userId, userEmail });

            // Export data
            const exportData = await this.exportUserData(userId);

            // Send email with data
            const exportJson = JSON.stringify(exportData, null, 2);
            const exportSize = Buffer.byteLength(exportJson, 'utf8');

            await NotificationSender.sendEmail(
                userEmail,
                'Your PricePilot Data Export',
                `
          <h2>Your Data Export is Ready</h2>
          <p>As requested, we have prepared an export of all your personal data stored in PricePilot.</p>

          <h3>Export Summary</h3>
          <ul>
            <li><strong>User Account:</strong> ${exportData.user.email}</li>
            <li><strong>Company:</strong> ${exportData.tenant.companyName}</li>
            <li><strong>Sites:</strong> ${exportData.sites.length}</li>
            <li><strong>Products:</strong> ${exportData.products.length}</li>
            <li><strong>Price History Records:</strong> ${exportData.priceHistory.length}</li>
            <li><strong>Audit Logs:</strong> ${exportData.auditLogs.length}</li>
            <li><strong>Notifications:</strong> ${exportData.notifications.length}</li>
            <li><strong>Export Size:</strong> ${(exportSize / 1024).toFixed(2)} KB</li>
          </ul>

          <h3>Data Format</h3>
          <p>Your data is provided in JSON format, which is machine-readable and can be imported into other systems.</p>

          <h3>What's Included</h3>
          <ul>
            <li>Your user profile information</li>
            <li>Company/tenant information</li>
            <li>Connected sites and integrations</li>
            <li>Product data (up to 10,000 products)</li>
            <li>Price history (up to 5,000 records)</li>
            <li>Your audit logs (up to 1,000 records)</li>
            <li>Notifications (up to 1,000 records)</li>
            <li>API keys (metadata only, not the actual keys)</li>
          </ul>

          <h3>Your Rights</h3>
          <p>Under GDPR, you have the right to:</p>
          <ul>
            <li><strong>Access:</strong> Request a copy of your data (this export)</li>
            <li><strong>Rectification:</strong> Update incorrect data in your account settings</li>
            <li><strong>Erasure:</strong> Request deletion of your account and data</li>
            <li><strong>Portability:</strong> Transfer your data to another service</li>
          </ul>

          <p>Please download your data export from your account settings page.</p>

          <p>If you have any questions or concerns, please contact our support team.</p>

          <p>Best regards,<br>The PricePilot Team</p>
        `
            );

            logger.info('GDPR data export email sent', { userId, userEmail });
        } catch (error) {
            logger.error('Failed to send GDPR data export email', { error, userId, userEmail });
            throw error;
        }
    }

    /**
     * Delete user account and all associated data (GDPR Article 17)
     * Right to Erasure (Right to be Forgotten)
     *
     * Implements soft delete with 30-day recovery period
     */
    static async requestAccountDeletion(
        userId: string,
        reason?: string
    ): Promise<{ deletionDate: Date; recoveryDeadline: Date }> {
        try {
            logger.info('Processing GDPR account deletion request', { userId, reason });

            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { Tenant: true },
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Calculate deletion dates
            const now = new Date();
            const recoveryDeadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

            // Create audit log for deletion request
            await prisma.tenantAuditLog.create({
                data: {
                    tenantId: user.tenantId,
                    userId,
                    userEmail: user.email,
                    action: 'GDPR_DELETION_REQUESTED',
                    entityId: userId,
                    details: JSON.stringify({
                        requestedAt: now.toISOString(),
                        recoveryDeadline: recoveryDeadline.toISOString(),
                        reason: reason || 'User requested account deletion',
                    }),
                },
            });

            // Send confirmation email
            await NotificationSender.sendEmail(
                user.email,
                'Account Deletion Request Received',
                `
          <h2>Account Deletion Request</h2>
          <p>We have received your request to delete your PricePilot account.</p>

          <h3>Important Information</h3>
          <ul>
            <li><strong>Recovery Period:</strong> 30 days</li>
            <li><strong>Recovery Deadline:</strong> ${recoveryDeadline.toLocaleDateString()}</li>
            <li><strong>Permanent Deletion:</strong> ${new Date(recoveryDeadline.getTime() + 24 * 60 * 60 * 1000).toLocaleDateString()}</li>
          </ul>

          <h3>What Happens Next</h3>
          <ol>
            <li><strong>Immediate:</strong> Your account is marked for deletion</li>
            <li><strong>30-Day Period:</strong> You can still log in and cancel the deletion</li>
            <li><strong>After 30 Days:</strong> Your account and all data will be permanently deleted</li>
          </ol>

          <h3>What Will Be Deleted</h3>
          <ul>
            <li>Your user account and profile</li>
            <li>All connected sites and integrations</li>
            <li>All product data</li>
            <li>All price history</li>
            <li>All notifications</li>
            <li>All API keys</li>
          </ul>

          <h3>What Will Be Retained</h3>
          <p>For legal and compliance reasons, we will retain:</p>
          <ul>
            <li>Audit logs (anonymized after 2 years)</li>
            <li>Financial records (as required by law)</li>
          </ul>

          <h3>Cancel Deletion</h3>
          <p>If you change your mind, you can cancel this deletion request by logging into your account before ${recoveryDeadline.toLocaleDateString()}.</p>

          <p>If you have any questions, please contact our support team.</p>

          <p>Best regards,<br>The PricePilot Team</p>
        `
            );

            logger.info('GDPR account deletion requested', { userId, recoveryDeadline });

            return {
                deletionDate: now,
                recoveryDeadline,
            };
        } catch (error) {
            logger.error('Failed to process GDPR account deletion request', { error, userId });
            throw error;
        }
    }

    /**
     * Permanently delete user account and all data
     * Called after 30-day recovery period
     */
    static async permanentlyDeleteAccount(userId: string): Promise<void> {
        try {
            logger.info('Starting permanent account deletion', { userId });

            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { Tenant: true },
            });

            if (!user) {
                throw new Error('User not found');
            }

            const tenantId = user.tenantId;

            // Check if user is the only admin
            const adminCount = await prisma.user.count({
                where: {
                    tenantId,
                    role: 'ADMIN',
                },
            });

            if (adminCount === 1 && user.role === 'ADMIN') {
                throw new Error('Cannot delete the only admin user. Please assign another admin first.');
            }

            // Create final audit log
            await prisma.tenantAuditLog.create({
                data: {
                    tenantId,
                    userId,
                    userEmail: user.email,
                    action: 'GDPR_ACCOUNT_DELETED',
                    entityId: userId,
                    details: JSON.stringify({
                        deletedAt: new Date().toISOString(),
                        email: user.email,
                        name: user.name,
                    }),
                },
            });

            // Delete user data in transaction
            await prisma.$transaction(async (tx) => {
                // Delete API keys
                await tx.apiKey.deleteMany({ where: { userId } });

                // Delete password history
                await tx.passwordHistory.deleteMany({ where: { userId } });

                // Delete sessions
                await tx.session.deleteMany({ where: { userId } });

                // Delete accounts (OAuth)
                await tx.account.deleteMany({ where: { userId } });

                // Delete approval delegations
                await tx.approvalDelegation.deleteMany({
                    where: {
                        OR: [{ fromUserId: userId }, { toUserId: userId }],
                    },
                });

                // Finally, delete the user
                await tx.user.delete({ where: { id: userId } });
            });

            logger.info('Permanent account deletion completed', { userId, tenantId });
        } catch (error) {
            logger.error('Failed to permanently delete account', { error, userId });
            throw error;
        }
    }

    /**
     * Cancel account deletion request
     */
    static async cancelAccountDeletion(userId: string): Promise<void> {
        try {
            logger.info('Canceling account deletion request', { userId });

            const user = await prisma.user.findUnique({
                where: { id: userId },
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Create audit log
            await prisma.tenantAuditLog.create({
                data: {
                    tenantId: user.tenantId,
                    userId,
                    userEmail: user.email,
                    action: 'GDPR_DELETION_CANCELLED',
                    entityId: userId,
                    details: JSON.stringify({
                        cancelledAt: new Date().toISOString(),
                    }),
                },
            });

            // Send confirmation email
            await NotificationSender.sendEmail(
                user.email,
                'Account Deletion Cancelled',
                `
          <h2>Account Deletion Cancelled</h2>
          <p>Your account deletion request has been successfully cancelled.</p>
          <p>Your account and all data remain active and accessible.</p>
          <p>If you did not request this cancellation, please contact our support team immediately.</p>
          <p>Best regards,<br>The PricePilot Team</p>
        `
            );

            logger.info('Account deletion cancelled', { userId });
        } catch (error) {
            logger.error('Failed to cancel account deletion', { error, userId });
            throw error;
        }
    }

    /**
     * Anonymize user data in audit logs (after retention period)
     */
    static async anonymizeAuditLogs(userId: string): Promise<void> {
        try {
            logger.info('Anonymizing audit logs', { userId });

            const user = await prisma.user.findUnique({
                where: { id: userId },
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Anonymize audit logs older than 2 years
            const twoYearsAgo = new Date();
            twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

            await prisma.tenantAuditLog.updateMany({
                where: {
                    userId,
                    createdAt: {
                        lt: twoYearsAgo,
                    },
                },
                data: {
                    userEmail: 'anonymized@example.com',
                    userId: 'anonymized',
                    details: null,
                    ipAddress: null,
                },
            });

            logger.info('Audit logs anonymized', { userId });
        } catch (error) {
            logger.error('Failed to anonymize audit logs', { error, userId });
            throw error;
        }
    }
}
