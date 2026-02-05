---
title: "Tenant Operations Guide"
description: "Manage tenant accounts, subscriptions, and operations"
category: "tenant-management"
subcategory: null
tags: ["tenants", "management", "operations", "admin"]
author: "PricePilot Team"
lastReviewed: "2024-01-15"
relatedDocs: ["user-management", "health-checks"]
---

# Tenant Operations Guide

Comprehensive guide for managing tenant accounts and operations.

## Tenant Management

### View All Tenants

```http
GET /api/v1/admin/tenants
Authorization: Bearer ADMIN_TOKEN

Response:
{
  "success": true,
  "data": {
    "tenants": [
      {
        "id": "uuid",
        "name": "Acme Corp",
        "slug": "acme-corp",
        "plan": "professional",
        "status": "active",
        "userCount": 5,
        "productCount": 1500,
        "createdAt": "2024-01-01T00:00:00Z",
        "lastActivity": "2024-01-15T10:00:00Z"
      }
    ],
    "total": 150,
    "page": 1,
    "limit": 20
  }
}
```

### Tenant Details

```typescript
interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
  
  // Usage metrics
  userCount: number;
  productCount: number;
  competitorCount: number;
  apiCallsThisMonth: number;
  
  // Subscription
  subscriptionId: string;
  billingEmail: string;
  nextBillingDate: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastActivity: Date;
}
```

## Tenant Operations

### Create Tenant

```http
POST /api/v1/admin/tenants
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "name": "New Company",
  "slug": "new-company",
  "plan": "professional",
  "billingEmail": "billing@newcompany.com",
  "adminUser": {
    "email": "admin@newcompany.com",
    "name": "Admin User",
    "password": "secure-password"
  }
}

Response:
{
  "success": true,
  "data": {
    "tenant": { /* tenant object */ },
    "adminUser": { /* user object */ }
  }
}
```

### Update Tenant

```http
PATCH /api/v1/admin/tenants/:id
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "plan": "enterprise",
  "status": "active"
}
```

### Suspend Tenant

```typescript
// Suspend tenant account
async function suspendTenant(tenantId: string, reason: string) {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      status: 'suspended',
      suspensionReason: reason,
      suspendedAt: new Date()
    }
  });
  
  // Disable all API tokens
  await prisma.apiToken.updateMany({
    where: { tenantId },
    data: { status: 'disabled' }
  });
  
  // Stop all scheduled jobs
  await stopTenantJobs(tenantId);
  
  // Send notification
  await notifyTenantSuspension(tenantId, reason);
}
```

### Delete Tenant

```typescript
// Soft delete tenant (preserves data)
async function deleteTenant(tenantId: string) {
  // Mark as deleted
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      status: 'deleted',
      deletedAt: new Date()
    }
  });
  
  // Schedule data cleanup (after 30 days)
  await scheduleDataCleanup(tenantId, 30);
}

// Hard delete tenant (removes all data)
async function hardDeleteTenant(tenantId: string) {
  // Delete in order (respecting foreign keys)
  await prisma.priceHistory.deleteMany({ where: { tenantId } });
  await prisma.productMatches.deleteMany({ where: { tenantId } });
  await prisma.competitorProducts.deleteMany({ where: { tenantId } });
  await prisma.userProducts.deleteMany({ where: { tenantId } });
  await prisma.competitorWebsites.deleteMany({ where: { tenantId } });
  await prisma.userWebsites.deleteMany({ where: { tenantId } });
  await prisma.users.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
}
```

## Usage Monitoring

### Track Usage Metrics

```typescript
// Monitor tenant resource usage
interface TenantUsage {
  tenantId: string;
  period: 'daily' | 'monthly';
  
  // API usage
  apiCalls: number;
  apiCallsLimit: number;
  apiCallsRemaining: number;
  
  // Resource usage
  productCount: number;
  productLimit: number;
  competitorCount: number;
  competitorLimit: number;
  userCount: number;
  userLimit: number;
  
  // Scraping usage
  scrapingJobs: number;
  scrapingJobsLimit: number;
  
  // Storage usage
  storageUsed: number; // bytes
  storageLimit: number;
}
```

### Usage Alerts

```typescript
// Alert when tenant approaches limits
{
  alerts: [
    {
      tenantId: "uuid",
      type: "api_limit",
      message: "Tenant approaching API limit (90% used)",
      usage: 9000,
      limit: 10000,
      severity: "warning"
    },
    {
      tenantId: "uuid",
      type: "product_limit",
      message: "Product limit exceeded",
      usage: 1100,
      limit: 1000,
      severity: "critical"
    }
  ]
}
```

## Plan Management

### Plan Limits

