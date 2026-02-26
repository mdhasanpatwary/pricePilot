---
title: "Admin Dashboard Guide"
description: "Complete guide to using the PricePilot admin dashboard for tenant management, system monitoring, and configuration"
category: "tenant-management"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["admin", "dashboard", "management", "monitoring", "configuration"]
audience: "admin"
relatedDocs: ["tenant-operations", "health-checks", "security-checklist"]
---

# Admin Dashboard Guide

The PricePilot admin dashboard provides comprehensive tools for managing tenants, monitoring system health, and configuring platform-wide settings. This guide covers all administrative features and best practices.

## Overview

The admin dashboard is accessible only to users with administrator privileges and provides:

- **Tenant Management** - Create, configure, and monitor customer accounts
- **System Monitoring** - Real-time health metrics and performance data
- **Configuration Management** - Platform-wide settings and feature flags
- **User Administration** - Manage admin users and permissions
- **Analytics & Reporting** - System-wide usage and performance analytics
- **Security Controls** - Access logs, audit trails, and security settings

### Accessing the Admin Dashboard

1. Navigate to `/admin` in your browser
2. Log in with admin credentials
3. Verify you have admin or super admin role

**Security Note:** Admin access is restricted to authenticated users with `isSuperAdmin` flag or `admin` role. All admin actions are logged for audit purposes.

## Tenant Management

### Tenant Overview

The tenant management section provides a comprehensive view of all customer accounts.

#### Viewing All Tenants

Navigate to **Admin → Tenants** to see:

- **Tenant List** - All registered tenants with key metrics
- **Status Indicators** - Active, trial, suspended, cancelled
- **Plan Information** - Current subscription tier
- **Usage Metrics** - Products, competitors, API usage
- **Last Activity** - Recent sync and scraping timestamps

#### Tenant Details

Click on any tenant to view detailed information:

```typescript
// Tenant detail view includes:
{
  id: "uuid",
  name: "TechStore Inc",
  slug: "techstore",
  status: "active",
  plan: "professional",
  createdAt: "2024-01-01T00:00:00Z",

  // Usage statistics
  stats: {
    products: 1250,
    competitors: 8,
    priceUpdates: 450,
    apiRequests: 15000
  },

  // Configuration
  settings: {
    maxProducts: 2000,
    maxCompetitors: 10,
    scrapingFrequency: "hourly",
    features: ["autoApproval", "bulkUpdates", "apiAccess"]
  },

  // Health metrics
  health: {
    lastSync: "2024-02-05T10:30:00Z",
    syncSuccessRate: 0.98,
    scrapingSuccessRate: 0.95,
    apiErrorRate: 0.002
  }
}
```

### Creating New Tenants

#### Via Dashboard UI

1. Click **Create New Tenant** button
2. Fill in required information:
   - **Organization Name** - Customer company name
   - **Slug** - URL-safe identifier (auto-generated from name)
   - **Contact Email** - Primary contact email
   - **Plan** - Select subscription tier
   - **Status** - Set initial status (usually "trial")
3. Configure optional settings:
   - Product limits
   - Competitor limits
   - Feature flags
   - Scraping frequency
4. Click **Create Tenant**

#### Plan Options

**Free Plan:**
- 100 products
- 2 competitors
- Daily scraping (24-hour intervals)
- Basic email support
- No API access

**Starter Plan:**
- 500 products
- 5 competitors
- Hourly scraping
- Email support
- Limited API access (100 requests/hour)

**Professional Plan:**
- 2,000 products
- 10 competitors
- Hourly scraping
- Priority email support
- Full API access (1,000 requests/hour)
- Auto-approval rules
- Bulk operations

**Enterprise Plan:**
- Unlimited products
- Unlimited competitors
- Custom scraping frequency
- Dedicated support
- Unlimited API access
- Custom integrations
- SLA guarantees

### Managing Tenant Configuration

#### Updating Tenant Settings

Navigate to **Tenant Details → Settings** to modify:

**Resource Limits:**
```typescript
{
  maxProducts: 2000,
  maxCompetitors: 10,
  maxUsers: 5,
  storageLimit: "10GB"
}
```

**Feature Flags:**
```typescript
{
  features: {
    autoApproval: true,
    bulkUpdates: true,
    apiAccess: true,
    webhooks: true,
    advancedMatching: true,
    customScraping: false
  }
}
```

**Scraping Configuration:**
```typescript
{
  scrapingFrequency: "hourly", // hourly, daily, custom
  scrapingConcurrency: 5,
  scrapingTimeout: 30000, // milliseconds
  retryAttempts: 3,
  respectRobotsTxt: true
}
```

