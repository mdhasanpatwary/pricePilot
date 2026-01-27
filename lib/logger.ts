/**
 * Centralized logging utility for the application.
 * In a production environment, this would connect to Sentry, LogRocket, or Datadog.
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isProduction = process.env.NODE_ENV === "production";

  /**
   * Log info messages
   */
  info(message: string, context?: LogContext) {
    this.log("info", message, context);
  }

  /**
   * Log warnings
   */
  warn(message: string, context?: LogContext) {
    this.log("warn", message, context);
  }

  /**
   * Log debug messages
   */
  debug(message: string, context?: LogContext) {
    this.log("debug", message, context);
  }

  /**
   * Log errors with optional stack trace
   */
  error(message: string | Error, context?: LogContext) {
    if (message instanceof Error) {
      this.log("error", message.message, {
        ...context,
        stack: message.stack,
        name: message.name,
      });

      // In production, we would call Sentry.captureException(message)
    } else {
      this.log("error", message, context);
    }
  }

  /**
   * Internal logging logic
   */
  private log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (!this.isProduction) {
      switch (level) {
        case "error":
          console.error(formattedMessage, context || "");
          break;
        case "warn":
          console.warn(formattedMessage, context || "");
          break;
        case "debug":
          console.debug(formattedMessage, context || "");
          break;
        default:
          console.log(formattedMessage, context || "");
      }
    } else {
      // Production: Send to external logging service (Sentry, etc.)
      // Example: Sentry.addBreadcrumb({ level, message, data: context });

      // For now, we fall back to console in production if no service is configured
      if (level === "error") {
        console.error(formattedMessage, context || "");
      }
    }
  }
}

export const logger = new Logger();
