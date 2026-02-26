---
title: "Monitoring Infrastructure Setup"
description: "Setting up monitoring infrastructure"
category: "system-monitoring"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["monitoring", "infrastructure", "setup"]
audience: "admin"
---

# Monitoring Infrastructure Setup

This document describes the monitoring and alerting infrastructure setup for PricePilot.

## Overview

The monitoring system provides comprehensive observability through:
- **Error Tracking**: Sentry integration for capturing and tracking application errors
- **Performance Monitoring**: Response time tracking and performance metrics
- **Alert Rules**: Configurable alert rules with threshold-based triggering
- **Multi-Channel Notifications**: Email and Slack notification delivery
- **Alert History**: Complete audit trail of all triggered alerts

## Database Schema

### Tables

#### MonitoringAlertRule
Stores alert rule configurations including thresholds, conditions, and notification channels.

**Key Fields:**
- `tenantId`: Optional tenant isolation (null for system-wide rules)
- `metricType`: Type of metric to monitor (e.g., 'error_rate', 'response_time')
- `conditionOperator`: Comparison operator (GT, GTE, LT, LTE, EQ)
- `conditionAggregation`: Aggregation type (COUNT, AVG, SUM, MAX, MIN, P95, P99)
- `timeWindowSeconds`: Time window for metric aggregation
- `threshold`: Threshold value that triggers the alert
- `notificationChannels`: Array of channel IDs to send notifications to

**Indexes:**
- `tenantId` - For tenant-specific queries
- `enabled` - For filtering active rules
- `metricType` - For metric-specific queries

#### MonitoringNotificationChannel
Stores notification channel configurations (email, Slack).

**Key Fields:**
- `type`: Channel type (EMAIL, SLACK)
- `name`: Human-readable channel name
- `enabled`: Whether the channel is active
- `config`: JSON configuration (recipients, webhook URLs, etc.)

**Indexes:**
- `type` - For channel type filtering
- `enabled` - For filtering active channels

#### MonitoringAlertHistory
Stores the history of triggered alerts with full context.

**Key Fields:**
- `ruleId`: Reference to the alert rule
- `severity`: Alert severity (CRITICAL, WARNING, INFO)
- `triggeredAt`: When the alert was triggered
- `resolvedAt`: When the alert condition cleared (nullable)
- `metricValue`: The actual metric value that triggered the alert
- `threshold`: The threshold that was exceeded
- `tenantId`: Optional tenant context
- `context`: Additional context data (JSON)
- `notificationsSent`: Delivery results for each channel (JSON)

**Indexes:**
- `ruleId` - For rule-specific history
- `tenantId` - For tenant-specific history
- `triggeredAt` - For time-based queries
- `severity` - For severity filtering

#### MonitoringMaintenanceWindow
Stores maintenance windows during which alerts are suppressed.

**Key Fields:**
- `name`: Maintenance window name
- `startTime`: Start of maintenance window
- `endTime`: End of maintenance window
- `isActive`: Whether the window is currently active

**Indexes:**
- `startTime, endTime` - For time range queries
- `isActive` - For filtering active windows

## Sentry Integration

### Configuration Files

#### sentry.client.config.ts
Client-side Sentry configuration for browser error tracking.

**Features:**
- Session replay for debugging
- Sensitive data filtering
- Performance monitoring

#### sentry.server.config.ts
Server-side Sentry configuration for Node.js error tracking.

**Features:**
- Server-side error capture
- API route error tracking
- Sensitive data sanitization

#### sentry.edge.config.ts
Edge runtime Sentry configuration for edge functions.

**Features:**
- Edge function error tracking
- Minimal overhead configuration

### Environment Variables

Required environment variables for Sentry:

```bash
# Sentry DSN (Data Source Name)
SENTRY_DSN="https://your-dsn@sentry.io/project-id"

# Environment name
SENTRY_ENVIRONMENT="production"

# Release version (optional)
SENTRY_RELEASE="pricepilot@1.0.0"

# Performance monitoring sample rate (0.0 to 1.0)
SENTRY_TRACES_SAMPLE_RATE="0.1"

# Enable/disable Sentry
SENTRY_ENABLED="true"

# For source map uploads (build time)
SENTRY_ORG="your-org-slug"
SENTRY_PROJECT="your-project-name"
SENTRY_AUTH_TOKEN="your-auth-token"
```