**Rate Limiting:**
```typescript
{
  apiRequestsPerHour: 1000,
  scrapingRequestsPerMinute: 10,
  priceUpdatesPerDay: 500
}
```

#### Changing Tenant Plans

1. Navigate to **Tenant Details → Plan**
2. Click **Change Plan**
3. Select new plan tier
4. Set effective date (immediate or scheduled)
5. Choose proration option
6. Confirm plan change

**Plan Change Effects:**
- Limits updated immediately or on effective date
- Features enabled/disabled based on new plan
- Billing adjusted with proration (if applicable)
- Notification sent to tenant

### Tenant Lifecycle Management

#### Trial Management

**Setting Trial Period:**
```typescript
// Configure trial duration
{
  status: "trial",
  trialEndsAt: "2024-02-19T23:59:59Z", // 14 days from creation
  trialNotifications: {
    sent7DayWarning: false,
    sent3DayWarning: false,
    sent1DayWarning: false
  }
}
```

**Trial Expiration Actions:**
- Automatic status change to "expired"
- Disable scraping and price updates
- Maintain read-only access for 7 days
- Send conversion emails
- Option to extend trial

#### Suspending Tenants

**Reasons for Suspension:**
- Payment failure
- Terms of service violation
- Excessive resource usage
- Security concerns
- Customer request

**Suspension Process:**
1. Navigate to **Tenant Details → Actions**
2. Click **Suspend Tenant**
3. Select suspension reason
4. Add internal notes
5. Choose notification option
6. Confirm suspension

**Effects of Suspension:**
- Users cannot log in
- API access disabled
- Scraping jobs paused
- Price updates blocked
- Data retained (not deleted)
- Billing paused

#### Reactivating Tenants

1. Navigate to suspended tenant
2. Click **Reactivate Tenant**
3. Verify payment/issue resolution
4. Confirm reactivation
5. System automatically:
   - Restores user access
   - Re-enables API
   - Resumes scraping
   - Sends reactivation email

#### Cancelling Tenants

**Cancellation Process:**
1. Navigate to **Tenant Details → Actions**
2. Click **Cancel Tenant**
3. Select cancellation reason
4. Set effective date
5. Choose data retention option:
   - **Retain for 30 days** (default)
   - **Retain for 90 days**
   - **Immediate deletion** (requires confirmation)
6. Confirm cancellation

**Post-Cancellation:**
- Status set to "cancelled"
- All services stopped immediately
- Data retained per selected option
- Cancellation email sent
- Billing stopped
- Option to export data (if requested)

### User Management

#### Viewing Tenant Users

Navigate to **Tenant Details → Users** to see:
- All users associated with the tenant
- User roles and permissions
- Last login timestamps
- Activity status

#### Adding Users to Tenant

1. Click **Add User** in tenant users section
2. Enter user details:
   - Email address
   - Full name
   - Role (owner, admin, manager, user)
3. Set permissions (if custom role)
4. Send invitation email
5. User receives setup link

#### User Roles

**Owner:**
- Full access to all features
- Billing and subscription management
- Can add/remove users
- Can delete tenant account

**Admin:**
- Full access except billing
- Can manage users
- Can configure integrations
- Can approve price updates

**Manager:**
- Can view all data
- Can approve price updates
- Can configure products
- Cannot manage users

**User:**
- View-only access
- Can view products and prices
- Cannot make changes
- Cannot access settings

#### Removing Users

1. Navigate to tenant users list
2. Click **Remove** next to user
3. Confirm removal
4. User access revoked immediately
5. Notification email sent (optional)

## System Monitoring

### Dashboard Overview

The monitoring dashboard provides real-time system health metrics.

#### Key Metrics Display

**System Status:**
```typescript
{
  status: "healthy", // healthy, degraded, unhealthy
  uptime: "99.95%",
  version: "1.5.0",
  lastDeployment: "2024-02-01T10:00:00Z"
}
```

**Active Resources:**
```typescript
{
  activeTenants: 150,
  activeUsers: 450,
  totalProducts: 125000,
  totalCompetitors: 800,
  scrapingJobsToday: 5000
}
```

**Performance Metrics:**
```typescript
{
  avgResponseTime: 150, // ms
  requestsPerMinute: 500,
  errorRate: 0.002, // 0.2%
  cacheHitRate: 0.95 // 95%
}
```

### Component Health

#### Database Health

Monitor database performance:

