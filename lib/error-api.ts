import { NextRequest, NextResponse } from "next/server";
import { logger } from "./logger";

/**
 * Standard API error response format
 */
export interface ApiErrorResponse {
  error: string;
  details?: string;
  code?: string;
  digest?: string;
}

/**
 * Higher-order function to wrap API handlers with error catching and logging.
 * This ensures no API route crashes the process and all errors are logged consistently.
 */
export function withErrorHandling(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    try {
      return await handler(req, ...args);
    } catch (error) {
      const digest = Math.random().toString(36).substring(2, 10).toUpperCase();

      logger.error(`API Error Handler [${digest}]`, {
        url: req.url,
        method: req.method,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      const response: ApiErrorResponse = {
        error: "An unexpected server error occurred",
        code: "INTERNAL_SERVER_ERROR",
        digest,
      };

      // Show more details in development
      if (process.env.NODE_ENV === "development" && error instanceof Error) {
        response.details = error.message;
      }

      return NextResponse.json(response, { status: 500 });
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
