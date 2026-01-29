/**
 * Global Error Handler Middleware for PricePilot
 * 
 * This module provides centralized error handling for Next.js API routes with:
 * - Standardized error response format
 * - Automatic error logging with sanitization
 * - Development vs production mode support
 * - Request ID tracking
 * - HTTP status code mapping
 * - Non-AppError wrapping
 * 
 * Requirements: 7.1-7.12
 */

import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '../utils/error-handler';
import { ErrorLogger, defaultErrorLogger } from '../utils/error-logger';

/**
 * Standardized error response format
 */
export interface ErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: any;
    };
    meta: {
        requestId: string;
        timestamp: string;
    };
}

/**
 * GlobalErrorHandler class
 * Handles all errors in API routes with consistent formatting and logging
 */
export class GlobalErrorHandler {
    private readonly errorLogger: ErrorLogger;
    private readonly isDevelopment: boolean;

    constructor(
        errorLogger: ErrorLogger = defaultErrorLogger,
        isDevelopment: boolean = process.env.NODE_ENV !== 'production'
    ) {
        this.errorLogger = errorLogger;
        this.isDevelopment = isDevelopment;
    }

    /**
     * Handle error and return appropriate NextResponse
     * This is the main entry point for error handling
     * 
     * @param error - The error to handle
     * @param req - The Next.js request object
     * @returns NextResponse with error details
     */
    handleError(error: Error, req: NextRequest): NextResponse {
        try {
            // Wrap non-AppError errors
            const appError = error instanceof AppError
                ? error
                : this.wrapError(error);

            // Add request context if missing
            if (!appError.context.requestId) {
                // Generate request ID if not present
                const requestId = this.getRequestId(req);
                appError.context.requestId = requestId;
            }

            // Log error before sending response (Requirement 7.12)
            try {
                // Extract IP address and user agent for audit logging
                const requestInfo = {
                    ip: this.getIpAddress(req),
                    userAgent: req.headers.get('user-agent') || undefined,
                };
                this.errorLogger.logError(appError, requestInfo);
            } catch (logError) {
                // Fallback to console if logging fails
                console.error('Failed to log error:', logError);
                console.error('Original error:', appError);
            }

            // Transform to error response
            const response = this.toErrorResponse(appError, appError.context.requestId!);

            // Create NextResponse with appropriate status code
            return NextResponse.json(response, {
                status: appError.statusCode,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Request-ID': appError.context.requestId!,
                },
            });
        } catch (handlerError) {
            // Last resort fallback
            console.error('Critical error in error handler:', handlerError);
            console.error('Original error:', error);

            // Return minimal error response
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INTERNAL_ERROR',
                        message: 'An unexpected error occurred',
                    },
                    meta: {
                        requestId: this.getRequestId(req),
                        timestamp: new Date().toISOString(),
                    },
                } as ErrorResponse,
                {
                    status: 500,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );
        }
    }

    /**
     * Transform AppError to standardized error response
     * 
     * @param error - The AppError to transform
     * @param requestId - The request ID for tracking
     * @returns Standardized error response object
     */
    private toErrorResponse(error: AppError, requestId: string): ErrorResponse {
        // Use the error's toJSON method to get the base response
        const errorJson = error.toJSON();

        const response: ErrorResponse = {
            success: false,
            error: {
                code: errorJson.error.code,
                message: errorJson.error.message,
                details: errorJson.error.details,
            },
            meta: {
                requestId,
                timestamp: errorJson.meta.timestamp,
            },
        };

        // Add developer message in development mode (Requirement 4.6, 4.7)
        if (this.isDevelopment && error.developerMessage) {
            response.error.details = {
                ...response.error.details,
                developerMessage: error.developerMessage,
                stack: error.stack,
            };
        }

        return response;
    }

    /**
     * Wrap non-AppError errors into AppError
     * 
     * @param error - The error to wrap
     * @returns AppError instance
     */
    private wrapError(error: Error): AppError {
        // Create a generic AppError with the original error as cause
        return new AppError(
            error.message || 'An unexpected error occurred',
            500,
            'INTERNAL_ERROR',
            {
                cause: error,
                context: {
                    operation: 'unknown',
                },
                developerMessage: this.isDevelopment ? error.stack : undefined,
            }
        );
    }

    /**
     * Extract or generate request ID from request
     * 
     * @param req - The Next.js request object
     * @returns Request ID string
     */
    private getRequestId(req: NextRequest): string {
        // Try to get request ID from headers
        const headerRequestId = req.headers.get('x-request-id') ||
            req.headers.get('x-correlation-id');

        if (headerRequestId) {
            return headerRequestId;
        }

        // Generate new request ID
        return crypto.randomUUID();
    }

    /**
     * Extract IP address from request
     * 
     * @param req - The Next.js request object
     * @returns IP address string or undefined
     */
    private getIpAddress(req: NextRequest): string | undefined {
        // Check x-forwarded-for header (common in proxied environments)
        const forwarded = req.headers.get('x-forwarded-for');
        if (forwarded) {
            return forwarded.split(',')[0].trim();
        }

        // Check x-real-ip header
        const realIp = req.headers.get('x-real-ip');
        if (realIp) {
            return realIp;
        }

        // Note: NextRequest doesn't have an 'ip' property directly
        // In production, IP should be extracted from headers
        return undefined;
    }
}

/**
 * Default singleton instance of GlobalErrorHandler
 */
export const defaultGlobalErrorHandler = new GlobalErrorHandler();

/**
 * Middleware wrapper for Next.js API routes
 * Wraps a handler function with error handling
 * 
 * Usage:
 * ```typescript
 * export async function GET(req: NextRequest) {
 *   return withGlobalErrorHandler(req, async (req) => {
 *     // Your handler logic here
 *     return NextResponse.json({ data: 'success' });
 *   });
 * }
 * ```
 * 
 * @param req - The Next.js request object
 * @param handler - The handler function to wrap
 * @param errorHandler - Optional custom error handler instance
 * @returns Promise<NextResponse>
 */
export async function withGlobalErrorHandler(
    req: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>,
    errorHandler: GlobalErrorHandler = defaultGlobalErrorHandler
): Promise<NextResponse> {
    try {
        return await handler(req);
    } catch (error) {
        return errorHandler.handleError(
            error instanceof Error ? error : new Error(String(error)),
            req
        );
    }
}

/**
 * Enhanced version of the existing withErrorHandling wrapper
 * This maintains backward compatibility while using the new error handling system
 * 
 * Usage:
 * ```typescript
 * export async function POST(req: NextRequest) {
 *   return withRateLimit(req, 'write', withErrorHandling(handlePOST));
 * }
 * ```
 * 
 * @param handler - The handler function to wrap
 * @param errorHandler - Optional custom error handler instance
 * @returns Wrapped handler function
 */
export function withErrorHandling(
    handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
    errorHandler: GlobalErrorHandler = defaultGlobalErrorHandler
): (req: NextRequest, ...args: any[]) => Promise<NextResponse> {
    return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
        try {
            return await handler(req, ...args);
        } catch (error) {
            return errorHandler.handleError(
                error instanceof Error ? error : new Error(String(error)),
                req
            );
        }
    };
}
