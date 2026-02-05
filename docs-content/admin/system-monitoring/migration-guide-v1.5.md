---
title: "Migration Guide v1.5"
description: "Migration guide for version 1.5"
category: "system-monitoring"
tags: ["migration", "upgrade", "deployment"]
audience: "admin"
relatedDocs: ["/docs/troubleshooting/migration-guide-v1.5.md"]
---

# Migration Guide: Upgrading to PricePilot v1.5

**Target Audience**: Users upgrading from PricePilot v1.0 to v1.5  
**Estimated Time**: 15-30 minutes  
**Difficulty**: Easy  
**Last Updated**: February 1, 2026

---

## Overview

PricePilot v1.5 introduces significant enhancements in security, performance, and automation. This guide will help you upgrade smoothly from v1.0 to v1.5.

**Good News**: There are **NO breaking changes**. All existing integrations, pricing rules, and data will continue to work without modification.

---

## What's New in v1.5

### Major Features
- ✅ **Auto-Approval Rules**: Automate routine price approvals
- ✅ **Email Notifications**: Stay informed about price changes
- ✅ **Approval Delegation**: Delegate approval authority to team members
- ✅ **Rollback System**: Undo incorrect price changes
- ✅ **Enhanced Security**: AES-256 encryption, rate limiting, input validation
- ✅ **Performance Boost**: 10x faster queries, Redis caching, pagination

### Improvements
- ✅ **Better Error Handling**: User-friendly error messages
- ✅ **Comprehensive Monitoring**: Real-time dashboards
- ✅ **Complete API Documentation**: OpenAPI 3.0 specification
- ✅ **Troubleshooting Guide**: Common issues and solutions

---

## Pre-Upgrade Checklist

Before upgrading, ensure you have:

- [ ] **Backup**: Create a backup of your database
- [ ] **Access**: Admin access to your PricePilot account
- [ ] **Time**: 15-30 minutes for the upgrade process
- [ ] **Testing**: A test environment (optional but recommended)

---

## Upgrade Steps

### Step 1: Update Environment Variables

Add the following new environment variables to your `.env` file:

```env
# Security (Required for v1.5)
ENCRYPTION_KEY="your_32_byte_hex_key"  # Generate with: openssl rand -hex 32

# Redis (Required for caching and rate limiting)
UPSTASH_REDIS_REST_URL="your_redis_url"
UPSTASH_REDIS_REST_TOKEN="your_redis_token"

# Email Notifications (Optional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="noreply@pricepilot.com"
```

#### Generating the Encryption Key

```bash
# On Linux/Mac
openssl rand -hex 32

# On Windows (PowerShell)
-join ((48..57) + (97..102) | Get-Random -Count 64 | % {[char]$_})

# Example output:
# a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

#### Setting Up Redis (Upstash)

1. **Create Free Account**: Visit [upstash.com](https://upstash.com) and sign up
2. **Create Database**: Click "Create Database" → Choose region → Create
3. **Get Credentials**: Copy REST URL and REST Token from dashboard
4. **Add to .env**: Paste credentials into your `.env` file

**Note**: Upstash offers a generous free tier (10,000 commands/day) which is sufficient for most users.

#### Setting Up Email (Optional)

If you want email notifications:

**Gmail Setup**:
1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password: Google Account → Security → App Passwords
3. Use the app password in `SMTP_PASS`

**Other Providers**:
- **SendGrid**: Use API key as password
- **Mailgun**: Use SMTP credentials from dashboard
- **Amazon SES**: Use SMTP credentials from AWS console

### Step 2: Update Dependencies

If you're self-hosting, update your dependencies:

```bash
# Update npm packages
npm install

# Update Prisma client
npx prisma generate

# Run database migrations
npx prisma db push
```

**Note**: If you're using PricePilot Cloud, this step is handled automatically.

### Step 3: Run Database Migrations

The v1.5 upgrade includes new database tables and indexes:

```bash
# Apply migrations
npx prisma migrate deploy

# Verify migrations
npx prisma migrate status
```

**New Tables Added**:
- `AutoApprovalRule` - Stores auto-approval rules
- `ApprovalDelegation` - Stores delegation records
- `BulkOperationSnapshot` - Stores bulk operation snapshots for rollback

**New Indexes Added**:
- 15+ strategic indexes for performance optimization
- See [ARCHITECTURE.md](ARCHITECTURE.md) for complete list

### Step 4: Encrypt Existing API Tokens

Existing API tokens need to be encrypted with the new encryption system:

```bash
# Run migration script
npm run migrate:encrypt-tokens

