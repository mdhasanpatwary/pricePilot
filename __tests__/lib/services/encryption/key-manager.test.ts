/**
 * Tests for KeyManager
 * Validates key loading, validation, and error handling
 */

import { KeyManager } from '@/lib/services/encryption';
import { KeyNotFoundError, KeyValidationError } from '@/lib/services/encryption/errors';

describe('KeyManager', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset environment before each test
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        // Restore original environment
        process.env = originalEnv;
    });

    describe('Key Loading', () => {
        it('should load key from environment variable', () => {
            // Generate a valid 32-byte key
            const validKey = Buffer.from('a'.repeat(32)).toString('base64');
            process.env.ENCRYPTION_MASTER_KEY = validKey;

            const keyManager = new KeyManager();
            const masterKey = keyManager.getMasterKey();

            expect(masterKey).toBeInstanceOf(Buffer);
            expect(masterKey.length).toBe(32);
        });

        it('should throw KeyNotFoundError when key is missing', () => {
            delete process.env.ENCRYPTION_MASTER_KEY;

            expect(() => new KeyManager()).toThrow(KeyNotFoundError);
            expect(() => new KeyManager()).toThrow('ENCRYPTION_MASTER_KEY environment variable is not set');
        });

        it('should cache key after first load', () => {
            const validKey = Buffer.from('a'.repeat(32)).toString('base64');
            process.env.ENCRYPTION_MASTER_KEY = validKey;

            const keyManager = new KeyManager();
            const key1 = keyManager.getMasterKey();
            const key2 = keyManager.getMasterKey();

            // Should return the same buffer instance (cached)
            expect(key1).toBe(key2);
        });
    });

    describe('Key Validation', () => {
        it('should validate key length is exactly 32 bytes', () => {
            const validKey = Buffer.from('a'.repeat(32)).toString('base64');
            process.env.ENCRYPTION_MASTER_KEY = validKey;

            const keyManager = new KeyManager();

            // Should not throw
            expect(() => keyManager.validateKey()).not.toThrow();
        });

        it('should throw KeyValidationError for short keys', () => {
            const shortKey = Buffer.from('a'.repeat(16)).toString('base64'); // Only 16 bytes
            process.env.ENCRYPTION_MASTER_KEY = shortKey;

            expect(() => new KeyManager()).toThrow(KeyValidationError);
            expect(() => new KeyManager()).toThrow('Invalid key length: 16 bytes');
        });

        it('should throw KeyValidationError for long keys', () => {
            const longKey = Buffer.from('a'.repeat(64)).toString('base64'); // 64 bytes
            process.env.ENCRYPTION_MASTER_KEY = longKey;

            expect(() => new KeyManager()).toThrow(KeyValidationError);
            expect(() => new KeyManager()).toThrow('Invalid key length: 64 bytes');
        });

        it('should throw KeyValidationError for invalid base64 that decodes to wrong length', () => {
            // This base64 string decodes successfully but to wrong length
            process.env.ENCRYPTION_MASTER_KEY = 'not-valid-base64!!!';

            expect(() => new KeyManager()).toThrow(KeyValidationError);
            expect(() => new KeyManager()).toThrow('Invalid key length');
        });
    });

    describe('Error Messages', () => {
        it('should never expose key in error messages', () => {
            const validKey = Buffer.from('a'.repeat(32)).toString('base64');
            process.env.ENCRYPTION_MASTER_KEY = validKey;

            const keyManager = new KeyManager();

            // Try to get a non-existent key
            try {
                keyManager.getKey('nonexistent');
                fail('Should have thrown an error');
            } catch (error) {
                if (error instanceof Error) {
                    // Error message should not contain the actual key
                    expect(error.message).not.toContain(validKey);
                    expect(error.message).toContain('nonexistent');
                }
            }
        });

        it('should provide helpful error message for missing key', () => {
            delete process.env.ENCRYPTION_MASTER_KEY;

            try {
                new KeyManager();
                fail('Should have thrown an error');
            } catch (error) {
                if (error instanceof KeyNotFoundError) {
                    expect(error.message).toContain('ENCRYPTION_MASTER_KEY');
                    expect(error.message).toContain('Generate a key using');
                }
            }
        });
    });

    describe('Key Rotation Support', () => {
        it('should support getting master key by ID', () => {
            const validKey = Buffer.from('a'.repeat(32)).toString('base64');
            process.env.ENCRYPTION_MASTER_KEY = validKey;

            const keyManager = new KeyManager();
            const masterKey = keyManager.getKey('master');

            expect(masterKey).toBeInstanceOf(Buffer);
            expect(masterKey.length).toBe(32);
        });

        it('should load new key from environment for rotation', () => {
            const oldKey = Buffer.from('a'.repeat(32)).toString('base64');
            const newKey = Buffer.from('b'.repeat(32)).toString('base64');

            process.env.ENCRYPTION_MASTER_KEY = oldKey;
            process.env.ENCRYPTION_MASTER_KEY_NEW = newKey;

            const keyManager = new KeyManager();
            const rotationKey = keyManager.getKey('new');

            expect(rotationKey).toBeInstanceOf(Buffer);
            expect(rotationKey.length).toBe(32);
            expect(rotationKey.toString('base64')).toBe(newKey);
        });

        it('should throw KeyNotFoundError for non-existent key ID', () => {
            const validKey = Buffer.from('a'.repeat(32)).toString('base64');
            process.env.ENCRYPTION_MASTER_KEY = validKey;

            const keyManager = new KeyManager();

            expect(() => keyManager.getKey('nonexistent')).toThrow(KeyNotFoundError);
            expect(() => keyManager.getKey('nonexistent')).toThrow('Encryption key not found: nonexistent');
        });

        it('should validate new key length during rotation', () => {
            const validKey = Buffer.from('a'.repeat(32)).toString('base64');
            const invalidNewKey = Buffer.from('b'.repeat(16)).toString('base64'); // Only 16 bytes

            process.env.ENCRYPTION_MASTER_KEY = validKey;
            process.env.ENCRYPTION_MASTER_KEY_NEW = invalidNewKey;

            const keyManager = new KeyManager();

            expect(() => keyManager.getKey('new')).toThrow(KeyValidationError);
            expect(() => keyManager.getKey('new')).toThrow('Invalid new key length: 16 bytes');
        });
    });
});
