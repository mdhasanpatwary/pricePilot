/**
 * Error Handling System for PricePilot
 * 
 * This module provides a comprehensive error handling framework with:
 * - Hierarchical error classes for different scenarios
 * - Rich context capture (tenantId, userId, operation, etc.)
 * - User-friendly and developer messages
 * - Retry metadata for transient failures
 * - Serialization for API responses and logging
 */

import { getUserMessage, getDeveloperMessage, type MessageVariables } from './error-messages';

/**
 * Error context metadata captured with every error
 */
export interface ErrorContext {
    tenantId?: string;
    userId?: string;
    operation?: string;
    requestId?: string;
    timestamp: string;
    metadata?: Record<string, any>;
}

/**
 * Options for creating an AppError
 */
export interface ErrorOptions {
    userMessage?: string;
    developerMessage?: string;
    context?: Partial<ErrorContext>;
    cause?: Error;
    /** 
     * Indicates if this error represents a transient failure that can be retried.
     * Defaults to false for most errors.
     * Set to true for network timeouts, rate limits, and temporary service unavailability.
     */
    isRetryable?: boolean;
    /**
     * Recommended delay in seconds before retrying the operation.
     * Only applicable when isRetryable is true.
     */
    retryAfter?: number;
    /**
     * Variables to use for message template formatting
     */
    messageVariables?: MessageVariables;
}

/**
 * Base application error class
 * All application-specific errors should extend this class
 * 
 * Retry Behavior:
 * - By default, errors are NOT retryable (isRetryable = false)
 * - RateLimitError is automatically retryable with backoff
 * - ExternalServiceError can be marked retryable for transient failures
 * - Set isRetryable: true and optionally retryAfter in options for custom retry behavior
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly errorCode: string;
    public readonly userMessage: string;
    public readonly developerMessage?: string;
    public readonly context: ErrorContext;
    public readonly cause?: Error;
    /** Indicates if this error can be retried. Defaults to false. */
    public readonly isRetryable: boolean;
    /** Recommended delay in seconds before retrying. Only set when isRetryable is true. */
    public readonly retryAfter?: number;
    /** Variables used for message template formatting */
    protected readonly messageVariables?: MessageVariables;

    constructor(
        message: string,
        statusCode: number,
        errorCode: string,
        options?: ErrorOptions
    ) {
        super(message);

        // Maintain proper prototype chain for instanceof checks
        Object.setPrototypeOf(this, new.target.prototype);

        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.messageVariables = options?.messageVariables;

        // Use custom message if provided, otherwise use template
        this.userMessage = options?.userMessage || this.getDefaultUserMessage();

        // Use custom developer message if provided, otherwise use template
        this.developerMessage = options?.developerMessage || this.getDefaultDeveloperMessage();

        this.cause = options?.cause;
        this.isRetryable = options?.isRetryable ?? false;
        this.retryAfter = options?.retryAfter;

        // Build error context
        this.context = {
            timestamp: new Date().toISOString(),
            ...options?.context,
        };

        // Capture stack trace
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Get default user-friendly message for this error type
     */
    protected getDefaultUserMessage(): string {
        return getUserMessage(this.errorCode, this.messageVariables);
    }

    /**
     * Get default developer message for this error type
     */
    protected getDefaultDeveloperMessage(): string | undefined {
        return getDeveloperMessage(this.errorCode, this.messageVariables);
    }

    /**
     * Serialize error for API response
     */
    toJSON(): {
        success: false;
        error: {
            code: string;
            message: string;
            details?: any;
        };
        meta: {
            requestId?: string;
            timestamp: string;
        };
    } {
        return {
            success: false,
            error: {
                code: this.errorCode,
                message: this.userMessage,
                details: this.getErrorDetails(),
            },
            meta: {
                requestId: this.context.requestId,
                timestamp: this.context.timestamp,
            },
        };
    }

    /**
     * Get error-specific details for API response
     */
    protected getErrorDetails(): any {
        return undefined;
    }

    /**
     * Serialize error for logging (includes full context)
     */
    toLogFormat(): {
        level: 'error' | 'warn' | 'info';
        message: string;
        errorCode: string;
        statusCode: number;
        context: ErrorContext;
        stack?: string;
        cause?: any;
        timestamp: string;
    } {
        return {
            level: this.getLogLevel(),
            message: this.message,
            errorCode: this.errorCode,
            statusCode: this.statusCode,
            context: this.context,
            stack: this.stack,
            cause: this.cause ? {
                message: this.cause.message,
                stack: this.cause.stack,
            } : undefined,
            timestamp: this.context.timestamp,
        };
    }

    /**
     * Determine log level based on error severity
     */
    protected getLogLevel(): 'error' | 'warn' | 'info' {
        // Default to error level
        return 'error';
    }
}


