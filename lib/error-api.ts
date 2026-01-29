import { NextRequest, NextResponse } from "next/server";
import { logger } from "./logger";
import { AppError } from "./utils/error-handler";
import { ErrorLogger } from "./utils/error-logger";
import { ErrorSanitizer } from "./utils/error-sanitizer";

/**
 * Standard API error response format
 */
export interface ApiErrorResponse {
  error: string;
  details?: string;
  code?: string;
  digest?: string;
}

// Initialize error handling components
const errorSanitizer = new ErrorSanitizer();
const errorLogger = new ErrorLogger(logger, errorSanitizer);

/**
 * Higher-order function to wrap API handlers with error catching and logging.
 * This ensures no API route crashes the process and all errors are logged consistently.
 * 
 * Enhanced to support the new AppError hierarchy while maintaining backward compatibility.
 */
export function withErrorHandling(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    try {
      return await handler(req, ...args);
    } catch (error) {
      // Convert to AppError if not already
      let appError: AppError;

      if (error instanceof AppError) {
        // Already an AppError, use as-is
        appError = error;

        // Add request context if missing
        if (!appError.context.requestId) {
          appError.context.requestId = req.headers.get('x-request-id') ||
            Math.random().toString(36).substring(2, 10).toUpperCase();
        }
      } else {
        // Wrap non-AppError errors
        const digest = Math.random().toString(36).substring(2, 10).toUpperCase();

        appError = new AppError(
          error instanceof Error ? error.message : String(error),
          500,
          'INTERNAL_SERVER_ERROR',
          {
            userMessage: 'An unexpected server error occurred',
            developerMessage: error instanceof Error ? error.message : String(error),
            cause: error instanceof Error ? error : undefined,
            context: {
              requestId: req.headers.get('x-request-id') || digest,
              operation: 'api_request',
              metadata: {
                url: req.url,
                method: req.method,
              },
            },
          }
        );
      }

      // Log the error using the new error logger
      errorLogger.logError(appError);

      // Build response
      const response: ApiErrorResponse = {
        error: appError.userMessage,
        code: appError.errorCode,
        digest: appError.context.requestId,
      };

      // Show more details in development
      if (process.env.NODE_ENV === "development" && appError.developerMessage) {
        response.details = appError.developerMessage;
      }

      return NextResponse.json(response, { status: appError.statusCode });
    }
  };
}

/**
 * Create a specialized error response
 */
export function apiError(
  message: string,
  status: number = 400,
  code?: string,
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code: code || "BAD_REQUEST",
    } as ApiErrorResponse,
    { status },
  );
}
