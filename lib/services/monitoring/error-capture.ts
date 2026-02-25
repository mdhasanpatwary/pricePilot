/**
 * Error Capture Service with Sentry Integration
 *
 * This service provides comprehensive error capture with:
 * - Sentry integration for error tracking
 * - Context extraction (userId, tenantId, requestId, endpoint)
 * - Sensitive data sanitization
 * - Graceful degradation when Sentry is unavailable
 * - Error grouping and frequency tracking
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import * as Sentry from '@sentry/nextjs';
import { logger } from '@/lib/logger';

/**
 * Error context information
 */
export interface ErrorContext {
    userId?: string;
    tenantId?: string;
    requestId: string;
    endpoint: string;
    method: string;
    statusCode?: number;
    additionalData?: Record<string, any>;
}

/**
 * Sensitive data patterns to sanitize
 */
const SENSITIVE_PATTERNS = {
    // Password patterns
    password: /password|passwd|pwd/i,
    // Token patterns
    token: /token|jwt|bearer|authorization/i,
    // API key patterns
    apiKey: /api[_-]?key|apikey|api[_-]?secret/i,
    // Credit card patterns (basic detection)
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
    // CVV patterns
    cvv: /\bcvv\b|\bcvc\b|\bsecurity[_-]?code\b/i,
    // SSN patterns
    ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/,
    // Email in some contexts
    sensitiveEmail: /email.*password|password.*email/i,
};

/**
 * Fields that should always be sanitized
 */
const SENSITIVE_FIELDS = [
    'password',
    'passwordHash',
    'passwd',
    'pwd',
    'token',
    'apiToken',
    'apiKey',
    'api_key',
    'apiSecret',
    'api_secret',
    'secret',
    'encryptionKey',
    'encryption_key',
    'privateKey',
    'private_key',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'bearerToken',
    'bearer_token',
    'authorization',
    'creditCard',
    'credit_card',
    'cardNumber',
    'card_number',
    'cvv',
    'cvc',
    'securityCode',
    'security_code',
    'ssn',
    'socialSecurity',
    'social_security',
];

/**
 * ErrorCaptureMiddleware interface
 */
export interface ErrorCaptureMiddleware {
    captureError(error: Error, context: ErrorContext): Promise<void>;
    captureException(exception: unknown, context: ErrorContext): Promise<void>;
    setUserContext(userId: string, tenantId: string): void;
}

/**
 * ErrorCaptureService implementation
 */
export class ErrorCaptureService implements ErrorCaptureMiddleware {
    private sentryAvailable: boolean;
    private readonly isDevelopment: boolean;
    private errorGroupingCache: Map<string, number>;

    constructor(forceSentryAvailable?: boolean) {
        this.sentryAvailable = forceSentryAvailable !== undefined
            ? forceSentryAvailable
            : this.checkSentryAvailability();
        this.isDevelopment = process.env.NODE_ENV !== 'production';
        this.errorGroupingCache = new Map();
    }