/**
 * Validation error for invalid input data
 * HTTP Status: 422 Unprocessable Entity
 * 
 * This error is NOT retryable as it indicates a client error that
 * requires the input to be corrected before retrying.
 */
export class ValidationError extends AppError {
    public readonly fields: Record<string, string[]>;

    constructor(
        message: string,
        fields: Record<string, string[]>,
        options?: ErrorOptions
    ) {
        super(message, 422, 'VALIDATION_ERROR', {
            ...options,
            messageVariables: {
                ...options?.messageVariables,
            },
        });
        this.fields = fields;
    }

    protected getErrorDetails(): any {
        return {
            fields: this.fields,
        };
    }

    protected getLogLevel(): 'error' | 'warn' | 'info' {
        return 'warn';
    }
}

/**
 * Not found error for missing resources
 * HTTP Status: 404 Not Found
 * 
 * This error is NOT retryable as it indicates the resource does not exist.
 */
export class NotFoundError extends AppError {
    public readonly resourceType: string;
    public readonly resourceId: string;

    constructor(
        resourceType: string,
        resourceId: string,
        options?: ErrorOptions
    ) {
        super(
            `${resourceType} with ID ${resourceId} not found`,
            404,
            'NOT_FOUND',
            {
                ...options,
                messageVariables: {
                    resourceType,
                    resourceId,
                    ...options?.messageVariables,
                },
            }
        );
        this.resourceType = resourceType;
        this.resourceId = resourceId;
    }

    protected getErrorDetails(): any {
        return {
            resourceType: this.resourceType,
            resourceId: this.resourceId,
        };
    }

    protected getLogLevel(): 'error' | 'warn' | 'info' {
        return 'warn';
    }
}

/**
 * Unauthorized error for authentication failures
 * HTTP Status: 401 Unauthorized
 * 
 * This error is NOT retryable as it indicates missing or invalid credentials.
 */
export class UnauthorizedError extends AppError {
    constructor(message?: string, options?: ErrorOptions) {
        super(
            message || 'Authentication required',
            401,
            'UNAUTHORIZED',
            options
        );
    }

    protected getLogLevel(): 'error' | 'warn' | 'info' {
        return 'error';
    }
}

/**
 * Forbidden error for authorization failures
 * HTTP Status: 403 Forbidden
 * 
 * This error is NOT retryable as it indicates insufficient permissions.
 */
export class ForbiddenError extends AppError {
    public readonly requiredPermission?: string;

    constructor(
        message?: string,
        requiredPermission?: string,
        options?: ErrorOptions
    ) {
        super(
            message || 'Access forbidden',
            403,
            'FORBIDDEN',
            {
                ...options,
                messageVariables: {
                    requiredPermission,
                    ...options?.messageVariables,
                },
            }
        );
        this.requiredPermission = requiredPermission;
    }

    protected getErrorDetails(): any {
        if (this.requiredPermission) {
            return {
                requiredPermission: this.requiredPermission,
            };
        }
        return undefined;
    }

