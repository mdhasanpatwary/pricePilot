/**
 * End-to-end verification script for encryption functionality
 * This script tests the complete encryption/decryption flow
 */

import { EncryptionService } from '@/lib/services/encryption/encryption-service';
import { KeyManager } from '@/lib/services/encryption/key-manager';

async function verifyEncryption() {
    console.log('🔐 Starting encryption verification...\n');

    try {
        // Initialize services
        const keyManager = new KeyManager();
        const encryptionService = new EncryptionService(keyManager);

        // Test 1: Basic encryption/decryption
        console.log('Test 1: Basic encryption/decryption');
        const testToken = 'test-api-token-12345';
        const encrypted = encryptionService.encrypt(testToken);
        console.log(`  ✓ Encrypted: ${encrypted.substring(0, 50)}...`);

        const decrypted = encryptionService.decrypt(encrypted);
        console.log(`  ✓ Decrypted: ${decrypted}`);

        if (decrypted !== testToken) {
            throw new Error('Decrypted value does not match original!');
        }
        console.log('  ✅ Round-trip successful\n');

        // Test 2: Multiple encryptions produce different ciphertext
        console.log('Test 2: IV uniqueness');
        const encrypted1 = encryptionService.encrypt(testToken);
        const encrypted2 = encryptionService.encrypt(testToken);

        if (encrypted1 === encrypted2) {
            throw new Error('Multiple encryptions produced identical ciphertext!');
        }
        console.log('  ✓ Different ciphertext for same plaintext');
        console.log(`  ✓ Encrypted 1: ${encrypted1.substring(0, 50)}...`);
        console.log(`  ✓ Encrypted 2: ${encrypted2.substring(0, 50)}...`);
        console.log('  ✅ IV uniqueness verified\n');

        // Test 3: Format validation
        console.log('Test 3: Format validation');
        const parts = encrypted.split(':');
        if (parts.length !== 4) {
            throw new Error('Invalid encrypted format!');
        }
        console.log(`  ✓ Format: ${parts[0]}:iv:authTag:ciphertext`);
        console.log('  ✅ Format validation passed\n');

        // Test 4: isEncrypted detection
        console.log('Test 4: Encrypted string detection');
        const isEncryptedResult = encryptionService.isEncrypted(encrypted);
        const isPlaintextResult = encryptionService.isEncrypted(testToken);

        if (!isEncryptedResult) {
            throw new Error('Failed to detect encrypted string!');
        }
        if (isPlaintextResult) {
            throw new Error('Incorrectly detected plaintext as encrypted!');
        }
        console.log('  ✓ Correctly identified encrypted string');
        console.log('  ✓ Correctly identified plaintext string');
        console.log('  ✅ Detection working correctly\n');

        // Test 5: Long token handling
        console.log('Test 5: Long token handling');
        const longToken = 'a'.repeat(500);
        const encryptedLong = encryptionService.encrypt(longToken);
        const decryptedLong = encryptionService.decrypt(encryptedLong);

        if (decryptedLong !== longToken) {
            throw new Error('Long token round-trip failed!');
        }
        console.log(`  ✓ Encrypted 500-char token: ${encryptedLong.length} chars`);
        console.log('  ✅ Long token handling successful\n');

        // Test 6: Error handling
        console.log('Test 6: Error handling');
        try {
            encryptionService.decrypt('invalid-format');
            throw new Error('Should have thrown error for invalid format!');
        } catch (error: any) {
            if (error.name === 'InvalidFormatError') {
                console.log('  ✓ Correctly rejected invalid format');
            } else {
                throw error;
            }
        }

        try {
            const tampered = encrypted.replace(/.$/, 'X');
            encryptionService.decrypt(tampered);
            throw new Error('Should have thrown error for tampered data!');
        } catch (error: any) {
            if (error.name === 'AuthenticationError' || error.name === 'DecryptionError') {
                console.log('  ✓ Correctly detected tampered data');
            } else {
                throw error;
            }
        }
        console.log('  ✅ Error handling working correctly\n');

        console.log('✅ All encryption verification tests passed!');
        console.log('\n📊 Summary:');
        console.log('  - Basic encryption/decryption: ✅');
        console.log('  - IV uniqueness: ✅');
        console.log('  - Format validation: ✅');
        console.log('  - String detection: ✅');
        console.log('  - Long token handling: ✅');
        console.log('  - Error handling: ✅');

        return true;
    } catch (error: any) {
        console.error('\n❌ Verification failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Run verification
verifyEncryption()
    .then((success) => {
        process.exit(success ? 0 : 1);
    })
    .catch((error) => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
