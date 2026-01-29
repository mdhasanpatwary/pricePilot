# Database Optimization Scheduler

## Overview

The scheduler manages all automated database optimization jobs including maintenance, archival, caching, and monitoring.

## Installation

Install the required dependency:

```bash
npm install node-cron
# or
yarn add node-cron
```

## Running the Scheduler

### Development

```bash
npx tsx scripts/scheduler.ts
```

### Production with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start the scheduler
pm2 start scripts/scheduler.ts --name "db-scheduler" --interpreter tsx

# View logs
pm2 logs db-scheduler

# Monitor
pm2 monit

# Stop
pm2 stop db-scheduler

# Restart
pm2 restart db-scheduler
```

### Production with systemd

Create a systemd service file `/etc/systemd/system/db-scheduler.service`:

```ini
[Unit]
Description=Database Optimization Scheduler
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/app
Environment="NODE_ENV=production"
Environment="DATABASE_URL=postgresql://..."
Environment="REDIS_URL=redis://..."
ExecStart=/usr/bin/npx tsx scripts/scheduler.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl enable db-scheduler
sudo systemctl start db-scheduler
sudo systemctl status db-scheduler
```

## Scheduled Jobs

| Job | Schedule | Duration | Purpose |
|-----|----------|----------|---------|
| Daily ANALYZE | 3:00 AM UTC | 5-15 min | Update query planner statistics |
| Weekly VACUUM | Sun 2:00 AM UTC | 30-60 min | Reclaim storage, prevent bloat |
| Daily Archival | 2:30 AM UTC | 10-30 min | Move old data to archives |
| Materialized Views | Every 15 min | 1-5 min | Refresh analytics views |
| Query Metrics | 3:30 AM UTC | 2-5 min | Aggregate slow query data |
| Cache Warming | 2:00 AM UTC | 5-10 min | Pre-load frequently accessed data |
| Statistics Collection | 4:00 AM UTC | 2-5 min | Track database growth |

## Manual Job Execution

You can run individual jobs manually:

```bash
# Run ANALYZE
npx tsx scripts/run-maintenance-check.ts --analyze

# Run VACUUM
npx tsx scripts/run-maintenance-check.ts --vacuum

# Run archival
npx tsx scripts/run-archival.ts

# Refresh materialized views
npx tsx scripts/refresh-materialized-views.ts

# Aggregate query metrics
npx tsx scripts/aggregate-query-metrics.ts

# Warm cache
npx tsx scripts/warm-cache.ts

# Collect statistics
npx tsx scripts/collect-statistics.ts
```

## Monitoring

### Check Scheduler Status

```bash
# With PM2
pm2 status db-scheduler
pm2 logs db-scheduler --lines 100

# With systemd
sudo systemctl status db-scheduler
sudo journalctl -u db-scheduler -n 100 -f
```

### View Job Statistics

The scheduler tracks job execution statistics:

- Last run time
- Success count
- Failure count

These are logged to stdout and can be viewed in PM2 logs or systemd journal.

### Database Monitoring

View performance metrics in the admin dashboard:

```
GET /api/v1/admin/performance/slow-queries
GET /api/v1/admin/performance/cache-stats
GET /api/v1/admin/performance/replication-status
```

## Troubleshooting

### Scheduler Not Starting

1. Check Node.js version: `node --version` (requires 18+)
2. Verify dependencies: `npm install`
3. Check environment variables
4. Review logs for errors

### Jobs Not Running

1. Verify scheduler is running: `pm2 status` or `systemctl status`
2. Check timezone configuration (should be UTC)
3. Review cron expressions
4. Check database connectivity

### Job Failures

1. View logs: `pm2 logs db-scheduler` or `journalctl -u db-scheduler`
2. Run job manually to see detailed errors
3. Check database permissions
4. Verify sufficient disk space

### Performance Issues

1. Adjust job timing to avoid overlap
2. Increase maintenance window duration
3. Optimize batch sizes in archival jobs
4. Monitor database load during jobs

## Environment Variables

Required environment variables:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
NODE_ENV=production

# Optional: Read replicas
READ_REPLICA_1_URL=postgresql://user:pass@replica1:5432/db
READ_REPLICA_2_URL=postgresql://user:pass@replica2:5432/db
```

## Customization

### Adjusting Schedules

Edit `scripts/scheduler.ts` and modify the cron expressions:

```typescript
// Change from 3 AM to 4 AM
cron.schedule('0 4 * * *', async () => {
  // ...
});
```

### Adding New Jobs

Add a new cron schedule in `scripts/scheduler.ts`:

```typescript
cron.schedule('0 5 * * *', async () => {
  await executeJob('my-custom-job', async () => {
    // Your job logic here
  });
}, {
  timezone: 'UTC'
});
```

### Disabling Jobs

Comment out the cron schedule for jobs you don't need:

```typescript
// Disable cache warming
// cron.schedule('0 2 * * *', async () => {
//   await executeJob('warm-cache', async () => {
//     // ...
//   });
// });
```

## Best Practices

1. **Always use UTC timezone** for consistency across servers
2. **Schedule heavy jobs during off-peak hours** (2-4 AM)
3. **Monitor job execution** and set up alerts for failures
4. **Test in staging** before deploying to production
5. **Keep logs rotated** to prevent disk space issues
6. **Document any customizations** in this README

## Support

For issues or questions:

1. Check logs for error messages
2. Review the main cron jobs documentation: `scripts/cron-jobs.md`
3. Consult the database optimization design document
4. Contact the development team