```typescript
const planLimits = {
  free: {
    products: 100,
    competitors: 3,
    users: 1,
    apiCalls: 1000,
    scrapingFrequency: 'daily'
  },
  starter: {
    products: 500,
    competitors: 10,
    users: 3,
    apiCalls: 10000,
    scrapingFrequency: 'hourly'
  },
  professional: {
    products: 2000,
    competitors: 25,
    users: 10,
    apiCalls: 50000,
    scrapingFrequency: 'hourly'
  },
  enterprise: {
    products: -1, // unlimited
    competitors: -1,
    users: -1,
    apiCalls: -1,
    scrapingFrequency: 'realtime'
  }
};
```

### Upgrade/Downgrade

```typescript
// Handle plan changes
async function changePlan(
  tenantId: string,
  newPlan: string,
  immediate: boolean = false
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });
  
  const oldPlan = tenant.plan;
  const newLimits = planLimits[newPlan];
  
  // Check if downgrade requires data cleanup
  if (isDowngrade(oldPlan, newPlan)) {
    await validateDowngrade(tenantId, newLimits);
  }
  
  // Update plan
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      plan: newPlan,
      planChangedAt: new Date(),
      previousPlan: oldPlan
    }
  });
  
  // Apply new limits
  await applyPlanLimits(tenantId, newLimits);
  
  // Notify tenant
  await notifyPlanChange(tenantId, oldPlan, newPlan);
}
```

## Tenant Isolation

### Data Isolation Verification

```sql
-- Verify tenant isolation
SELECT 
  t.id,
  t.name,
  COUNT(DISTINCT up.id) as products,
  COUNT(DISTINCT cw.id) as competitors,
  COUNT(DISTINCT u.id) as users
FROM tenants t
LEFT JOIN user_products up ON up."tenantId" = t.id
LEFT JOIN competitor_websites cw ON cw."tenantId" = t.id
LEFT JOIN users u ON u."tenantId" = t.id
GROUP BY t.id, t.name;
```

### Cross-Tenant Query Prevention

```typescript
// Always include tenantId in queries
async function getProducts(tenantId: string) {
  return await prisma.userProduct.findMany({
    where: {
      tenantId: tenantId // REQUIRED
    }
  });
}

// Middleware to enforce tenant isolation
app.use((req, res, next) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    return res.status(403).json({ error: 'No tenant context' });
  }
  req.tenantId = tenantId;
  next();
});
```

## Tenant Analytics

### Activity Metrics

```typescript
interface TenantAnalytics {
  tenantId: string;
  period: string;
  
  // User activity
  activeUsers: number;
  loginCount: number;
  avgSessionDuration: number;
  
  // Feature usage
  productSyncs: number;
  priceUpdates: number;
  scrapingJobs: number;
  apiCalls: number;
  
  // Business metrics
  productsTracked: number;
  competitorsMonitored: number;
  priceChanges: number;
  avgPriceChange: number;
}
```

### Health Score

```typescript
// Calculate tenant health score
function calculateHealthScore(tenant: Tenant): number {
  const factors = {
    activity: getActivityScore(tenant),      // 30%
    usage: getUsageScore(tenant),           // 25%
    engagement: getEngagementScore(tenant), // 25%
    satisfaction: getSatisfactionScore(tenant) // 20%
  };
  
  return (
    factors.activity * 0.30 +
    factors.usage * 0.25 +
    factors.engagement * 0.25 +
    factors.satisfaction * 0.20
  );
}
```

## Troubleshooting

### Common Issues

**Tenant Can't Access System:**
```typescript
// Check tenant status
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId }
});

if (tenant.status === 'suspended') {
  // Review suspension reason
  // Contact tenant
  // Resolve issue
  // Reactivate account
}
```

**Usage Limit Exceeded:**
```typescript
// Temporarily increase limits
await prisma.tenant.update({
  where: { id: tenantId },
  data: {
    temporaryLimits: {
      apiCalls: 20000, // Double the limit
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }
  }
});
```

**Data Inconsistency:**
```sql
-- Audit tenant data
SELECT 
  'user_products' as table_name,
  COUNT(*) as count
FROM user_products
WHERE "tenantId" = 'uuid'
UNION ALL
SELECT 
  'competitor_products',
  COUNT(*)
FROM competitor_products
WHERE "tenantId" = 'uuid';
```

## Best Practices

1. **Regular Audits**: Review tenant accounts monthly
2. **Usage Monitoring**: Track usage patterns for capacity planning
3. **Communication**: Keep tenants informed of changes
4. **Data Backup**: Regular backups before major operations
5. **Documentation**: Document all tenant operations

## Next Steps

- Review [User Management](user-management)
- Configure [Database Operations](../database/schema-management)
- Set up [Security Configurations](../security/authentication-config)
