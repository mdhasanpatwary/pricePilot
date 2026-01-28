/**
 * Audit logging for encryption operations
 * Ensures comprehensive tracking of all encryption-related events
 * while maintaining security by never logging sensitive data
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

/**
 * Encryption audit event types
 */
export type EncryptionAuditEvent =
    | 'TOKEN_ENCRYPTED'
    | 'TOKEN_DECRYPTED'
    | 'TOKEN_MIGRATED'
    | 'DECRYPTION_FAILED'
    | 'KEY_ACCESSED'
    | 'KEY_VALIDATED'
    | 'ENCRYPTION_FAILED'
    | 'KEY_ROTATED';

/**
 * Audit log entry structure for encryption events
 */
interface EncryptionAuditLogEntry {
    event: EncryptionAuditEvent;
    tenantId?: string;
    userId?: string;
    websiteId?: string;
    purpose?: string;
    operation?: string;
    success: boolean;
    errorType?: string;
    errorMessage?: string;
    timestamp: Date;
}

/**
 * Logs when an API token is encrypted
 * @param tenantId - Tenant ID
 * @param userId - User ID who initiated the action
 * @param websiteId - Website ID for which token was encrypted
 */
export async function logTokenEncrypted(
    tenantId: string,
    userId: string,
    websiteId: string
): Promise<void> {
    try {
        const entry: EncryptionAuditLogEntry = {
            event: 'TOKEN_ENCRYPTED',
            tenantId,
            userId,
            websiteId,
            success: true,
            timestamp: new Date(),
        };

        // Log to application logger
        logger.info('API token encrypted', {
            event: entry.event,
            tenantId,
            userId,
            websiteId,
        });

        // Store in database audit log
        await prisma.tenantAuditLog.create({
            data: {
                tenantId,
                userId,
                userEmail: 'system@pricepilot.ai', // Will be updated when user context is available
                action: 'TOKEN_ENCRYPTED',
                entityId: websiteId,
                details: JSON.stringify({
                    event: entry.event,
                    timestamp: entry.timestamp.toISOString(),
                }),
            },
        });
    } catch (error) {
        // Audit logging failures should not break the application
        logger.error('Failed to log token encryption event', {
            error: error instanceof Error ? error.message : 'Unknown error',
            tenantId,
            websiteId,
        });
    }
}

/**
 * Logs when an API token is decrypted
 * @param tenantId - Tenant ID
 * @param websiteId - Website ID for which token was decrypted
 * @param purpose - Purpose of decryption (e.g., 'product_sync', 'api_call')
 */
export async function logTokenDecrypted(
    tenantId: string,
    websiteId: string,
    purpose: string
): Promise<void> {
    try {
        const entry: EncryptionAuditLogEntry = {
            event: 'TOKEN_DECRYPTED',
            tenantId,
            websiteId,
            purpose,
            success: true,
            timestamp: new Date(),
        };

        // Log to application logger
        logger.info('API token decrypted', {
            event: entry.event,
            tenantId,
            websiteId,
            purpose,
        });

        // Store in database audit log
        await prisma.tenantAuditLog.create({
            data: {
                tenantId,
                userId: 'SYSTEM',
                userEmail: 'system@pricepilot.ai',
                action: 'TOKEN_DECRYPTED',
                entityId: websiteId,
                details: JSON.stringify({
                    event: entry.event,
                    purpose,
                    timestamp: entry.timestamp.toISOString(),
                }),
            },
        });
    } catch (error) {
        // Audit logging failures should not break the application
        logger.error('Failed to log token decryption event', {
            error: error instanceof Error ? error.message : 'Unknown error',
            tenantId,
            websiteId,
        });
    }
}

/**
 * Logs when a plaintext token is migrated to encrypted format
 * @param tenantId - Tenant ID
 * @param websiteId - Website ID for which token was migrated
 */
export async function logTokenMigrated(
    tenantId: string,
    websiteId: string
): Promise<void> {
    try {
        const entry: EncryptionAuditLogEntry = {
            event: 'TOKEN_MIGRATED',
            tenantId,
            websiteId,
            success: true,
            timestamp: new Date(),
        };

        // Log to application logger
        logger.info('Plaintext token migrated to encrypted format', {
            event: entry.event,
            tenantId,
            websiteId,
        });

        // Store in database audit log
        await prisma.tenantAuditLog.create({
            data: {
                tenantId,
                userId: 'SYSTEM',
                userEmail: 'system@pricepilot.ai',
                action: 'TOKEN_MIGRATED',
                entityId: websiteId,
                details: JSON.stringify({
                    event: entry.event,
                    timestamp: entry.timestamp.toISOString(),
                }),
            },
        });
    } catch (error) {
        // Audit logging failures should not break the application
        logger.error('Failed to log token migration event', {
            error: error instanceof Error ? error.message : 'Unknown error',
            tenantId,
            websiteId,
        });
    }
}

/**
 * Logs when token decryption fails
 * @param tenantId - Tenant ID
 * @param websiteId - Website ID for which decryption failed
 * @param error - Error that occurred during decryption
 */
