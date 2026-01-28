# API Token Encryption - Key Rotation Procedure

## Overview

This guide provides step-by-step instructions for rotating the master encryption key used to protect API tokens. Key rotation is a critical security practice that limits the impact of potential key compromise and meets compliance requirements for periodic key updates.

**Recommended Rotation Frequency:** Annually, or immediately if compromise is suspected

## Key Rotation Strategy

The rotation process uses a **dual-key approach** to achieve zero-downtime rotation:

1. Deploy new key alongside old key
2. Re-encrypt all tokens with new key
3. Remove old key after verification
4. All operations continue during rotation

## Prerequisites

Before beginning key rotation:

- [ ] Backup database completely
- [ ] Test rotation procedure in staging environment
- [ ] Schedule maintenance window (recommended but not required)
- [ ] Notify team of rotation activity
- [ ] Prepare rollback plan
- [ ] Verify monitoring and alerting is active

## Rotation Timeline

**Estimated Total Time:** 2-4 hours (including verification)

- Key generation: 5 minutes
- Staging testing: 30-60 minutes
- Production deployment: 15 minutes
- Token re-encryption: 30-90 minutes (depends on volume)
- Verification: 30-60 minutes
- Cleanup: 15 minutes

## Phase 1: Preparation

### Step 1.1: Generate New Encryption Key

Generate a new secure 256-bit encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Example output:**
```
x9y8z7a6b5c4d3e2f1g0h9i8j7k6l5m4n3o2p1q0r9s8t7u6v5w4x3y2z1a0b9c8
```

**Security Requirements:**
- Generate in secure environment
- Use cryptographically secure random number generator
- Never reuse old keys
- Store securely immediately after generation

### Step 1.2: Document Key Information

Create a secure record (NOT containing the actual key):

```
Key Rotation Record
-------------------
Date: 2024-01-15
Environment: Production
Old Key ID: key-2023-01
New Key ID: key-2024-01
Rotated By: [Your Name]
Reason: Annual rotation
Status: In Progress
```

### Step 1.3: Store New Key Securely

Store the new key in your secrets management system:

**AWS Secrets Manager:**
```bash
# Store new key with version identifier
aws secretsmanager create-secret \
  --name pricepilot/production/encryption-master-key-new \
  --secret-string "YOUR_NEW_KEY_HERE" \
  --description "New encryption key for rotation (2024-01)"
```

**Azure Key Vault:**
```bash
az keyvault secret set \
  --vault-name pricepilot-prod \
  --name encryption-master-key-new \
  --value "YOUR_NEW_KEY_HERE"
```

**Important:** Keep both old and new keys accessible during rotation.

### Step 1.4: Backup Database

Create a complete database backup before rotation:

```bash
# PostgreSQL backup with timestamp
pg_dump -h your-db-host -U your-db-user -d pricepilot_production \
  > backup_pre_rotation_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh backup_pre_rotation_*.sql

# Test backup integrity
pg_restore --list backup_pre_rotation_*.sql | head -20
```

## Phase 2: Staging Environment Testing

### Step 2.1: Deploy New Key to Staging

Set both old and new keys in staging environment:

```bash
# Set new key as ENCRYPTION_MASTER_KEY_NEW
export ENCRYPTION_MASTER_KEY_NEW="your_new_staging_key"

# Keep old key as ENCRYPTION_MASTER_KEY
export ENCRYPTION_MASTER_KEY="your_old_staging_key"
```

### Step 2.2: Test Key Rotation Utility

Run rotation in dry-run mode first:

```bash
npm run rotate-keys -- --dry-run
```

**Expected output:**
```
Key Rotation Dry Run
====================
Old Key: Loaded successfully
New Key: Loaded successfully

Analyzing tokens...
- Total websites: 50
- Tokens to rotate: 50
- Estimated time: ~5 seconds

Dry run completed. No changes made.
```

### Step 2.3: Execute Rotation in Staging

Run actual rotation:

```bash
npm run rotate-keys
```

