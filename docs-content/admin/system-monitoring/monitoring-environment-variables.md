---
title: "Monitoring Environment Variables"
description: "Environment variables for monitoring configuration"
category: "system-monitoring"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["monitoring", "environment", "configuration"]
audience: "admin"
---

# Monitoring System Environment Variables

## Overview

This document lists all environment variables required for the PricePilot monitoring and alerting system.

## Required Variables

### Sentry Configuration

Error tracking and performance monitoring.

```bash
# Sentry DSN (Data Source Name)
# Get from: Sentry Project Settings → Client Keys (DSN)
SENTRY_DSN=https://[key]@[organization].ingest.sentry.io/[project]

# Environment name (development, staging, production)
SENTRY_ENVIRONMENT=production

# Application version/release
SENTRY_RELEASE=1.0.0

# Organization slug (for source maps)
SENTRY_ORG=your-organization

# Project slug
SENTRY_PROJECT=pricepilot

# Auth token for uploading source maps (optional)
SENTRY_AUTH_TOKEN=your-auth-token
```

### Redis/Upstash Configuration

Metrics storage and alert state management.

```bash
# Upstash Redis REST URL
UPSTASH_REDIS_REST_URL=https://[region]-[id].upstash.io

# Upstash Redis REST Token
UPSTASH_REDIS_REST_TOKEN=your-token-here

# Alternative: Standard Redis URL (if not using Upstash)
REDIS_URL=redis://localhost:6379
```

### Email Configuration

Email notification delivery via Resend.

```bash
# Resend API Key
# Get from: Resend Dashboard → API Keys
RESEND_API_KEY=re_xxxxxxxxxxxxx

# Sender email address (must be verified in Resend)
EMAIL_FROM=alerts@yourdomain.com

# Sender display name
EMAIL_FROM_NAME=PricePilot Alerts

# Default recipient for critical alerts (optional)
EMAIL_ALERT_RECIPIENT=ops@yourdomain.com
```

### Slack Configuration (Optional)

Slack notification delivery.

```bash
# Slack Incoming Webhook URL
# Get from: Slack App → Incoming Webhooks
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX

# Default Slack channel
SLACK_CHANNEL=#alerts

# Bot username
SLACK_USERNAME=PricePilot Bot

# Bot icon emoji
SLACK_ICON_EMOJI=:warning:
```

### Database Configuration

PostgreSQL for alert rules and history.

```bash
# PostgreSQL connection string
DATABASE_URL=postgresql://user:password@host:5432/database

# Connection pool size
DATABASE_POOL_SIZE=10

# Connection timeout (milliseconds)
DATABASE_TIMEOUT=5000
```

### Application Configuration

General application settings.

```bash
# Application URL (for dashboard links in alerts)
NEXT_PUBLIC_APP_URL=https://app.pricepilot.com

# API base URL
NEXT_PUBLIC_API_URL=https://api.pricepilot.com

# Environment
NODE_ENV=production
```

## Optional Variables

### Monitoring Configuration

Fine-tune monitoring behavior.

```bash
# Enable/disable monitoring (default: true)
MONITORING_ENABLED=true

# Monitoring overhead limit in milliseconds (default: 5)
MONITORING_OVERHEAD_LIMIT=5

# Alert evaluation interval in seconds (default: 60)
ALERT_EVALUATION_INTERVAL=60

# Alert deduplication window in seconds (default: 900 = 15 minutes)
ALERT_DEDUPLICATION_WINDOW=900

# Notification rate limit per channel per minute (default: 10)
NOTIFICATION_RATE_LIMIT=10
```

### Metrics Configuration

Configure metric collection and retention.

```bash
# Metric collection interval in seconds (default: 30)
METRIC_COLLECTION_INTERVAL=30

# Detailed metrics TTL in seconds (default: 604800 = 7 days)
METRICS_DETAILED_TTL=604800

# Aggregated metrics TTL in seconds (default: 7776000 = 90 days)
METRICS_AGGREGATED_TTL=7776000

# Enable metric sampling for high-volume endpoints (default: false)
METRICS_SAMPLING_ENABLED=false

# Sampling rate (0.0 to 1.0, default: 0.1 = 10%)
METRICS_SAMPLING_RATE=0.1
```

### Sentry Advanced Configuration

Advanced Sentry settings.

```bash
# Sample rate for error events (0.0 to 1.0, default: 1.0 = 100%)
SENTRY_SAMPLE_RATE=1.0

# Sample rate for performance traces (0.0 to 1.0, default: 0.1 = 10%)
SENTRY_TRACES_SAMPLE_RATE=0.1

# Enable debug mode (default: false)
SENTRY_DEBUG=false

# Attach stack traces to messages (default: true)
SENTRY_ATTACH_STACKTRACE=true

# Maximum breadcrumbs (default: 100)
SENTRY_MAX_BREADCRUMBS=100

# Enable performance monitoring (default: true)
SENTRY_ENABLE_TRACING=true
```

### Email Advanced Configuration

Advanced email settings.

```bash
# Email retry attempts (default: 3)
EMAIL_RETRY_ATTEMPTS=3

# Email retry delay in milliseconds (default: 1000)
EMAIL_RETRY_DELAY=1000

# Email timeout in milliseconds (default: 10000)
EMAIL_TIMEOUT=10000

# Enable HTML emails (default: true)
EMAIL_HTML_ENABLED=true

# Enable plain text fallback (default: true)
EMAIL_TEXT_ENABLED=true
```

### Slack Advanced Configuration

