/**
 * Encryption Service for secure API token encryption/decryption
 * Uses AES-256-GCM for authenticated encryption
 */

import crypto from 'crypto';
import { IEncryptionService } from './types';
import { IKeyManager } from './types';
import {
    EncryptionError,
    DecryptionError,
    AuthenticationError,
    InvalidFormatError,
} from './errors';
import { logKeyAccessed } from './audit-logger';
import { encryptionPerformanceMonitor } from './performance-monitor';

/**
 * Core cryptographic operations for encrypting and decrypting API tokens
 */
export class EncryptionService implements IEncryptionService {
    private readonly algorithm = 'aes-256-gcm';
    private readonly ivLength = 12; // 12 bytes for GCM mode
    private readonly authTagLength = 16; // 16 bytes authentication tag

    constructor(private keyManager: IKeyManager) { }

    /**
     * Encrypts a plaintext string using AES-256-GCM
     * @param plaintext - The string to encrypt
     * @returns Encrypted string in format: aes-256-gcm:iv:authTag:ciphertext
     * @throws EncryptionError if encryption fails
     */
    public encrypt(plaintext: string): string {
        const startTime = performance.now();
        let success = false;

        try {
            // Log key access for audit trail
            logKeyAccessed('encrypt');

            // Get the master encryption key
            const key = this.keyManager.getMasterKey();

            // Generate a random 12-byte initialization vector
            const iv = crypto.randomBytes(this.ivLength);

            // Create cipher with AES-256-GCM
            const cipher = crypto.createCipheriv(this.algorithm, key, iv);

            // Encrypt the plaintext
            let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
            ciphertext += cipher.final('base64');

            // Get the authentication tag
            const authTag = cipher.getAuthTag();

            // Format: algorithm:iv:authTag:ciphertext
            const encrypted = [
                this.algorithm,
                iv.toString('base64'),
                authTag.toString('base64'),
                ciphertext,
            ].join(':');

            success = true;
            return encrypted;
        } catch (error) {
            // Ensure we never expose sensitive data in error messages
            if (error instanceof Error) {
                throw new EncryptionError(
                    'Failed to encrypt data. Please check encryption configuration.',
                    error
                );
            }
            throw new EncryptionError(
                'Failed to encrypt data. Unknown error occurred.'
            );
        } finally {
            // Record performance metrics
            const latency = performance.now() - startTime;
            encryptionPerformanceMonitor.recordOperation('encrypt', latency, success);
        }
    }

    /**
     * Decrypts an encrypted string
     * @param encrypted - The encrypted string
     * @returns Decrypted plaintext string
     * @throws DecryptionError if decryption fails or auth tag verification fails
     * @throws InvalidFormatError if encrypted string format is invalid
     * @throws AuthenticationError if auth tag verification fails (tampering detected)
     */
    public decrypt(encrypted: string): string {
        const startTime = performance.now();
        let success = false;

        try {
            // Log key access for audit trail
            logKeyAccessed('decrypt');

            // Validate format before attempting decryption
            if (!this.isEncrypted(encrypted)) {
                throw new InvalidFormatError(
                    'Invalid encrypted string format. Expected format: aes-256-gcm:iv:authTag:ciphertext'
                );
            }

            // Parse the encrypted string
            const parts = encrypted.split(':');
            const [algorithm, ivBase64, authTagBase64, ciphertext] = parts;

            // Validate algorithm
            if (algorithm !== this.algorithm) {
                throw new InvalidFormatError(
                    `Unsupported encryption algorithm: ${algorithm}`
                );
            }

            // Decode components from base64
            const iv = Buffer.from(ivBase64, 'base64');
            const authTag = Buffer.from(authTagBase64, 'base64');

            // Get the master encryption key
            const key = this.keyManager.getMasterKey();

            // Create decipher with AES-256-GCM
            const decipher = crypto.createDecipheriv(this.algorithm, key, iv);

            // Set the authentication tag for verification
            decipher.setAuthTag(authTag);

            // Decrypt the ciphertext
            let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
            plaintext += decipher.final('utf8');

            success = true;
            return plaintext;
        } catch (error) {
            // Handle specific error types
            if (error instanceof InvalidFormatError) {
                throw error;
            }

            // Check if it's an authentication error (tampering detected)
            if (error instanceof Error) {
                if (
                    error.message.includes('Unsupported state') ||
                    error.message.includes('auth') ||
                    error.message.includes('tag')
                ) {
                    throw new AuthenticationError(
                        'Authentication tag verification failed. Data may have been tampered with.'
                    );
                }

                throw new DecryptionError(
                    'Failed to decrypt data. Please verify encryption key and data integrity.',
                    error
                );
            }

            throw new DecryptionError(
                'Failed to decrypt data. Unknown error occurred.'
            );
        } finally {
            // Record performance metrics
            const latency = performance.now() - startTime;
            encryptionPerformanceMonitor.recordOperation('decrypt', latency, success);
        }
    }

    /**
     * Checks if a string is in encrypted format
     * @param value - The string to check
     * @returns true if the string appears to be encrypted
     */
    public isEncrypted(value: string): boolean {
        if (!value || typeof value !== 'string') {
            return false;
        }

        // Check format: algorithm:iv:authTag:ciphertext
        const parts = value.split(':');
        if (parts.length !== 4) {
            return false;
        }

        const [algorithm, iv, authTag, ciphertext] = parts;

        // Validate algorithm
        if (algorithm !== this.algorithm) {
            return false;
        }

        // Validate base64 encoding of components
        const base64Regex = /^[A-Za-z0-9+/]+=*$/;

        if (!base64Regex.test(iv)) {
            return false;
        }

        if (!base64Regex.test(authTag)) {
            return false;
        }

        // Ciphertext can be empty for empty plaintext, so only validate if not empty
        if (ciphertext && !base64Regex.test(ciphertext)) {
            return false;
        }

        // Validate component lengths (decoded)
        try {
            const ivBuffer = Buffer.from(iv, 'base64');
            const authTagBuffer = Buffer.from(authTag, 'base64');

            // IV should be 12 bytes for GCM
            if (ivBuffer.length !== this.ivLength) {
                return false;
            }

            // Auth tag should be 16 bytes
            if (authTagBuffer.length !== this.authTagLength) {
                return false;
            }

            return true;
        } catch {
            return false;
        }
    }
}