**Monitor output:**
```
Key Rotation Started
====================
Old Key: Loaded successfully
New Key: Loaded successfully

Processing batch 1/1 (50 records)...
✓ Rotated 50 tokens

Rotation Results:
- Total websites: 50
- Successfully rotated: 50
- Failed: 0
- Skipped: 0

Rotation completed successfully!
Duration: 4.2 seconds
```

### Step 2.4: Verify Rotation in Staging

Test that decryption works with new key:

```bash
# Update environment to use new key as primary
export ENCRYPTION_MASTER_KEY="your_new_staging_key"
unset ENCRYPTION_MASTER_KEY_NEW

# Restart application
npm run restart

# Test product sync (requires decryption)
curl -X POST https://staging.pricepilot.com/api/v1/websites/{id}/sync \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Verify successful sync in logs and response.

### Step 2.5: Verify Old Key No Longer Works

Attempt to decrypt with old key (should fail):

```bash
# Temporarily set old key
export ENCRYPTION_MASTER_KEY="your_old_staging_key"

# Restart and test (should fail)
npm run restart

# This should fail with decryption error
curl -X POST https://staging.pricepilot.com/api/v1/websites/{id}/sync \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected: Decryption failures (confirms tokens are encrypted with new key)

## Phase 3: Production Rotation

### Step 3.1: Pre-Rotation Checklist

- [ ] Staging rotation completed successfully
- [ ] Database backup completed and verified
- [ ] Team notified of rotation activity
- [ ] Monitoring alerts active
- [ ] Rollback plan reviewed
- [ ] Both keys stored in secrets manager

### Step 3.2: Deploy New Key to Production

Add new key to production environment (keep old key):

**Vercel:**
```bash
vercel env add ENCRYPTION_MASTER_KEY_NEW production
# Paste new key when prompted
```

**AWS Elastic Beanstalk:**
```bash
aws elasticbeanstalk update-environment \
  --environment-name pricepilot-prod \
  --option-settings \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=ENCRYPTION_MASTER_KEY_NEW,Value=YOUR_NEW_KEY
```

**Kubernetes:**
```yaml
# Update secret with new key
apiVersion: v1
kind: Secret
metadata:
  name: pricepilot-secrets
type: Opaque
data:
  ENCRYPTION_MASTER_KEY: <old-key-base64>
  ENCRYPTION_MASTER_KEY_NEW: <new-key-base64>
```

### Step 3.3: Verify Both Keys Loaded

Check application logs after deployment:

```bash
tail -f /var/log/pricepilot/app.log | grep -i "key"
```

Expected logs:
```
[INFO] Master key loaded successfully
[INFO] New master key loaded successfully
[INFO] Key rotation mode enabled
```

### Step 3.4: Run Rotation Utility (Dry Run)

Test rotation without making changes:

```bash
npm run rotate-keys -- --dry-run
```

Review output carefully:
- Number of tokens to rotate
- Estimated time
- Any warnings or errors

### Step 3.5: Execute Production Rotation

Run the actual key rotation:

```bash
npm run rotate-keys -- --batch-size=100 --continue-on-error
```

**Rotation Options:**
- `--batch-size=N`: Process N records at a time (default: 50)
- `--continue-on-error`: Continue if individual rotations fail
- `--dry-run`: Preview without making changes

**Monitor progress:**
```
Key Rotation Started
====================
Old Key: Loaded successfully
New Key: Loaded successfully

Processing batch 1/20 (100 records)...
✓ Rotated 100 tokens (5.2s)

Processing batch 2/20 (100 records)...
✓ Rotated 100 tokens (4.8s)

Processing batch 3/20 (100 records)...
✓ Rotated 100 tokens (5.1s)

...

Rotation Results:
- Total websites: 2000
- Successfully rotated: 1998
- Failed: 2
- Skipped: 0

Failed rotations:
- Website ID: abc-123 (Error: Database connection timeout)
- Website ID: def-456 (Error: Token format invalid)

Rotation completed!
Duration: 102.4 seconds
```