**Connection Pool:**
- Active connections: 45/100
- Idle connections: 20
- Waiting queries: 0

**Query Performance:**
- Average query time: 15ms
- Slow queries (>1s): 2
- Failed queries: 0

**Storage:**
- Database size: 25GB
- Growth rate: 500MB/day
- Available space: 75GB

#### Redis Cache Health

Monitor caching system:

**Memory Usage:**
- Used memory: 2.5GB / 4GB
- Peak memory: 3.2GB
- Fragmentation ratio: 1.15

**Performance:**
- Hit rate: 95%
- Operations/sec: 10,000
- Average latency: 0.5ms

#### Queue Health

Monitor background job processing:

**Scraping Queue:**
- Waiting: 150 jobs
- Active: 10 jobs
- Completed today: 5,000
- Failed today: 25
- Success rate: 99.5%

**Price Update Queue:**
- Waiting: 50 jobs
- Active: 5 jobs
- Completed today: 1,200
- Failed today: 10
- Success rate: 99.2%

### Performance Monitoring

#### API Performance

**Endpoint Metrics:**
```typescript
{
  "/api/v1/products": {
    requestCount: 10000,
    avgResponseTime: 150,
    p95ResponseTime: 300,
    p99ResponseTime: 500,
    errorRate: 0.001
  },
  "/api/v1/competitors": {
    requestCount: 5000,
    avgResponseTime: 200,
    p95ResponseTime: 400,
    p99ResponseTime: 600,
    errorRate: 0.002
  }
}
```

#### Scraping Performance

**Success Rates:**
- Overall success rate: 99.5%
- CAPTCHA encounters: 50/day
- Timeout errors: 10/day
- Network errors: 5/day

**Timing Metrics:**
- Average scraping time: 2.5s
- P95 scraping time: 5s
- P99 scraping time: 10s

### Alert Management

#### Active Alerts

View and manage system alerts:

**Alert Dashboard:**
- Active alerts: 0
- Acknowledged: 2
- Resolved today: 5
- Total this week: 15

**Alert Types:**
- Critical: Database down, API unavailable
- Warning: High error rate, queue backlog
- Info: Deployment completed, maintenance scheduled

#### Alert Configuration

Configure alert thresholds:

**Database Alerts:**
- Connection pool >80%: Warning
- Connection pool >95%: Critical
- Query time >1s: Warning
- Failed queries >10/min: Critical

**API Alerts:**
- Error rate >1%: Warning
- Error rate >5%: Critical
- Response time >500ms: Warning
- Response time >1s: Critical

**Queue Alerts:**
- Backlog >500: Warning
- Backlog >1000: Critical
- Failure rate >5%: Warning
- Failure rate >10%: Critical

## System Configuration

### Platform-Wide Settings

#### General Configuration

Navigate to **Admin → Configuration → General**:

**System Settings:**
```typescript
{
  siteName: "PricePilot",
  supportEmail: "support@pricepilot.com",
  maintenanceMode: false,
  registrationEnabled: true,
  defaultPlan: "free",
  defaultTrialDays: 14
}
```

**Email Configuration:**
```typescript
{
  provider: "sendgrid",
  fromEmail: "noreply@pricepilot.com",
  fromName: "PricePilot",
  replyToEmail: "support@pricepilot.com",
  templates: {
    welcome: "d-abc123",
    trialExpiring: "d-def456",
    passwordReset: "d-ghi789"
  }
}
```

#### Feature Flags

Control platform-wide features:

**Global Features:**
```typescript
{
  features: {
    newTenantRegistration: true,
    apiAccess: true,
    webhooks: true,
    advancedMatching: true,
    bulkOperations: true,
    autoApproval: true,
    customScraping: false, // Beta feature
    aiPricing: false // Coming soon
  }
}
```

#### Scraping Configuration

**Global Scraping Settings:**
```typescript
{
  defaultFrequency: "daily", // 24-hour intervals
  maxConcurrency: 50,
  defaultTimeout: 30000,
  maxRetries: 3,
  userAgent: "PricePilot/1.5.0",
  respectRobotsTxt: true,
  proxyRotation: true
}
```

**Bot Protection:**
```typescript
{
  captchaSolver: "2captcha",
  captchaApiKey: "encrypted",
  proxyProvider: "brightdata",
  proxyPoolSize: 100,
  ipRotationInterval: 300 // seconds
}
```

#### Rate Limiting

