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
        return 'API token integrity check failed. Please re-enter your API token in settings.';
    }

    if (error instanceof DecryptionError) {
        return 'Failed to decrypt API token. Please re-enter your API token in settings.';
    }

    if (error instanceof EncryptionError) {
        return 'Failed to encrypt API token. Please try again.';
    }

    if (error instanceof KeyNotFoundError) {
        return 'System configuration error. Please contact support.';
    }

    if (error instanceof KeyValidationError) {
        return 'System configuration error. Please contact support.';
    }

    if (error instanceof InvalidFormatError) {
        return 'Invalid token format detected. Your token will be automatically migrated.';
    }

    return 'An unexpected error occurred. Please try again or contact support.';
}
