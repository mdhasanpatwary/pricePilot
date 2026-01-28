/**
 * Basic tests for EncryptionService
 * Full test suite will be implemented in task 2.4-2.8
 */

import crypto from 'crypto';
import { EncryptionService } from '@/lib/services/encryption/encryption-service';
import { KeyManager } from '@/lib/services/encryption/key-manager';
import {
    EncryptionError,
    DecryptionError,
    InvalidFormatError,
    AuthenticationError,
} from '@/lib/services/encryption/errors';

describe('EncryptionService', () => {
    let encryptionService: EncryptionService;
    let keyManager: KeyManager;

    beforeAll(() => {
        // Set up a test encryption key (exactly 32 bytes)
        const testKey = crypto.randomBytes(32);
        process.env.ENCRYPTION_MASTER_KEY = testKey.toString('base64');
        keyManager = new KeyManager();
        encryptionService = new EncryptionService(keyManager);
    });

    afterAll(() => {
        delete process.env.ENCRYPTION_MASTER_KEY;
    });

    describe('encrypt', () => {
        it('should encrypt a plaintext string', () => {
            const plaintext = 'my-secret-api-token';
            const encrypted = encryptionService.encrypt(plaintext);

            expect(encrypted).toBeDefined();
            expect(typeof encrypted).toBe('string');
            expect(encrypted).toContain('aes-256-gcm:');
        });

        it('should produce different ciphertext for same plaintext', () => {
            const plaintext = 'my-secret-api-token';
            const encrypted1 = encryptionService.encrypt(plaintext);
            const encrypted2 = encryptionService.encrypt(plaintext);

            expect(encrypted1).not.toBe(encrypted2);
        });

        it('should return encrypted string in correct format', () => {
            const plaintext = 'test-token';
            const encrypted = encryptionService.encrypt(plaintext);

            const parts = encrypted.split(':');
            expect(parts).toHaveLength(4);
            expect(parts[0]).toBe('aes-256-gcm');
        });
    });

    describe('decrypt', () => {
        it('should decrypt an encrypted string back to plaintext', () => {
            const plaintext = 'my-secret-api-token';
            const encrypted = encryptionService.encrypt(plaintext);
            const decrypted = encryptionService.decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });

        it('should throw InvalidFormatError for invalid format', () => {
            expect(() => {
                encryptionService.decrypt('invalid-format');
            }).toThrow(InvalidFormatError);
        });

        it('should throw InvalidFormatError for wrong number of parts', () => {
            expect(() => {
                encryptionService.decrypt('aes-256-gcm:iv:authTag');
            }).toThrow(InvalidFormatError);
        });

        it('should throw DecryptionError for corrupted ciphertext', () => {
            const plaintext = 'test-token';
            const encrypted = encryptionService.encrypt(plaintext);
            const parts = encrypted.split(':');

            // Corrupt the ciphertext but keep it valid base64
            const corruptedCiphertext = Buffer.from('corrupted-data').toString('base64');
            parts[3] = corruptedCiphertext;
            const corrupted = parts.join(':');

            expect(() => {
                encryptionService.decrypt(corrupted);
            }).toThrow(DecryptionError);
        });
    });

    describe('isEncrypted', () => {
        it('should return true for encrypted strings', () => {
            const plaintext = 'test-token';
            const encrypted = encryptionService.encrypt(plaintext);

            expect(encryptionService.isEncrypted(encrypted)).toBe(true);
        });

        it('should return false for plaintext strings', () => {
            expect(encryptionService.isEncrypted('plaintext-token')).toBe(false);
        });

        it('should return false for invalid format', () => {
            expect(encryptionService.isEncrypted('aes-256-gcm:invalid')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(encryptionService.isEncrypted('')).toBe(false);
        });

        it('should return false for non-string values', () => {
            expect(encryptionService.isEncrypted(null as any)).toBe(false);
            expect(encryptionService.isEncrypted(undefined as any)).toBe(false);
        });

        it('should return false for wrong algorithm', () => {
            expect(
                encryptionService.isEncrypted('aes-128-gcm:iv:authTag:ciphertext')
            ).toBe(false);
        });

        it('should validate base64 encoding', () => {
            expect(
                encryptionService.isEncrypted('aes-256-gcm:invalid!:authTag:ciphertext')
            ).toBe(false);
        });
    });

    describe('round-trip encryption', () => {
        it('should handle empty strings', () => {
            const plaintext = '';
            const encrypted = encryptionService.encrypt(plaintext);
            const decrypted = encryptionService.decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });

        it('should handle long tokens', () => {
            const plaintext = 'a'.repeat(1000);
            const encrypted = encryptionService.encrypt(plaintext);
            const decrypted = encryptionService.decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });

        it('should handle special characters', () => {
            const plaintext = 'token-with-special-chars!@#$%^&*()_+{}[]|:;<>?,./';
            const encrypted = encryptionService.encrypt(plaintext);
            const decrypted = encryptionService.decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });

        it('should handle unicode characters', () => {
            const plaintext = 'token-with-unicode-🔐🔑🛡️';
            const encrypted = encryptionService.encrypt(plaintext);
            const decrypted = encryptionService.decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });
    });
});
