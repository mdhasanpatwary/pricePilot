/**
 * Custom error classes for encryption operations
 * 
 * These error classes provide specific error types for different failure modes
 * in the encryption service. All error messages are designed to never expose
 * sensitive data such as encryption keys or plaintext tokens.
 */

/**
 * Base error class for encryption operations
 * Thrown when encryption operation fails
 */
export class EncryptionError extends Error {
    constructor(message: string, public cause?: Error) {
        super(message);
        this.name = 'EncryptionError';

        // Maintains proper stack trace for where error was thrown (V8 only)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, EncryptionError);
        }
    }
}

/**
 * Base error class for decryption operations
 * Thrown when decryption operation fails
 */
export class DecryptionError extends Error {
    constructor(message: string, public cause?: Error) {
        super(message);
        this.name = 'DecryptionError';

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, DecryptionError);
        }
    }
}

/**
 * Error thrown when authentication tag verification fails
 * Extends DecryptionError to indicate data tampering or corruption
 * This is a critical security event that should be logged
 */
export class AuthenticationError extends DecryptionError {
    constructor(message: string = 'Authentication tag verification failed. Data may have been tampered with.') {
        super(message);
        this.name = 'AuthenticationError';

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AuthenticationError);
        }
    }
}

/**
 * Error thrown when encrypted string format is invalid
 * Indicates the string doesn't match expected format: algorithm:iv:authTag:ciphertext
 */
export class InvalidFormatError extends Error {
    constructor(message: string = 'Invalid encrypted token format. Expected format: algorithm:iv:authTag:ciphertext') {
        super(message);
        this.name = 'InvalidFormatError';

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, InvalidFormatError);
        }
    }
}

/**
 * Error thrown when encryption key is not found in environment
 * This is a critical configuration error that prevents application startup
 */
export class KeyNotFoundError extends Error {
    constructor(message: string = 'Encryption key not found. Please set ENCRYPTION_MASTER_KEY environment variable.') {
        super(message);
        this.name = 'KeyNotFoundError';

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, KeyNotFoundError);
        }
    }
}

/**
 * Error thrown when encryption key validation fails
 * Indicates the key is present but invalid (wrong length, format, etc.)
 */
export class KeyValidationError extends Error {
    constructor(message: string = 'Encryption key validation failed. Key must be 32 bytes (256 bits) encoded as base64.') {
        super(message);
        this.name = 'KeyValidationError';

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, KeyValidationError);
        }
    }
}

/**
 * Sanitizes error messages to ensure no sensitive data is exposed
 * Removes any potential key material, tokens, or other sensitive information
 * 
 * @param error - The error to sanitize
 * @returns A sanitized error message safe for logging and display
 */
export function sanitizeErrorMessage(error: Error): string {
    let message = error.message;

    // Remove any potential environment variable values FIRST (before base64 matching)
    message = message.replace(/ENCRYPTION_MASTER_KEY(_NEW)?=[^\s]+/gi, (match) => {
        const keyName = match.split('=')[0];
        return `${keyName}=[REDACTED]`;
    });

    // Remove any base64-encoded strings that might be keys or tokens
    // Base64 pattern: sequences of alphanumeric, +, /, = characters (minimum 10 chars to catch most tokens)
    // Don't match strings that are all uppercase (likely variable names like "ENCRYPTION")
    message = message.replace(/[A-Za-z0-9+/]*[a-z+/][A-Za-z0-9+/]{9,}={0,2}/g, '[REDACTED]');

    // Remove any hex-encoded strings that might be keys (32+ hex chars)
    message = message.replace(/[0-9a-fA-F]{32,}/g, '[REDACTED]');

    return message;
}

/**
 * Creates a user-friendly error message for display
 * Provides helpful guidance without exposing sensitive information
 * 
 * @param error - The error to convert to user-friendly message
 * @returns A user-friendly error message with guidance
 */
