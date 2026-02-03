/**
 * Centralized logging utility for the application.
 * In a production environment, this would connect to Sentry, LogRocket, or Datadog.
 * 
 * Security: All log context is automatically sanitized to prevent sensitive data leakage.
 * Requirement: 2.7.5 - Prevent sensitive data logging
 */

import { sanitizeLogContext, sanitizeError } from './utils/log-sanitizer';

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isProduction = process.env.NODE_ENV === "production";

  /**
   * Log info messages
   * Context is automatically sanitized to remove sensitive data
   */
  info(message: string, context?: LogContext) {
    this.log("info", message, context);
  }

  /**
   * Log warnings
   * Context is automatically sanitized to remove sensitive data
   */
  warn(message: string, context?: LogContext) {
    this.log("warn", message, context);
  }

  /**
   * Log debug messages
   * Context is automatically sanitized to remove sensitive data
   */
  debug(message: string, context?: LogContext) {
    this.log("debug", message, context);
  }

  /**
   * Log errors with optional stack trace
   * Error and context are automatically sanitized to remove sensitive data
   */
  error(message: string | Error, context?: LogContext) {
    if (message instanceof Error) {
      const sanitizedError = sanitizeError(message);
      this.log("error", sanitizedError.message, {
        ...sanitizeLogContext(context),
        stack: sanitizedError.stack,
        name: sanitizedError.name,
      });

      // In production, we would call Sentry.captureException(message)
      // Note: Sentry integration should also sanitize before sending
    } else {
      this.log("error", message, context);
    }
  }

  /**
   * Internal logging logic
   * Automatically sanitizes all context before logging
   */
  private log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    // Sanitize context to remove sensitive data
    const sanitizedContext = sanitizeLogContext(context);

    if (!this.isProduction) {
      switch (level) {
        case "error":
          console.error(formattedMessage, sanitizedContext || "");
          break;
        case "warn":
          console.warn(formattedMessage, sanitizedContext || "");
          break;
        case "debug":
          console.debug(formattedMessage, sanitizedContext || "");
          break;
        default:
          console.log(formattedMessage, sanitizedContext || "");
      }
    } else {
      // Production: Send to external logging service (Sentry, etc.)
      // Example: Sentry.addBreadcrumb({ level, message, data: sanitizedContext });

      // For now, we fall back to console in production if no service is configured
      if (level === "error") {
        console.error(formattedMessage, sanitizedContext || "");
      }
    }
  }
}

export const logger = new Logger();
