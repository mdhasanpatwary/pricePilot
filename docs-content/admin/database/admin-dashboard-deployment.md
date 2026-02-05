---
title: "Admin Dashboard Deployment"
description: "Deploying and configuring the admin dashboard"
category: "database"
tags: ["admin", "dashboard", "deployment"]
audience: "admin"
---

# Admin Dashboard Enhancement Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the enhanced admin dashboard features to production. It covers prerequisites, deployment steps, verification procedures, and rollback strategies.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Database Migration](#database-migration)
4. [Redis Configuration](#redis-configuration)
5. [Application Deployment](#application-deployment)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Rollback Procedures](#rollback-procedures)
8. [Monitoring and Alerts](#monitoring-and-alerts)

---

## Prerequisites

### System Requirements

**Minimum Requirements**:
- Node.js: v18.0.0 or higher
- PostgreSQL: v14.0 or higher
- Redis: v6.0 or higher
- Memory: 4GB RAM minimum
- Disk: 20GB free space
- CPU: 2 cores minimum

**Recommended Requirements**:
- Node.js: v20.0.0
- PostgreSQL: v15.0
- Redis: v7.0
- Memory: 8GB RAM
- Disk: 50GB free space
- CPU: 4 cores

### Software Dependencies

```bash
# Install Node.js dependencies
npm install

# Install system dependencies (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y postgresql-client redis-tools

# Install PM2 for process management
npm install -g pm2
```

### Access Requirements

- Database admin credentials
- Redis connection details
- Server SSH access
- Admin user account
- Backup storage access


---

## Pre-Deployment Checklist

### 1. Backup Current System

```bash
# Backup database
pg_dump -U postgres -d pricepilot > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup Redis data
redis-cli --rdb /backup/redis_$(date +%Y%m%d_%H%M%S).rdb

# Backup application files
tar -czf app_backup_$(date +%Y%m%d_%H%M%S).tar.gz /var/www/pricepilot

# Backup environment variables
cp .env .env.backup_$(date +%Y%m%d_%H%M%S)
```

### 2. Test in Staging Environment

```bash
# Deploy to staging
git checkout main
git pull origin main
npm install
npm run build

# Run tests
npm test
npm run test:e2e

# Verify staging deployment
curl https://staging.pricepilot.com/api/v1/admin/health
```

### 3. Notify Stakeholders

- Send deployment notification email
- Update status page
- Schedule maintenance window
- Prepare rollback plan

### 4. Review Changes

```bash
# Review commits since last deployment
git log --oneline production..main

# Review database migrations
ls -la prisma/migrations/

# Review configuration changes
git diff production..main -- .env.example
```

---

## Database Migration

### 1. Review Migration Scripts

```bash
# List pending migrations
npx prisma migrate status

# Review migration SQL
cat prisma/migrations/20260127053603_add_admin_dashboard_tables/migration.sql
```

### 2. Test Migration in Staging

```bash
# Run migration in staging
DATABASE_URL="postgresql://user:pass@staging-db:5432/pricepilot" \
  npx prisma migrate deploy

# Verify tables created
psql -U postgres -d pricepilot -c "\dt scraping_sessions"
psql -U postgres -d pricepilot -c "\dt simulation_results"
psql -U postgres -d pricepilot -c "\dt system_alerts"
```


### 3. Run Production Migration

```bash
# Set maintenance mode
pm2 stop pricepilot

# Backup database before migration
pg_dump -U postgres -d pricepilot > pre_migration_backup.sql

# Run migration
DATABASE_URL="postgresql://user:pass@prod-db:5432/pricepilot" \
  npx prisma migrate deploy

# Verify migration success
psql -U postgres -d pricepilot -c "
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_name IN ('scraping_sessions', 'simulation_results', 'system_alerts');
"

# Run performance indexes
psql -U postgres -d pricepilot -f prisma/migrations/performance_indexes.sql
```

### 4. Verify Migration

```bash
# Check table structure
psql -U postgres -d pricepilot -c "\d scraping_sessions"

# Check indexes
psql -U postgres -d pricepilot -c "\di"

# Test insert
psql -U postgres -d pricepilot -c "
  INSERT INTO scraping_sessions (id, tenant_id, tenant_name, site_url, target_url, status, current_stage, start_time)
  VALUES ('test_123', 'tenant_1', 'Test', 'https://test.com', 'https://test.com/page', 'running', 'navigation', NOW());
"

# Verify insert
psql -U postgres -d pricepilot -c "SELECT * FROM scraping_sessions WHERE id = 'test_123';"

# Clean up test data
psql -U postgres -d pricepilot -c "DELETE FROM scraping_sessions WHERE id = 'test_123';"
```

---

## Redis Configuration

### 1. Update Redis Configuration

```bash
# Edit Redis config
sudo nano /etc/redis/redis.conf

# Add/update these settings:
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### 2. Create Redis Data Structures

```bash
# Test Redis connection
redis-cli ping

# Set up initial structures
redis-cli << EOF
# Set metrics cache TTL
CONFIG SET maxmemory-policy allkeys-lru

# Test session storage
HSET session:test_123 tenantId tenant_1 status running
EXPIRE session:test_123 3600

# Verify
HGETALL session:test_123
TTL session:test_123

# Clean up
DEL session:test_123
EOF
```


### 3. Configure Redis Persistence

```bash
# Enable RDB snapshots
redis-cli CONFIG SET save "900 1 300 10 60 10000"

# Enable AOF
redis-cli CONFIG SET appendonly yes
redis-cli CONFIG SET appendfsync everysec

# Verify configuration
redis-cli CONFIG GET save
redis-cli CONFIG GET appendonly
```

---

## Application Deployment

### 1. Update Environment Variables

```bash
# Edit production .env
nano .env

# Add/update these variables:
REDIS_URL=redis://localhost:6379
SESSION_TRACKER_ENABLED=true
PROXY_SIMULATOR_ENABLED=true
METRICS_CACHE_ENABLED=true
METRICS_CACHE_TTL=60000
AUTO_REFRESH_INTERVAL=5000
MAX_CONCURRENT_SIMULATIONS=5
SESSION_RETENTION_DAYS=30
```

### 2. Build Application

```bash
# Install dependencies
npm ci --production

# Build Next.js application
npm run build

# Verify build
ls -la .next/

# Check build size
du -sh .next/
```

### 3. Deploy with PM2

```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'pricepilot',
    script: 'npm',
    args: 'start',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G'
  }]
};
EOF

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup
pm2 startup
```


### 4. Configure Nginx (if applicable)

```nginx
# /etc/nginx/sites-available/pricepilot