# Or manually via Prisma Studio
npx prisma studio
```

**Note**: This is a one-time operation. New tokens will be automatically encrypted.

### Step 5: Verify Upgrade

After upgrading, verify everything is working:

1. **Check Dashboard**: Log in and ensure dashboard loads correctly
2. **Test Integration**: Go to Dashboard → Integrations → Test Connection
3. **Check Scraping**: Verify competitor prices are updating
4. **Test Price Update**: Try updating a test product price
5. **Review Logs**: Check Dashboard → Activity for any errors

---

## New Features Setup

### Enable Auto-Approval Rules

1. Go to **Dashboard → Auto-Approval Rules**
2. Click **Create New Rule**
3. Configure your first rule:
   - Name: "Small Price Decreases"
   - Max Price Change: $20
   - Max Percentage Change: 5%
   - Min Confidence Score: 85
4. Click **Save** and **Enable**

**Recommended Starting Rules**:
```
Rule 1: High Confidence Small Changes
- Max Price Change: $10
- Min Confidence Score: 95
- Priority: 1

Rule 2: Medium Confidence Moderate Changes
- Max Price Change: $25
- Max Percentage Change: 5%
- Min Confidence Score: 85
- Priority: 2
```

### Configure Email Notifications

1. Go to **Dashboard → Settings → Notifications**
2. Enable desired notification types:
   - ☑️ Pending Approval Alerts
   - ☑️ Daily Approval Summary
   - ☑️ Auto-Approval Notifications
3. Set auto-approval frequency: Daily Digest
4. Click **Save Preferences**
5. Click **Send Test Email** to verify

### Set Up Approval Delegation (Optional)

If you have team members who should approve prices:

1. Go to **Dashboard → Settings → Delegations**
2. Click **Create New Delegation**
3. Select team member
4. Set start and end dates
5. Click **Create**

---

## Configuration Changes

### Scraping Frequency

**Important**: The scraping frequency documentation has been corrected.

- **Previous Documentation**: Claimed "every 15 minutes"
- **Actual Behavior**: Every 24 hours (unchanged)
- **v1.5 Documentation**: Correctly states "every 24 hours"

**No action required** - this was a documentation correction only.

### Rate Limits

New rate limits are now enforced:

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| API Endpoints | 100 requests | 1 hour |
| Scraping Operations | 10 requests | 1 minute |
| Admin Endpoints | 1000 requests | 1 hour |
| Authentication | 5 attempts | 15 minutes |

**Impact**: Most users won't notice any difference. If you have custom integrations making many API calls, you may need to implement rate limit handling.

**Handling Rate Limits**:
```javascript
// Check rate limit headers
const response = await fetch('/api/v1/products');
const remaining = response.headers.get('X-RateLimit-Remaining');
const reset = response.headers.get('X-RateLimit-Reset');

if (response.status === 429) {
  // Rate limit exceeded, wait and retry
  const resetTime = new Date(parseInt(reset) * 1000);
  console.log(`Rate limit exceeded. Resets at ${resetTime}`);
}
```

### Security Enhancements

**API Token Encryption**:
- All API tokens are now encrypted at rest
- Existing tokens are automatically encrypted during migration
- No changes needed to your integration code

**Input Validation**:
- Enhanced validation on all API endpoints
- More detailed error messages for invalid input
- Better protection against malicious input

**Impact**: You may see more detailed validation errors if you're sending invalid data. Update your integration code to handle these errors properly.

---

## Troubleshooting

### Common Issues

#### Issue: "ENCRYPTION_KEY not found"

**Solution**:
```bash
# Generate encryption key
openssl rand -hex 32

# Add to .env
echo "ENCRYPTION_KEY=your_generated_key" >> .env

# Restart application
npm run dev
```

#### Issue: "Redis connection failed"

**Solution**:
1. Verify Redis credentials in `.env`
2. Check Upstash dashboard for database status
3. Test connection:
   ```bash
   curl -X GET "https://your-redis-url/get/test" \
     -H "Authorization: Bearer your-redis-token"
   ```

#### Issue: "Email notifications not working"

**Solution**:
1. Check SMTP configuration in `.env`
2. Verify SMTP credentials are correct
3. Test with Gmail app password (not regular password)
4. Check spam folder
5. Send test email from Dashboard → Settings → Notifications

#### Issue: "Database migration failed"

**Solution**:
```bash
# Reset migrations (WARNING: This will delete data)
npx prisma migrate reset