### Step 3.6: Handle Rotation Failures

For any failed rotations:

1. **Review error details:**
```bash
# Check rotation logs
tail -100 /var/log/pricepilot/rotation.log | grep -i "error"
```

2. **Investigate specific failures:**
```sql
SELECT id, tenant_id, platform, api_token 
FROM user_websites 
WHERE id IN ('abc-123', 'def-456');
```

3. **Retry failed rotations:**
```bash
# Re-run rotation (will skip already rotated tokens)
npm run rotate-keys
```

4. **Mark for re-authentication if needed:**
```sql
UPDATE user_websites 
SET status = 'requires_reauth' 
WHERE id IN ('abc-123', 'def-456');
```

## Phase 4: Verification

### Step 4.1: Verify Rotation Completeness

Check that all tokens are encrypted with new key:

```sql
-- Count tokens by encryption status
SELECT 
  COUNT(*) as total_tokens,
  COUNT(CASE WHEN api_token LIKE 'aes-256-gcm:%' THEN 1 END) as encrypted_tokens
FROM user_websites
WHERE api_token IS NOT NULL;
```

Expected: All tokens encrypted (or only known failures)

### Step 4.2: Test Decryption with New Key

Update environment to use new key as primary:

**Vercel:**
```bash
# Update ENCRYPTION_MASTER_KEY to new key value
vercel env rm ENCRYPTION_MASTER_KEY production
vercel env add ENCRYPTION_MASTER_KEY production
# Paste new key when prompted
```

**AWS:**
```bash
aws elasticbeanstalk update-environment \
  --environment-name pricepilot-prod \
  --option-settings \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=ENCRYPTION_MASTER_KEY,Value=YOUR_NEW_KEY
```

### Step 4.3: Restart Application

Restart to load new key configuration:

```bash
# Using your deployment method
npm run restart:production

# Or trigger rolling restart
kubectl rollout restart deployment/pricepilot-api
```

### Step 4.4: Verify Application Functionality

Test critical operations:

**1. Website Creation (encryption):**
```bash
curl -X POST https://api.pricepilot.com/api/v1/websites \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "opencart",
    "baseUrl": "https://test-store.com",
    "apiToken": "test_token_rotation"
  }'
```

**2. Product Sync (decryption):**
```bash
curl -X POST https://api.pricepilot.com/api/v1/websites/{id}/sync \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**3. Check audit logs:**
```sql
SELECT event, website_id, timestamp 
FROM audit_logs 
WHERE event IN ('token_encrypted', 'token_decrypted')
  AND timestamp > NOW() - INTERVAL '10 minutes'
ORDER BY timestamp DESC 
LIMIT 10;
```

### Step 4.5: Verify Old Key No Longer Works

Temporarily test with old key to confirm rotation:

```bash
# In a test environment, set old key
export ENCRYPTION_MASTER_KEY="old_key_value"

# Attempt decryption (should fail)
# This confirms tokens are encrypted with new key
```

Expected: Decryption failures

## Phase 5: Cleanup

### Step 5.1: Remove Old Key from Environment

Once rotation is verified successful, remove old key:

**Vercel:**
```bash
vercel env rm ENCRYPTION_MASTER_KEY_NEW production
```

**AWS:**
```bash
aws elasticbeanstalk update-environment \
  --environment-name pricepilot-prod \
  --option-settings \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=ENCRYPTION_MASTER_KEY_NEW,Value=""
```

**Kubernetes:**
```bash
# Update secret to remove old key
kubectl edit secret pricepilot-secrets
# Remove ENCRYPTION_MASTER_KEY_NEW entry
```

### Step 5.2: Archive Old Key Securely

Move old key to secure archive (don't delete immediately):

**AWS Secrets Manager:**
```bash
# Add archived tag
aws secretsmanager tag-resource \
  --secret-id pricepilot/production/encryption-master-key-old \
  --tags Key=Status,Value=Archived Key=ArchivedDate,Value=2024-01-15

