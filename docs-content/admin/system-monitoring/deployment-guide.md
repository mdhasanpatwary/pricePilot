---
title: "Deployment Guide"
description: "Complete guide for deploying PricePilot"
category: "system-monitoring"
tags: ["deployment", "guide", "operations"]
audience: "admin"
---

# PricePilot Deployment Guide

**Version**: 1.5  
**Last Updated**: February 3, 2026

## Overview

This guide provides step-by-step instructions for deploying PricePilot to production environments. It covers prerequisites, configuration, deployment procedures, and post-deployment verification.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Redis Setup](#redis-setup)
5. [Application Configuration](#application-configuration)
6. [Deployment Procedures](#deployment-procedures)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Rollback Procedures](#rollback-procedures)
9. [Monitoring Setup](#monitoring-setup)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Services

- **Node.js**: v18.x or higher
- **PostgreSQL**: v14.x or higher
- **Redis**: v7.x or higher (Upstash recommended)
- **SMTP Server**: For email notifications (Gmail, SendGrid, Mailgun, or Amazon SES)

### Required Accounts

- **Vercel Account**: For hosting (or alternative hosting provider)
- **Upstash Account**: For Redis (free tier available)
- **Database Provider**: Vercel Postgres, Supabase, or self-hosted PostgreSQL
- **Email Provider**: SMTP credentials for email notifications

### Development Tools

- **Git**: For version control
- **npm** or **yarn**: Package manager
- **Prisma CLI**: Database migrations

---

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/pricepilot.git
cd pricepilot
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/pricepilot?schema=public"

# NextAuth
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="generate-a-secure-random-string-here"

# Redis (Upstash)
UPSTASH_REDIS_REST_URL="https://your-redis-url.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-redis-token"

# Encryption (Generate with: openssl rand -hex 32)
ENCRYPTION_KEY="your-64-character-hex-encryption-key"

# Email (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="noreply@your-domain.com"

# Cron Secret (Generate with: openssl rand -hex 32)
CRON_SECRET="your-cron-secret-key"

# Sentry (Optional)
SENTRY_DSN="your-sentry-dsn"
SENTRY_AUTH_TOKEN="your-sentry-auth-token"

# Feature Flags
ENABLE_AUTO_APPROVAL="true"
ENABLE_EMAIL_NOTIFICATIONS="true"
ENABLE_ROLLBACK="true"
ENABLE_DELEGATION="true"
```

### 4. Generate Encryption Key

```bash
# Generate a secure 32-byte (64 hex characters) encryption key
openssl rand -hex 32
```

Copy the output to `ENCRYPTION_KEY` in your `.env` file.

### 5. Generate Cron Secret

```bash
# Generate a secure cron secret
openssl rand -hex 32
```

Copy the output to `CRON_SECRET` in your `.env` file.

---

## Database Setup

### 1. Create Database

Create a PostgreSQL database for PricePilot:

```sql
CREATE DATABASE pricepilot;
```

### 2. Configure Connection

Update `DATABASE_URL` in `.env` with your database credentials:

```env
DATABASE_URL="postgresql://username:password@host:5432/pricepilot?schema=public"
```

### 3. Run Migrations

```bash
# Generate Prisma Client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Verify migrations
npx prisma migrate status
```

### 4. Seed Database (Optional)

```bash
# Seed with initial data
npx prisma db seed
```

### 5. Create Indexes

Run the performance indexes migration:

```bash
# Apply performance indexes
npm run db:indexes
```

Or manually execute:

```sql
-- Product queries
CREATE INDEX IF NOT EXISTS idx_product_tenant_site ON "Product"("tenantId", "siteId");
CREATE INDEX IF NOT EXISTS idx_product_external_id ON "Product"("externalId");
CREATE INDEX IF NOT EXISTS idx_product_updated_at ON "Product"("updatedAt" DESC);

-- ProductMatch queries
CREATE INDEX IF NOT EXISTS idx_match_user_product ON "ProductMatch"("userProductId", "status");
CREATE INDEX IF NOT EXISTS idx_match_competitor_product ON "ProductMatch"("competitorProductId");
CREATE INDEX IF NOT EXISTS idx_match_confidence ON "ProductMatch"("confidenceScore" DESC);

-- PriceHistory queries
CREATE INDEX IF NOT EXISTS idx_price_history_product_date ON "PriceHistory"("productId", "recordedAt" DESC);

-- Site queries
CREATE INDEX IF NOT EXISTS idx_site_tenant_type ON "Site"("tenantId", "type");
CREATE INDEX IF NOT EXISTS idx_site_syncing ON "Site"("isSyncing", "syncStartedAt");

-- Notification queries
CREATE INDEX IF NOT EXISTS idx_notification_tenant_read ON "Notification"("tenantId", "isRead", "createdAt" DESC);

-- Audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_tenant_date ON "TenantAuditLog"("tenantId", "createdAt" DESC);
```

---

## Redis Setup

### Option 1: Upstash (Recommended)

1. **Create Upstash Account**: Visit [upstash.com](https://upstash.com)
2. **Create Redis Database**:
   - Click "Create Database"
   - Choose region closest to your application
   - Select "Free" tier for development
3. **Get Credentials**:
   - Copy REST URL
   - Copy REST Token
4. **Update Environment Variables**:
   ```env
   UPSTASH_REDIS_REST_URL="https://your-redis-url.upstash.io"
   UPSTASH_REDIS_REST_TOKEN="your-redis-token"
   ```

### Option 2: Self-Hosted Redis

1. **Install Redis**:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install redis-server
   
   # macOS
   brew install redis
   ```

2. **Start Redis**:
   ```bash
   redis-server
   ```

3. **Configure Connection**:
   ```env
   REDIS_URL="redis://localhost:6379"
   ```

### Verify Redis Connection

```bash
# Test Redis connection
npm run test:redis
```

---

## Application Configuration

### 1. Build Application

```bash
# Build for production
npm run build

# Verify build
npm run start
```

### 2. Configure Cron Jobs

If deploying to Vercel, cron jobs are configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/v1/cron/global-sync",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/v1/cron/auto-approval",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/v1/cron/daily-approval-summary",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/v1/cron/cleanup-price-history",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/v1/cron/cleanup-audit-logs",
      "schedule": "0 3 * * 0"
    },
    {
      "path": "/api/v1/cron/cleanup-notifications",
      "schedule": "0 4 * * *"
    }
  ]
}
```

For other hosting providers, set up cron jobs manually or use a service like:
- **Cron-job.org**
- **EasyCron**
- **AWS EventBridge**

### 3. Configure Email

Test email configuration:

```bash
# Test email sending
npm run test:email
```

### 4. Configure Security Headers

Security headers are configured in `next.config.ts`:

```typescript
{
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'DENY'
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff'
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains'
        },
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
        }
      ]
    }
  ]
}
```

---

## Deployment Procedures

### Vercel Deployment

#### 1. Install Vercel CLI

```bash
npm install -g vercel
```

#### 2. Login to Vercel

```bash
vercel login
```

#### 3. Link Project

```bash
vercel link
```

#### 4. Set Environment Variables

```bash
# Set all environment variables
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_URL production
vercel env add NEXTAUTH_SECRET production
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel env add ENCRYPTION_KEY production
vercel env add SMTP_HOST production
vercel env add SMTP_PORT production
vercel env add SMTP_USER production
vercel env add SMTP_PASSWORD production
vercel env add CRON_SECRET production
```

#### 5. Deploy to Production

```bash
# Deploy to production
vercel --prod
```

#### 6. Verify Deployment

```bash
# Check deployment status
vercel ls

