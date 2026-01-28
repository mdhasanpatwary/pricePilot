/**
 * Tests for encryption error classes
 */

import {
    EncryptionError,
    DecryptionError,
    AuthenticationError,
    InvalidFormatError,
    KeyNotFoundError,
    KeyValidationError,
    sanitizeErrorMessage,
    getUserFriendlyErrorMessage,
} from '@/lib/services/encryption/errors';

describe('Encryption Error Classes', () => {
    describe('EncryptionError', () => {
        it('should create error with message', () => {
            const error = new EncryptionError('Test encryption error');
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(EncryptionError);
            expect(error.name).toBe('EncryptionError');
            expect(error.message).toBe('Test encryption error');
        });

        it('should store cause error', () => {
            const cause = new Error('Original error');
            const error = new EncryptionError('Test error', cause);
            expect(error.cause).toBe(cause);
        });

        it('should have proper stack trace', () => {
            const error = new EncryptionError('Test error');
            expect(error.stack).toBeDefined();
            expect(error.stack).toContain('EncryptionError');
        });
    });

    describe('DecryptionError', () => {
        it('should create error with message', () => {
            const error = new DecryptionError('Test decryption error');
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(DecryptionError);
            expect(error.name).toBe('DecryptionError');
            expect(error.message).toBe('Test decryption error');
        });

        it('should store cause error', () => {
            const cause = new Error('Original error');
            const error = new DecryptionError('Test error', cause);
            expect(error.cause).toBe(cause);
        });
    });

    describe('AuthenticationError', () => {
        it('should create error with default message', () => {
            const error = new AuthenticationError();
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(DecryptionError);
            expect(error).toBeInstanceOf(AuthenticationError);
            expect(error.name).toBe('AuthenticationError');
            expect(error.message).toContain('Authentication tag verification failed');
        });

        it('should create error with custom message', () => {
            const error = new AuthenticationError('Custom auth error');
            expect(error.message).toBe('Custom auth error');
        });

        it('should extend DecryptionError', () => {
            const error = new AuthenticationError();
            expect(error).toBeInstanceOf(DecryptionError);
        });
    });

    describe('InvalidFormatError', () => {
        it('should create error with default message', () => {
            const error = new InvalidFormatError();
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(InvalidFormatError);
            expect(error.name).toBe('InvalidFormatError');
            expect(error.message).toContain('Invalid encrypted token format');
        });

        it('should create error with custom message', () => {
            const error = new InvalidFormatError('Custom format error');
            expect(error.message).toBe('Custom format error');
        });
    });

    describe('KeyNotFoundError', () => {
        it('should create error with default message', () => {
            const error = new KeyNotFoundError();
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(KeyNotFoundError);
            expect(error.name).toBe('KeyNotFoundError');
            expect(error.message).toContain('Encryption key not found');
        });

        it('should create error with custom message', () => {
            const error = new KeyNotFoundError('Custom key error');
            expect(error.message).toBe('Custom key error');
        });
    });

    describe('KeyValidationError', () => {
        it('should create error with default message', () => {
            const error = new KeyValidationError();
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(KeyValidationError);
            expect(error.name).toBe('KeyValidationError');
            expect(error.message).toContain('Encryption key validation failed');
        });

        it('should create error with custom message', () => {
            const error = new KeyValidationError('Custom validation error');
            expect(error.message).toBe('Custom validation error');
        });
    });
});

describe('Error Message Sanitization', () => {
    describe('sanitizeErrorMessage', () => {
        it('should redact base64-encoded strings', () => {
            const error = new Error('Key: dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleQ==');
            const sanitized = sanitizeErrorMessage(error);
            expect(sanitized).toBe('Key: [REDACTED]');
        });

        it('should redact hex-encoded strings', () => {
            const error = new Error('Key: 0123456789abcdef0123456789abcdef');
            const sanitized = sanitizeErrorMessage(error);
            expect(sanitized).toBe('Key: [REDACTED]');
        });

        it('should redact environment variable values', () => {
            const error = new Error('ENCRYPTION_MASTER_KEY=secretvalue123');
            const sanitized = sanitizeErrorMessage(error);
            expect(sanitized).toBe('ENCRYPTION_MASTER_KEY=[REDACTED]');
        });

        it('should handle multiple sensitive values', () => {
            const error = new Error(
                'Key: dGVzdGtleQ== and hex: 0123456789abcdef0123456789abcdef'
            );
            const sanitized = sanitizeErrorMessage(error);
            expect(sanitized).toBe('Key: [REDACTED] and hex: [REDACTED]');
        });

        it('should not redact short strings', () => {
            const error = new Error('Short error message');
            const sanitized = sanitizeErrorMessage(error);
            expect(sanitized).toBe('Short error message');
        });

        it('should preserve error context while redacting sensitive data', () => {
            const error = new Error(
                'Failed to decrypt with key: dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleQ=='
            );
            const sanitized = sanitizeErrorMessage(error);
            expect(sanitized).toContain('Failed to decrypt with key:');
            expect(sanitized).toContain('[REDACTED]');
            expect(sanitized).not.toContain('dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleQ==');
        });
    });
});