# Schedule deletion after 30 days
aws secretsmanager delete-secret \
  --secret-id pricepilot/production/encryption-master-key-old \
  --recovery-window-in-days 30
```

**Keep old key accessible for 30 days in case rollback is needed.**

### Step 5.3: Update Documentation

Update key rotation record:

```
Key Rotation Record
-------------------
Date: 2024-01-15
Environment: Production
Old Key ID: key-2023-01 (archived)
New Key ID: key-2024-01 (active)
Rotated By: [Your Name]
Reason: Annual rotation
Status: Completed
Tokens Rotated: 1998/2000
Failed: 2 (marked for re-auth)
Duration: 102.4 seconds
Next Rotation: 2025-01-15
```

### Step 5.4: Verify Audit Trail

Ensure rotation is properly logged:

```sql
SELECT 
  event,
  COUNT(*) as count,
  MIN(timestamp) as first_event,
  MAX(timestamp) as last_event
FROM audit_logs
WHERE event = 'key_rotated'
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY event;
```

## Phase 6: Post-Rotation Monitoring

### Step 6.1: Monitor for 24 Hours

Watch for issues after rotation:

**Metrics to monitor:**
- Decryption success rate (should be ~100%)
- Encryption operation latency
- Error rates
- API response times

**Check every 2 hours for first 24 hours:**
```bash
# Check error logs
tail -100 /var/log/pricepilot/error.log | grep -i "decrypt"

# Check metrics
curl https://api.pricepilot.com/metrics | grep encryption
```

### Step 6.2: Verify No Decryption Failures

Query for decryption errors:

```sql
SELECT COUNT(*) as decryption_errors
FROM audit_logs
WHERE event = 'decryption_failed'
  AND timestamp > NOW() - INTERVAL '24 hours';
```

Expected: 0 errors (or only known failures)

### Step 6.3: User Communication

If any users need to re-enter tokens (due to rotation failures):

**Email template:**
```
Subject: Action Required: Reconnect Your Store

Hi [User Name],

We recently performed a security update to enhance the protection of your store credentials in PricePilot.

We need you to reconnect your store to continue using PricePilot:

1. Log in to PricePilot
2. Go to Settings > Integrations
3. Click "Reconnect" next to your store
4. Enter your API token

This is a one-time action to ensure your credentials remain secure.

If you need assistance, please contact support.

Best regards,
PricePilot Team
```

## Rollback Procedure

If critical issues occur during rotation:

### Rollback Step 1: Restore Old Key as Primary

```bash
# Set old key back as ENCRYPTION_MASTER_KEY
vercel env add ENCRYPTION_MASTER_KEY production
# Paste old key value

# Restart application
npm run restart:production
```

### Rollback Step 2: Verify Application Recovery

Test that operations work with old key:

```bash
# Test product sync
curl -X POST https://api.pricepilot.com/api/v1/websites/{id}/sync \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Rollback Step 3: Re-rotate Back to Old Key

If tokens were partially rotated with new key:

```bash
# Set old key as "new" key for reverse rotation
export ENCRYPTION_MASTER_KEY_NEW="old_key_value"

# Run rotation to re-encrypt with old key
npm run rotate-keys
```

### Rollback Step 4: Restore Database (Last Resort)

Only if data corruption occurred:

```bash
# Stop application
npm run stop:production

# Restore from backup
psql -h your-db-host -U your-db-user -d pricepilot_production \
  < backup_pre_rotation_YYYYMMDD_HHMMSS.sql

# Restart application
npm run start:production
```

## Emergency Key Rotation

If key compromise is suspected, rotate immediately:

### Emergency Procedure

1. **Immediate Actions (within 1 hour):**
   - Generate new key
   - Deploy new key to production
   - Run rotation utility immediately
   - Monitor for suspicious activity

2. **Communication:**
   - Notify security team
   - Document incident
   - Prepare user communication if needed

