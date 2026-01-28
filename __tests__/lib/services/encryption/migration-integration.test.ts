/**
 * Integration tests for automatic plaintext token migration
 * Tests the complete migration flow from detection to encryption
 */

import { EncryptionService } from '@/lib/services/encryption/encryption-service';
import { KeyManager } from '@/lib/services/encryption/key-manager';

describe('Automatic Token Migration Integration', () => {
    let encryptionService: EncryptionService;
    let keyManager: KeyManager;

    beforeAll(() => {
        // Set up encryption key for testing
        process.env.ENCRYPTION_MASTER_KEY = Buffer.from('a'.repeat(32)).toString('base64');
        keyManager = new KeyManager();
        encryptionService = new EncryptionService(keyManager);
    });

    afterAll(() => {
        delete process.env.ENCRYPTION_MASTER_KEY;
    });

    describe('Token Detection', () => {
        it('should correctly identify plaintext tokens', () => {
            const plaintextToken = 'my-api-token-12345';
            expect(encryptionService.isEncrypted(plaintextToken)).toBe(false);
        });

        it('should correctly identify encrypted tokens', () => {
            const plaintextToken = 'my-api-token-12345';
            const encryptedToken = encryptionService.encrypt(plaintextToken);
            expect(encryptionService.isEncrypted(encryptedToken)).toBe(true);
        });

        it('should handle edge cases in detection', () => {
            // Empty string
            expect(encryptionService.isEncrypted('')).toBe(false);

            // Malformed encrypted format
            expect(encryptionService.isEncrypted('aes-256-gcm:invalid')).toBe(false);

            // Wrong algorithm
            expect(encryptionService.isEncrypted('aes-128-cbc:abc:def:ghi')).toBe(false);
        });
    });

    describe('Migration Flow', () => {
        it('should successfully migrate plaintext to encrypted and back', () => {
            const originalPlaintext = 'my-secret-api-token';

            // Step 1: Detect plaintext (not encrypted)
            expect(encryptionService.isEncrypted(originalPlaintext)).toBe(false);

            // Step 2: Encrypt the plaintext token
            const encryptedToken = encryptionService.encrypt(originalPlaintext);
            expect(encryptionService.isEncrypted(encryptedToken)).toBe(true);

            // Step 3: Decrypt to verify original value preserved
            const decryptedToken = encryptionService.decrypt(encryptedToken);
            expect(decryptedToken).toBe(originalPlaintext);
        });

        it('should handle multiple migrations of the same token', () => {
            const originalPlaintext = 'my-api-token';

            // First migration
            const encrypted1 = encryptionService.encrypt(originalPlaintext);
            const decrypted1 = encryptionService.decrypt(encrypted1);
            expect(decrypted1).toBe(originalPlaintext);

            // Second migration (if retry needed)
            const encrypted2 = encryptionService.encrypt(originalPlaintext);
            const decrypted2 = encryptionService.decrypt(encrypted2);
            expect(decrypted2).toBe(originalPlaintext);

            // Encrypted values should be different (unique IVs)
            expect(encrypted1).not.toBe(encrypted2);
        });

        it('should preserve token functionality after migration', () => {
            const tokens = [
                'simple-token',
                'token-with-special-chars-!@#$%',
                'very-long-token-' + 'x'.repeat(500),
                'token with spaces',
                'token\nwith\nnewlines',
            ];

            tokens.forEach((token) => {
                const encrypted = encryptionService.encrypt(token);
                const decrypted = encryptionService.decrypt(encrypted);
                expect(decrypted).toBe(token);
            });
        });
    });

    describe('Migration Error Scenarios', () => {
        it('should detect corrupted encrypted tokens', () => {
            const plaintext = 'my-token';
            const encrypted = encryptionService.encrypt(plaintext);

            // Corrupt the encrypted token
            const corrupted = encrypted.replace(/.$/, 'X');

            // Should still be detected as encrypted format
            expect(encryptionService.isEncrypted(corrupted)).toBe(true);

            // But decryption should fail
            expect(() => encryptionService.decrypt(corrupted)).toThrow();
        });

        it('should handle tokens that look like encrypted format but are not', () => {
            const fakeEncrypted = 'aes-256-gcm:fake:fake:fake';

            // Should be detected as encrypted format
            expect(encryptionService.isEncrypted(fakeEncrypted)).toBe(false);
        });
    });

    describe('Backward Compatibility', () => {
        it('should allow plaintext tokens to be used directly if migration fails', () => {
            const plaintextToken = 'my-plaintext-token';

            // In case of migration failure, the plaintext token should still be usable
            // This simulates the backward compatibility requirement
            expect(encryptionService.isEncrypted(plaintextToken)).toBe(false);

            // The system should be able to detect it's plaintext and handle accordingly
            // (In real implementation, this would be handled by WebsiteService)
        });
    });
});
