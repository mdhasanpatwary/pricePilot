/**
 * Error Logging System for PricePilot
 * 
 * This module provides centralized error logging with:
 * - Integration with existing lib/logger.ts
 * - Automatic sanitization of sensitive data
 * - Structured logging with full error context
 * - Severity-based log level mapping
 * - Preservation of original errors for debugging
 * - Security error audit logging
 */

import { logger } from '../logger';
import { AppError, ErrorContext, UnauthorizedError, ForbiddenError } from './error-handler';
import { ErrorSanitizer, defaultSanitizer } from './error-sanitizer';
import { recordAuditLog } from '../audit';

/**
 * Structured log entry format
 */
export interface LogEntry {
    level: 'error' | 'warn' | 'info';
    message: string;
    errorCode: string;
    statusCode: number;
    context: ErrorContext;
    stack?: string;
    cause?: {
        message: string;
        stack?: string;
    };
    timestamp: string;
    environment: 'development' | 'production';
}

/**
 * ErrorLogger class
 * Handles logging of errors with sanitization and structured formatting
 */
export class ErrorLogger {
    private readonly logger: typeof logger;
    private readonly sanitizer: ErrorSanitizer;
    private readonly environment: 'development' | 'production';

    constructor(
        loggerInstance: typeof logger = logger,
        sanitizer: ErrorSanitizer = defaultSanitizer
    ) {
        this.logger = loggerInstance;
        this.sanitizer = sanitizer;
        this.environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    }

    /**
     * Log an error with appropriate level and sanitization
     * Also logs security errors to audit trail
     * @param error - The AppError to log
     * @param request - Optional request object for extracting IP and user agent
     */
    logError(error: AppError, request?: { ip?: string; userAgent?: string }): void {
        try {
            // Format the log entry
            const logEntry = this.formatLogEntry(error);

            // Determine log level
            const level = this.getLogLevel(error);

            // Log using the appropriate level
            switch (level) {
                case 'error':
                    this.logger.error(logEntry.message, this.sanitizeLogContext(logEntry));
                    break;
                case 'warn':
                    this.logger.warn(logEntry.message, this.sanitizeLogContext(logEntry));
                    break;
                case 'info':
                    this.logger.info(logEntry.message, this.sanitizeLogContext(logEntry));
                    break;
            }

            // Log security errors to audit trail
            if (this.isSecurityError(error)) {
                this.logSecurityErrorToAudit(error, request);
            }
        } catch (loggingError) {
            // Fallback to console if logging fails
            console.error('Failed to log error:', loggingError);
            console.error('Original error:', error);
        }
    }

    /**
     * Check if an error is a security-related error
     * @param error - The error to check
     * @returns True if the error is security-related
     */
    private isSecurityError(error: AppError): boolean {
        return error instanceof UnauthorizedError || error instanceof ForbiddenError;
    }

    /**
     * Log security error to audit trail
     * @param error - The security error to log
     * @param request - Optional request object for extracting IP and user agent
     */
    private async logSecurityErrorToAudit(
        error: AppError,
        request?: { ip?: string; userAgent?: string }
    ): Promise<void> {
        try {
            // Extract context information
            const tenantId = error.context.tenantId;
            const userId = error.context.userId;

            // Only log to audit if we have tenant and user context
            if (!tenantId || !userId) {
                // Log warning that we couldn't create audit entry
                this.logger.warn('Security error occurred but missing tenant/user context for audit log', {
                    errorCode: error.errorCode,
                    context: error.context,
                });
                return;
            }

            // Determine action based on error type
            const action = error instanceof UnauthorizedError
                ? 'SECURITY_UNAUTHORIZED_ACCESS'
                : 'SECURITY_FORBIDDEN_ACCESS';

            // Create audit log entry
            await recordAuditLog({
                tenantId,
                userId,
                userEmail: error.context.metadata?.userEmail || 'unknown',
                action,
                entityId: error.context.requestId || 'unknown',
                details: {
                    errorCode: error.errorCode,
                    errorMessage: error.message,
                    operation: error.context.operation,
                    timestamp: error.context.timestamp,
                    userAgent: request?.userAgent,
                    // Include additional context from ForbiddenError
                    ...(error instanceof ForbiddenError && error.requiredPermission
                        ? { requiredPermission: error.requiredPermission }
                        : {}),
                },
                ipAddress: request?.ip,
            });
        } catch (auditError) {
            // Log audit failure but don't throw - audit logging should not break the application
            this.logger.error('Failed to log security error to audit trail', {
                error: auditError,
                originalError: error.errorCode,
            });
        }
    }

    /**
     * Determine log level based on error type and severity
     * @param error - The AppError to evaluate
     * @returns The appropriate log level
     */
    private getLogLevel(error: AppError): 'error' | 'warn' | 'info' {
        // Use the error's built-in log level determination
        const errorLogFormat = error.toLogFormat();
        return errorLogFormat.level;
    }

    /**
     * Format error into structured log entry
     * @param error - The AppError to format
     * @returns Structured log entry
     */
    private formatLogEntry(error: AppError): LogEntry {
        const logFormat = error.toLogFormat();

        return {
            level: logFormat.level,
            message: logFormat.message,
            errorCode: logFormat.errorCode,
            statusCode: logFormat.statusCode,
            context: logFormat.context,
            stack: logFormat.stack,
            cause: logFormat.cause,
            timestamp: logFormat.timestamp,
            environment: this.environment,
        };
    }

    /**
     * Sanitize log context before logging
     * @param logEntry - The log entry to sanitize
     * @returns Sanitized log context
     */
    private sanitizeLogContext(logEntry: LogEntry): Record<string, any> {
        // Create a sanitized copy of the log entry
        const sanitized: Record<string, any> = {
            errorCode: logEntry.errorCode,
            statusCode: logEntry.statusCode,
            environment: logEntry.environment,
            timestamp: logEntry.timestamp,
        };

        // Sanitize context
        if (logEntry.context) {
            sanitized.context = this.sanitizer.sanitizeContext(logEntry.context);
        }

        // Sanitize stack trace (remove sensitive data from error messages in stack)
        if (logEntry.stack) {
            sanitized.stack = this.sanitizer.sanitizeMessage(logEntry.stack);
        }

        // Sanitize cause if present
        if (logEntry.cause) {
            sanitized.cause = {
                message: this.sanitizer.sanitizeMessage(logEntry.cause.message),
                stack: logEntry.cause.stack
                    ? this.sanitizer.sanitizeMessage(logEntry.cause.stack)
                    : undefined,
            };
        }

        return sanitized;
    }
}

/**
 * Default singleton instance of ErrorLogger
 */
export const defaultErrorLogger = new ErrorLogger();