**Global Rate Limits:**
```typescript
{
  api: {
    authenticated: 1000, // requests/hour
    unauthenticated: 100,
    admin: 10000
  },
  scraping: {
    perCompetitor: 10, // requests/minute
    global: 100
  },
  priceUpdates: {
    perTenant: 500, // updates/day
    global: 50000
  }
}
```

### Security Configuration

#### Authentication Settings

**Password Policies:**
```typescript
{
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxAge: 90, // days
  preventReuse: 5 // last 5 passwords
}
```

**Session Management:**
```typescript
{
  sessionTimeout: 3600, // seconds (1 hour)
  maxConcurrentSessions: 3,
  requireMFA: false, // For admin users
  ipWhitelist: [], // Optional IP restrictions
  allowedOrigins: ["https://app.pricepilot.com"]
}
```

#### API Security

**Token Configuration:**
```typescript
{
  tokenExpiration: 2592000, // 30 days
  tokenRotation: true,
  encryptionAlgorithm: "aes-256-gcm",
  allowedScopes: ["read", "write", "admin"]
}
```

**CORS Settings:**
```typescript
{
  allowedOrigins: [
    "https://app.pricepilot.com",
    "https://dashboard.pricepilot.com"
  ],
  allowedMethods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Authorization", "Content-Type"],
  maxAge: 86400 // 24 hours
}
```

### Database Configuration

#### Connection Settings

**Primary Database:**
```typescript
{
  host: "db.pricepilot.com",
  port: 5432,
  database: "pricepilot_production",
  poolSize: 100,
  connectionTimeout: 5000,
  idleTimeout: 30000,
  ssl: true
}
```

**Read Replicas:**
```typescript
{
  replicas: [
    {
      host: "db-replica-1.pricepilot.com",
      weight: 50
    },
    {
      host: "db-replica-2.pricepilot.com",
      weight: 50
    }
  ],
  loadBalancing: "round-robin"
}
```

#### Backup Configuration

**Automated Backups:**
```typescript
{
  frequency: "daily",
  time: "02:00", // 2 AM UTC
  retention: 30, // days
  location: "s3://backups.pricepilot.com",
  encryption: true,
  compression: true
}
```

### Maintenance Mode

#### Enabling Maintenance Mode

1. Navigate to **Admin → Configuration → Maintenance**
2. Click **Enable Maintenance Mode**
3. Set maintenance message
4. Choose affected services:
   - API access
   - User login
   - Scraping jobs
   - Price updates
5. Set estimated duration
6. Confirm activation

**Maintenance Mode Effects:**
- Users see maintenance page
- API returns 503 status
- Background jobs paused
- Admin access maintained
- System monitoring continues

## Analytics & Reporting

### Usage Analytics

#### Tenant Analytics

**Aggregate Metrics:**
```typescript
{
  totalTenants: 150,
  activeTenants: 145,
  trialTenants: 20,
  suspendedTenants: 3,
  cancelledTenants: 2,

  byPlan: {
    free: 50,
    starter: 60,
    professional: 35,
    enterprise: 5
  },

  growth: {
    newThisMonth: 15,
    churnThisMonth: 2,
    growthRate: 0.087 // 8.7%
  }
}
```

#### System Analytics

**Resource Usage:**
```typescript
{
  totalProducts: 125000,
  totalCompetitors: 800,
  scrapingJobsToday: 5000,
  priceUpdatesToday: 1200,
  apiRequestsToday: 150000,

  averages: {
    productsPerTenant: 833,
    competitorsPerTenant: 5.3,
    priceUpdatesPerTenant: 8
  }
}
```

#### Performance Analytics

**Response Times:**
- API average: 150ms
- Database average: 15ms
- Cache average: 0.5ms
- Scraping average: 2.5s

**Success Rates:**
- API success: 99.8%
- Scraping success: 99.5%
- Price update success: 99.2%
- Sync success: 98.5%

### Financial Reporting

#### Revenue Metrics

```typescript
{
  mrr: 45000, // Monthly Recurring Revenue
  arr: 540000, // Annual Recurring Revenue

  byPlan: {
    free: 0,
    starter: 12000, // 60 * $200/month
    professional: 28000, // 35 * $800/month
    enterprise: 5000 // 5 * $1000/month
  },

  growth: {
    mrrGrowth: 0.05, // 5% month-over-month
    newMrr: 3000,
    churnedMrr: 500,
    expansionMrr: 1000
  }
}
```

### Export Reports

Generate and download reports:

1. Navigate to **Admin → Reports**
2. Select report type:
   - Tenant usage report
   - System performance report
   - Financial report
   - Security audit report
3. Choose date range
4. Select format (CSV, PDF, JSON)
5. Click **Generate Report**
6. Download when ready

