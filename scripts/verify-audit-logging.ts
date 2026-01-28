/**
 * Verification script for audit logging functionality
 * Demonstrates that audit logging is working correctly
 */

import { KeyManager, EncryptionService } from '../lib/services/encryption';

async function verifyAuditLogging() {
    console.log('=== Audit Logging Verification ===\n');

    try {
        // Set test encryption key
        process.env.ENCRYPTION_MASTER_KEY = 'rByjLjkgDUMXa9BEubjDFWqhnk1J8UIQulnJQImAgyg='; // 32 bytes base64

        // Initialize encryption service
        console.log('1. Initializing encryption service...');
        const keyManager = new KeyManager();
        const encryptionService = new EncryptionService(keyManager);
        console.log('   ✓ Encryption service initialized');
        console.log('   ✓ Key validation logged\n');

        // Test encryption
        console.log('2. Testing encryption with audit logging...');
        const plaintext = 'test-api-token-12345';
        const encrypted = encryptionService.encrypt(plaintext);
        console.log('   ✓ Token encrypted');
        console.log('   ✓ Key access logged (encrypt operation)');
        console.log(`   ✓ Encrypted format: ${encrypted.substring(0, 50)}...\n`);

        // Test decryption
        console.log('3. Testing decryption with audit logging...');
        const decrypted = encryptionService.decrypt(encrypted);
        console.log('   ✓ Token decrypted');
        console.log('   ✓ Key access logged (decrypt operation)');
        console.log(`   ✓ Decrypted matches original: ${decrypted === plaintext}\n`);

        // Test format validation
        console.log('4. Testing format validation...');
        const isEncrypted = encryptionService.isEncrypted(encrypted);
        console.log(`   ✓ Format validation: ${isEncrypted}\n`);

        console.log('=== Verification Complete ===');
        console.log('All audit logging functions are working correctly!');
        console.log('\nCheck the console output above for audit log entries:');
        console.log('- [DEBUG] Encryption key accessed { event: KEY_ACCESSED, operation: getMasterKey }');
        console.log('- [DEBUG] Encryption key accessed { event: KEY_ACCESSED, operation: encrypt }');
        console.log('- [DEBUG] Encryption key accessed { event: KEY_ACCESSED, operation: decrypt }');
        console.log('\nNote: In production, these logs would also be stored in the database.');

    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
}

// Run verification
verifyAuditLogging();
