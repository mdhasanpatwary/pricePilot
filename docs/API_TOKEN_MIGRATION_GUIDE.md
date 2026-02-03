# API Token Migration Guide

## Overview

This guide provides step-by-step instructions for migrating existing plain-text API tokens to encrypted format. The migration ensures all API tokens stored in the database are encrypted at rest using AES-256-GCM encryption.

## Prerequisites

Before starting the migration, ensure:

1. **Encryption Key is Set**: The `ENCRYPTION_KEY` environment variable must be set in your `.env` file
2. **Database Backup Tools**: `pg_dump` must be available for PostgreSQL backups
3. **Database Access**: You have full access to the production database
4. **Downtime Window**: Schedule a maintenance window if possible (recommended but not required)

## Migration Process

### Step 1: Verify Environment Setup

Check that the encryption key is properly configured:

```bash
# Verify ENCRYPTION_KEY is set
echo $ENCRYPTION_KEY

# If not set, generate a new key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to your `.env` file:
```env
ENCRYPTION_KEY=your-64-character-hex-key-here
```

### Step 2: Run Dry Run (Recommended)

Before performing the actual migration, run a dry run to preview the changes:

```bash
npm run migrate:tokens:dry-run
```

This will:
- Analyze all sites in the database
- Identify which tokens need encryption
- Show what would be changed
- **NOT** modify any data

Expected output:
```
🔐 API Token Migration Script
============================================================
🔍 Analyzing sites...
   Total sites: 15
   Sites with API tokens: 10
   Already encrypted: 3
   Need migration: 7

