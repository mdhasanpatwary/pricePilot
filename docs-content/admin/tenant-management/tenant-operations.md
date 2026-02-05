---
title: "Tenant Operations Guide"
description: "Complete guide for managing tenants in PricePilot - creation, configuration, and lifecycle management"
category: "tenant-management"
tags: ["tenant", "management", "operations", "admin"]
audience: "admin"
---

# Tenant Operations Guide

This guide covers all aspects of tenant management in PricePilot, including creation, configuration, monitoring, and lifecycle management.

## Overview

PricePilot is a multi-tenant SaaS platform where each tenant represents a separate customer organization with isolated data and configuration.

### Tenant Isolation

Each tenant has:
- **Separate database records** - Row-level security by `tenantId`
- **Isolated data** - No cross-tenant data access
- **Independent configuration** - Settings, integrations, users
- **Separate API tokens** - Unique authentication per tenant
- **Individual billing** - Per-tenant subscription management

## Creating a New Tenant

### Via Admin Dashboard

1. Navigate to **Admin → Tenants**
2. Click **Create New Tenant**
3. Fill in tenant details:
   - **Organization Name** - Company/store name
   - **Slug** - URL-safe identifier (auto-generated)
   - **Plan** - Subscription tier (free, starter, professional, enterprise)
   - **Status** - Active, trial, suspended, cancelled
   - **Contact Email** - Primary contact
4. Click **Create Tenant**

### Via API

```bash
POST /api/v1/admin/tenants
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "TechStore Inc",
  "slug": "techstore",
  "plan": "professional",
  "status": "trial",
  "contactEmail": "admin@techstore.com",
  "settings": {
    "maxProducts": 1000,
    "maxCompetitors": 10,
    "scrapingFrequency": "hourly"
  }
}
```

### Via CLI

```bash
npm run tenant:create -- \
  --name "TechStore Inc" \
  --slug "techstore" \
  --plan "professional" \
  --email "admin@techstore.com"
```

## Tenant Configuration

### Plan Limits

Each plan has different limits:

**Free Plan:**
- 100 products
- 2 competitors
- Daily scraping
- Basic support

**Starter Plan:**
- 500 products
- 5 competitors
- Hourly scraping
- Email support

**Professional Plan:**
- 2,000 products
- 10 competitors
- Hourly scraping
- Priority support
- API access

**Enterprise Plan:**
- Unlimited products
- Unlimited competitors
- Real-time scraping
- Dedicated support
- Custom integrations

### Configuring Tenant Settings

```typescript
// Update tenant settings
await prisma.tenant.update({
  where: { id: tenantId },
  data: {
    settings: {
      maxProducts: 2000,
      maxCompetitors: 10,
      scrapingFrequency: 'hourly',
      features: {
        autoApproval: true,
        bulkUpdates: true,
        apiAccess: true,
        webhooks: true
      },
      limits: {
        apiRequestsPerHour: 1000,
        scrapingConcurrency: 5,
        priceUpdatesPerDay: 500
      }
    }
  }
});
```

## User Management

### Adding Users to Tenant

```bash
POST /api/v1/admin/tenants/:tenantId/users
Authorization: Bearer <admin_token>

{
  "email": "user@techstore.com",
  "name": "John Doe",
  "role": "user",
  "permissions": ["view_products", "update_prices"]
}
```

### User Roles

- **Owner** - Full access, billing management
- **Admin** - Full access except billing
- **Manager** - Can approve price updates
- **User** - View-only access

### Removing Users

```bash
DELETE /api/v1/admin/tenants/:tenantId/users/:userId
Authorization: Bearer <admin_token>
```

## Monitoring Tenant Health

### Key Metrics to Monitor

1. **Product Sync Status**
   - Last sync time
   - Sync success rate
   - Failed sync count

2. **Scraping Performance**
   - Scraping success rate
   - Average scraping time
   - Failed scraping attempts

3. **API Usage**
   - Requests per hour
   - Rate limit violations
   - Error rates

4. **Price Updates**
   - Updates per day
   - Success rate
   - Rollback frequency

### Monitoring Dashboard

Access tenant metrics:

```bash
GET /api/v1/admin/tenants/:tenantId/metrics
Authorization: Bearer <admin_token>
```

Response:
```json
{
  "tenantId": "uuid",
  "metrics": {
    "products": {
      "total": 1250,
      "synced": 1248,
      "lastSync": "2024-01-15T10:30:00Z"
    },
    "competitors": {
      "total": 8,
      "active": 7,
      "lastScrape": "2024-01-15T11:00:00Z"
    },
    "apiUsage": {
      "requestsToday": 450,
      "limit": 1000,
      "errorRate": 0.02
    },
    "priceUpdates": {
      "today": 25,
      "thisWeek": 180,
      "successRate": 0.98
    }
  }
}
```