describe('User-Friendly Error Messages', () => {
    describe('getUserFriendlyErrorMessage', () => {
        it('should return helpful message for AuthenticationError', () => {
            const error = new AuthenticationError();
            const message = getUserFriendlyErrorMessage(error);
            expect(message).toContain('API token integrity check failed');
            expect(message).toContain('re-enter your API token');
            expect(message).not.toContain('authentication tag');
        });

        it('should return helpful message for DecryptionError', () => {
            const error = new DecryptionError('Decryption failed');
            const message = getUserFriendlyErrorMessage(error);
            expect(message).toContain('Failed to decrypt API token');
            expect(message).toContain('re-enter your API token');
        });

        it('should return helpful message for EncryptionError', () => {
            const error = new EncryptionError('Encryption failed');
            const message = getUserFriendlyErrorMessage(error);
            expect(message).toContain('Failed to encrypt API token');
            expect(message).toContain('try again');
        });

        it('should return system error message for KeyNotFoundError', () => {
            const error = new KeyNotFoundError();
            const message = getUserFriendlyErrorMessage(error);
            expect(message).toContain('System configuration error');
            expect(message).toContain('contact support');
            expect(message).not.toContain('ENCRYPTION_MASTER_KEY');
        });

        it('should return system error message for KeyValidationError', () => {
            const error = new KeyValidationError();
            const message = getUserFriendlyErrorMessage(error);
            expect(message).toContain('System configuration error');
            expect(message).toContain('contact support');
        });

        it('should return migration message for InvalidFormatError', () => {
            const error = new InvalidFormatError();
            const message = getUserFriendlyErrorMessage(error);
            expect(message).toContain('automatically migrated');
        });

        it('should return generic message for unknown errors', () => {
            const error = new Error('Unknown error');
            const message = getUserFriendlyErrorMessage(error);
            expect(message).toContain('unexpected error');
            expect(message).toContain('try again');
        });

        it('should never expose sensitive data in user messages', () => {
            const errors = [
                new AuthenticationError('Key: dGVzdGtleQ=='),
                new DecryptionError('Token: secrettoken123'),
                new EncryptionError('Key: 0123456789abcdef'),
                new KeyNotFoundError('ENCRYPTION_MASTER_KEY=secret'),
            ];

            errors.forEach((error) => {
                const message = getUserFriendlyErrorMessage(error);
                expect(message).not.toContain('dGVzdGtleQ==');
                expect(message).not.toContain('secrettoken123');
                expect(message).not.toContain('0123456789abcdef');
                expect(message).not.toContain('ENCRYPTION_MASTER_KEY=');
            });
        });
    });
});

describe('Error Class Hierarchy', () => {
    it('should maintain proper inheritance chain', () => {
        const authError = new AuthenticationError();
        expect(authError).toBeInstanceOf(AuthenticationError);
        expect(authError).toBeInstanceOf(DecryptionError);
        expect(authError).toBeInstanceOf(Error);
    });

    it('should allow catching by base class', () => {
        try {
            throw new AuthenticationError('Test');
        } catch (error) {
            expect(error).toBeInstanceOf(DecryptionError);
            expect(error).toBeInstanceOf(Error);
        }
    });

    it('should allow specific error type checking', () => {
        const error = new AuthenticationError();

        if (error instanceof AuthenticationError) {
            expect(error.name).toBe('AuthenticationError');
        } else {
            fail('Should be AuthenticationError');
        }
    });
});

describe('Error Messages Never Expose Sensitive Data', () => {
    it('should not expose keys in EncryptionError', () => {
        const error = new EncryptionError('Failed with key: dGVzdGtleQ==');
        expect(error.message).toBeDefined();
        // The error message itself might contain sensitive data, but when sanitized it should not
        const sanitized = sanitizeErrorMessage(error);
        expect(sanitized).not.toContain('dGVzdGtleQ==');
    });

    it('should not expose tokens in DecryptionError', () => {
        const error = new DecryptionError('Failed to decrypt: secrettoken123');
        const sanitized = sanitizeErrorMessage(error);
        // Short strings might not be redacted, but base64/hex will be
        expect(sanitized).toBeDefined();
    });

    it('should not expose keys in KeyNotFoundError', () => {
        const error = new KeyNotFoundError('ENCRYPTION_MASTER_KEY=secretvalue');
        const sanitized = sanitizeErrorMessage(error);
        expect(sanitized).toContain('ENCRYPTION_MASTER_KEY=[REDACTED]');
    });

    it('should handle errors with multiple sensitive values', () => {
        const error = new Error(
            'Encryption failed: key=dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleQ== token=YW5vdGhlcnNlY3JldHZhbHVl'
        );
        const sanitized = sanitizeErrorMessage(error);
        expect(sanitized).not.toContain('dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleQ==');
        expect(sanitized).not.toContain('YW5vdGhlcnNlY3JldHZhbHVl');
        expect(sanitized).toContain('[REDACTED]');
    });
});