### Sensitive Data Filtering

The Sentry configuration automatically filters sensitive data:
- Passwords
- API tokens
- API keys
- Secrets
- Encryption keys
- Webhook URLs

This filtering is applied to:
- Request data
- Breadcrumbs
- Extra context
- Error messages

## Setup Instructions

### 1. Database Migration

The database schema has been created with the migration:
```bash
npx prisma db push
```

The migration file is located at:
```
prisma/migrations/20260201120000_add_monitoring_infrastructure/migration.sql
```

### 2. Sentry Setup

1. Create a Sentry account at https://sentry.io/
2. Create a new project for PricePilot
3. Copy the DSN from Settings > Projects > [Your Project] > Client Keys (DSN)
4. Add the DSN to your `.env` file:
   ```bash
   SENTRY_DSN="your-dsn-here"
   SENTRY_ENVIRONMENT="production"
   SENTRY_ENABLED="true"
   ```

### 3. Source Map Upload (Optional)

For production deployments with source map uploads:

1. Generate an auth token at https://sentry.io/settings/account/api/auth-tokens/
2. Add to your `.env` file:
   ```bash
   SENTRY_ORG="your-org-slug"
   SENTRY_PROJECT="your-project-name"
   SENTRY_AUTH_TOKEN="your-auth-token"
   ```

### 4. Verify Installation

Run the following to verify the setup:

```bash
# Validate Prisma schema
npx prisma validate

# Generate Prisma client
npx prisma generate

# Build the application
npm run build
```

## Next Steps

After completing this infrastructure setup, the following components need to be implemented:

1. **Error Capture Middleware** (Task 2)
   - Integrate Sentry error capture
   - Add context extraction
   - Implement sensitive data sanitization

2. **Metrics Collector Service** (Task 3)
   - Redis-based metrics storage
   - Time-series data collection
   - Percentile calculations

3. **Alert Rules Evaluator** (Task 4)
   - Rule evaluation logic
   - Threshold comparisons
   - Built-in alert rules

4. **Notification Services** (Tasks 7-9)
   - Email notification service
   - Slack notification service
   - Notification router

5. **Dashboard UI** (Tasks 18-20)
   - Monitoring dashboard
   - Alert configuration UI
   - Notification channel configuration

## Performance Considerations

- **Database Indexes**: All tables have appropriate indexes for performance
- **Tenant Isolation**: Alert rules support optional tenant-specific rules
- **Time-Series Data**: Alert history is indexed by `triggeredAt` for efficient time-range queries
- **Sentry Overhead**: Configured with appropriate sample rates to minimize performance impact

## Security Considerations

- **Sensitive Data**: Sentry configuration filters all sensitive data before sending
- **Tenant Isolation**: Alert rules support tenant-specific isolation
- **Access Control**: Dashboard UI will require admin role (implemented in later tasks)
- **Audit Trail**: Complete alert history with notification delivery results

## Troubleshooting

### Sentry Not Capturing Errors

1. Verify `SENTRY_DSN` is set correctly
2. Check `SENTRY_ENABLED` is set to `"true"`
3. Verify the DSN is valid in your Sentry dashboard
4. Check browser console for Sentry initialization errors

### Database Migration Issues

1. Verify database connection: `npx prisma db pull`
2. Check migration status: `npx prisma migrate status`
3. Reset database (development only): `npx prisma migrate reset`

### Build Errors

1. Ensure all Sentry environment variables are set
2. Verify `@sentry/nextjs` is installed: `npm list @sentry/nextjs`
3. Check Next.js configuration in `next.config.ts`

## References

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Monitoring and Alerting Design Document](../.kiro/specs/monitoring-and-alerting/design.md)
- [Monitoring and Alerting Requirements](../.kiro/specs/monitoring-and-alerting/requirements.md)