# View logs
vercel logs
```

### Alternative Hosting (Docker)

#### 1. Build Docker Image

```bash
# Build image
docker build -t pricepilot:latest .

# Tag for registry
docker tag pricepilot:latest your-registry/pricepilot:latest

# Push to registry
docker push your-registry/pricepilot:latest
```

#### 2. Deploy Container

```bash
# Run container
docker run -d \
  --name pricepilot \
  -p 3000:3000 \
  --env-file .env \
  your-registry/pricepilot:latest
```

#### 3. Use Docker Compose

```yaml
version: '3.8'

services:
  app:
    image: your-registry/pricepilot:latest
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: pricepilot
      POSTGRES_USER: pricepilot
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

Deploy with:

```bash
docker-compose up -d
```

---

## Post-Deployment Verification

### 1. Health Check

```bash
# Check application health
curl https://your-domain.com/api/health

# Expected response:
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "timestamp": "2026-02-03T10:00:00.000Z"
}
```

### 2. Database Verification

```bash
# Run verification script
npm run verify:database

# Check migrations
npx prisma migrate status
```

### 3. Redis Verification

```bash
# Test Redis connection
npm run verify:redis
```

### 4. Email Verification

```bash
# Send test email
npm run test:email -- --to=your-email@example.com
```

### 5. Cron Job Verification

```bash
# Manually trigger cron jobs to verify
curl -X POST https://your-domain.com/api/v1/cron/global-sync \
  -H "Authorization: Bearer ${CRON_SECRET}"

# Check cron logs
vercel logs --follow
```

### 6. Security Verification

```bash
# Run security audit
npm run security:audit

# Check security headers
curl -I https://your-domain.com

# Verify encryption
npm run verify:encryption
```

### 7. Performance Verification

```bash
# Run performance tests
npm run test:performance

# Check response times
curl -w "@curl-format.txt" -o /dev/null -s https://your-domain.com
```

### 8. Integration Testing

```bash
# Run integration tests
npm run test:integration

# Test OpenCart integration
npm run test:opencart

# Test Laravel integration
npm run test:laravel
```

---

## Rollback Procedures

### Vercel Rollback

#### 1. List Deployments

```bash
vercel ls
```

#### 2. Rollback to Previous Deployment

```bash
# Promote previous deployment to production
vercel promote <deployment-url>
```

#### 3. Verify Rollback

```bash
# Check current deployment
vercel ls --prod

# Verify application
curl https://your-domain.com/api/health
```

### Database Rollback

#### 1. Backup Current State

```bash
# Create backup before rollback
npm run db:backup
```

