# Operations Runbook

This runbook provides step-by-step procedures for common operational tasks, incident response, and disaster recovery for PricePilot.

---

## 📋 Table of Contents

1. [System Health Checks](#system-health-checks)
2. [Common Incidents & Solutions](#common-incidents--solutions)
3. [Scaling Procedures](#scaling-procedures)
4. [Disaster Recovery](#disaster-recovery)
5. [Monitoring & Alerts](#monitoring--alerts)
6. [Maintenance Tasks](#maintenance-tasks)

---

## 🏥 System Health Checks

### Quick Health Check
```bash
# Check if all services are running
pm2 status

# Check Redis connectivity
redis-cli ping  # Should return "PONG"

# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check application health endpoint
curl http://localhost:3000/api/v1/health
```

### Detailed Diagnostics
Navigate to the Admin Panel → Diagnostics page:
```
https://your-domain.com/admin/diagnostics
```

This checks:
- Database connectivity
- Redis status
- Internet connectivity
- Proxy configuration
- Integration health

---

## 🚨 Common Incidents & Solutions

### 1. Worker Process Crashed

**Symptoms:**
- Sync jobs are queued but not processing
- Dashboard shows "Sync in progress" indefinitely

**Diagnosis:**
```bash
pm2 logs pricepilot-worker --lines 50
```

**Solution:**
```bash
# Restart the worker
pm2 restart pricepilot-worker

# If using single process mode
pm2 restart pricepilot
```

**Prevention:**
- Monitor worker memory usage
- Set up PM2 auto-restart on crash
- Configure memory limits in `ecosystem.config.js`:
  ```javascript
  {
    name: "pricepilot-worker",
    max_memory_restart: "1G"
  }
  ```

---

### 2. Redis Connection Failed

**Symptoms:**
- Error: "ECONNREFUSED" in logs
- Jobs not being queued

**Diagnosis:**
```bash
redis-cli ping
systemctl status redis  # On Linux
brew services list | grep redis  # On macOS
```

**Solution:**
```bash
# Start Redis
systemctl start redis  # Linux
brew services start redis  # macOS

# Restart application after Redis is up
pm2 restart all
```

**Prevention:**
- Set up Redis as a systemd service with auto-restart
- Monitor Redis memory usage
- Configure Redis persistence (AOF or RDB)

---

### 3. Database Connection Pool Exhausted

**Symptoms:**
- Error: "Connection pool timeout"
- Slow API responses

**Diagnosis:**
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check connection pool settings
SHOW max_connections;
```

**Solution:**
```bash
# Restart application to reset pool
pm2 restart all

# If persistent, increase pool size in DATABASE_URL
# Example: ?connection_limit=20
```

**Prevention:**
- Monitor database connection count
- Tune Prisma connection pool settings
- Set up connection pooling with PgBouncer for high-traffic deployments

---

### 4. Scraper Blocked by Target Site

**Symptoms:**
- Sync logs show "403 Forbidden" or "429 Too Many Requests"
- Products not updating

**Diagnosis:**
```bash
# Check recent sync logs
tail -f logs/sync.log

# Or via Admin Panel → Sync Console
```

**Solution:**
```bash
# Option 1: Enable/configure proxies
# Edit .env
SCRAPER_PROXIES="http://proxy1:port,http://proxy2:port"

# Option 2: Reduce scraping speed
# Admin Panel → Business Setup → Scraper Batch Size: 3 (default: 5)

# Option 3: Rotate User Agents
# Admin Panel → Scraper Profiles → Add more user agents
```

**Prevention:**
- Use rotating proxies from the start
- Implement rate limiting per domain
- Add random delays between requests

---

### 5. Out of Memory (OOM)

**Symptoms:**
- Process killed unexpectedly
- PM2 shows "errored" status

**Diagnosis:**
```bash
# Check system memory
free -h  # Linux
top  # macOS/Linux

# Check PM2 memory usage
pm2 monit
```

**Solution:**
```bash
# Immediate: Restart with memory limit
pm2 restart pricepilot-worker --max-memory-restart 1G

# Long-term: Optimize batch sizes
# Admin Panel → Business Setup → Scraper Batch Size: 3
```

**Prevention:**
- Set memory limits in PM2 config
- Monitor memory usage with PM2 Plus or Datadog
- Implement batch processing (already done in RulesEngine)

---

## 📈 Scaling Procedures

### Vertical Scaling (Increase Server Resources)

1. **Increase RAM:**
   - Recommended: 2GB minimum, 4GB for 10k+ products
   - Update PM2 memory limits accordingly

2. **Increase CPU:**
   - Worker concurrency scales with CPU cores
   - Edit `lib/queue/worker.ts`:
     ```typescript
     concurrency: 4  // Increase from 2
     ```

### Horizontal Scaling (Multiple Workers)

1. **Deploy additional worker instances:**
   ```bash
   # On Worker Server 2
   git clone <repo>
   npm install
   npm run worker  # Only run worker, not web server
   ```

2. **Configure shared Redis:**
   ```env
   REDIS_URL="redis://shared-redis-server:6379"
   ```

3. **Load balance web servers:**
   - Use Nginx or AWS ALB to distribute traffic
   - All web instances share the same database and Redis

### Database Scaling

1. **Connection Pooling:**
   ```bash
   # Use PgBouncer
   sudo apt install pgbouncer
   ```

2. **Read Replicas:**
   - Configure Prisma to use read replicas for analytics queries
   - Keep writes on primary database

---

## 🔥 Disaster Recovery

### Database Backup & Restore

**Automated Backups:**
```bash
# Set up daily backups (cron job)
0 2 * * * cd /path/to/PricePilot && npm run backup
```

The script at `scripts/backup-db.ts` handles:
- Compressed SQL dumps (`.sql.gz`)
- Automatic 7-day retention management
- Local storage in the `/backups` directory

**Manual Backup:**
```bash
pg_dump $DATABASE_URL > backup.sql
```

**Restore:**
```bash
# Stop application first
pm2 stop all

# Restore database
psql $DATABASE_URL < backup.sql

# Restart application
pm2 start all
```

### Redis Backup & Restore

**Backup:**
```bash
# Redis automatically saves to dump.rdb
cp /var/lib/redis/dump.rdb /backups/redis_$(date +%Y%m%d).rdb
```

**Restore:**
```bash
systemctl stop redis
cp /backups/redis_YYYYMMDD.rdb /var/lib/redis/dump.rdb
systemctl start redis
```

### Complete System Recovery

1. **Provision new server**
2. **Install dependencies:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install nodejs postgresql redis-server
   ```

3. **Clone repository:**
   ```bash
   git clone <repo>
   cd PricePilot
   npm install
   ```

4. **Restore database:**
   ```bash
   psql $DATABASE_URL < backup.sql
   ```

5. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with production values
   ```

6. **Start application:**
   ```bash
   npm run build
   pm2 start npm --name pricepilot -- start
   ```

---

## 📊 Monitoring & Alerts

### Key Metrics to Monitor

1. **Application Health:**
   - Uptime
   - Response time (p95, p99)
   - Error rate

2. **Worker Health:**
   - Job processing rate
   - Job failure rate
   - Queue depth

3. **Infrastructure:**
   - CPU usage
   - Memory usage
   - Disk space
   - Database connections

### Recommended Tools

- **PM2 Plus:** Built-in monitoring for PM2
- **Datadog/New Relic:** APM and infrastructure monitoring
- **Sentry:** Error tracking
- **Uptime Robot:** External uptime monitoring

### Setting Up Alerts

**PM2 Plus:**
```bash
pm2 install pm2-server-monit
pm2 link <secret> <public>
```

**Custom Health Check Script:**
```bash
#!/bin/bash
# health-check.sh
HEALTH=$(curl -s http://localhost:3000/api/v1/health | jq -r '.status')
if [ "$HEALTH" != "ok" ]; then
  echo "Health check failed!" | mail -s "PricePilot Alert" admin@example.com
fi
```

---

## 🔧 Maintenance Tasks

### Weekly Tasks

1. **Check disk space:**
   ```bash
   df -h
   ```

2. **Review error logs:**
   ```bash
   pm2 logs --err --lines 100
   ```

3. **Check queue health:**
   ```bash
   redis-cli LLEN bull:sync-queue:wait
   ```

### Monthly Tasks

1. **Update dependencies:**
   ```bash
   npm outdated
   npm update
   npm audit fix
   ```

2. **Database maintenance:**
   ```sql
   VACUUM ANALYZE;
   REINDEX DATABASE pricepilot;
   ```

3. **Clean old logs:**
   ```bash
   pm2 flush  # Clear PM2 logs
   find /var/log -name "*.log" -mtime +30 -delete
   ```

### Quarterly Tasks

1. **Review and optimize database indexes**
2. **Audit user permissions and access logs**
3. **Test disaster recovery procedures**
4. **Review and update this runbook**

---

## 📞 Emergency Contacts

- **Primary On-Call:** [Your Contact]
- **Database Admin:** [DBA Contact]
- **Infrastructure Team:** [Infra Contact]

---

## 📚 Additional Resources

- [Architecture Documentation](./ARCHITECTURE.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [API Documentation](../app/docs/api/page.tsx)
