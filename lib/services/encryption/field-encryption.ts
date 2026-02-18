import { EncryptionService } from "./encryption-service";
import { KeyManager } from "./key-manager";

const keyManager = new KeyManager();
const encryptionService = new EncryptionService(keyManager);

export function isEncryptedString(value: string | null | undefined): boolean {
  if (!value) return false;
  return encryptionService.isEncrypted(value);
}

/**
 * Encrypt a string for storage.
 *
 * Throws if encryption is not configured (e.g., ENCRYPTION_MASTER_KEY missing),
 * so callers don't silently persist plaintext secrets.
 */
export function encryptForStorage(plaintext: string): string {
  if (encryptionService.isEncrypted(plaintext)) return plaintext;
  return encryptionService.encrypt(plaintext);
}

/**
 * Decrypt a stored secret for runtime use.
 *
 * If the value isn't in encrypted format, returns it as-is. This supports
 * plaintext -> encrypted migration without breaking runtime.
 */
export function decryptForUse(storedValue: string): string {
  if (!encryptionService.isEncrypted(storedValue)) return storedValue;
  return encryptionService.decrypt(storedValue);
}

