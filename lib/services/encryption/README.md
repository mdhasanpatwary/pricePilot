# Encryption Service

Secure encryption and decryption service for API tokens using AES-256-GCM.

## Overview

This service provides authenticated encryption for sensitive data (API tokens) stored in the database. It uses AES-256-GCM, which provides both confidentiality and integrity verification.

## Components

### KeyManager

Manages encryption keys with secure loading and validation.

**Features:**
- Loads master key from environment variables
- Validates key length (must be 32 bytes for AES-256)
- Supports key rotation with versioned keys
- Caches keys in memory for performance
- Never logs keys in error messages

**Usage:**
```typescript
import { KeyManager } from '@/lib/services/encryption';

const keyManager = new KeyManager();
const masterKey = keyManager.getMasterKey();
```

### EncryptionService

Core cryptographic operations for encrypting and decrypting data.

**Features:**
- AES-256-GCM authenticated encryption
- Unique IV generation for each encryption
- Format: `aes-256-gcm:iv:authTag:ciphertext`
- Automatic format validation
- Tamper detection via authentication tags

**Usage:**
```typescript
import { EncryptionService } from '@/lib/services/encryption';
import { KeyManager } from '@/lib/services/encryption';

const keyManager = new KeyManager();
const encryptionService = new EncryptionService(keyManager);

// Encrypt
const encrypted = encryptionService.encrypt('my-api-token');

// Decrypt
const decrypted = encryptionService.decrypt(encrypted);

// Check if encrypted
const isEncrypted = encryptionService.isEncrypted(someString);
```

### MigrationUtility

Batch migration utility for encrypting existing plaintext tokens.

**Features:**
- Batch processing with configurable size
- Dry-run mode for testing
- Continue-on-error option
- Detailed statistics and reporting
- Audit logging for each migration

**Usage:**
```typescript
import { MigrationUtility } from '@/lib/services/encryption';

const migrationUtility = new MigrationUtility();

// Run migration
const result = await migrationUtility.migrateAllTokens({
    dryRun: false,
    batchSize: 100,
    continueOnError: true,
});

// Generate report
const report = migrationUtility.generateReport(result);
console.log(report);
```

**CLI Command:**
```bash
# Run migration
npm run migrate-tokens

# Dry run (preview)
npm run migrate-tokens -- --dry-run

# Custom batch size
npm run migrate-tokens -- --batch-size=50

# Show help
npm run migrate-tokens -- --help
```

## Migration Guide

### Step 1: Generate Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Step 2: Set Environment Variable

Add to your `.env` file:
```bash
ENCRYPTION_MASTER_KEY="your-generated-key-here"
```

### Step 3: Test with Dry Run

```bash
npm run migrate-tokens -- --dry-run
```

Review the output to see what would be migrated.

### Step 4: Run Live Migration

```bash
npm run migrate-tokens
```

The command will:
1. Validate the encryption key
2. Display configuration
3. Show a 5-second countdown (press Ctrl+C to cancel)
4. Process all websites in batches
5. Display a detailed report

### Step 5: Verify Results

Check the migration report for:
- Total websites checked
- Successfully migrated count
- Already encrypted count
- Failed count (should be 0)
- Error details (if any)

## Environment Variables

### Required

**ENCRYPTION_MASTER_KEY**
- 32-byte (256-bit) base64-encoded encryption key
- Required for application startup
- Generate using: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

Example:
```bash
ENCRYPTION_MASTER_KEY="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6=="
```

### Optional (for key rotation)

**ENCRYPTION_MASTER_KEY_NEW**
- New key for key rotation
- Same format as ENCRYPTION_MASTER_KEY
- Only needed during key rotation process

## Key Generation

Generate a secure 256-bit encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

This will output a base64-encoded string like:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6==
```

Add this to your `.env` file:
```bash
ENCRYPTION_MASTER_KEY="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6=="
```

## Error Handling

The service provides specific error types for different failure scenarios:

- **KeyNotFoundError**: Encryption key not found in environment
- **KeyValidationError**: Key is invalid (wrong length or format)
- **EncryptionError**: Encryption operation failed
- **DecryptionError**: Decryption operation failed
- **AuthenticationError**: Auth tag verification failed (tampering detected)
- **InvalidFormatError**: Encrypted string format is invalid

All error messages are designed to be safe - they never expose sensitive data like keys or plaintext tokens.

## Security Considerations

### Key Storage
- Never commit keys to version control
- Use environment variables or secret management service
- Use separate keys per environment (dev, staging, prod)
- Rotate keys periodically (recommended: annually)

### Access Control
- Limit access to environment variables
- Audit key access events
- Implement key rotation without downtime

### Compliance
- AES-256-GCM meets FIPS 140-2 standards
- Authenticated encryption prevents tampering
- Audit logging supports compliance requirements

## Application Startup

The application validates the encryption key on startup using Next.js instrumentation:

1. `instrumentation.ts` runs when the server starts
2. Creates a KeyManager instance
3. Validates the master key
4. If validation fails, the application exits with an error

This ensures the application never runs with invalid encryption configuration.

## Next Steps

See the implementation plan in `.kiro/specs/api-token-encryption/tasks.md` for:
- Task 2: Implement core encryption service
- Task 3: Implement custom error classes (completed)
- Task 4: Integrate with WebsiteService
- And more...
