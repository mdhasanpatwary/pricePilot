# API Token Encryption - Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the API token encryption feature to production. The deployment process ensures that all API tokens are securely encrypted at rest while maintaining system availability and backward compatibility.

## Prerequisites

Before beginning deployment, ensure you have:

- [ ] Access to production environment variables
- [ ] Database backup capability
- [ ] Access to application logs
- [ ] Ability to restart the application
- [ ] Staging environment for testing
- [ ] Rollback plan prepared

## Deployment Timeline

**Estimated Total Time:** 2-4 hours (including verification)

- Key generation and setup: 15 minutes
- Staging deployment and testing: 30-60 minutes
- Production deployment: 15 minutes
- Token migration: 30-90 minutes (depends on data volume)
- Verification and monitoring: 30-60 minutes

## Phase 1: Key Generation

### Step 1.1: Generate Master Encryption Key

Generate a secure 256-bit (32-byte) encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Example output:**
```
a3f2c1b4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2
```

**Security Notes:**
- Generate the key in a secure environment
- Never commit the key to version control
- Store the key in a secure secrets management system
- Use different keys for each environment (dev, staging, production)

### Step 1.2: Store Key Securely

Store the generated key in your secrets management system:

**AWS Secrets Manager:**
```bash
aws secretsmanager create-secret \
  --name pricepilot/production/encryption-master-key \
  --secret-string "YOUR_GENERATED_KEY_HERE"
```

**Azure Key Vault:**
```bash
az keyvault secret set \
  --vault-name pricepilot-prod \
  --name encryption-master-key \
  --value "YOUR_GENERATED_KEY_HERE"
```

**Environment Variable (Alternative):**
```bash
export ENCRYPTION_MASTER_KEY="YOUR_GENERATED_KEY_HERE"
```

### Step 1.3: Document Key Information

Create a secure record with:
- Key generation date
- Key ID/version
- Environment (production)
- Who generated the key
- Where the key is stored

**Do NOT store the actual key value in this record.**

## Phase 2: Staging Deployment

### Step 2.1: Deploy to Staging

1. Set the encryption key in staging environment:
```bash
# Using your deployment platform's environment variable management
ENCRYPTION_MASTER_KEY="your_staging_key_here"
```

2. Deploy the application code:
```bash
git checkout main
git pull origin main
npm run build
# Deploy using your deployment method
```

3. Verify application starts successfully:
```bash
# Check application logs for key validation
tail -f /var/log/pricepilot/app.log | grep -i "encryption"
```

Expected log output:
```
[INFO] Encryption service initialized successfully
[INFO] Master key validated
```

### Step 2.2: Test Encryption in Staging

Test website creation with token encryption:

```bash
curl -X POST https://staging.pricepilot.com/api/v1/websites \
  -H "Authorization: Bearer YOUR_TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "opencart",
    "baseUrl": "https://test-store.com",
    "apiToken": "test_token_12345"
  }'
```

Verify in database that token is encrypted:
```sql
SELECT id, platform, 
  SUBSTRING(api_token, 1, 20) as token_preview 
FROM user_websites 
ORDER BY created_at DESC 
LIMIT 1;
```

Expected format: `aes-256-gcm:...`

### Step 2.3: Test Token Decryption

Test product sync (which requires token decryption):

```bash
curl -X POST https://staging.pricepilot.com/api/v1/websites/{website_id}/sync \
  -H "Authorization: Bearer YOUR_TEST_TOKEN"
```

Verify successful sync in logs:
```
[INFO] Token decrypted successfully for website {id}
[INFO] Product sync completed: 50 products synced
```

### Step 2.4: Test Migration Utility

If you have existing plaintext tokens in staging:

```bash
# Dry run first
npm run migrate-tokens -- --dry-run

# Review output, then run actual migration
npm run migrate-tokens
```

Expected output:
```
Migration Results:
- Total websites: 10
- Already encrypted: 0
- Successfully migrated: 10
- Failed: 0
- Skipped: 0

Migration completed successfully!
```

## Phase 3: Production Deployment

### Step 3.1: Pre-Deployment Checklist

- [ ] Staging tests passed successfully
- [ ] Database backup completed
- [ ] Encryption key stored in production secrets manager
- [ ] Rollback plan reviewed and ready
- [ ] Team notified of deployment
- [ ] Monitoring alerts configured

### Step 3.2: Create Database Backup

```bash
# PostgreSQL backup
pg_dump -h your-db-host -U your-db-user -d pricepilot_production > backup_pre_encryption_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh backup_pre_encryption_*.sql
```

### Step 3.3: Set Production Environment Variable