export function getUserFriendlyErrorMessage(error: Error): string {
    if (error instanceof AuthenticationError) {
        return 'API token integrity check failed. This may indicate the token was corrupted or tampered with. ' +
            'For your security, please re-enter your API token in the website settings. ' +
            'Navigate to Settings > Website Configuration to update your token.';
    }

    if (error instanceof DecryptionError) {
        return 'Failed to decrypt API token. This could be due to a configuration change or data corruption. ' +
            'Please re-enter your API token in the website settings. ' +
            'Navigate to Settings > Website Configuration to update your token.';
    }

    if (error instanceof EncryptionError) {
        return 'Failed to encrypt API token. This is usually a temporary issue. ' +
            'Please try again in a few moments. If the problem persists, contact support.';
    }

    if (error instanceof KeyNotFoundError) {
        return 'System configuration error: Encryption key not found. ' +
            'This is a server configuration issue. Please contact support for assistance.';
    }

    if (error instanceof KeyValidationError) {
        return 'System configuration error: Invalid encryption key. ' +
            'This is a server configuration issue. Please contact support for assistance.';
    }

    if (error instanceof InvalidFormatError) {
        return 'Invalid token format detected. Your token will be automatically migrated to the new secure format. ' +
            'No action is required on your part.';
    }

    return 'An unexpected error occurred while processing your API token. ' +
        'Please try again. If the problem persists, contact support with error code: ' + error.name;
}

/**
 * Error message templates for different error scenarios
 * Provides consistent, helpful messages across the application
 */
export const ErrorMessages = {
    // Encryption errors
    ENCRYPTION_FAILED: {
        title: 'Encryption Failed',
        message: 'Failed to encrypt API token. Please try again.',
        guidance: 'This is usually a temporary issue. If it persists, contact support.',
        action: 'Try Again',
    },
    
    // Decryption errors
    DECRYPTION_FAILED: {
        title: 'Token Decryption Failed',
        message: 'Failed to decrypt your API token.',
        guidance: 'Please re-enter your API token in the website settings.',
        action: 'Update Token',
        link: '/dashboard/site-config',
    },
    
    // Authentication errors (tampering detected)
    AUTHENTICATION_FAILED: {
        title: 'Security Alert: Token Integrity Check Failed',
        message: 'We detected a potential security issue with your API token.',
        guidance: 'For your security, the token has been cleared. Please re-enter your API token.',
        action: 'Update Token',
        link: '/dashboard/site-config',
        severity: 'critical',
    },
    
    // Key management errors
    KEY_NOT_FOUND: {
        title: 'System Configuration Error',
        message: 'Encryption key not configured.',
        guidance: 'This is a server configuration issue. Please contact support.',
        action: 'Contact Support',
        severity: 'critical',
    },
    
    KEY_VALIDATION_FAILED: {
        title: 'System Configuration Error',
        message: 'Invalid encryption key configuration.',
        guidance: 'This is a server configuration issue. Please contact support.',
        action: 'Contact Support',
        severity: 'critical',
    },
    
    // Format errors
    INVALID_FORMAT: {
        title: 'Token Format Issue',
        message: 'Invalid token format detected.',
        guidance: 'Your token will be automatically migrated to the secure format.',
        action: 'No Action Required',
        severity: 'info',
    },
    
    // Migration errors
    MIGRATION_FAILED: {
        title: 'Token Migration Failed',
        message: 'Failed to migrate your API token to the new secure format.',
        guidance: 'Your token will continue to work. Migration will be retried automatically.',
        action: 'No Action Required',
        severity: 'warning',
    },
    
    // Recovery errors
    RECOVERY_FAILED: {
        title: 'Token Recovery Failed',
        message: 'Failed to complete token recovery process.',
        guidance: 'Please manually clear and re-enter your API token in settings.',
        action: 'Update Token',
        link: '/dashboard/site-config',
        severity: 'warning',
    },
} as const;

/**
 * Gets a structured error message for a given error type
 * 
 * @param error - The error to get message for
 * @returns Structured error message with title, message, guidance, and action
 */
export function getStructuredErrorMessage(error: Error): {
    title: string;
    message: string;
    guidance: string;
    action: string;
    link?: string;
    severity?: 'info' | 'warning' | 'critical';
} {
    if (error instanceof AuthenticationError) {
        return ErrorMessages.AUTHENTICATION_FAILED;
    }

    if (error instanceof DecryptionError) {
        return ErrorMessages.DECRYPTION_FAILED;
    }

    if (error instanceof EncryptionError) {
        return ErrorMessages.ENCRYPTION_FAILED;
    }

    if (error instanceof KeyNotFoundError) {
        return ErrorMessages.KEY_NOT_FOUND;
    }

    if (error instanceof KeyValidationError) {
        return ErrorMessages.KEY_VALIDATION_FAILED;
    }

    if (error instanceof InvalidFormatError) {
        return ErrorMessages.INVALID_FORMAT;
    }

    // Default error message
    return {
        title: 'Unexpected Error',
        message: 'An unexpected error occurred.',
        guidance: 'Please try again. If the problem persists, contact support.',
        action: 'Try Again',
        severity: 'warning',
    };
}
