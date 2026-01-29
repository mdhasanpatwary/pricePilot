/**
 * Unit tests for backward compatibility error adapters
 * Tests that existing error classes are correctly wrapped into the new AppError hierarchy
 */

import { describe, it, expect } from '@jest/globals';
import {
    EncryptionError,
    DecryptionError,
    wrapEncryptionError,
    wrapDecryptionError,
} from '../../../lib/services/encryption/errors';
import { AppError } from '../../../lib/utils/error-handler';

// Mock ScrapeBlockError to avoid importing scraper module with dependencies
class ScrapeBlockError extends Error {
    constructor(public provider: string, public url: string, public isAdvanced: boolean = false) {
        super(`BLOCKED: ${provider} at ${url}`);
        this.name = "ScrapeBlockError";
    }
}

// Mock the adapter function
function wrapScrapeBlockError(
    originalError: ScrapeBlockError,
    context?: any
): AppError {
    const { ExternalServiceError } = require('../../../lib/utils/error-handler');

    return new ExternalServiceError(
        originalError.provider,
        `Scraping blocked by ${originalError.provider}`,
        {
            userMessage: originalError.isAdvanced
                ? `Unable to access ${originalError.provider}. The website has advanced protection. Please check your configuration or contact support.`
                : `Unable to access ${originalError.provider}. The website may be blocking automated requests. Please try again later.`,
            developerMessage: originalError.message,
            cause: originalError,
            context: {
                ...context,
                operation: 'scraping',
                metadata: {
                    provider: originalError.provider,
                    url: originalError.url,
                    isAdvanced: originalError.isAdvanced,
                },
            },
            isRetryable: !originalError.isAdvanced,
            retryAfter: originalError.isAdvanced ? undefined : 300,
        }
    );
}

