/**
 * Key Manager for secure encryption key management
 */

import { IKeyManager } from './types';
import { KeyNotFoundError, KeyValidationError } from './errors';
import { logKeyAccessed, logKeyValidated } from './audit-logger';

/**
 * Manages encryption keys with secure loading and validation
 */
export class KeyManager implements IKeyManager {
    private masterKey: Buffer | null = null;
    private keys: Map<string, Buffer> = new Map();

    constructor() {
        // Master key will be loaded and validated on first use
    }

    /**
     * Loads the master encryption key from environment variables
     * @private
     */
    private loadMasterKey(): void {
        const keyString = process.env.ENCRYPTION_MASTER_KEY;

        if (!keyString) {
            throw new KeyNotFoundError(
                'ENCRYPTION_MASTER_KEY environment variable is not set. ' +
                'Generate a key using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
            );
        }

        try {
            // Decode base64-encoded key
            this.masterKey = Buffer.from(keyString, 'base64');

            // Store in keys map with default ID
            this.keys.set('master', this.masterKey);
        } catch (error) {
            throw new KeyValidationError(
                'Failed to decode ENCRYPTION_MASTER_KEY. Key must be base64-encoded.'
            );
        }
    }

    /**
     * Validates that the master key meets security requirements
     * @throws KeyValidationError if key is invalid
     */
    public validateKey(): void {
        try {
            if (!this.masterKey) {
                throw new KeyNotFoundError('Master key not loaded');
            }

            // Validate key length (must be exactly 32 bytes for AES-256)
            if (this.masterKey.length !== 32) {
                const errorMessage = `Invalid key length: ${this.masterKey.length} bytes. ` +
                    'AES-256 requires exactly 32 bytes (256 bits). ' +
                    'Generate a valid key using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"';

                // Log validation failure
                logKeyValidated(false, errorMessage);

                throw new KeyValidationError(errorMessage);
            }

            // Log successful validation
            logKeyValidated(true);
        } catch (error) {
            // If it's already a KeyValidationError or KeyNotFoundError, rethrow
            if (error instanceof KeyValidationError || error instanceof KeyNotFoundError) {
                throw error;
            }

            // Log unexpected validation error
            const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
            logKeyValidated(false, errorMessage);

            throw new KeyValidationError('Key validation failed: ' + errorMessage);
        }
    }

    /**
     * Retrieves the master encryption key
     * @returns Buffer containing the 256-bit key
     * @throws KeyNotFoundError if key is not configured
     */
    public getMasterKey(): Buffer {
        if (!this.masterKey) {
            this.loadMasterKey();
            this.validateKey();
        }

        if (!this.masterKey) {
            throw new KeyNotFoundError('Master key not loaded');
        }

        // Log key access for audit trail
        logKeyAccessed('getMasterKey');

        return this.masterKey;
    }

    /**
     * Supports key rotation by managing multiple keys
     * @param keyId - Identifier for the key version
     * @returns Buffer containing the specified key
     * @throws KeyNotFoundError if key is not found
     */
    public getKey(keyId: string): Buffer {
        const key = this.keys.get(keyId);

        if (!key) {
            // Check for new key in environment (for key rotation)
            if (keyId === 'new') {
                const newKeyString = process.env.ENCRYPTION_MASTER_KEY_NEW;
                if (newKeyString) {
                    try {
                        const newKey = Buffer.from(newKeyString, 'base64');

                        // Validate new key length
                        if (newKey.length !== 32) {
                            throw new KeyValidationError(
                                `Invalid new key length: ${newKey.length} bytes. Must be 32 bytes.`
                            );
                        }

                        this.keys.set('new', newKey);

                        // Log key access for audit trail
                        logKeyAccessed(`getKey:${keyId}`);

                        return newKey;
                    } catch (error) {
                        if (error instanceof KeyValidationError) {
                            throw error;
                        }
                        throw new KeyValidationError(
                            'Failed to decode ENCRYPTION_MASTER_KEY_NEW. Key must be base64-encoded.'
                        );
                    }
                }
            }

            throw new KeyNotFoundError(`Encryption key not found: ${keyId}`);
        }

        // Log key access for audit trail
        logKeyAccessed(`getKey:${keyId}`);

        return key;
    }
}