🔄 Simulating migration...
   ✅ Site abc123 (https://store1.com) - Would be migrated
   ✅ Site def456 (https://store2.com) - Would be migrated
   ...

============================================================
📊 Dry Run Summary
============================================================
Total sites: 15
Sites with API tokens: 10
Already encrypted: 3
Need migration: 7
Successfully migrated: 7
Failed: 0
============================================================

✅ Dry run completed - no changes made
   Run without --dry-run to perform actual migration
```

### Step 3: Create Database Backup

The migration script automatically creates a backup, but you can create an additional manual backup:

```bash
# Manual backup
npm run backup

# Or use the migration script's backup-only mode
npm run migrate:tokens -- --backup-only
```

Backups are stored in the `backups/` directory with timestamps.

### Step 4: Perform Migration

Once you've verified the dry run results and created backups, perform the actual migration:

```bash
npm run migrate:tokens
```

The script will:
1. Create an automatic database backup
2. Wait 5 seconds for confirmation (press Ctrl+C to cancel)
3. Encrypt all plain-text API tokens
4. Verify each encrypted token can be decrypted
5. Report success or failure

Expected output:
```
🔐 API Token Migration Script
============================================================

📦 Creating database backup...
   Database: pricepilot_production
   Host: localhost:5432
   Backup file: /path/to/backups/pre-token-migration-2026-02-02T10-30-00.sql
   ✅ Backup created successfully (15.23 MB)
   📁 Location: /path/to/backups/pre-token-migration-2026-02-02T10-30-00.sql

🔍 Analyzing sites...
   Total sites: 15
   Sites with API tokens: 10
   Already encrypted: 3
   Need migration: 7

⚠️  WARNING: This will modify the database
   7 tokens will be encrypted
   Backup created: /path/to/backups/pre-token-migration-2026-02-02T10-30-00.sql

   Press Ctrl+C to cancel, or wait 5 seconds to continue...

🔄 Performing migration...
   ✅ Site abc123 (https://store1.com) - Migrated
   ✅ Site def456 (https://store2.com) - Migrated
   ...

============================================================
📊 Migration Summary
============================================================
Total sites: 15
Sites with API tokens: 10
Already encrypted: 3
Need migration: 7
Successfully migrated: 7
Failed: 0
============================================================

🔍 Verifying migration...
   ✅ Site abc123 (https://store1.com) - Verified
   ✅ Site def456 (https://store2.com) - Verified
   ...

✅ Migration completed and verified successfully
   7 tokens encrypted
   10 tokens verified
```

### Step 5: Verify Migration

After migration, verify all tokens are properly encrypted:

```bash
npm run migrate:tokens:verify
```

This will:
- Check all sites with API tokens
- Verify each token is in encrypted format
- Attempt to decrypt each token
- Report any issues

Expected output:
```
🔐 Verifying encrypted tokens...
   ✅ Site abc123 (https://store1.com) - Verified
   ✅ Site def456 (https://store2.com) - Verified
   ...

============================================================
📊 Verification Summary
============================================================
Total sites: 15
Sites with API tokens: 10
Already encrypted: 10
Need migration: 0
Verified: 10
Failed: 0
============================================================

✅ All tokens verified successfully
```

## Rollback Procedure

If the migration fails or causes issues, you can rollback using the backup:

### Option 1: Restore from Automatic Backup

```bash
# Find the backup file
ls -lh backups/pre-token-migration-*.sql

# Restore the backup
PGPASSWORD="your-password" psql -h localhost -U your-user -d your-database < backups/pre-token-migration-TIMESTAMP.sql
```

### Option 2: Restore from Manual Backup

If you created a manual backup before migration:

```bash
# Restore from manual backup
PGPASSWORD="your-password" psql -h localhost -U your-user -d your-database < backups/your-backup-file.sql
```

## Updating Application Code

After successful migration, update all code that reads Site API tokens to use the decryption middleware:

### Before Migration (Plain Text)
```typescript
// Old code - direct access to plain-text token
const site = await prisma.site.findUnique({ where: { id: siteId } });
const response = await fetch(site.baseUrl, {
  headers: { 'Authorization': `Bearer ${site.apiToken}` }
});
```

### After Migration (Encrypted)
```typescript
// New code - decrypt token before use
import { decryptSiteToken } from '@/lib/middleware/encryption';

const site = await prisma.site.findUnique({ where: { id: siteId } });
const decrypted = await decryptSiteToken(site);
const response = await fetch(decrypted.baseUrl, {
  headers: { 'Authorization': `Bearer ${decrypted.apiToken}` }
});
```

### Batch Operations
```typescript
// Decrypt multiple sites
import { decryptSiteTokens } from '@/lib/middleware/encryption';

const sites = await prisma.site.findMany({ where: { tenantId } });
const decrypted = await decryptSiteTokens(sites);
```

### Safe Decryption with Error Handling
```typescript
// Handle decryption errors gracefully
import { safeDecryptSiteToken } from '@/lib/middleware/encryption';

const site = await prisma.site.findUnique({ where: { id: siteId } });
const result = await safeDecryptSiteToken(site);

if (!result.success) {
  // Show error to user
  console.error('Failed to decrypt token:', result.errorMessage);
  // Prompt user to re-enter token
  return;
}

// Use decrypted site
const response = await fetch(result.site.baseUrl, {
  headers: { 'Authorization': `Bearer ${result.site.apiToken}` }
});
```

## Code Locations to Update

Search for these patterns in your codebase and update them:

1. **Direct Site Token Access**
   ```typescript
   // Find: site.apiToken
   // Replace with: (await decryptSiteToken(site)).apiToken
   ```

2. **Site Creation/Update**
   ```typescript
   // Before saving to database
   import { encryptSiteToken } from '@/lib/middleware/encryption';
   
   const siteData = { baseUrl, apiToken: userProvidedToken };
   const encrypted = await encryptSiteToken(siteData);
   await prisma.site.create({ data: encrypted });
   ```

3. **Sync Service**
   - `lib/services/sync.ts` - Update all methods that use `site.apiToken`

4. **API Routes**
   - `app/api/v1/sites/route.ts` - Encrypt on create/update
   - `app/api/v1/sync/route.ts` - Decrypt before use

5. **Background Workers**
   - `scripts/start-worker.ts` - Decrypt tokens before syncing

## Testing After Migration

### 1. Test Site Sync
```bash
# Test syncing a site
curl -X POST http://localhost:3000/api/v1/sync \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"siteId": "your-site-id"}'
```

### 2. Test Price Updates
```bash
# Test updating prices
curl -X POST http://localhost:3000/api/v1/price-update \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"productId": "your-product-id", "newPrice": 99.99}'
```

### 3. Monitor Logs
```bash
# Check for decryption errors
grep "decrypt" logs/application.log
grep "encryption" logs/application.log
```

## Troubleshooting

### Issue: "ENCRYPTION_KEY environment variable not set"

**Solution**: Add the encryption key to your `.env` file:
```bash
ENCRYPTION_KEY=your-64-character-hex-key-here
```

### Issue: "Decrypted token does not match original"

**Cause**: The encryption key may have changed between encryption and decryption.

**Solution**: 
1. Verify the `ENCRYPTION_KEY` is correct
2. Restore from backup
3. Re-run migration with correct key

### Issue: "API token authentication failed - possible tampering detected"

**Cause**: The encrypted token's authentication tag doesn't match, indicating possible tampering or corruption.

**Solution**:
1. Check database integrity
2. Restore from backup if needed
3. Prompt user to re-enter API token

### Issue: Migration fails for some sites

**Cause**: Various reasons - network issues, database locks, etc.

**Solution**:
1. Check the error messages in the migration output
2. Fix the underlying issues
3. Re-run migration (already encrypted tokens will be skipped)

### Issue: "Token format is invalid"

**Cause**: Token is not in the expected encrypted format (iv:authTag:encrypted).

**Solution**:
1. Verify the token was properly encrypted
2. Check for database corruption
3. Re-run migration for affected sites

## Security Considerations

1. **Encryption Key Storage**
   - Never commit the encryption key to version control
   - Use environment variables or secret management systems
   - Rotate keys periodically (see Key Rotation Guide)

2. **Backup Security**
   - Backups contain plain-text tokens before migration
   - Store backups securely with encryption
   - Delete old backups after successful migration

3. **Access Control**
   - Limit who can run the migration script
   - Audit all migration executions
   - Monitor for unauthorized access attempts

4. **Key Rotation**
   - Plan for periodic key rotation
   - See `docs/KEY_ROTATION_GUIDE.md` for details

## Staging Environment Testing

Before running in production, test the migration in staging:

1. **Clone Production Data to Staging**
   ```bash
   # Dump production database
   pg_dump -h prod-host -U prod-user -d prod-db > prod-dump.sql
   
   # Restore to staging
   psql -h staging-host -U staging-user -d staging-db < prod-dump.sql
   ```

2. **Run Migration in Staging**
   ```bash
   # Set staging environment
   export DATABASE_URL="postgresql://staging-user:password@staging-host:5432/staging-db"
   export ENCRYPTION_KEY="staging-encryption-key"
   
   # Run migration
   npm run migrate:tokens
   ```

3. **Test Application in Staging**
   - Test all site sync operations
   - Test price updates
   - Test API endpoints
   - Monitor for errors

4. **Verify Results**
   ```bash
   npm run migrate:tokens:verify
   ```

## Production Deployment Checklist

- [ ] Tested migration in staging environment
- [ ] Verified all application code is updated
- [ ] Created manual database backup
- [ ] Scheduled maintenance window (if needed)
- [ ] Notified users of potential downtime
- [ ] Prepared rollback procedure
- [ ] Verified encryption key is set correctly
- [ ] Tested decryption in staging
- [ ] Documented migration execution
- [ ] Prepared monitoring and alerting

## Post-Migration Monitoring

After migration, monitor these metrics:

1. **Error Rates**
   - Watch for decryption errors
   - Monitor API authentication failures
   - Check sync failure rates

2. **Performance**
   - Measure decryption overhead
   - Monitor database query times
   - Check API response times

3. **Security Events**
   - Monitor for tampering attempts
   - Check for unauthorized access
   - Audit token usage patterns

## Support

If you encounter issues during migration:

1. Check the troubleshooting section above
2. Review application logs for detailed error messages
3. Consult the encryption middleware documentation
4. Contact the development team for assistance

## Related Documentation

- [Encryption Middleware Documentation](../lib/middleware/encryption.README.md)
- [Encryption Service Documentation](../lib/services/encryption/README.md)
- [Key Rotation Guide](./KEY_ROTATION_GUIDE.md)
- [Security Requirements](../.kiro/steering/security-requirements.md)