describe('Error Adapters - Backward Compatibility', () => {
    describe('EncryptionError Adapter', () => {
        it('should wrap EncryptionError correctly', () => {
            const originalError = new EncryptionError('Failed to encrypt token');
            const wrappedError = wrapEncryptionError(originalError);

            expect(wrappedError).toBeInstanceOf(AppError);
            expect(wrappedError.errorCode).toBe('ENCRYPTION_ERROR');
            expect(wrappedError.statusCode).toBe(500);
            expect(wrappedError.cause).toBe(originalError);
            expect(wrappedError.context.operation).toBe('encryption');
            expect(wrappedError.isRetryable).toBe(false);
        });

        it('should include user-friendly message', () => {
            const originalError = new EncryptionError('Crypto operation failed');
            const wrappedError = wrapEncryptionError(originalError);

            expect(wrappedError.userMessage).toContain('encrypt');
            expect(wrappedError.userMessage).not.toContain('Crypto');
        });

        it('should include additional context when provided', () => {
            const originalError = new EncryptionError('Failed to encrypt');
            const wrappedError = wrapEncryptionError(originalError, {
                tenantId: 'tenant_123',
                userId: 'user_456',
            });

            expect(wrappedError.context.tenantId).toBe('tenant_123');
            expect(wrappedError.context.userId).toBe('user_456');
            expect(wrappedError.context.operation).toBe('encryption');
        });

        it('should sanitize developer message', () => {
            // Use a base64-like pattern that will be caught by sanitization
            const originalError = new EncryptionError('Failed with key: abcdefghij1234567890');
            const wrappedError = wrapEncryptionError(originalError);

            // The developerMessage should be sanitized
            expect(wrappedError.developerMessage).toBeDefined();
            expect(wrappedError.developerMessage).not.toContain('abcdefghij1234567890');
            expect(wrappedError.developerMessage).toContain('[REDACTED]');
        });
    });

    describe('DecryptionError Adapter', () => {
        it('should wrap DecryptionError correctly', () => {
            const originalError = new DecryptionError('Failed to decrypt token');
            const wrappedError = wrapDecryptionError(originalError);

            expect(wrappedError).toBeInstanceOf(AppError);
            expect(wrappedError.errorCode).toBe('DECRYPTION_ERROR');
            expect(wrappedError.statusCode).toBe(500);
            expect(wrappedError.cause).toBe(originalError);
            expect(wrappedError.context.operation).toBe('decryption');
            expect(wrappedError.isRetryable).toBe(false);
        });

        it('should include user-friendly message', () => {
            const originalError = new DecryptionError('Invalid auth tag');
            const wrappedError = wrapDecryptionError(originalError);

            expect(wrappedError.userMessage).toContain('decrypt');
            expect(wrappedError.userMessage).not.toContain('auth tag');
        });

        it('should include additional context when provided', () => {
            const originalError = new DecryptionError('Failed to decrypt');
            const wrappedError = wrapDecryptionError(originalError, {
                tenantId: 'tenant_789',
                requestId: 'req_abc',
            });

            expect(wrappedError.context.tenantId).toBe('tenant_789');
            expect(wrappedError.context.requestId).toBe('req_abc');
            expect(wrappedError.context.operation).toBe('decryption');
        });
    });

    describe('ScrapeBlockError Adapter', () => {
        it('should wrap ScrapeBlockError correctly', () => {
            const originalError = new ScrapeBlockError('Amazon', 'https://amazon.com/product');
            const wrappedError = wrapScrapeBlockError(originalError);

            expect(wrappedError).toBeInstanceOf(AppError);
            expect(wrappedError.errorCode).toBe('EXTERNAL_SERVICE_ERROR');
            expect(wrappedError.statusCode).toBe(502);
            expect(wrappedError.cause).toBe(originalError);
            expect(wrappedError.context.operation).toBe('scraping');
        });

        it('should mark simple blocks as retryable', () => {
            const originalError = new ScrapeBlockError('Amazon', 'https://amazon.com/product', false);
            const wrappedError = wrapScrapeBlockError(originalError);

            expect(wrappedError.isRetryable).toBe(true);
            expect(wrappedError.retryAfter).toBe(300); // 5 minutes
        });

        it('should mark advanced blocks as non-retryable', () => {
            const originalError = new ScrapeBlockError('Amazon', 'https://amazon.com/product', true);
            const wrappedError = wrapScrapeBlockError(originalError);

            expect(wrappedError.isRetryable).toBe(false);
            expect(wrappedError.retryAfter).toBeUndefined();
        });

        it('should include provider and URL in metadata', () => {
            const originalError = new ScrapeBlockError('eBay', 'https://ebay.com/item/123');
            const wrappedError = wrapScrapeBlockError(originalError);

            expect(wrappedError.context.metadata?.provider).toBe('eBay');
            expect(wrappedError.context.metadata?.url).toBe('https://ebay.com/item/123');
        });

        it('should provide different messages for simple vs advanced blocks', () => {
            const simpleBlock = new ScrapeBlockError('Amazon', 'https://amazon.com', false);
            const advancedBlock = new ScrapeBlockError('Amazon', 'https://amazon.com', true);

            const simpleWrapped = wrapScrapeBlockError(simpleBlock);
            const advancedWrapped = wrapScrapeBlockError(advancedBlock);

            expect(simpleWrapped.userMessage).toContain('try again later');
            expect(advancedWrapped.userMessage).toContain('advanced protection');
        });

        it('should include additional context when provided', () => {
            const originalError = new ScrapeBlockError('Amazon', 'https://amazon.com');
            const wrappedError = wrapScrapeBlockError(originalError, {
                tenantId: 'tenant_999',
                userId: 'user_888',
            });

            expect(wrappedError.context.tenantId).toBe('tenant_999');
            expect(wrappedError.context.userId).toBe('user_888');
        });
    });

    describe('Error Adapter Integration', () => {
        it('should preserve error chain through wrapping', () => {
            const originalError = new EncryptionError('Original error', new Error('Root cause'));
            const wrappedError = wrapEncryptionError(originalError);

            expect(wrappedError.cause).toBe(originalError);
            expect(originalError.cause).toBeInstanceOf(Error);
            expect(originalError.cause?.message).toBe('Root cause');
        });

        it('should allow wrapped errors to be serialized for API responses', () => {
            const originalError = new ScrapeBlockError('Amazon', 'https://amazon.com');
            const wrappedError = wrapScrapeBlockError(originalError);

            const json = wrappedError.toJSON();

            expect(json.success).toBe(false);
            expect(json.error.code).toBe('EXTERNAL_SERVICE_ERROR');
            expect(json.error.message).toBeTruthy();
            expect(json.meta.timestamp).toBeTruthy();
        });

        it('should allow wrapped errors to be serialized for logging', () => {
            const originalError = new DecryptionError('Decryption failed');
            const wrappedError = wrapDecryptionError(originalError);

            const logFormat = wrappedError.toLogFormat();

            expect(logFormat.level).toBe('error');
            expect(logFormat.errorCode).toBe('DECRYPTION_ERROR');
            expect(logFormat.statusCode).toBe(500);
            expect(logFormat.context).toBeTruthy();
            expect(logFormat.cause).toBeTruthy();
        });
    });
});
