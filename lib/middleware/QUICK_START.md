# Encryption Middleware - Quick Start Guide

## 🚀 Quick Start

### 1. Setup Environment Variable

```bash
# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Add to .env
ENCRYPTION_MASTER_KEY=<your-generated-key>
```

### 2. Import Middleware

```typescript
import { encryptSiteToken, decryptSiteToken } from '@/lib/middleware/encryption';
```

### 3. Encrypt Before Save

```typescript
// Before saving to database
const encrypted = await encryptSiteToken(siteData);
await prisma.site.create({ data: encrypted });
```

### 4. Decrypt After Read

```typescript
// After reading from database
const site = await prisma.site.findUnique({ where: { id } });
const decrypted = await decryptSiteToken(site);
// Now use decrypted.apiToken
```

## 📋 Common Use Cases

### Creating a New Site

```typescript
const siteData = {
    tenantId: 'tenant-123',
    type: 'USER',
    platform: 'OPENCART',
    baseUrl: 'https://example.com',
    apiToken: 'my-api-token',
};

const encrypted = await encryptSiteToken(siteData);
const site = await prisma.site.create({ data: encrypted });
```

### Updating API Token

```typescript
const updateData = { apiToken: 'new-token' };
const encrypted = await encryptSiteToken(updateData);
await prisma.site.update({ where: { id }, data: encrypted });
```

### Using Token for API Call

```typescript
const site = await prisma.site.findUnique({ where: { id } });
const decrypted = await decryptSiteToken(site);

const response = await fetch(`${decrypted.baseUrl}/api/products`, {
    headers: { 'Authorization': `Bearer ${decrypted.apiToken}` }
});
```

### Safe Decryption with Error Handling

```typescript
const result = await safeDecryptSiteToken(site);

if (!result.success) {
    console.error('Decryption failed:', result.errorMessage);
    // Redirect to settings page
    return;
}

// Use result.site
```

### Batch Operations

```typescript
const sites = await prisma.site.findMany({ where: { tenantId } });
const decrypted = await decryptSiteTokens(sites);
```

### Check Encryption Status

```typescript
if (!isTokenEncrypted(site.apiToken)) {
    // Migrate to encrypted format
    const encrypted = await encryptSiteToken({ apiToken: site.apiToken });
    await prisma.site.update({ where: { id: site.id }, data: encrypted });
}
```

## ⚠️ Error Handling

```typescript
try {
    const decrypted = await decryptSiteToken(site);
} catch (error) {
    if (error.name === 'AuthenticationError') {
        // Token tampered - clear and prompt re-entry
        await prisma.site.update({ 
            where: { id: site.id }, 
            data: { apiToken: null } 
        });
    } else if (error.name === 'DecryptionError') {
        // Decryption failed - prompt re-entry
        console.error('Please re-enter your API token');
    }
}
```

## 🔒 Security Best Practices

1. **Never log decrypted tokens**
2. **Always use HTTPS for API calls**
3. **Handle decryption errors gracefully**
4. **Rotate tokens regularly**
5. **Monitor audit logs**

## 📚 Full Documentation

- **Complete Guide**: `lib/middleware/encryption.README.md`
- **Examples**: `lib/middleware/encryption.example.ts`
- **Implementation**: `lib/middleware/ENCRYPTION_MIDDLEWARE_IMPLEMENTATION.md`

## 🆘 Troubleshooting

### "Encryption key not found"
Set `ENCRYPTION_MASTER_KEY` environment variable

### "Invalid key length"
Key must be 32 bytes (256 bits) base64-encoded

### "Authentication tag verification failed"
Token may be tampered - clear and prompt re-entry

### "Invalid encrypted token format"
Token may be legacy format - migrate or prompt re-entry

## 📞 Support

For issues or questions, refer to:
- `lib/middleware/encryption.README.md` - Full documentation
- `lib/middleware/encryption.example.ts` - Usage examples
- Task 4.2 in `.kiro/specs/project-gaps-and-improvements/tasks.md`
