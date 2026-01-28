/**
 * Property-Based Test: Token Length Constraints
 * Feature: api-token-encryption
 * Property 15: Token Length Constraints
 * Validates: Requirements 8.5
 * 
 * For any plaintext token, the resulting encrypted token should not exceed 1024 characters in length.
 */

import fc from 'fast-check';
import { EncryptionService } from '@/lib/services/encryption/encryption-service';
import { KeyManager } from '@/lib/services/encryption/key-manager';

describe('Feature: api-token-encryption, Property 15: Token Length Constraints', () => {
  let encryptionService: EncryptionService;
  const originalEnv = process.env.ENCRYPTION_MASTER_KEY;

  beforeAll(() => {
    // Set up a valid encryption key
    const validKey = Buffer.alloc(32).fill(1);
    process.env.ENCRYPTION_MASTER_KEY = validKey.toString('base64');
    const keyManager = new KeyManager();
    encryptionService = new EncryptionService(keyManager);
  });

  afterAll(() => {
    // Restore original environment
    if (originalEnv) {
      process.env.ENCRYPTION_MASTER_KEY = originalEnv;
    } else {
      delete process.env.ENCRYPTION_MASTER_KEY;
    }
  });

  it('should produce encrypted tokens under 1024 characters for typical API tokens', () => {
    fc.assert(
      fc.property(
        // Generate typical API token lengths (32-256 characters)
        fc.string({ minLength: 32, maxLength: 256 }),
        (plaintext) => {
          const encrypted = encryptionService.encrypt(plaintext);
          
          // Encrypted token should not exceed 1024 characters
          expect(encrypted.length).toBeLessThanOrEqual(1024);
          
          // Verify it can be decrypted back
          const decrypted = encryptionService.decrypt(encrypted);
          expect(decrypted).toBe(plaintext);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce encrypted tokens under 1024 characters for short tokens', () => {
    fc.assert(
      fc.property(
        // Generate short tokens (1-50 characters)
        fc.string({ minLength: 1, maxLength: 50 }),
        (plaintext) => {
          const encrypted = encryptionService.encrypt(plaintext);
          
          // Encrypted token should not exceed 1024 characters
          expect(encrypted.length).toBeLessThanOrEqual(1024);
          
          // Verify it can be decrypted back
          const decrypted = encryptionService.decrypt(encrypted);
          expect(decrypted).toBe(plaintext);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce encrypted tokens under 1024 characters for long tokens', () => {
    fc.assert(
      fc.property(
        // Generate longer tokens (up to 500 characters)
        fc.string({ minLength: 256, maxLength: 500 }),
        (plaintext) => {
          const encrypted = encryptionService.encrypt(plaintext);
          
          // Encrypted token should not exceed 1024 characters
          expect(encrypted.length).toBeLessThanOrEqual(1024);
          
          // Verify it can be decrypted back
          const decrypted = encryptionService.decrypt(encrypted);
          expect(decrypted).toBe(plaintext);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should calculate encrypted length predictably based on plaintext length', () => {
    fc.assert(
      fc.property(
        // Generate tokens of various lengths
        fc.string({ minLength: 1, maxLength: 600 }),
        (plaintext) => {
          const encrypted = encryptionService.encrypt(plaintext);
          
          // Parse the encrypted format: aes-256-gcm:iv:authTag:ciphertext
          const parts = encrypted.split(':');
          expect(parts.length).toBe(4);
          
          const [algorithm, iv, authTag, ciphertext] = parts;
          
          // Algorithm is fixed: "aes-256-gcm" (11 chars)
          expect(algorithm).toBe('aes-256-gcm');
          
          // IV is 12 bytes = 16 base64 chars
          expect(iv.length).toBe(16);
          
          // Auth tag is 16 bytes = 24 base64 chars
          expect(authTag.length).toBe(24);
          
          // Ciphertext length should be roughly plaintext length * 4/3 (base64 encoding)
          // Plus some overhead for padding
          const expectedCiphertextLength = Math.ceil((plaintext.length * 4) / 3);
          expect(ciphertext.length).toBeGreaterThanOrEqual(expectedCiphertextLength - 4);
          expect(ciphertext.length).toBeLessThanOrEqual(expectedCiphertextLength + 4);
          
          // Total length: algorithm + 3 colons + iv + authTag + ciphertext
          const totalLength = 11 + 3 + 16 + 24 + ciphertext.length;
          expect(encrypted.length).toBe(totalLength);
          
          // Should not exceed 1024
          expect(encrypted.length).toBeLessThanOrEqual(1024);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle edge case of very long tokens gracefully', () => {
    fc.assert(
      fc.property(
        // Generate very long tokens (up to 700 characters - close to limit)
        fc.string({ minLength: 600, maxLength: 700 }),
        (plaintext) => {
          const encrypted = encryptionService.encrypt(plaintext);
          
          // Should still be under 1024 characters
          expect(encrypted.length).toBeLessThanOrEqual(1024);
          
          // Should still decrypt correctly
          const decrypted = encryptionService.decrypt(encrypted);
          expect(decrypted).toBe(plaintext);
        }
      ),
      { numRuns: 100 }
    );
  });
});
