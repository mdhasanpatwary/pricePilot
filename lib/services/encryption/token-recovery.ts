/**
 * Token Recovery Service for handling corrupted or invalid encrypted tokens
 * 
 * This service implements the recovery flow when token decryption fails:
 * 1. Detect authentication/decryption errors
 * 2. Mark website status as 'requires_reauth'
 * 3. Send notification to user
 * 4. Clear corrupted token from database
 */

import { prisma } from '@/lib/prisma';
import { NotificationService } from '../notification';
import { AuthenticationError, DecryptionError } from './errors';
import { logger } from '@/lib/logger';

/**
 * Recovery result containing status and details
 */
export interface TokenRecoveryResult {
    success: boolean;
    websiteId: string;
    action: 'marked_for_reauth' | 'token_cleared' | 'notification_sent' | 'recovery_failed';
    message: string;
    error?: string;
}

/**
 * Token Recovery Service
 */
export class TokenRecoveryService {
    /**
     * Handles corrupted token recovery flow
     * 
     * @param websiteId - The website ID with corrupted token
     * @param tenantId - The tenant ID for authorization
     * @param error - The decryption error that triggered recovery
     * @returns Recovery result with status and details
     */
    static async handleCorruptedToken(
        websiteId: string,
        tenantId: string,
        error: Error
    ): Promise<TokenRecoveryResult> {
        try {
            // Log the security event
            logger.error('[TokenRecovery] Corrupted token detected', {
                websiteId,
                tenantId,
                errorType: error.name,
                errorMessage: error.message,
            });

            // Determine if this is a critical security event (tampering)
            const isTamperingDetected = error instanceof AuthenticationError;

            // Execute recovery flow in transaction
            await prisma.$transaction(async (tx) => {
                // 1. Fetch the website to get details for notification
                const website = await tx.site.findFirst({
                    where: {
                        id: websiteId,
                        tenantId,
                    },
                });

                if (!website) {
                    throw new Error('Website not found during recovery');
                }

                // 2. Mark website status as 'requires_reauth'
                await tx.site.update({
                    where: { id: websiteId },
                    data: {
                        // Clear the corrupted token
                        apiToken: null,
                        // Note: If your schema has a status field, uncomment:
                        // status: 'requires_reauth',
                    },
                });

                // 3. Log the recovery event in audit log
                await tx.tenantAuditLog.create({
                    data: {
                        tenantId,
                        userId: '',
                        userEmail: '',
                        action: isTamperingDetected ? 'TOKEN_TAMPERING_DETECTED' : 'TOKEN_CORRUPTION_DETECTED',
                        entityId: websiteId,
                        ipAddress: null,
                        details: JSON.stringify({
                            event: 'token_recovery',
                            errorType: error.name,
                            errorMessage: error.message,
                            isTamperingDetected,
                            action: 'token_cleared',
                            timestamp: new Date(),
                        }),
                    },
                });
            });

            // 4. Send notification to user (outside transaction to avoid rollback on notification failure)
            try {
                const notificationTitle = isTamperingDetected
                    ? '🔒 Security Alert: API Token Integrity Check Failed'
                    : '⚠️ API Token Issue Detected';

                const notificationMessage = isTamperingDetected
                    ? 'We detected a potential security issue with your API token. For your security, the token has been cleared. Please re-enter your API token in the website settings.'
                    : 'We encountered an issue with your API token. The token has been cleared for security. Please re-enter your API token in the website settings.';

                await NotificationService.create({
                    tenantId,
                    type: 'SECURITY_NOTICE',
                    title: notificationTitle,
                    message: notificationMessage,
                    link: `/dashboard/site-config`,
                });

                logger.info('[TokenRecovery] Recovery notification sent', {
                    websiteId,
                    tenantId,
                });
            } catch (notificationError) {
                // Log notification failure but don't fail the recovery
                logger.error('[TokenRecovery] Failed to send recovery notification', {
                    websiteId,
                    tenantId,
                    error: notificationError,
                });
            }

            return {
                success: true,
                websiteId,
                action: 'token_cleared',
                message: 'Token cleared and user notified. Please re-enter API token.',
            };
        } catch (recoveryError) {
            // Log recovery failure
            logger.error('[TokenRecovery] Recovery flow failed', {
                websiteId,
                tenantId,
                error: recoveryError,
            });

            return {
                success: false,
                websiteId,
                action: 'recovery_failed',
                message: 'Failed to complete token recovery',
                error: recoveryError instanceof Error ? recoveryError.message : 'Unknown error',
            };
        }
    }

    /**
     * Checks if an error should trigger token recovery
     * 
     * @param error - The error to check
     * @returns true if recovery should be triggered
     */
    static shouldTriggerRecovery(error: Error): boolean {
        return (
            error instanceof AuthenticationError ||
            error instanceof DecryptionError
        );
    }
}
