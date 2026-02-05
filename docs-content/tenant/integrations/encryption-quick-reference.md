---
title: "Encryption Quick Reference"
description: "Quick reference for encryption features"
category: "integrations"
tags: ["encryption", "security", "quick-reference"]
audience: "tenant"
relatedDocs: ["/admin-docs/security/encryption-quick-reference.md"]
---

> **Note:** This is a simplified version for tenants. For technical details, administrators can refer to the [admin documentation](/admin-docs/security/encryption-quick-reference.md).

# API Token Encryption - Quick Reference

## Overview

All API tokens are automatically encrypted at rest using AES-256-GCM encryption. The Prisma middleware handles encryption/decryption transparently, so most application code doesn't need to change.

## For Developers

### Normal Usage (Automatic)

With Prisma middleware enabled, encryption/decryption happens automatically:

```typescript
// ✅ This works automatically - no changes needed
const site = await prisma.site.findUnique({ where: { id: siteId } });
console.log(site.apiToken); // Automatically decrypted

// ✅ This also works automatically
await prisma.site.create({
  data: {
    baseUrl: 'https://example.com',
    apiToken: 'plain-text-token' // Automatically encrypted before saving
  }
});
```

### Manual Encryption/Decryption (When Needed)

If you need to manually handle encryption (e.g., outside Prisma):

```typescript
import { encryptSiteToken, decryptSiteToken } from '@/lib/middleware/encryption';

// Encrypt before saving
const siteData = { baseUrl: 'https://example.com', apiToken: 'plain-token' };
const encrypted = await encryptSiteToken(siteData);
// encrypted.apiToken is now encrypted

// Decrypt after reading
const site = await getSiteFromSomewhere();
const decrypted = await decryptSiteToken(site);
// decrypted.apiToken is now plain text
```

### Safe Decryption with Error Handling

```typescript
import { safeDecryptSiteToken } from '@/lib/middleware/encryption';

const result = await safeDecryptSiteToken(site);

if (!result.success) {
  // Handle error - show message to user
  console.error(result.errorMessage);
  // Prompt user to re-enter token
  return;
}

// Use decrypted site
const apiToken = result.site.apiToken;
```

### Batch Operations

```typescript
import { decryptSiteTokens } from '@/lib/middleware/encryption';

const sites = await prisma.site.findMany({ where: { tenantId } });
// Sites are automatically decrypted by Prisma middleware

// If you need manual batch decryption:
const decrypted = await decryptSiteTokens(sites);
```

## Environment Setup

### Required Environment Variable

```env
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your-64-character-hex-key-here
```

### Key Requirements

- Must be exactly 64 hexadecimal characters (32 bytes)
- Must be kept secret and never committed to version control
- Must be the same across all application instances
- Should be rotated periodically (see Key Rotation Guide)

## Migration Commands

### Migrate Existing Tokens

```bash
# Preview changes (recommended first)
npm run migrate:tokens:dry-run

# Perform migration
npm run migrate:tokens

# Verify migration
npm run migrate:tokens:verify
```

### Test Encryption

```bash
# Run encryption tests
npm run test:encryption
```

## Common Scenarios

### Creating a New Site

```typescript
// ✅ Automatic encryption
await prisma.site.create({
  data: {
    tenantId: user.tenantId,
    type: 'USER',
    platform: 'OPENCART',
    baseUrl: 'https://mystore.com',
    apiToken: userProvidedToken // Automatically encrypted
  }
});
```

### Updating a Site Token

```typescript
// ✅ Automatic encryption
await prisma.site.update({
  where: { id: siteId },
  data: {
    apiToken: newToken // Automatically encrypted
  }
});
```

### Using Token for API Calls

```typescript
// ✅ Token is automatically decrypted
const site = await prisma.site.findUnique({ where: { id: siteId } });

const response = await fetch(`${site.baseUrl}/api/products`, {
  headers: {
    'Authorization': `Bearer ${site.apiToken}` // Already decrypted
  }
});
```