Advanced Slack settings.

```bash
# Slack timeout in milliseconds (default: 5000)
SLACK_TIMEOUT=5000

# Slack retry attempts (default: 3)
SLACK_RETRY_ATTEMPTS=3

# Enable Slack threading (default: true)
SLACK_THREADING_ENABLED=true

# Enable Slack action buttons (default: true)
SLACK_ACTIONS_ENABLED=true
```

### Security Configuration

Security-related settings.

```bash
# Enable sensitive data sanitization (default: true)
MONITORING_SANITIZE_SENSITIVE_DATA=true

# Patterns to sanitize (comma-separated regex patterns)
MONITORING_SENSITIVE_PATTERNS=password,token,secret,apikey,creditcard

# Enable audit logging (default: true)
MONITORING_AUDIT_LOGGING=true

# Audit log retention in days (default: 365)
MONITORING_AUDIT_RETENTION_DAYS=365
```

## Environment-Specific Configurations

### Development Environment

```bash
# .env.development
SENTRY_ENVIRONMENT=development
SENTRY_DEBUG=true
MONITORING_ENABLED=true
ALERT_EVALUATION_INTERVAL=30
EMAIL_ALERT_RECIPIENT=dev@yourdomain.com
```

### Staging Environment

```bash
# .env.staging
SENTRY_ENVIRONMENT=staging
MONITORING_ENABLED=true
ALERT_EVALUATION_INTERVAL=60
EMAIL_ALERT_RECIPIENT=staging-ops@yourdomain.com
SENTRY_TRACES_SAMPLE_RATE=0.5
```

### Production Environment

```bash
# .env.production
SENTRY_ENVIRONMENT=production
MONITORING_ENABLED=true
ALERT_EVALUATION_INTERVAL=60
EMAIL_ALERT_RECIPIENT=ops@yourdomain.com
SENTRY_TRACES_SAMPLE_RATE=0.1
MONITORING_OVERHEAD_LIMIT=5
```

## Configuration Validation

### Required Variables Check

The application validates required variables on startup:

```typescript
const requiredVars = [
  'SENTRY_DSN',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'DATABASE_URL',
];

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
}
```

### Verification Script

Run the verification script to check configuration:

```bash
npm run verify:monitoring
```

This checks:
- All required variables are set
- Sentry connection works
- Redis connection works
- Email service works
- Database connection works

## Security Best Practices

### Protecting Secrets

1. **Never commit secrets to version control**
   - Add `.env` to `.gitignore`
   - Use `.env.example` for documentation

2. **Use environment-specific files**
   - `.env.development`
   - `.env.staging`
   - `.env.production`

3. **Use secrets management**
   - Vercel: Environment Variables
   - AWS: Secrets Manager
   - Azure: Key Vault
   - GCP: Secret Manager

4. **Rotate secrets regularly**
   - API keys every 90 days
   - Webhook URLs after incidents
   - Database passwords quarterly

### Access Control

1. **Limit access to production secrets**
   - Only operations team
   - Use role-based access
   - Audit secret access

2. **Use separate credentials per environment**
   - Different Sentry projects
   - Different Redis instances
   - Different email accounts

3. **Monitor secret usage**
   - Track API key usage
   - Alert on unusual patterns
   - Log secret access

## Troubleshooting

### Missing Variables

**Error**: `Missing required environment variable: SENTRY_DSN`

**Solution**:
1. Check `.env` file exists
2. Verify variable is set
3. Restart application
4. Check environment loading

### Invalid Configuration

**Error**: `Invalid Sentry DSN format`

**Solution**:
1. Verify DSN from Sentry dashboard
2. Check for typos
3. Ensure no extra spaces
4. Test with curl

### Connection Errors

**Error**: `Failed to connect to Redis`

**Solution**:
1. Verify Redis URL and token
2. Check network connectivity
3. Test with Redis CLI
4. Review firewall rules

## Example Configuration Files

### .env.example

```bash
# Sentry Configuration
SENTRY_DSN=https://[key]@[organization].ingest.sentry.io/[project]
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=1.0.0

# Redis Configuration
UPSTASH_REDIS_REST_URL=https://[region]-[id].upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here

# Email Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=alerts@yourdomain.com
EMAIL_FROM_NAME=PricePilot Alerts

# Slack Configuration (Optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SLACK_CHANNEL=#alerts

# Database Configuration
DATABASE_URL=postgresql://user:password@host:5432/database

# Application Configuration
NEXT_PUBLIC_APP_URL=https://app.pricepilot.com
NODE_ENV=production
```

### .env.local (for local development)

```bash
# Sentry Configuration
SENTRY_DSN=https://[key]@[organization].ingest.sentry.io/[project]
SENTRY_ENVIRONMENT=development
SENTRY_DEBUG=true

# Redis Configuration (local)
REDIS_URL=redis://localhost:6379

# Email Configuration (test mode)
RESEND_API_KEY=re_test_xxxxxxxxxxxxx
EMAIL_FROM=dev@localhost
EMAIL_FROM_NAME=PricePilot Dev

# Database Configuration (local)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pricepilot_dev

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

## Related Documentation

- [Monitoring System Overview](./MONITORING_SYSTEM.md)
- [Infrastructure Setup](./MONITORING_INFRASTRUCTURE_SETUP.md)
- [Deployment Checklist](./MONITORING_DEPLOYMENT_CHECKLIST.md)
- [Troubleshooting Guide](./MONITORING_TROUBLESHOOTING.md)