    protected getLogLevel(): 'error' | 'warn' | 'info' {
        return 'error';
    }
}

/**
 * Conflict error for resource conflicts
 * HTTP Status: 409 Conflict
 * 
 * This error is NOT retryable as it indicates a conflict that must be
 * resolved before the operation can succeed.
 */
export class ConflictError extends AppError {
    public readonly conflictingResource?: string;

    constructor(
        message: string,
        conflictingResource?: string,
        options?: ErrorOptions
    ) {
        super(message, 409, 'CONFLICT', {
            ...options,
            messageVariables: {
                conflictingResource,
                ...options?.messageVariables,
            },
        });
        this.conflictingResource = conflictingResource;
    }

    protected getErrorDetails(): any {
        if (this.conflictingResource) {
            return {
                conflictingResource: this.conflictingResource,
            };
        }
        return undefined;
    }

    protected getLogLevel(): 'error' | 'warn' | 'info' {
        return 'warn';
    }
}

/**
 * Rate limit error for rate limiting violations
 * HTTP Status: 429 Too Many Requests
 * 
 * This error is automatically marked as retryable with a retry delay
 * equal to the rate limit window. The retryAfter value can be overridden
 * in options if a different delay is desired.
 * 
 * Example:
 * ```typescript
 * throw new RateLimitError(100, 3600); // 100 requests per hour
 * // Automatically sets: isRetryable=true, retryAfter=3600
 * ```
 */
export class RateLimitError extends AppError {
    public readonly limit: number;
    public readonly windowSeconds: number;

    constructor(
        limit: number,
        windowSeconds: number,
        options?: ErrorOptions
    ) {
        super(
            `Rate limit exceeded: ${limit} requests per ${windowSeconds} seconds`,
            429,
            'RATE_LIMIT_EXCEEDED',
            {
                ...options,
                isRetryable: true,
                retryAfter: options?.retryAfter ?? windowSeconds,
                messageVariables: {
                    limit,
                    windowSeconds,
                    ...options?.messageVariables,
                },
            }
        );
        this.limit = limit;
        this.windowSeconds = windowSeconds;
    }

    protected getErrorDetails(): any {
        return {
            limit: this.limit,
            windowSeconds: this.windowSeconds,
            retryAfter: this.retryAfter,
        };
    }

    protected getLogLevel(): 'error' | 'warn' | 'info' {
        return 'warn';
    }
}

/**
 * External service error for third-party API failures
 * HTTP Status: 502 Bad Gateway
 * 
 * This error is used when external API calls fail. Transient failures
 * (network timeouts, temporary service unavailability) should be marked
 * as retryable by setting isRetryable: true in options.
 * 
 * Example:
 * ```typescript
 * throw new ExternalServiceError(
 *   'OpenCart',
 *   'Failed to fetch products',
 *   {
 *     isRetryable: true,
 *     retryAfter: 60,
 *     cause: originalError
 *   }
 * );
 * ```
 */
export class ExternalServiceError extends AppError {
    public readonly serviceName: string;
    public readonly serviceStatusCode?: number;

    constructor(
        serviceName: string,
        message: string,
        options?: ErrorOptions & { serviceStatusCode?: number }
    ) {
        super(
            message,
            502,
            'EXTERNAL_SERVICE_ERROR',
            {
                ...options,
                messageVariables: {
                    serviceName,
                    serviceStatusCode: options?.serviceStatusCode,
                    ...options?.messageVariables,
                },
            }
        );
        this.serviceName = serviceName;
        this.serviceStatusCode = options?.serviceStatusCode;
    }

    protected getErrorDetails(): any {
        return {
            serviceName: this.serviceName,
            serviceStatusCode: this.serviceStatusCode,
            isRetryable: this.isRetryable,
            retryAfter: this.retryAfter,
        };
    }

    protected getLogLevel(): 'error' | 'warn' | 'info' {
        return 'error';
    }
}
