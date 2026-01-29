/**
 * Error Sanitization System for PricePilot
 * 
 * This module provides security-focused sanitization of error messages and context
 * to prevent exposure of sensitive data in logs and API responses.
 * 
 * Features:
 * - Pattern-based redaction of sensitive data (tokens, passwords, credentials)
 * - Field-level sanitization for error context
 * - Configurable sanitization rules
 * - Deep object traversal for nested sensitive data
 */

import { ErrorContext } from './error-handler';

/**
 * Sanitization rule definition
 */
export interface SanitizationRule {
    pattern: RegExp;
    replacement: string;
}

/**
 * Redaction placeholder for sensitive data
 */
const REDACTED = '[REDACTED]';

/**
 * ErrorSanitizer class
 * Handles sanitization of error messages and context to prevent sensitive data exposure
 */
export class ErrorSanitizer {
    private readonly sensitivePatterns: SanitizationRule[];
    private readonly sensitiveFieldNames: Set<string>;

    constructor() {
        // Initialize default sensitive patterns
        this.sensitivePatterns = [
            // Bearer tokens
            { pattern: /Bearer\s+[\w\-._~+/]+=*/gi, replacement: 'Bearer [REDACTED]' },

            // API keys with common prefixes
            { pattern: /sk_[a-zA-Z0-9]+/gi, replacement: 'sk_[REDACTED]' },
            { pattern: /pk_[a-zA-Z0-9]+/gi, replacement: 'pk_[REDACTED]' },
            { pattern: /api[_-]?key[:\s=]+[\w\-]+/gi, replacement: 'api_key=[REDACTED]' },

            // Generic tokens
            { pattern: /token[:\s=]+[\w\-._~+/]+=*/gi, replacement: 'token=[REDACTED]' },

            // Passwords in various formats
            { pattern: /password[:\s=]+\S+/gi, replacement: 'password=[REDACTED]' },
            { pattern: /passwd[:\s=]+\S+/gi, replacement: 'passwd=[REDACTED]' },
            { pattern: /pwd[:\s=]+\S+/gi, replacement: 'pwd=[REDACTED]' },

            // Database connection strings
            { pattern: /(?:postgres|mysql|mongodb):\/\/[^:]+:[^@]+@[^\s]+/gi, replacement: 'db://[REDACTED]' },
            { pattern: /(?:Server|Host)=[^;]+;.*?(?:Password|Pwd)=[^;]+/gi, replacement: 'connection_string=[REDACTED]' },

            // Private keys
            { pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi, replacement: '[REDACTED PRIVATE KEY]' },

            // AWS credentials
            { pattern: /AKIA[0-9A-Z]{16}/g, replacement: 'AKIA[REDACTED]' },

            // JWT tokens
            { pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, replacement: 'jwt.[REDACTED]' },
        ];

        // Initialize sensitive field names
        this.sensitiveFieldNames = new Set([
            // Authentication & Authorization
            'password',
            'passwd',
            'pwd',
            'secret',
            'token',
            'apikey',
            'api_key',
            'apitoken',
            'api_token',
            'accesstoken',
            'access_token',
            'refreshtoken',
            'refresh_token',
            'bearer',
            'authorization',
            'auth',
            'credential',
            'credentials',

            // Encryption
            'privatekey',
            'private_key',
            'secretkey',
            'secret_key',
            'encryptionkey',
            'encryption_key',
            'cipher',
            'encrypted',

            // Database
            'connectionstring',
            'connection_string',
            'dburl',
            'db_url',
            'databaseurl',
            'database_url',
            'dbpassword',
            'db_password',

            // Payment
            'creditcard',
            'credit_card',
            'cardnumber',
            'card_number',
            'cvv',
            'ccv',

            // Personal Information
            'ssn',
            'socialsecurity',
            'social_security',
        ]);
    }

    /**
     * Add a custom sanitization rule
     * @param pattern - Regular expression to match sensitive data
     * @param replacement - Replacement string (default: [REDACTED])
     */
    addRule(pattern: RegExp, replacement: string = REDACTED): void {
        this.sensitivePatterns.push({ pattern, replacement });
    }

