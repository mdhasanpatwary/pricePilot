/**
 * Error Handler for encryption-related errors in API endpoints
 * 
 * Provides consistent error handling and response formatting for
 * encryption/decryption errors across the application.
 */

import { NextResponse } from 'next/server';
import {
    EncryptionError,
    DecryptionError,
    AuthenticationError,
    InvalidFormatError,
    KeyNotFoundError,
    KeyValidationError,
    getStructuredErrorMessage,
    sanitizeErrorMessage,
} from './errors';
import { logger } from '@/lib/logger';

/**
 * Error response structure for API endpoints
 */
export interface ErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        guidance?: string;
        action?: string;
        link?: string;
    };
    meta: {
        requestId?: string;
        timestamp: string;
    };
}

/**
 * Handles encryption-related errors and returns appropriate HTTP response
 * 
 * @param error - The error to handle
 * @param context - Additional context for logging (websiteId, tenantId, etc.)
 * @returns NextResponse with appropriate status code and error message
 */
export function handleEncryptionError(
    error: Error,
    context?: {
        websiteId?: string;
        tenantId?: string;
        userId?: string;
        requestId?: string;
    }
): NextResponse<ErrorResponse> {
    // Sanitize error message to prevent sensitive data exposure
    const sanitizedMessage = sanitizeErrorMessage(error);

    // Get structured error message
    const structuredError = getStructuredErrorMessage(error);

    // Log the error with context
    logger.error('[EncryptionErrorHandler] Error occurred', {
        errorType: error.name,
        errorMessage: sanitizedMessage,
        ...context,
    });

    // Determine HTTP status code based on error type
    let statusCode = 500;
    let errorCode = 'INTERNAL_SERVER_ERROR';

    if (error instanceof AuthenticationError) {
        statusCode = 401;
        errorCode = 'AUTHENTICATION_FAILED';
    } else if (error instanceof DecryptionError) {
        statusCode = 500;
        errorCode = 'DECRYPTION_FAILED';
    } else if (error instanceof EncryptionError) {
        statusCode = 500;
        errorCode = 'ENCRYPTION_FAILED';
    } else if (error instanceof KeyNotFoundError || error instanceof KeyValidationError) {
        statusCode = 503;
        errorCode = 'SERVICE_UNAVAILABLE';
    } else if (error instanceof InvalidFormatError) {
        statusCode = 400;
        errorCode = 'INVALID_FORMAT';
    }

    // Build error response
    const errorResponse: ErrorResponse = {
        success: false,
        error: {
            code: errorCode,
            message: structuredError.message,
            guidance: structuredError.guidance,
            action: structuredError.action,
            link: structuredError.link,
        },
        meta: {
            requestId: context?.requestId,
            timestamp: new Date().toISOString(),
        },
    };

    return NextResponse.json(errorResponse, { status: statusCode });
}

/**
 * Wraps an async API handler with encryption error handling
 * 
 * @param handler - The async handler function to wrap
 * @returns Wrapped handler with error handling
 */
export function withEncryptionErrorHandling<T>(
    handler: () => Promise<T>
): Promise<T | NextResponse<ErrorResponse>> {
    return handler().catch((error) => {
        // Check if this is an encryption-related error
        if (
            error instanceof EncryptionError ||
            error instanceof DecryptionError ||
            error instanceof AuthenticationError ||
            error instanceof InvalidFormatError ||
            error instanceof KeyNotFoundError ||
            error instanceof KeyValidationError
        ) {
            return handleEncryptionError(error);
        }

        // Re-throw non-encryption errors
        throw error;
    });
}

/**
 * Formats an error for display in the UI
 * 
 * @param error - The error to format
 * @returns Formatted error object for UI display
 */
export function formatErrorForUI(error: Error): {
    title: string;
    message: string;
    guidance: string;
    action: string;
    link?: string;
    severity: 'info' | 'warning' | 'critical';
} {
    const structured = getStructuredErrorMessage(error);

    return {
        title: structured.title,
        message: structured.message,
        guidance: structured.guidance,
        action: structured.action,
        link: structured.link,
        severity: structured.severity || 'warning',
    };
}

/**
 * Checks if an error is recoverable (user can fix it)
 * 
 * @param error - The error to check
 * @returns true if the error is recoverable by user action
 */
export function isRecoverableError(error: Error): boolean {
    return (
        error instanceof DecryptionError ||
        error instanceof AuthenticationError ||
        error instanceof InvalidFormatError
    );
}

/**
 * Checks if an error is a system error (requires admin intervention)
 * 
 * @param error - The error to check
 * @returns true if the error requires system administrator intervention
 */
export function isSystemError(error: Error): boolean {
    return (
        error instanceof KeyNotFoundError ||
        error instanceof KeyValidationError
    );
}