## Security Considerations

### Access Control

**Admin Permissions:**
- Only users with `isSuperAdmin` flag or `admin` role can access
- All admin actions are logged
- Session timeout enforced
- IP restrictions available (optional)

**Audit Logging:**
```typescript
{
  action: "tenant_suspended",
  adminUser: "admin@pricepilot.com",
  targetTenant: "techstore",
  timestamp: "2024-02-05T10:30:00Z",
  ipAddress: "203.0.113.1",
  details: {
    reason: "Payment failure",
    previousStatus: "active",
    newStatus: "suspended"
  }
}
```

### Data Protection

**Sensitive Data Handling:**
- API tokens encrypted at rest
- Passwords hashed with bcrypt
- PII access logged
- Data export requires approval
- Deletion is permanent (after retention period)

**Tenant Isolation:**
- All queries filtered by tenantId
- No cross-tenant data access
- Separate API tokens per tenant
- Row-level security enforced

### Security Best Practices

1. **Use Strong Passwords** - Enforce password policies
2. **Enable MFA** - Require for admin accounts
3. **Regular Audits** - Review access logs weekly
4. **Limit Admin Access** - Only grant when necessary
5. **Monitor Suspicious Activity** - Set up alerts
6. **Regular Backups** - Automated daily backups
7. **Encryption** - Encrypt sensitive data at rest
8. **Secure Communications** - HTTPS/TLS only
9. **Token Rotation** - Rotate API tokens regularly
10. **Incident Response** - Have a plan ready

## Troubleshooting

### Common Issues

#### Cannot Access Admin Dashboard

**Symptoms:**
- 403 Forbidden error
- Redirected to login
- "Access Denied" message

**Solutions:**
1. Verify admin role in database:
   ```sql
   SELECT email, role, "isSuperAdmin"
   FROM users
   WHERE email = 'your-email@example.com';
   ```
2. Check session validity
3. Clear browser cache and cookies
4. Verify IP not blocked
5. Contact platform engineering if issue persists

#### Tenant Metrics Not Updating

**Symptoms:**
- Stale data in dashboard
- Metrics show old values
- Last updated timestamp old

**Solutions:**
1. Check background job status
2. Verify database connectivity
3. Review error logs
4. Manually trigger metrics update
5. Check cache invalidation

#### Slow Dashboard Performance

**Symptoms:**
- Pages load slowly
- Timeouts on large queries
- High CPU usage

**Solutions:**
1. Check database query performance
2. Review slow query logs
3. Verify cache hit rates
4. Check connection pool status
5. Consider adding database indexes
6. Implement pagination for large lists

## Best Practices

### Daily Operations

1. **Morning Check** - Review overnight alerts and metrics
2. **Monitor Active Alerts** - Address critical issues immediately
3. **Review New Tenants** - Verify legitimate registrations
4. **Check System Health** - Ensure all components healthy
5. **Review Support Tickets** - Prioritize admin-level issues

### Weekly Tasks

1. **Tenant Health Review** - Check struggling tenants
2. **Performance Analysis** - Review slow queries and endpoints
3. **Security Audit** - Review access logs and suspicious activity
4. **Backup Verification** - Verify backups completed successfully
5. **Capacity Planning** - Monitor resource usage trends

### Monthly Tasks

1. **Financial Review** - Analyze MRR, churn, growth
2. **Feature Usage Analysis** - Identify underutilized features
3. **Security Updates** - Apply patches and updates
4. **Documentation Review** - Update admin guides
5. **Disaster Recovery Test** - Test backup restoration

## Related Documentation

- [Tenant Operations Guide](/admin-docs/tenant-management/tenant-operations) - Detailed tenant management
- [System Health Checks](/admin-docs/system-monitoring/health-checks) - Monitoring and diagnostics
- [Security Checklist](/admin-docs/security/security-checklist) - Security best practices
- [Performance Metrics](/admin-docs/performance/performance-metrics) - Performance monitoring
- [Alert Configuration](/admin-docs/alerting/alert-configuration) - Alert setup and management

## Support

For admin dashboard issues:
- Check [Admin Troubleshooting Guide](/admin-docs/system-monitoring/admin-troubleshooting-guide)
- Review [Operations Runbook](/admin-docs/system-monitoring/runbook)
- Contact platform engineering team
- Email: platform@pricepilot.com
- Slack: #platform-engineering

---

**Last Updated:** February 5, 2024
**Version:** 1.5.0
**Maintained By:** Platform Engineering Team