    /**
     * Check if a field name is considered sensitive
     * @param fieldName - The field name to check
     * @returns true if the field is sensitive
     */
    isSensitiveField(fieldName: string): boolean {
        const normalized = fieldName.toLowerCase().replace(/[-_\s]/g, '');
        return this.sensitiveFieldNames.has(normalized);
    }

    /**
     * Sanitize an error message by redacting sensitive patterns
     * @param message - The error message to sanitize
     * @returns Sanitized message with sensitive data redacted
     */
    sanitizeMessage(message: string): string {
        if (!message || typeof message !== 'string') {
            return message;
        }

        let sanitized = message;

        // Apply all sanitization patterns
        for (const rule of this.sensitivePatterns) {
            sanitized = sanitized.replace(rule.pattern, rule.replacement);
        }

        return sanitized;
    }

    /**
     * Sanitize error context by redacting sensitive fields
     * @param context - The error context to sanitize
     * @returns Sanitized context with sensitive data redacted
     */
    sanitizeContext(context: ErrorContext): ErrorContext {
        if (!context || typeof context !== 'object') {
            return context;
        }

        const sanitized: ErrorContext = {
            timestamp: context.timestamp,
        };

        // Copy non-sensitive fields directly
        if (context.tenantId) sanitized.tenantId = context.tenantId;
        if (context.userId) sanitized.userId = context.userId;
        if (context.operation) sanitized.operation = context.operation;
        if (context.requestId) sanitized.requestId = context.requestId;

        // Sanitize metadata if present
        if (context.metadata) {
            sanitized.metadata = this.sanitizeObject(context.metadata);
        }

        return sanitized;
    }

    /**
     * Sanitize an entire error object
     * @param error - The error object to sanitize
     * @returns Sanitized error object
     */
    sanitizeError(error: any): any {
        if (!error || typeof error !== 'object') {
            return error;
        }

        const sanitized: any = {};

        // Sanitize each property
        for (const [key, value] of Object.entries(error)) {
            if (this.isSensitiveField(key)) {
                sanitized[key] = REDACTED;
            } else if (key === 'message' && typeof value === 'string') {
                sanitized[key] = this.sanitizeMessage(value);
            } else if (key === 'context' && typeof value === 'object') {
                sanitized[key] = this.sanitizeContext(value as ErrorContext);
            } else if (typeof value === 'string') {
                sanitized[key] = this.sanitizeMessage(value);
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    /**
     * Sanitize a generic object by redacting sensitive fields
     * @param obj - The object to sanitize
     * @returns Sanitized object
     */
    private sanitizeObject(obj: any): any {
        if (obj === null || obj === undefined) {
            return obj;
        }

        // Handle arrays
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item));
        }

        // Handle non-object types
        if (typeof obj !== 'object') {
            if (typeof obj === 'string') {
                return this.sanitizeMessage(obj);
            }
            return obj;
        }

        // Handle circular references
        const seen = new WeakSet();
        return this.sanitizeObjectRecursive(obj, seen);
    }

    /**
     * Recursively sanitize an object with circular reference detection
     * @param obj - The object to sanitize
     * @param seen - Set of already processed objects
     * @returns Sanitized object
     */
    private sanitizeObjectRecursive(obj: any, seen: WeakSet<object>): any {
        // Prevent circular references
        if (seen.has(obj)) {
            return '[Circular Reference]';
        }
        seen.add(obj);

        const sanitized: any = {};

        for (const [key, value] of Object.entries(obj)) {
            // Check if field name is sensitive
            if (this.isSensitiveField(key)) {
                sanitized[key] = REDACTED;
            } else if (typeof value === 'string') {
                sanitized[key] = this.sanitizeMessage(value);
            } else if (Array.isArray(value)) {
                sanitized[key] = value.map(item => {
                    if (typeof item === 'object' && item !== null) {
                        return this.sanitizeObjectRecursive(item, seen);
                    } else if (typeof item === 'string') {
                        return this.sanitizeMessage(item);
                    }
                    return item;
                });
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeObjectRecursive(value, seen);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }
}

/**
 * Default singleton instance of ErrorSanitizer
 */
export const defaultSanitizer = new ErrorSanitizer();
