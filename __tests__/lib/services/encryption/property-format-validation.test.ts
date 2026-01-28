/**
 * Property-Based Test: Format Validation Before Decryption
 * Feature: api-token-encryption
 * Property 14: Format Validation Before Decryption
 * Validates: Requirements 8.3, 8.4
 * 
 * For any string passed to the decrypt function, invalid formats should be rejected 
 * before attempting decryption, and valid formats should proceed to decryption.
 */

import fc from 'fast-check';
import { EncryptionService } from '@/lib/services/encryption/encryption-service';
import { KeyManager } from '@/lib/services/encryption/key-manager';
import { InvalidFormatError } from '@/lib/services/encryption/errors';

describe('Feature: api-token-encryption, Property 14: Format Validation Before Decryption', () => {
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

  it('should reject strings with invalid format (wrong number of parts)', () => {
    fc.assert(
      fc.property(
        // Generate strings with wrong number of colons
        fc.oneof(
          fc.string(), // No colons
          fc.tuple(fc.string(), fc.string()).map(([a, b]) => `${a}:${b}`), // 1 colon
          fc.tuple(fc.string(), fc.string(), fc.string()).map(([a, b, c]) => `${a}:${b}:${c}`), // 2 colons
          fc.tuple(fc.string(), fc.string(), fc.string(), fc.string(), fc.string())
            .map(([a, b, c, d, e]) => `${a}:${b}:${c}:${d}:${e}`) // 4 colons
        ),
        (invalidFormat) => {
          // Should throw InvalidFormatError
          expect(() => {
            encryptionService.decrypt(invalidFormat);
          }).toThrow(InvalidFormatError);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject strings with invalid algorithm identifier', () => {
    fc.assert(
      fc.property(
        // Generate strings with wrong algorithm but correct structure
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s !== 'aes-256-gcm'),
        fc.string({ minLength: 16, maxLength: 16 }),
        fc.string({ minLength: 24, maxLength: 24 }),
        fc.string({ minLength: 20, maxLength: 100 }),
        (algorithm, iv, authTag, ciphertext) => {
          const invalidFormat = `${algorithm}:${iv}:${authTag}:${ciphertext}`;
          
          // Should throw InvalidFormatError
          expect(() => {
            encryptionService.decrypt(invalidFormat);
          }).toThrow(InvalidFormatError);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject strings with invalid base64 encoding', () => {
    fc.assert(
      fc.property(
        // Generate strings with invalid base64 characters
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !/^[A-Za-z0-9+/=]*$/.test(s)),
        (invalidBase64) => {
          const invalidFormat = `aes-256-gcm:${invalidBase64}:validAuthTag123=:validCipher456=`;
          
          // Should throw InvalidFormatError
          expect(() => {
            encryptionService.decrypt(invalidFormat);
          }).toThrow(InvalidFormatError);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accept valid encrypted format and attempt decryption', () => {
    fc.assert(
      fc.property(
        // Generate random plaintext tokens
        fc.string({ minLength: 1, maxLength: 100 }),
        (plaintext) => {
          // Encrypt to get valid format
          const encrypted = encryptionService.encrypt(plaintext);
          
          // Should not throw format error (may throw decryption error if tampered)
          // But format validation should pass
          expect(() => {
            const decrypted = encryptionService.decrypt(encrypted);
            expect(decrypted).toBe(plaintext);
          }).not.toThrow(InvalidFormatError);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate format before attempting cryptographic operations', () => {
    fc.assert(
      fc.property(
        // Generate completely random strings
        fc.string({ minLength: 0, maxLength: 200 }),
        (randomString) => {
          // If it doesn't match the format, should fail fast with InvalidFormatError
          // without attempting expensive crypto operations
          const parts = randomString.split(':');
          
          if (parts.length !== 4 || parts[0] !== 'aes-256-gcm') {
            expect(() => {
              encryptionService.decrypt(randomString);
            }).toThrow(InvalidFormatError);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