upstream pricepilot {
    least_conn;
    server localhost:3000;
    server localhost:3001;
}

server {
    listen 80;
    server_name pricepilot.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name pricepilot.com;

    ssl_certificate /etc/ssl/certs/pricepilot.crt;
    ssl_certificate_key /etc/ssl/private/pricepilot.key;

    # Admin dashboard specific settings
    location /admin {
        proxy_pass http://pricepilot;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # API endpoints
    location /api/v1/admin {
        proxy_pass http://pricepilot;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
        
        # Rate limiting
        limit_req zone=admin burst=20 nodelay;
    }

    location / {
        proxy_pass http://pricepilot;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Rate limiting zone
limit_req_zone $binary_remote_addr zone=admin:10m rate=100r/m;
```

```bash
# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## Post-Deployment Verification

### 1. Health Check

```bash
# Check application status
pm2 status

# Check application logs
pm2 logs pricepilot --lines 50

# Test health endpoint
curl https://pricepilot.com/api/v1/admin/health
```


### 2. Functional Testing

```bash
# Test session monitoring API
curl -X GET "https://pricepilot.com/api/v1/admin/sessions" \
  -H "Cookie: next-auth.session-token=<token>" \
  | jq '.success'

# Test metrics API
curl -X GET "https://pricepilot.com/api/v1/admin/metrics/dashboard" \
  -H "Cookie: next-auth.session-token=<token>" \
  | jq '.data.platform'

# Test simulator API
curl -X POST "https://pricepilot.com/api/v1/admin/simulator/run" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<token>" \
  -d '{
    "scenario": "rotation",
    "targetSite": "https://example.com",
    "proxyPool": [{"url": "http://proxy1.example.com:8080", "type": "residential"}],
    "requestCount": 10
  }' \
  | jq '.success'

# Test health monitoring
curl -X GET "https://pricepilot.com/api/v1/admin/health" \
  -H "Cookie: next-auth.session-token=<token>" \
  | jq '.data.overall'
```

### 3. UI Testing

**Manual Testing Checklist**:
- [ ] Login as admin user
- [ ] Navigate to /admin/monitoring
- [ ] Verify real-time monitor loads
- [ ] Check session list displays
- [ ] Test tenant filtering
- [ ] Verify auto-refresh works
- [ ] Navigate to /admin/simulator
- [ ] Run test simulation
- [ ] Verify results display
- [ ] Navigate to /admin/metrics
- [ ] Check all metrics load
- [ ] Test time range selector
- [ ] Verify charts render
- [ ] Test export functionality
- [ ] Check system health monitor
- [ ] Test session control operations

### 4. Performance Testing

```bash
# Test response times
curl -w "@curl-format.txt" -o /dev/null -s \
  "https://pricepilot.com/api/v1/admin/sessions"

# Load test (using Apache Bench)
ab -n 1000 -c 10 -H "Cookie: next-auth.session-token=<token>" \
  https://pricepilot.com/api/v1/admin/metrics/dashboard

# Monitor resource usage
top -b -n 1 | grep node
free -h
df -h
```


### 5. Database Verification

```sql
-- Check new tables exist and have data
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN ('scraping_sessions', 'simulation_results', 'system_alerts')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('scraping_sessions', 'simulation_results');

-- Verify data integrity
SELECT COUNT(*) FROM scraping_sessions;
SELECT COUNT(*) FROM simulation_results;
SELECT COUNT(*) FROM system_alerts;
```

### 6. Redis Verification

```bash
# Check Redis memory usage
redis-cli info memory | grep used_memory_human

# Check active sessions
redis-cli KEYS "session:*" | wc -l

# Check metrics cache
redis-cli GET "metrics:realtime"

# Monitor Redis operations
redis-cli MONITOR | head -20
```

---

## Rollback Procedures

### Quick Rollback (Application Only)

```bash
# Stop current version
pm2 stop pricepilot

# Restore previous version
git checkout production
npm ci --production
npm run build

# Restart application
pm2 restart pricepilot

# Verify rollback
curl https://pricepilot.com/api/health
```


### Full Rollback (Database + Application)

```bash
# 1. Stop application
pm2 stop pricepilot

# 2. Restore database
psql -U postgres -d pricepilot < pre_migration_backup.sql

# 3. Restore Redis
redis-cli FLUSHDB
redis-cli --rdb /backup/redis_backup.rdb

# 4. Restore application
git checkout production
npm ci --production
npm run build

# 5. Restore environment
cp .env.backup .env

# 6. Restart services
pm2 restart pricepilot
sudo systemctl restart redis

# 7. Verify rollback
curl https://pricepilot.com/api/health
psql -U postgres -d pricepilot -c "\dt"
```

### Rollback Decision Matrix

| Issue | Severity | Action |
|-------|----------|--------|
| UI bugs | Low | Fix forward, deploy patch |
| API errors | Medium | Investigate, fix if quick, else rollback |
| Database errors | High | Immediate rollback |
| Data corruption | Critical | Immediate rollback + restore backup |
| Performance degradation | Medium | Monitor, optimize, or rollback |
| Security issue | Critical | Immediate rollback + patch |

---

## Monitoring and Alerts

### 1. Set Up Application Monitoring

```bash
# Install monitoring tools
npm install -g pm2-logrotate

# Configure log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```


### 2. Configure Health Check Monitoring

```bash
# Create health check script
cat > /usr/local/bin/health-check.sh << 'EOF'
#!/bin/bash

HEALTH_URL="https://pricepilot.com/api/v1/admin/health"
ALERT_EMAIL="ops@pricepilot.com"

response=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL")

if [ "$response" != "200" ]; then
  echo "Health check failed with status: $response" | \
    mail -s "PricePilot Health Check Failed" "$ALERT_EMAIL"
fi
EOF

chmod +x /usr/local/bin/health-check.sh

# Add to crontab (every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/health-check.sh") | crontab -
```

### 3. Set Up Database Monitoring

```sql
-- Create monitoring view
CREATE OR REPLACE VIEW admin_dashboard_health AS
SELECT
  'scraping_sessions' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE status = 'running') as active_sessions,
  COUNT(*) FILTER (WHERE start_time > NOW() - INTERVAL '1 hour') as recent_sessions
FROM scraping_sessions
UNION ALL
SELECT
  'simulation_results' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE start_time > NOW() - INTERVAL '1 hour') as active_sessions,
  COUNT(*) FILTER (WHERE start_time > NOW() - INTERVAL '1 hour') as recent_sessions
FROM simulation_results;

-- Query monitoring view
SELECT * FROM admin_dashboard_health;
```

### 4. Configure Alerts

```javascript
// config/alerts.js
module.exports = {
  alerts: {
    // System health alerts
    databaseDown: {
      enabled: true,
      severity: 'critical',
      channels: ['email', 'slack']
    },
    redisDown: {
      enabled: true,
      severity: 'critical',
      channels: ['email', 'slack']
    },
    
    // Performance alerts
    highResponseTime: {
      enabled: true,
      threshold: 5000, // ms
      severity: 'warning',
      channels: ['email']
    },
    highMemoryUsage: {
      enabled: true,
      threshold: 0.9, // 90%
      severity: 'warning',
      channels: ['email']
    },
    
    // Business logic alerts
    highFailureRate: {
      enabled: true,
      threshold: 0.3, // 30%
      severity: 'warning',
      channels: ['email', 'slack']
    },
    proxyPoolDegraded: {
      enabled: true,
      threshold: 0.5, // 50% unhealthy
      severity: 'warning',
      channels: ['email']
    }
  }
};
```

---

## Post-Deployment Tasks

### 1. Update Documentation

- [ ] Update CHANGELOG.md
- [ ] Update API documentation
- [ ] Update user guide
- [ ] Update architecture diagrams
- [ ] Document any configuration changes

### 2. Communicate Deployment

```markdown
# Deployment Notification Template

Subject: Admin Dashboard Enhancement Deployed

Hi Team,

The admin dashboard enhancement has been successfully deployed to production.

**New Features:**
- Real-time session monitoring
- Proxy simulator
- Enhanced metrics dashboard
- System health monitor
- Session control panel
- Tenant debug view

**Access:**
- URL: https://pricepilot.com/admin/monitoring
- Documentation: https://docs.pricepilot.com/admin-dashboard-enhancement

**Known Issues:**
- None

**Support:**
- Email: support@pricepilot.com
- Slack: #admin-dashboard

Thanks,
DevOps Team
```

### 3. Schedule Follow-Up

- Day 1: Monitor closely, check logs hourly
- Day 2-7: Daily health checks
- Week 2: Performance review
- Week 4: Feature adoption review
- Month 3: Full retrospective

---

*Last Updated: January 27, 2026*
*Version: 2.0.0*
