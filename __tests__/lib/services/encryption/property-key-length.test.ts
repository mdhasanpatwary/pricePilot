/**
 * Property-Based Test: Key Length Validation
 * Feature: api-token-encryption
 * Property 5: Key Length Validation
 * Validates: Requirements 2.3
 * 
 * For any encryption key, keys shorter than 256 bits (32 bytes) should be rejected during initialization.
 */

import fc from 'fast-check';
import { KeyManager } from '@/lib/services/encryption/key-manager';
import { KeyValidationError } from '@/lib/services/encryption/errors';

describe('Feature: api-token-encryption, Property 5: Key Length Validation', () => {
  const originalEnv = process.env.ENCRYPTION_MASTER_KEY;

  afterEach(() => {
    // Restore original environment
    if (originalEnv) {
      process.env.ENCRYPTION_MASTER_KEY = originalEnv;
    } else {
      delete process.env.ENCRYPTION_MASTER_KEY;
    }
  });

  it('should reject keys shorter than 256 bits (32 bytes)', () => {
    fc.assert(
      fc.property(
        // Generate keys with length from 1 to 31 bytes (all invalid)
        fc.integer({ min: 1, max: 31 }),
        (keyLength) => {
          // Generate a random key of the specified length
          const invalidKey = Buffer.alloc(keyLength).fill(0);
          const base64Key = invalidKey.toString('base64');
          
          // Set the invalid key in environment
          process.env.ENCRYPTION_MASTER_KEY = base64Key;
          
          // Attempt to create KeyManager - should throw
          expect(() => {
            const keyManager = new KeyManager();
            keyManager.validateKey();
          }).toThrow(KeyValidationError);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accept keys of exactly 256 bits (32 bytes)', () => {
    fc.assert(
      fc.property(
        // Generate random 32-byte keys
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        (keyBytes) => {
          const validKey = Buffer.from(keyBytes);
          const base64Key = validKey.toString('base64');
          
          // Set the valid key in environment
          process.env.ENCRYPTION_MASTER_KEY = base64Key;
          
          // Should not throw
          expect(() => {
            const keyManager = new KeyManager();
            keyManager.validateKey();
            const key = keyManager.getMasterKey();
            expect(key.length).toBe(32);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject keys longer than 256 bits (32 bytes)', () => {
    fc.assert(
      fc.property(
        // Generate keys with length from 33 to 64 bytes (all invalid)
        fc.integer({ min: 33, max: 64 }),
        (keyLength) => {
          // Generate a random key of the specified length
          const invalidKey = Buffer.alloc(keyLength).fill(0);
          const base64Key = invalidKey.toString('base64');
          
          // Set the invalid key in environment
          process.env.ENCRYPTION_MASTER_KEY = base64Key;
          
          // Attempt to create KeyManager - should throw
          expect(() => {
            const keyManager = new KeyManager();
            keyManager.validateKey();
          }).toThrow(KeyValidationError);
        }
      ),
      { numRuns: 100 }
    );
  });
});