#### 2. Rollback Migration

```bash
# Rollback last migration
npx prisma migrate resolve --rolled-back <migration-name>

# Apply previous migration
npx prisma migrate deploy
```

#### 3. Verify Database State

```bash
# Check migration status
npx prisma migrate status

# Verify data integrity
npm run verify:database
```

### Application Rollback

#### 1. Revert Code Changes

```bash
# Revert to previous commit
git revert HEAD

# Push changes
git push origin main
```

#### 2. Redeploy

```bash
# Deploy reverted version
vercel --prod
```

#### 3. Verify Rollback

```bash
# Check application version
curl https://your-domain.com/api/version

# Run smoke tests
npm run test:smoke
```

---

## Monitoring Setup

### 1. Configure Sentry

```bash
# Install Sentry
npm install @sentry/nextjs

# Initialize Sentry
npx @sentry/wizard -i nextjs
```

Update `.env`:

```env
SENTRY_DSN="your-sentry-dsn"
SENTRY_AUTH_TOKEN="your-sentry-auth-token"
```

### 2. Configure Uptime Monitoring

Set up uptime monitoring with:
- **UptimeRobot**: Free tier available
- **Pingdom**: Comprehensive monitoring
- **StatusCake**: Multiple check locations

Monitor these endpoints:
- `https://your-domain.com/api/health`
- `https://your-domain.com/api/v1/monitoring/health`

### 3. Configure Log Aggregation

Options:
- **Vercel Logs**: Built-in logging
- **Datadog**: Comprehensive monitoring
- **LogRocket**: Session replay
- **Papertrail**: Log aggregation

### 4. Configure Alerts

Set up alerts for:
- **Application Errors**: Error rate > 1%
- **Response Time**: P95 > 500ms
- **Database**: Connection failures
- **Redis**: Connection failures
- **Cron Jobs**: Execution failures
- **Email**: Delivery failures

### 5. Configure Dashboard

Access monitoring dashboards:
- **Admin Dashboard**: `https://your-domain.com/admin/monitoring`
- **Metrics Dashboard**: `https://your-domain.com/admin/metrics`
- **Alert History**: `https://your-domain.com/admin/alert-history`

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

**Symptom**: "Can't reach database server"

**Solution**:
```bash
# Verify DATABASE_URL
echo $DATABASE_URL

# Test connection
npx prisma db pull

# Check database status
psql $DATABASE_URL -c "SELECT 1"
```

#### 2. Redis Connection Errors

**Symptom**: "Redis connection failed"

**Solution**:
```bash
# Verify Redis credentials
npm run verify:redis

# Check Redis status
redis-cli ping

# Test Upstash connection
curl $UPSTASH_REDIS_REST_URL/ping \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"
```

#### 3. Email Sending Failures

**Symptom**: "Failed to send email"

**Solution**:
```bash
# Test SMTP configuration
npm run test:email

# Check SMTP credentials
echo $SMTP_HOST
echo $SMTP_PORT
echo $SMTP_USER

# Verify SMTP connection
telnet $SMTP_HOST $SMTP_PORT
```

#### 4. Cron Job Not Running

**Symptom**: "Cron job not executing"

**Solution**:
```bash
# Verify cron configuration
cat vercel.json | jq '.crons'

# Manually trigger cron
curl -X POST https://your-domain.com/api/v1/cron/global-sync \
  -H "Authorization: Bearer ${CRON_SECRET}"

# Check cron logs
vercel logs --follow | grep cron
```

#### 5. Build Failures

**Symptom**: "Build failed"

**Solution**:
```bash
# Clear cache
rm -rf .next node_modules

# Reinstall dependencies
npm install

# Rebuild
npm run build

# Check for TypeScript errors
npm run type-check
```

#### 6. Performance Issues

**Symptom**: "Slow response times"

**Solution**:
```bash
# Check database indexes
npm run db:analyze

# Verify cache hit rate
npm run cache:stats

# Check Redis memory
redis-cli info memory

# Analyze slow queries
npm run db:slow-queries
```

### Getting Help

- **Documentation**: [docs/](../docs/)
- **GitHub Issues**: [github.com/your-org/pricepilot/issues](https://github.com/your-org/pricepilot/issues)
- **Support Email**: support@your-domain.com
- **Community**: [Discord/Slack Channel]

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] Redis connection verified
- [ ] Email configuration tested
- [ ] Security audit completed
- [ ] Performance tests passed
- [ ] Documentation updated
- [ ] Rollback plan prepared

### Deployment

- [ ] Backup database
- [ ] Deploy to staging
- [ ] Run smoke tests on staging
- [ ] Deploy to production
- [ ] Verify health checks
- [ ] Test critical workflows
- [ ] Monitor error rates
- [ ] Check performance metrics

### Post-Deployment

- [ ] Verify all services running
- [ ] Check cron jobs executing
- [ ] Monitor error logs
- [ ] Verify email notifications
- [ ] Test user workflows
- [ ] Update status page
- [ ] Notify team of deployment
- [ ] Document any issues

---

**Last Updated**: February 3, 2026  
**Version**: 1.5  
**Maintained By**: DevOps Team