### Handling Null Tokens

```typescript
// ✅ Null tokens are handled gracefully
const site = await prisma.site.create({
  data: {
    baseUrl: 'https://example.com',
    apiToken: null // No encryption needed
  }
});
```

## Error Handling

### Decryption Errors

If decryption fails (e.g., wrong key, corrupted data):

```typescript
try {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  // Use site.apiToken
} catch (error) {
  if (error.name === 'AuthenticationError') {
    // Token may have been tampered with
    // Prompt user to re-enter token
  } else if (error.name === 'DecryptionError') {
    // General decryption failure
    // Check encryption key is correct
  }
}
```

### Safe Decryption

```typescript
import { safeDecryptSiteToken } from '@/lib/middleware/encryption';

const result = await safeDecryptSiteToken(site);

if (!result.success) {
  // Handle error without throwing
  switch (result.errorType) {
    case 'AuthenticationError':
      // Token tampered with
      break;
    case 'DecryptionError':
      // Decryption failed
      break;
    case 'InvalidFormatError':
      // Token format invalid
      break;
  }
}
```

## Troubleshooting

### "ENCRYPTION_KEY environment variable not set"

**Solution**: Add `ENCRYPTION_KEY` to your `.env` file:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### "Decrypted token does not match original"

**Cause**: Encryption key changed between encryption and decryption.

**Solution**: Ensure `ENCRYPTION_KEY` is the same across all environments.

### "Token format is invalid"

**Cause**: Token is not in encrypted format (iv:authTag:encrypted).

**Solution**: Run migration to encrypt existing tokens:
```bash
npm run migrate:tokens
```

### Prisma Middleware Not Working

**Check**: Ensure middleware is applied in `lib/prisma.ts`:
```typescript
import { applyEncryptionMiddleware } from './database/prisma-encryption-middleware';

applyEncryptionMiddleware(prisma);
```

## Performance Considerations

### Encryption Overhead

- Encryption: ~1-2ms per token
- Decryption: ~1-2ms per token
- Batch operations: ~0.5ms per token (parallelized)

### Caching

Consider caching decrypted tokens in memory for frequently accessed sites:

```typescript
const tokenCache = new Map<string, string>();

async function getDecryptedToken(siteId: string): Promise<string> {
  if (tokenCache.has(siteId)) {
    return tokenCache.get(siteId)!;
  }
  
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  tokenCache.set(siteId, site.apiToken);
  
  return site.apiToken;
}
```

## Security Best Practices

1. **Never log decrypted tokens**
   ```typescript
   // ❌ Bad
   logger.info('Site token', { token: site.apiToken });
   
   // ✅ Good
   logger.info('Site token', { tokenLength: site.apiToken?.length });
   ```

2. **Rotate encryption keys periodically**
   - See `docs/KEY_ROTATION_GUIDE.md`

3. **Use HTTPS for all API calls**
   - Tokens are encrypted at rest, but must be protected in transit

4. **Validate tokens before use**
   ```typescript
   if (!site.apiToken) {
     throw new Error('Site API token is required');
   }
   ```

5. **Handle decryption errors gracefully**
   - Don't expose encryption details to users
   - Prompt for token re-entry on failure

## Related Documentation

- [API Token Migration Guide](./API_TOKEN_MIGRATION_GUIDE.md)
- [Encryption Middleware Documentation](../lib/middleware/encryption.README.md)
- [Encryption Service Documentation](../lib/services/encryption/README.md)
- [Key Rotation Guide](./KEY_ROTATION_GUIDE.md)
- [Security Requirements](../.kiro/steering/security-requirements.md)

## Quick Commands Reference

```bash
# Migration
npm run migrate:tokens:dry-run    # Preview migration
npm run migrate:tokens             # Run migration
npm run migrate:tokens:verify      # Verify migration

# Testing
npm run test:encryption            # Test encryption functionality

# Backup
npm run backup                     # Create database backup
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the full migration guide
3. Check application logs for detailed error messages
4. Contact the development team