export async function logDecryptionFailed(
    tenantId: string,
    websiteId: string,
    error: Error
): Promise<void> {
    try {
        const entry: EncryptionAuditLogEntry = {
            event: 'DECRYPTION_FAILED',
            tenantId,
            websiteId,
            success: false,
            errorType: error.name,
            errorMessage: error.message,
            timestamp: new Date(),
        };

        // Log to application logger (security event)
        logger.error('Token decryption failed - security event', {
            event: entry.event,
            tenantId,
            websiteId,
            errorType: error.name,
            errorMessage: error.message,
        });

        // Store in database audit log
        await prisma.tenantAuditLog.create({
            data: {
                tenantId,
                userId: 'SYSTEM',
                userEmail: 'system@pricepilot.ai',
                action: 'DECRYPTION_FAILED',
                entityId: websiteId,
                details: JSON.stringify({
                    event: entry.event,
                    errorType: error.name,
                    errorMessage: error.message,
                    timestamp: entry.timestamp.toISOString(),
                }),
            },
        });
    } catch (logError) {
        // Audit logging failures should not break the application
        logger.error('Failed to log decryption failure event', {
            error: logError instanceof Error ? logError.message : 'Unknown error',
            tenantId,
            websiteId,
        });
    }
}

/**
 * Logs when the encryption key is accessed
 * @param operation - Operation that accessed the key (e.g., 'encrypt', 'decrypt', 'validate')
 */
export function logKeyAccessed(operation: string): void {
    try {
        const entry: EncryptionAuditLogEntry = {
            event: 'KEY_ACCESSED',
            operation,
            success: true,
            timestamp: new Date(),
        };

        // Log to application logger only (no tenant context for key access)
        logger.debug('Encryption key accessed', {
            event: entry.event,
            operation,
        });
    } catch (error) {
        // Audit logging failures should not break the application
        logger.error('Failed to log key access event', {
            error: error instanceof Error ? error.message : 'Unknown error',
            operation,
        });
    }
}

/**
 * Logs when the encryption key is validated
 * @param success - Whether validation succeeded
 * @param errorMessage - Error message if validation failed
 */
export function logKeyValidated(success: boolean, errorMessage?: string): void {
    try {
        const entry: EncryptionAuditLogEntry = {
            event: 'KEY_VALIDATED',
            success,
            errorMessage,
            timestamp: new Date(),
        };

        if (success) {
            logger.info('Encryption key validated successfully', {
                event: entry.event,
            });
        } else {
            logger.error('Encryption key validation failed', {
                event: entry.event,
                errorMessage,
            });
        }
    } catch (error) {
        // Audit logging failures should not break the application
        logger.error('Failed to log key validation event', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}

/**
 * Logs when token encryption fails
 * @param tenantId - Tenant ID
 * @param userId - User ID who initiated the action
 * @param websiteId - Website ID for which encryption failed
 * @param error - Error that occurred during encryption
 */
export async function logEncryptionFailed(
    tenantId: string,
    userId: string,
    websiteId: string,
    error: Error
): Promise<void> {
    try {
        const entry: EncryptionAuditLogEntry = {
            event: 'ENCRYPTION_FAILED',
            tenantId,
            userId,
            websiteId,
            success: false,
            errorType: error.name,
            errorMessage: error.message,
            timestamp: new Date(),
        };

        // Log to application logger
        logger.error('Token encryption failed', {
            event: entry.event,
            tenantId,
            userId,
            websiteId,
            errorType: error.name,
            errorMessage: error.message,
        });

        // Store in database audit log
        await prisma.tenantAuditLog.create({
            data: {
                tenantId,
                userId,
                userEmail: 'system@pricepilot.ai',
                action: 'ENCRYPTION_FAILED',
                entityId: websiteId,
                details: JSON.stringify({
                    event: entry.event,
                    errorType: error.name,
                    errorMessage: error.message,
                    timestamp: entry.timestamp.toISOString(),
                }),
            },
        });
    } catch (logError) {
        // Audit logging failures should not break the application
        logger.error('Failed to log encryption failure event', {
            error: logError instanceof Error ? logError.message : 'Unknown error',
            tenantId,
            websiteId,
        });
    }
}

/**
 * Logs when a token is rotated to a new encryption key
 * @param tenantId - Tenant ID
 * @param websiteId - Website ID for which token was rotated
 */
export async function logKeyRotated(
    tenantId: string,
    websiteId: string
): Promise<void> {
    try {
        const entry: EncryptionAuditLogEntry = {
            event: 'KEY_ROTATED',
            tenantId,
            websiteId,
            success: true,
            timestamp: new Date(),
        };

        // Log to application logger
        logger.info('Token rotated to new encryption key', {
            event: entry.event,
            tenantId,
            websiteId,
        });

        // Store in database audit log
        await prisma.tenantAuditLog.create({
            data: {
                tenantId,
                userId: 'SYSTEM',
                userEmail: 'system@pricepilot.ai',
                action: 'KEY_ROTATED',
                entityId: websiteId,
                details: JSON.stringify({
                    event: entry.event,
                    timestamp: entry.timestamp.toISOString(),
                }),
            },
        });
    } catch (error) {
        // Audit logging failures should not break the application
        logger.error('Failed to log key rotation event', {
            error: error instanceof Error ? error.message : 'Unknown error',
            tenantId,
            websiteId,
        });
    }
}