3. **Investigation:**
   - Review audit logs for unauthorized access
   - Check for data exfiltration
   - Identify compromise vector
   - Implement additional security measures

4. **Follow-up:**
   - Complete security incident report
   - Review and update security procedures
   - Consider additional monitoring

## Troubleshooting

### Issue: Rotation Utility Fails to Start

**Symptom:** Error loading keys

**Solution:**
1. Verify both ENCRYPTION_MASTER_KEY and ENCRYPTION_MASTER_KEY_NEW are set
2. Check key format (44 characters, base64)
3. Verify no extra whitespace or newlines
4. Check application logs for specific error

### Issue: High Failure Rate During Rotation

**Symptom:** Many tokens fail to rotate

**Solution:**
1. Check database connectivity
2. Verify both keys are valid
3. Review error patterns in logs
4. Reduce batch size: `--batch-size=10`
5. Consider running during low-traffic period

### Issue: Decryption Fails After Rotation

**Symptom:** Cannot decrypt tokens with new key

**Solution:**
1. Verify new key is set as ENCRYPTION_MASTER_KEY
2. Check that rotation completed successfully
3. Verify application restarted with new key
4. Check specific token format in database
5. Review rotation logs for errors

### Issue: Performance Degradation During Rotation

**Symptom:** Slow API responses during rotation

**Solution:**
1. Reduce batch size to lower database load
2. Run rotation during low-traffic period
3. Monitor database CPU and connections
4. Consider pausing rotation and resuming later
5. Scale database resources if needed

## Best Practices

### Rotation Frequency
- **Regular rotation:** Annually
- **Compliance-driven:** Per regulatory requirements
- **Incident-driven:** Immediately if compromise suspected
- **Personnel changes:** When key-holders leave organization

### Security Considerations
- Never reuse old keys
- Generate keys in secure environment
- Use different keys per environment
- Maintain key version history
- Limit key access to essential personnel
- Audit all key access events

### Operational Considerations
- Test in staging first (always)
- Rotate during low-traffic periods (recommended)
- Monitor closely for 24 hours post-rotation
- Keep old key accessible for 30 days
- Document all rotation activities
- Maintain rollback capability

## Success Criteria

Rotation is successful when:

- [ ] All tokens re-encrypted with new key (or only known failures)
- [ ] Application functions normally with new key
- [ ] Old key no longer works for decryption
- [ ] No increase in error rates
- [ ] Performance metrics within normal range
- [ ] Audit logs show rotation events
- [ ] Monitoring shows no issues for 24 hours
- [ ] Documentation updated

## References

- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Monitoring and Alerting Guide](./MONITORING_GUIDE.md)
- [Design Document](./design.md)
- [Requirements Document](./requirements.md)

## Appendix: Key Rotation Utility Usage

### Command-Line Options

```bash
npm run rotate-keys [options]

Options:
  --dry-run              Preview rotation without making changes
  --batch-size=N         Process N records at a time (default: 50)
  --continue-on-error    Continue if individual rotations fail
  --help                 Show help message
```

### Examples

```bash
# Dry run to preview
npm run rotate-keys -- --dry-run

# Rotate with custom batch size
npm run rotate-keys -- --batch-size=100

# Rotate and continue on errors
npm run rotate-keys -- --continue-on-error

# Combine options
npm run rotate-keys -- --batch-size=200 --continue-on-error
```

### Exit Codes

- `0`: Success (all tokens rotated)
- `1`: Partial success (some failures, but continued)
- `2`: Fatal error (rotation aborted)

### Output Format

```
Key Rotation Started
====================
Old Key: Loaded successfully
New Key: Loaded successfully

Processing batch 1/10 (100 records)...
✓ Rotated 100 tokens (5.2s)

...

Rotation Results:
- Total websites: 1000
- Successfully rotated: 998
- Failed: 2
- Skipped: 0

Failed rotations:
- Website ID: abc-123 (Error: ...)
- Website ID: def-456 (Error: ...)

Rotation completed!
Duration: 52.4 seconds
```
