# Encryption Middleware

## Overview

The encryption middleware provides transparent encryption and decryption of API tokens for Site data. It ensures all API tokens are encrypted at rest in the database using AES-256-GCM encryption.

## Features

- **Transparent Encryption**: Automatically encrypts API tokens before saving to database
- **Transparent Decryption**: Automatically decrypts API tokens after reading from database
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Security**: Uses AES-256-GCM authenticated encryption
- **Audit Logging**: All encryption/decryption operations are logged
- **Performance Monitoring**: Tracks operation latency and success rates
- **Batch Operations**: Support for encrypting/decrypting multiple sites
- **Safe Operations**: Graceful error handling for production use

## Installation

The middleware is already installed and ready to use. Ensure you have the `ENCRYPTION_MASTER_KEY` environment variable set:

```bash
# Generate a new encryption key (32 bytes, base64-encoded)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Add to .env file
ENCRYPTION_MASTER_KEY=<generated-key>
```

## Usage

### Basic Usage

#### Encrypting Before Save

```typescript
import { encryptSiteToken } from '@/lib/middleware/encryption';
import { prisma } from '@/lib/prisma';

// Create new site with encrypted token
const siteData = {
    tenantId: 'tenant-123',
    type: 'USER',
    platform: 'OPENCART',
    baseUrl: 'https://example.com',
    apiToken: 'plain-text-token-12345',
};

// Encrypt the token
const encrypted = await encryptSiteToken(siteData);

// Save to database
const site = await prisma.site.create({ data: encrypted });
```

#### Decrypting After Read

```typescript
import { decryptSiteToken } from '@/lib/middleware/encryption';
import { prisma } from '@/lib/prisma';

// Fetch site from database
const site = await prisma.site.findUnique({ where: { id: siteId } });

// Decrypt the token
const decrypted = await decryptSiteToken(site);

// Use the decrypted token
const response = await fetch(`${decrypted.baseUrl}/api/products`, {
    headers: { 'Authorization': `Bearer ${decrypted.apiToken}` }
});
```

### Batch Operations

```typescript
import { decryptSiteTokens } from '@/lib/middleware/encryption';

// Fetch multiple sites
const sites = await prisma.site.findMany({ where: { tenantId } });

// Decrypt all tokens
const decrypted = await decryptSiteTokens(sites);
```

### Safe Operations with Error Handling

```typescript
import { safeDecryptSiteToken } from '@/lib/middleware/encryption';

const result = await safeDecryptSiteToken(site);

if (!result.success) {
    // Handle error gracefully
    console.error('Decryption failed:', result.errorMessage);
    // Redirect user to re-enter token
    return;
}

// Use decrypted site
const products = await syncProducts(result.site);
```

### Checking Encryption Status

```typescript
import { isTokenEncrypted } from '@/lib/middleware/encryption';

if (!isTokenEncrypted(site.apiToken)) {
    // Token needs migration
    const encrypted = await encryptSiteToken({ apiToken: site.apiToken });
    await prisma.site.update({ where: { id: site.id }, data: encrypted });
}
```

## API Reference

### `encryptSiteToken<T>(siteData: T): Promise<T>`

Encrypts the API token in Site data before saving to database.

**Parameters:**
- `siteData`: Site data object that may contain an API token

**Returns:**
- Site data with encrypted API token

**Throws:**
- `EncryptionError`: If encryption fails

**Example:**
```typescript
const encrypted = await encryptSiteToken({
    apiToken: 'plain-text-token'
});
```

### `decryptSiteToken<T>(site: T): Promise<T>`

Decrypts the API token in Site data after reading from database.

**Parameters:**
- `site`: Site object from database with encrypted API token

**Returns:**
- Site object with decrypted API token

**Throws:**
- `DecryptionError`: If decryption fails
- `AuthenticationError`: If token integrity check fails (tampering detected)
- `InvalidFormatError`: If token format is invalid

**Example:**
```typescript
const decrypted = await decryptSiteToken(site);
```

### `decryptSiteTokens<T>(sites: T[]): Promise<T[]>`

Decrypts API tokens for multiple sites.

**Parameters:**
- `sites`: Array of Site objects with encrypted API tokens

**Returns:**
- Array of Site objects with decrypted API tokens

**Example:**
```typescript
const decrypted = await decryptSiteTokens(sites);
```

### `isTokenEncrypted(token: string | null | undefined): boolean`

Checks if a token is encrypted.

**Parameters:**
- `token`: Token string to check