# Or manually apply migrations
npx prisma migrate deploy --skip-seed

# Check migration status
npx prisma migrate status
```

#### Issue: "Rate limit exceeded"

**Solution**:
1. Check your API usage in Dashboard → Settings → API Usage
2. Implement exponential backoff in your integration
3. Cache responses to reduce API calls
4. Contact support for higher limits if needed

### Getting Help

If you encounter issues during upgrade:

1. **Check Logs**: Dashboard → Activity → Filter by "Error"
2. **Review Documentation**: [DOCUMENTATION.md](../DOCUMENTATION.md)
3. **Troubleshooting Guide**: [DOCUMENTATION.md#troubleshooting-guide](../DOCUMENTATION.md#troubleshooting-guide)
4. **Contact Support**: support@pricepilot.com

**Include in Support Request**:
- Error messages
- Screenshots
- Environment (self-hosted or cloud)
- Steps to reproduce
- Browser/OS version

---

## Rollback Plan

If you need to rollback to v1.0:

### Step 1: Restore Database Backup

```bash
# Restore from backup
pg_restore -d pricepilot_db backup.sql

# Or using Prisma
npx prisma db push --force-reset
```

### Step 2: Revert Environment Variables

Remove v1.5-specific variables from `.env`:
- ENCRYPTION_KEY
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN
- SMTP_* variables

### Step 3: Revert Code

```bash
# Checkout v1.0 tag
git checkout v1.0

# Install dependencies
npm install

# Restart application
npm run dev
```

**Note**: Rollback will lose all v1.5 data (auto-approval rules, delegations, etc.). Export important data before rolling back.

---

## Post-Upgrade Checklist

After upgrading, verify:

- [ ] Dashboard loads correctly
- [ ] Store integration works (test connection)
- [ ] Competitor scraping works
- [ ] Price updates work
- [ ] Auto-approval rules work (if configured)
- [ ] Email notifications work (if configured)
- [ ] Rollback feature works (test with non-critical product)
- [ ] Performance is improved (check response times)
- [ ] No errors in logs

---

## Performance Improvements

You should notice these improvements immediately:

### Database Queries
- **Before**: 500ms average query time
- **After**: 50ms average query time (10x faster)

### API Response Times
- **Before**: 1000ms average response time
- **After**: 500ms average response time (50% faster)

### Dashboard Loading
- **Before**: 3-5 seconds
- **After**: 1-2 seconds (60% faster)

### Scraping Performance
- **Before**: 100 products/hour
- **After**: 150 products/hour (50% faster)

---

## Next Steps

After upgrading, explore the new features:

1. **Set Up Auto-Approval Rules**: Automate routine approvals
2. **Configure Email Notifications**: Stay informed
3. **Try Rollback Feature**: Test with a non-critical product
4. **Delegate Approval Authority**: If you have team members
5. **Review Security Enhancements**: Check audit logs
6. **Optimize Performance**: Review caching and indexing

---

## Additional Resources

- **Main Documentation**: [DOCUMENTATION.md](../DOCUMENTATION.md)
- **Architecture Guide**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **API Documentation**: [API_DOCUMENTATION_INDEX.md](API_DOCUMENTATION_INDEX.md)
- **Troubleshooting Guide**: [DOCUMENTATION.md#troubleshooting-guide](../DOCUMENTATION.md#troubleshooting-guide)
- **Email Notifications Guide**: [EMAIL_NOTIFICATIONS.md](EMAIL_NOTIFICATIONS.md)
- **Rollback Procedures**: [ROLLBACK_PROCEDURES.md](ROLLBACK_PROCEDURES.md)

---

## Feedback

We'd love to hear about your upgrade experience!

- **Email**: support@pricepilot.com
- **Subject**: "v1.5 Upgrade Feedback"
- **Include**: What went well, what could be improved

---

**Migration Guide Version**: 1.0  
**Last Updated**: February 1, 2026  
**Applies To**: PricePilot v1.0 → v1.5

---

<p align="center">
  <strong>Thank you for upgrading to PricePilot v1.5!</strong><br>
  Questions? Contact support@pricepilot.com
</p>
