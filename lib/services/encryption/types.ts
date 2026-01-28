/**
 * Type definitions for encryption service
 */

// Branded type for encrypted strings to prevent mixing with plaintext
export type EncryptedString = string & { readonly __brand: 'encrypted' };
export type PlaintextString = string;

/**
 * Result of an encryption operation
 */
export interface EncryptionResult {
    encrypted: EncryptedString;
    algorithm: string;
    iv: string;
    authTag: string;
}

/**
 * Result of a decryption operation
 */
export interface DecryptionResult {
    plaintext: PlaintextString;
    algorithm: string;
}

/**
 * Encryption service interface
 */
export interface IEncryptionService {
    /**
     * Encrypts a plaintext string using AES-256-GCM
     * @param plaintext - The string to encrypt
     * @returns Encrypted string in format: aes-256-gcm:iv:authTag:ciphertext
     * @throws EncryptionError if encryption fails
     */
    encrypt(plaintext: string): string;

    /**
     * Decrypts an encrypted string
     * @param encrypted - The encrypted string
     * @returns Decrypted plaintext string
     * @throws DecryptionError if decryption fails or auth tag verification fails
     */
    decrypt(encrypted: string): string;

    /**
     * Checks if a string is in encrypted format
     * @param value - The string to check
     * @returns true if the string appears to be encrypted
     */
    isEncrypted(value: string): boolean;
}

/**
 * Key manager interface
 */
export interface IKeyManager {
    /**
     * Retrieves the master encryption key
     * @returns Buffer containing the 256-bit key
     * @throws KeyNotFoundError if key is not configured
     */
    getMasterKey(): Buffer;

    /**
     * Validates that the master key is properly configured
     * @throws KeyValidationError if key is invalid
     */
    validateKey(): void;

    /**
     * Supports key rotation by managing multiple keys
     * @param keyId - Identifier for the key version
     * @returns Buffer containing the specified key
     */
    getKey(keyId: string): Buffer;
}
