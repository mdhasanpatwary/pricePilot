/**
 * Encryption service exports
 */

export { KeyManager } from './key-manager';
export { EncryptionService } from './encryption-service';
export { MigrationUtility } from './migration-utility';
export { KeyRotationUtility } from './key-rotation-utility';
export { TokenRecoveryService } from './token-recovery';
export {
    EncryptionError,
    DecryptionError,
    AuthenticationError,
    InvalidFormatError,
    KeyNotFoundError,
    KeyValidationError,
    sanitizeErrorMessage,
    getUserFriendlyErrorMessage,
    getStructuredErrorMessage,
    ErrorMessages
} from './errors';
export {
    handleEncryptionError,
    withEncryptionErrorHandling,
    formatErrorForUI,
    isRecoverableError,
    isSystemError
} from './error-handler';
export {
    logTokenEncrypted,
    logTokenDecrypted,
    logTokenMigrated,
    logDecryptionFailed,
    logKeyAccessed,
    logKeyValidated,
    logEncryptionFailed,
    logKeyRotated
} from './audit-logger';
export type {
    IEncryptionService,
    IKeyManager,
    EncryptionResult,
    DecryptionResult,
    EncryptedString,
    PlaintextString
} from './types';
export type {
    MigrationOptions,
    MigrationResult,
    MigrationError
} from './migration-utility';
export type {
    KeyRotationOptions,
    KeyRotationResult,
    KeyRotationError
} from './key-rotation-utility';
export type {
    TokenRecoveryResult
} from './token-recovery';
export type {
    ErrorResponse
} from './error-handler';