## Tenant Lifecycle Management

### Trial Period

New tenants start with a trial period:

```typescript
// Set trial expiration
await prisma.tenant.update({
  where: { id: tenantId },
  data: {
    status: 'trial',
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
  }
});
```

### Upgrading/Downgrading Plans

```bash
POST /api/v1/admin/tenants/:tenantId/change-plan
Authorization: Bearer <admin_token>

{
  "newPlan": "enterprise",
  "effectiveDate": "2024-02-01",
  "prorated": true
}
```

### Suspending a Tenant

Suspend for non-payment or policy violations:

```typescript
await prisma.tenant.update({
  where: { id: tenantId },
  data: {
    status: 'suspended',
    suspendedAt: new Date(),
    suspensionReason: 'Payment overdue'
  }
});
```

**Effects of suspension:**
- Users cannot log in
- API access disabled
- Scraping paused
- Data retained (not deleted)

### Reactivating a Tenant

```typescript
await prisma.tenant.update({
  where: { id: tenantId },
  data: {
    status: 'active',
    suspendedAt: null,
    suspensionReason: null
  }
});
```

### Cancelling a Tenant

```bash
POST /api/v1/admin/tenants/:tenantId/cancel
Authorization: Bearer <admin_token>

{
  "reason": "Customer request",
  "effectiveDate": "2024-02-01",
  "deleteData": false
}
```

**Cancellation process:**
1. Set status to 'cancelled'
2. Stop all scraping jobs
3. Disable API access
4. Retain data for 30 days (configurable)
5. Send cancellation confirmation email

### Data Retention

After cancellation:
- **30 days** - Data retained, can be reactivated
- **After 30 days** - Data archived to cold storage
- **After 90 days** - Data permanently deleted (GDPR compliance)

## Bulk Operations

### Bulk Tenant Updates

```bash
POST /api/v1/admin/tenants/bulk-update
Authorization: Bearer <admin_token>

{
  "tenantIds": ["uuid1", "uuid2", "uuid3"],
  "updates": {
    "settings.scrapingFrequency": "daily"
  }
}
```

### Bulk Status Changes

```bash
POST /api/v1/admin/tenants/bulk-status
Authorization: Bearer <admin_token>

{
  "tenantIds": ["uuid1", "uuid2"],
  "status": "suspended",
  "reason": "Maintenance"
}
```

## Troubleshooting

### Tenant Cannot Sync Products

1. Check API token validity
2. Verify store URL is accessible
3. Check firewall rules
4. Review sync error logs
5. Test API endpoint manually

### Scraping Failures

1. Check competitor URL accessibility
2. Review bot protection status
3. Check proxy health
4. Verify scraping configuration
5. Review error logs

### High API Error Rates

1. Check rate limiting configuration
2. Review error logs for patterns
3. Verify API token permissions
4. Check database connection health
5. Monitor server resources

## Security Considerations

### Data Isolation

Always verify tenant isolation:

```typescript
// CORRECT - Includes tenantId filter
const products = await prisma.product.findMany({
  where: {
    tenantId: currentTenantId,
    status: 'active'
  }
});

// INCORRECT - Missing tenantId filter (security risk!)
const products = await prisma.product.findMany({
  where: {
    status: 'active'
  }
});
```

### API Token Security

- Tokens are encrypted at rest
- Rotate tokens regularly
- Revoke compromised tokens immediately
- Audit token usage

### Access Control

- Enforce role-based access control (RBAC)
- Log all admin actions
- Require MFA for admin accounts
- Regular security audits

## Best Practices

1. **Regular Monitoring** - Check tenant health daily
2. **Proactive Communication** - Notify tenants of issues
3. **Data Backups** - Regular automated backups
4. **Performance Optimization** - Monitor and optimize slow queries
5. **Security Audits** - Regular security reviews
6. **Documentation** - Keep runbooks updated

## Related Documentation

- [Tenant Guide](/docs/troubleshooting/tenant-guide) - Tenant-facing documentation
- [User Management](/admin-docs/tenant-management/user-management) - Detailed user management
- [Monitoring System](/admin-docs/system-monitoring/monitoring-system) - System monitoring
- [Security Checklist](/admin-docs/security/security-checklist) - Security best practices

## Support

For tenant management issues:
- Check [Admin Troubleshooting Guide](/admin-docs/system-monitoring/admin-troubleshooting-guide)
- Review [Operations Runbook](/admin-docs/system-monitoring/runbook)
- Contact platform engineering team