    /**
     * Check if Sentry is available and configured
     * Requirement 1.5: Graceful degradation when Sentry is unavailable
     */
    private checkSentryAvailability(): boolean {
        try {
            const dsn = process.env.SENTRY_DSN;
            const enabled = process.env.SENTRY_ENABLED !== 'false';

            // Check if Sentry is available
            if (!dsn || !enabled) {
                return false;
            }

            // Try to access Sentry to verify it's loaded (guarded with any to satisfy typing)
            if (typeof (Sentry as any).getCurrentHub === 'function') {
                return true;
            }

            return false;
        } catch (error) {
            logger.warn('Sentry is not available, falling back to local logging', {
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }

    /**
     * Capture an error with full context
     * Requirements: 1.1, 1.2, 1.3
     *
     * @param error - The error to capture
     * @param context - Error context information
     */
    async captureError(error: Error, context: ErrorContext): Promise<void> {
        try {
            // Sanitize error message and stack trace (Requirement 1.3)
            const sanitizedError = this.sanitizeError(error);

            // Extract and sanitize context (Requirement 1.2)
            const sanitizedContext = this.sanitizeContext(context);

            // Track error frequency for grouping (Requirement 1.4)
            this.trackErrorFrequency(error, context);

            // Attempt to send to Sentry if available (Requirement 1.1)
            if (this.sentryAvailable) {
                await this.sendToSentry(sanitizedError, sanitizedContext);
            } else {
                // Fallback to local logging (Requirement 1.5)
                const fingerprint = this.generateErrorFingerprint(error, context);
                const frequency = this.errorGroupingCache.get(fingerprint) || 1;
                // Update cache for grouping frequency (non-blocking)
                this.errorGroupingCache.set(fingerprint, frequency + 1);
                this.logLocally(sanitizedError, sanitizedContext);
            }
        } catch (captureError) {
            // Ensure error capture failures don't break the application
            logger.error('Failed to capture error', {
                captureError: captureError instanceof Error ? captureError.message : String(captureError),
                originalError: error.message,
            });
        }
    }

    /**
     * Capture an exception (unknown type)
     * Requirements: 1.1, 1.2, 1.3
     *
     * @param exception - The exception to capture
     * @param context - Error context information
     */
    async captureException(exception: unknown, context: ErrorContext): Promise<void> {
        try {
            // Convert exception to Error if it's not already
            const error = exception instanceof Error
                ? exception
                : new Error(String(exception));

            await this.captureError(error, context);
        } catch (captureError) {
            logger.error('Failed to capture exception', {
                captureError: captureError instanceof Error ? captureError.message : String(captureError),
            });
        }
    }

    /**
     * Set user context for subsequent error captures
     * Requirement 1.2: Include context data
     *
     * @param userId - The user ID
     * @param tenantId - The tenant ID
     */
    setUserContext(userId: string, tenantId: string): void {
        try {
            if (this.sentryAvailable) {
                Sentry.setUser({
                    id: userId,
                    // Store tenantId in custom field
                    tenantId: tenantId,
                });

                Sentry.setTag('tenantId', tenantId);
            }
        } catch (error) {
            logger.warn('Failed to set user context in Sentry', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Sanitize error object to remove sensitive data
     * Requirement 1.3: Exclude sensitive data
     *
     * @param error - The error to sanitize
     * @returns Sanitized error
     */
    private sanitizeError(error: Error): Error {
        const sanitizedError = new Error(this.sanitizeString(error.message));
        sanitizedError.name = error.name;
        sanitizedError.stack = error.stack ? this.sanitizeString(error.stack) : undefined;

        return sanitizedError;
    }

    /**
     * Sanitize context object to remove sensitive data
     * Requirement 1.3: Exclude sensitive data
     *
     * @param context - The context to sanitize
     * @returns Sanitized context
     */
    private sanitizeContext(context: ErrorContext): ErrorContext {
        const sanitized: ErrorContext = {
            userId: context.userId,
            tenantId: context.tenantId,
            requestId: context.requestId,
            endpoint: context.endpoint,
            method: context.method,
            statusCode: context.statusCode,
        };

        // Sanitize additional data if present
        if (context.additionalData) {
            sanitized.additionalData = this.sanitizeObject(context.additionalData);
        }

        return sanitized;
    }

    /**
     * Sanitize a string by removing sensitive patterns
     * Requirement 1.3: Exclude sensitive data
     *
     * @param str - The string to sanitize
     * @returns Sanitized string
     */
    private sanitizeString(str: string): string {
        let sanitized = str;

        // Replace credit card numbers
        sanitized = sanitized.replace(SENSITIVE_PATTERNS.creditCard, '[REDACTED_CARD]');

        // Replace SSN
        sanitized = sanitized.replace(SENSITIVE_PATTERNS.ssn, '[REDACTED_SSN]');

        return sanitized;
    }

    /**
     * Sanitize an object by removing sensitive fields
     * Requirement 1.3: Exclude sensitive data
     *
     * @param obj - The object to sanitize
     * @returns Sanitized object
     */
    private sanitizeObject(obj: Record<string, any>): Record<string, any> {
        const sanitized: Record<string, any> = {};

        for (const [key, value] of Object.entries(obj)) {
            // Check if field name is sensitive
            if (this.isSensitiveField(key)) {
                sanitized[key] = '[REDACTED]';
                continue;
            }

            // Recursively sanitize nested objects
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                sanitized[key] = this.sanitizeObject(value);
            } else if (Array.isArray(value)) {
                sanitized[key] = value.map(item =>
                    item && typeof item === 'object' ? this.sanitizeObject(item) : item
                );
            } else if (typeof value === 'string') {
                sanitized[key] = this.sanitizeString(value);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    /**
     * Check if a field name is sensitive
     * Requirement 1.3: Exclude sensitive data
     *
     * @param fieldName - The field name to check
     * @returns True if the field is sensitive
     */
    private isSensitiveField(fieldName: string): boolean {
        const lowerFieldName = fieldName.toLowerCase();
        return SENSITIVE_FIELDS.some(sensitive =>
            lowerFieldName.includes(sensitive.toLowerCase())
        );
    }

    /**
     * Track error frequency for grouping
     * Requirement 1.4: Track error frequency and group similar errors
     *
     * @param error - The error to track
     * @param context - Error context
     */
    private trackErrorFrequency(error: Error, context: ErrorContext): void {
        try {
            // Create a fingerprint for error grouping
            const fingerprint = this.generateErrorFingerprint(error, context);

            // Increment frequency counter
            const currentCount = this.errorGroupingCache.get(fingerprint) || 0;
            this.errorGroupingCache.set(fingerprint, currentCount + 1);

            // Clean up old entries (keep last 1000)
            if (this.errorGroupingCache.size > 1000) {
                const firstKey = this.errorGroupingCache.keys().next().value;
                if (firstKey) {
                    this.errorGroupingCache.delete(firstKey);
                }
            }
        } catch (trackingError) {
            // Don't let tracking errors break error capture
            logger.warn('Failed to track error frequency', {
                error: trackingError instanceof Error ? trackingError.message : String(trackingError),
            });
        }
    }

    /**
     * Generate a fingerprint for error grouping
     * Requirement 1.4: Group similar errors together
     *
     * @param error - The error
     * @param context - Error context
     * @returns Error fingerprint
     */
    private generateErrorFingerprint(error: Error, context: ErrorContext): string {
        // Combine error type, message pattern, and endpoint
        const messagePattern = error.message.substring(0, 50); // First 50 chars
        const stackPattern = error.stack?.split('\n')[1]?.trim() || ''; // First stack frame

        return `${error.name}:${messagePattern}:${stackPattern}:${context.endpoint}`;
    }

    /**
     * Send error to Sentry
     * Requirement 1.1: Capture error details and send to Sentry
     *
     * @param error - The sanitized error
     * @param context - The sanitized context
     */
    private async sendToSentry(error: Error, context: ErrorContext): Promise<void> {
        try {
            // Set context tags
            Sentry.setTag('endpoint', context.endpoint);
            Sentry.setTag('method', context.method);
            if (context.tenantId) {
                Sentry.setTag('tenantId', context.tenantId);
            }

            // Set context data
            Sentry.setContext('request', {
                requestId: context.requestId,
                endpoint: context.endpoint,
                method: context.method,
                statusCode: context.statusCode,
            });

            if (context.userId) {
                Sentry.setUser({
                    id: context.userId,
                    tenantId: context.tenantId,
                });
            }

            // Add additional data as extras
            if (context.additionalData) {
                Sentry.setExtras(context.additionalData);
            }

            // Get error frequency for grouping
            const fingerprint = this.generateErrorFingerprint(error, context);
            const frequency = this.errorGroupingCache.get(fingerprint) || 1;

            // Set fingerprint for grouping (Sentry API may differ by version — guard with any)
            if (typeof (Sentry as any).setFingerprint === 'function') {
                (Sentry as any).setFingerprint([fingerprint]);
            }

            // Add frequency as extra data (use setExtra if available)
            if (typeof (Sentry as any).setExtra === 'function') {
                (Sentry as any).setExtra('errorFrequency', frequency);
            }

            // Capture the exception
            Sentry.captureException(error);

            // Flush to ensure it's sent (with timeout)
            await Sentry.flush(2000);
        } catch (sentryError) {
            // If Sentry fails, mark it as unavailable and fall back to local logging
            this.sentryAvailable = false;
            logger.warn('Sentry error capture failed, falling back to local logging', {
                error: sentryError instanceof Error ? sentryError.message : String(sentryError),
            });
            this.logLocally(error, context);
        }
    }

    /**
     * Log error locally when Sentry is unavailable
     * Requirement 1.5: Log errors locally when Sentry is unavailable
     *
     * @param error - The sanitized error
     * @param context - The sanitized context
     */
    private logLocally(error: Error, context: ErrorContext): void {
        const fingerprint = this.generateErrorFingerprint(error, context);
        const frequency = this.errorGroupingCache.get(fingerprint) || 1;

        logger.error('Application error captured (Sentry unavailable)', {
            errorName: error.name,
            errorMessage: error.message,
            errorStack: this.isDevelopment ? error.stack : undefined,
            context: {
                userId: context.userId,
                tenantId: context.tenantId,
                requestId: context.requestId,
                endpoint: context.endpoint,
                method: context.method,
                statusCode: context.statusCode,
            },
            errorFrequency: frequency,
            errorFingerprint: fingerprint,
            additionalData: context.additionalData,
        });
    }
}

/**
 * Default singleton instance of ErrorCaptureService
 */
// Lazy proxy avoids import-time side effects in build/dev workers.
let errorCaptureInstance: ErrorCaptureService | null = null;
export const defaultErrorCaptureService = new Proxy({} as ErrorCaptureService, {
    get(_target, property) {
        if (!errorCaptureInstance) {
            errorCaptureInstance = new ErrorCaptureService();
        }
        const value = (errorCaptureInstance as any)[property];
        return typeof value === "function" ? value.bind(errorCaptureInstance) : value;
    },
});

/**
 * Helper function to extract error context from Next.js request
 *
 * @param req - Next.js request object
 * @param error - The error that occurred
 * @returns Error context
 */
export function extractErrorContext(
    req: any,
    error: Error
): ErrorContext {
    return {
        requestId: req.headers?.get?.('x-request-id') || crypto.randomUUID(),
        endpoint: req.url || req.nextUrl?.pathname || 'unknown',
        method: req.method || 'unknown',
        statusCode: error instanceof Error && 'statusCode' in error
            ? (error as any).statusCode
            : 500,
        userId: (req as any).user?.id,
        tenantId: (req as any).user?.tenantId,
        additionalData: {
            userAgent: req.headers?.get?.('user-agent'),
            referer: req.headers?.get?.('referer'),
        },
    };
}