Set the encryption key in your production environment:

**Vercel:**
```bash
vercel env add ENCRYPTION_MASTER_KEY production
# Paste your production key when prompted
```

**AWS Elastic Beanstalk:**
```bash
aws elasticbeanstalk update-environment \
  --environment-name pricepilot-prod \
  --option-settings Namespace=aws:elasticbeanstalk:application:environment,OptionName=ENCRYPTION_MASTER_KEY,Value=YOUR_KEY
```

**Docker/Kubernetes:**
```yaml
# In your secrets configuration
apiVersion: v1
kind: Secret
metadata:
  name: pricepilot-secrets
type: Opaque
data:
  ENCRYPTION_MASTER_KEY: <base64-encoded-key>
```

### Step 3.4: Deploy Application

Deploy the application with encryption feature:

```bash
# Using your deployment method
git checkout main
git pull origin main
npm run build
npm run deploy:production
```

### Step 3.5: Verify Application Startup

Monitor application logs during startup:

```bash
# Check for successful initialization
tail -f /var/log/pricepilot/app.log | grep -i "encryption"
```

Expected logs:
```
[INFO] Encryption service initialized successfully
[INFO] Master key validated
[INFO] Application started successfully
```

**If startup fails:**
- Check that ENCRYPTION_MASTER_KEY is set correctly
- Verify key is exactly 32 bytes (44 characters base64)
- Review error logs for specific issues
- Execute rollback plan if necessary

## Phase 4: Token Migration

### Step 4.1: Assess Migration Scope

Check how many tokens need migration:

```sql
SELECT 
  COUNT(*) as total_websites,
  COUNT(CASE WHEN api_token LIKE 'aes-256-gcm:%' THEN 1 END) as encrypted,
  COUNT(CASE WHEN api_token NOT LIKE 'aes-256-gcm:%' THEN 1 END) as plaintext
FROM user_websites
WHERE api_token IS NOT NULL;
```

### Step 4.2: Run Migration in Dry-Run Mode

Test migration without making changes:

```bash
npm run migrate-tokens -- --dry-run
```

Review the output carefully:
- Number of tokens to migrate
- Any potential errors
- Estimated time

### Step 4.3: Execute Migration

Run the actual migration:

```bash
npm run migrate-tokens -- --batch-size=100 --continue-on-error
```

**Migration Options:**
- `--batch-size=N`: Process N records at a time (default: 50)
- `--continue-on-error`: Continue if individual migrations fail
- `--dry-run`: Preview without making changes

**Monitor progress:**
```
Processing batch 1/10 (100 records)...
✓ Migrated 100 tokens
Processing batch 2/10 (100 records)...
✓ Migrated 100 tokens
...

Migration Results:
- Total websites: 1000
- Already encrypted: 0
- Successfully migrated: 998
- Failed: 2
- Skipped: 0

Failed migrations:
- Website ID: abc-123 (Error: Invalid token format)
- Website ID: def-456 (Error: Database connection timeout)
```

### Step 4.4: Handle Migration Failures

For any failed migrations:

1. Review error details in logs
2. Investigate specific website records
3. Manually fix issues if needed
4. Re-run migration for failed records

```bash
# Check specific website
SELECT id, platform, base_url, api_token 
FROM user_websites 
WHERE id = 'abc-123';

# If token is invalid, mark for re-authentication
UPDATE user_websites 
SET status = 'requires_reauth' 
WHERE id = 'abc-123';
```

### Step 4.5: Verify Migration Success

Verify all tokens are encrypted:

```sql
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN api_token LIKE 'aes-256-gcm:%' THEN 1 END) as encrypted,
  COUNT(CASE WHEN api_token NOT LIKE 'aes-256-gcm:%' THEN 1 END) as plaintext
FROM user_websites
WHERE api_token IS NOT NULL;
```

Expected result: `plaintext = 0` (or only failed migrations)

## Phase 5: Verification

### Step 5.1: Test Website Creation

Create a new website to verify encryption:

```bash
curl -X POST https://api.pricepilot.com/api/v1/websites \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "opencart",
    "baseUrl": "https://example-store.com",
    "apiToken": "production_token_xyz"
  }'
```

Verify token is encrypted in database:
```sql
SELECT api_token FROM user_websites ORDER BY created_at DESC LIMIT 1;
```

### Step 5.2: Test Product Sync

Test that decryption works for API calls:

```bash
curl -X POST https://api.pricepilot.com/api/v1/websites/{id}/sync \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Verify successful sync in response and logs.

### Step 5.3: Verify Audit Logs

Check that encryption events are logged:

```sql
SELECT event, tenant_id, website_id, timestamp 
FROM audit_logs 
WHERE event IN ('token_encrypted', 'token_decrypted', 'token_migrated')
ORDER BY timestamp DESC 
LIMIT 20;
```

### Step 5.4: Monitor Performance

Check encryption/decryption performance:

```sql
SELECT 
  operation,
  AVG(duration_ms) as avg_duration,
  MAX(duration_ms) as max_duration,
  COUNT(*) as count
FROM performance_metrics
WHERE operation IN ('encrypt', 'decrypt')
  AND timestamp > NOW() - INTERVAL '1 hour'
GROUP BY operation;
```

Expected: avg_duration < 10ms

## Phase 6: Post-Deployment Monitoring

### Step 6.1: Monitor Error Rates

Watch for encryption/decryption errors:

```bash
# Check error logs
tail -f /var/log/pricepilot/error.log | grep -i "encryption\|decryption"
```

### Step 6.2: Monitor Application Performance

Check that encryption hasn't impacted performance:
- API response times
- Product sync duration
- Database query performance

### Step 6.3: User Communication

If any users need to re-enter tokens (due to migration failures):

**Email template:**
```
Subject: Action Required: Update Your Store Connection

Hi [User Name],

We've enhanced the security of PricePilot by implementing encryption for your store API tokens. 

We detected an issue with your store connection and need you to re-enter your API token to continue using PricePilot.

Steps:
1. Log in to PricePilot
2. Go to Settings > Integrations
3. Click "Reconnect" next to your store
4. Enter your API token

This is a one-time action to ensure your credentials remain secure.

If you need assistance, please contact support.

Best regards,
PricePilot Team
```

## Rollback Plan

If critical issues occur during deployment:

### Rollback Step 1: Revert Application Code

```bash
# Deploy previous version without encryption
git checkout <previous-release-tag>
npm run build
npm run deploy:production
```

### Rollback Step 2: Restore Database (if needed)

Only if data corruption occurred:

```bash
# Restore from backup
psql -h your-db-host -U your-db-user -d pricepilot_production < backup_pre_encryption_YYYYMMDD_HHMMSS.sql
```

### Rollback Step 3: Remove Environment Variable

Remove the encryption key to prevent startup issues:

```bash
# Using your platform's environment management
vercel env rm ENCRYPTION_MASTER_KEY production
```

### Rollback Step 4: Verify System Recovery

- Check application starts successfully
- Verify API endpoints work
- Test product sync functionality
- Monitor error rates

## Troubleshooting

### Issue: Application Won't Start

**Symptom:** Application fails during startup with key-related error

**Solution:**
1. Verify ENCRYPTION_MASTER_KEY is set: `echo $ENCRYPTION_MASTER_KEY`
2. Check key length: should be 44 characters (base64-encoded 32 bytes)
3. Verify no extra whitespace or newlines in key
4. Check application logs for specific error

### Issue: Decryption Failures

**Symptom:** "Failed to decrypt API token" errors

**Possible causes:**
- Wrong encryption key in environment
- Corrupted encrypted data
- Database encoding issues

**Solution:**
1. Verify correct key is set in environment
2. Check specific website record in database
3. Mark website for re-authentication if needed
4. Review audit logs for clues

### Issue: Migration Failures

**Symptom:** Some tokens fail to migrate

**Solution:**
1. Review error details in migration output
2. Check if tokens are already encrypted
3. Verify database connectivity
4. Re-run migration for failed records
5. Mark failed websites for re-authentication

### Issue: Performance Degradation

**Symptom:** Slow API responses after deployment

**Solution:**
1. Check encryption operation latency in metrics
2. Verify database query performance
3. Check if token caching is working
4. Review application resource usage
5. Scale resources if needed

## Success Criteria

Deployment is successful when:

- [ ] Application starts without errors
- [ ] All tokens encrypted in database (or only known failures)
- [ ] Website creation works with encryption
- [ ] Product sync works with decryption
- [ ] Audit logs show encryption events
- [ ] No increase in error rates
- [ ] Performance metrics within acceptable range
- [ ] All integration tests passing

## Support Contacts

- **Deployment Lead:** [Name/Email]
- **Database Admin:** [Name/Email]
- **Security Team:** [Name/Email]
- **On-Call Engineer:** [Phone/Pager]

## Additional Resources

- [Monitoring and Alerting Guide](./MONITORING_GUIDE.md)
- [Key Rotation Procedure](./KEY_ROTATION_GUIDE.md)
- [Design Document](./design.md)
- [Requirements Document](./requirements.md)
