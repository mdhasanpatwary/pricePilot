/**
 * Log Sanitizer Utility
 * 
 * Prevents sensitive data from being logged by masking or removing
 * sensitive fields from log context objects.
 * 
 * Security Requirement: 2.7.5 - Prevent sensitive data logging
 */

/**
 * List of sensitive field names that should be masked in logs
 */
const SENSITIVE_FIELDS = [
    // Authentication & Authorization
    'password',
    'passwordHash',
    'newPassword',
    'oldPassword',
    'currentPassword',
    'confirmPassword',

    // API & Access Tokens
    'apiToken',
    'token',
    'accessToken',
    'refreshToken',
    'bearerToken',
    'authToken',
    'sessionToken',

    // Secrets & Keys
    'secret',
    'secretKey',
    'apiSecret',
    'privateKey',
    'encryptionKey',
    'clientSecret',

    // Credentials
    'credential',
    'credentials',
    'apiKey',
    'apiKeys',

    // Personal Information
    'ssn',
    'socialSecurityNumber',
    'creditCard',
    'cardNumber',
    'cvv',
    'pin',

    // Database
    'connectionString',
    'databaseUrl',
    'dbPassword',
];

/**
 * Patterns to detect sensitive data in strings
 */
const SENSITIVE_PATTERNS = [
    // API tokens (common formats)
    /[a-zA-Z0-9_-]{32,}/g,

    // JWT tokens
    /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,

    // Credit card numbers (basic pattern)
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,

    // Email addresses (for PII protection)
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
];

/**
 * Mask value for sensitive data
 */
const MASK = '***REDACTED***';

/**
 * Mask for partial display (e.g., showing last 4 characters)
 */
function partialMask(value: string, visibleChars: number = 4): string {
    if (value.length <= visibleChars) {
        return MASK;
    }
    return `${MASK}${value.slice(-visibleChars)}`;
}

/**
 * Check if a field name is sensitive
 */
function isSensitiveField(fieldName: string): boolean {
    const lowerFieldName = fieldName.toLowerCase();
    return SENSITIVE_FIELDS.some(sensitive =>
        lowerFieldName.includes(sensitive.toLowerCase())
    );
}

/**
 * Sanitize a string value by masking sensitive patterns
 */
function sanitizeString(value: string): string {
    let sanitized = value;

    // Replace sensitive patterns
    SENSITIVE_PATTERNS.forEach(pattern => {
        sanitized = sanitized.replace(pattern, MASK);
    });

    return sanitized;
}

/**
 * Sanitize an object by masking sensitive fields
 */
function sanitizeObject(obj: any, depth: number = 0): any {
    // Prevent infinite recursion
    if (depth > 10) {
        return '[Max Depth Reached]';
    }

    if (obj === null || obj === undefined) {
        return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeValue(item, depth + 1));
    }

    // Handle objects
    if (typeof obj === 'object') {
        const sanitized: any = {};

        for (const [key, value] of Object.entries(obj)) {
            // Check if field name is sensitive
            if (isSensitiveField(key)) {
                // Mask the entire value
                sanitized[key] = MASK;
            } else {
                // Recursively sanitize the value
                sanitized[key] = sanitizeValue(value, depth + 1);
            }
        }

        return sanitized;
    }

    return obj;
}

/**
 * Sanitize any value (string, object, array, etc.)
 */
function sanitizeValue(value: any, depth: number = 0): any {
    if (value === null || value === undefined) {
        return value;
    }

    if (typeof value === 'string') {
        return sanitizeString(value);
    }

    if (typeof value === 'object') {
        return sanitizeObject(value, depth);
    }

    return value;
}

/**
 * Main sanitization function for log context
 * 
 * @param context - The log context object to sanitize
 * @returns Sanitized context with sensitive data masked
 * 
 * @example
 * const context = {
 *   userId: '123',
 *   apiToken: 'secret-token-123',
 *   email: 'user@example.com'
 * };
 * 
 * const sanitized = sanitizeLogContext(context);
 * // Result: { userId: '123', apiToken: '***REDACTED***', email: '***REDACTED***' }
 */
export function sanitizeLogContext(context: any): any {
    if (!context) {
        return context;
    }

    return sanitizeObject(context);
}

/**
 * Sanitize error objects for logging
 * Preserves error message and stack trace but masks sensitive data
 */
export function sanitizeError(error: Error | unknown): any {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: sanitizeString(error.message),
            stack: error.stack ? sanitizeString(error.stack) : undefined,
        };
    }

    return sanitizeValue(error);
}

/**
 * Create a safe logger wrapper that automatically sanitizes context
 * 
 * @example
 * const safeLogger = createSafeLogger(logger);
 * safeLogger.info('User logged in', { userId: '123', apiToken: 'secret' });
 * // Logs: 'User logged in' with context { userId: '123', apiToken: '***REDACTED***' }
 */
export function createSafeLogger(logger: any) {
    return {
        info: (message: string, context?: any) => {
            logger.info(message, sanitizeLogContext(context));
        },
        warn: (message: string, context?: any) => {
            logger.warn(message, sanitizeLogContext(context));
        },
        error: (message: string | Error, context?: any) => {
            if (message instanceof Error) {
                logger.error(sanitizeError(message), sanitizeLogContext(context));
            } else {
                logger.error(message, sanitizeLogContext(context));
            }
        },
        debug: (message: string, context?: any) => {
            logger.debug(message, sanitizeLogContext(context));
        },
    };
}

/**
 * Utility to mask API tokens for display purposes
 * Shows only the last 4 characters
 */
export function maskApiToken(token: string | null | undefined): string {
    if (!token) {
        return 'NOT_SET';
    }

    return partialMask(token, 4);
}

/**
 * Utility to mask email addresses for display purposes
 * Shows only the first character and domain
 */
export function maskEmail(email: string | null | undefined): string {
    if (!email) {
        return 'NOT_SET';
    }

    const [localPart, domain] = email.split('@');
    if (!domain) {
        return MASK;
    }

    return `${localPart[0]}***@${domain}`;
}