**Returns:**
- `true` if token is encrypted, `false` otherwise

**Example:**
```typescript
if (isTokenEncrypted(site.apiToken)) {
    console.log('Token is encrypted');
}
```

### `safeDecryptSiteToken<T>(site: T): Promise<Result>`

Safely handles decryption errors and returns user-friendly messages.

**Parameters:**
- `site`: Site object to decrypt

**Returns:**
- Object with `success`, `site` (if successful), `errorMessage`, and `errorType`

**Example:**
```typescript
const result = await safeDecryptSiteToken(site);
if (result.success) {
    // Use result.site
}
```

## Error Handling

The middleware throws specific error types for different failure scenarios:

### `EncryptionError`

Thrown when encryption operation fails.

**Handling:**
```typescript
try {
    const encrypted = await encryptSiteToken(siteData);
} catch (error) {
    if (error instanceof EncryptionError) {
        // Log error and retry
        console.error('Encryption failed:', error.message);
    }
}
```

### `DecryptionError`

Thrown when decryption operation fails.

**Handling:**
```typescript
try {
    const decrypted = await decryptSiteToken(site);
} catch (error) {
    if (error instanceof DecryptionError) {
        // Prompt user to re-enter token
        console.error('Decryption failed:', error.message);
    }
}
```

### `AuthenticationError`

Thrown when token integrity check fails (tampering detected). This is a critical security event.

**Handling:**
```typescript
try {
    const decrypted = await decryptSiteToken(site);
} catch (error) {
    if (error instanceof AuthenticationError) {
        // Clear token and notify user
        await prisma.site.update({
            where: { id: site.id },
            data: { apiToken: null }
        });
        // Show security alert to user
    }
}
```

### `InvalidFormatError`

Thrown when token format is invalid (may be legacy unencrypted token).

**Handling:**
```typescript
try {
    const decrypted = await decryptSiteToken(site);
} catch (error) {
    if (error instanceof InvalidFormatError) {
        // Attempt migration or prompt for re-entry
        console.warn('Invalid token format:', error.message);
    }
}
```

## Security Considerations

1. **Never log decrypted tokens**: The middleware automatically sanitizes error messages to prevent token leakage
2. **Use HTTPS**: Always use HTTPS for API calls with decrypted tokens
3. **Token rotation**: Regularly rotate API tokens and encryption keys
4. **Audit logging**: All encryption/decryption operations are logged for audit trail
5. **Error handling**: Always handle decryption errors gracefully and prompt users to re-enter tokens

## Performance

- **Encryption**: < 10ms per operation (monitored)
- **Decryption**: < 10ms per operation (monitored)
- **Batch operations**: Optimized for multiple sites
- **Caching**: Not recommended for decrypted tokens (security risk)

## Migration

To migrate existing plaintext tokens to encrypted format:

```typescript
import { isTokenEncrypted, encryptSiteToken } from '@/lib/middleware/encryption';

async function migrateTokens(tenantId: string) {
    const sites = await prisma.site.findMany({ where: { tenantId } });
    
    for (const site of sites) {
        if (site.apiToken && !isTokenEncrypted(site.apiToken)) {
            const encrypted = await encryptSiteToken({ apiToken: site.apiToken });
            await prisma.site.update({
                where: { id: site.id },
                data: encrypted
            });
        }
    }
}
```

## Testing

See `lib/middleware/encryption.example.ts` for comprehensive usage examples.

## Troubleshooting

### "Encryption key not found"

**Solution:** Set the `ENCRYPTION_MASTER_KEY` environment variable:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### "Invalid key length"

**Solution:** Ensure the key is exactly 32 bytes (256 bits) encoded as base64.

### "Authentication tag verification failed"

**Solution:** This indicates token tampering. Clear the token and prompt user to re-enter:
```typescript
await prisma.site.update({
    where: { id: siteId },
    data: { apiToken: null }
});
```

### "Invalid encrypted token format"

**Solution:** Token may be legacy unencrypted format. Migrate or prompt for re-entry.

## Related Files

- `lib/services/encryption/encryption-service.ts` - Core encryption service
- `lib/services/encryption/key-manager.ts` - Encryption key management
- `lib/services/encryption/errors.ts` - Error types and handling
- `lib/middleware/encryption.example.ts` - Usage examples

## Requirements

This middleware implements requirement **2.7.1** from the project specification:
- API tokens are properly encrypted at rest
- Uses AES-256-GCM authenticated encryption
- Comprehensive error handling
- Audit logging for all operations
