---
title: "Database Backup and Restore"
description: "Procedures for backing up and restoring PricePilot database"
category: "database"
subcategory: null
tags: ["database", "backup", "restore", "disaster-recovery"]
author: "PricePilot Team"
lastReviewed: "2024-01-15"
relatedDocs: ["schema-management", "tenant-operations"]
---

# Database Backup and Restore

Comprehensive guide for backing up and restoring the PricePilot PostgreSQL database.

## Backup Strategy

### Backup Types

#### 1. Full Database Backup
Complete backup of all data, schema, and configurations.

**Frequency**: Daily at 2:00 AM UTC

```bash
# Full backup using pg_dump
pg_dump -h localhost -U postgres -d pricepilot \
  -F c -b -v -f "/backups/pricepilot_full_$(date +%Y%m%d_%H%M%S).backup"
```

#### 2. Incremental Backup
Backup of changes since last full backup using WAL archiving.

**Frequency**: Continuous

```bash
# Configure WAL archiving in postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /backups/wal_archive/%f'
```

#### 3. Tenant-Specific Backup
Backup data for a specific tenant.

```bash
# Backup single tenant
pg_dump -h localhost -U postgres -d pricepilot \
  --table='*' \
  --where="tenant_id='<tenant-uuid>'" \
  -F c -f "/backups/tenant_<tenant-id>_$(date +%Y%m%d).backup"
```

### Backup Retention Policy

- **Daily backups**: Retain for 30 days
- **Weekly backups**: Retain for 90 days
- **Monthly backups**: Retain for 1 year
- **Yearly backups**: Retain for 7 years (compliance)

## Automated Backup

### Backup Script

Create `/scripts/backup-database.sh`:

```bash
#!/bin/bash

# Configuration
DB_HOST="localhost"
DB_USER="postgres"
DB_NAME="pricepilot"
BACKUP_DIR="/backups"
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate backup filename
BACKUP_FILE="$BACKUP_DIR/pricepilot_$(date +%Y%m%d_%H%M%S).backup"

# Perform backup
pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" \
  -F c -b -v -f "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"

# Upload to S3 (optional)
aws s3 cp "$BACKUP_FILE.gz" "s3://pricepilot-backups/$(basename $BACKUP_FILE.gz)"

# Remove old backups
find "$BACKUP_DIR" -name "pricepilot_*.backup.gz" -mtime +$RETENTION_DAYS -delete

# Log completion
echo "Backup completed: $BACKUP_FILE.gz"
```

### Cron Schedule

Add to crontab:

```bash
# Daily backup at 2:00 AM
0 2 * * * /scripts/backup-database.sh >> /var/log/backup.log 2>&1

# Weekly backup on Sunday at 3:00 AM
0 3 * * 0 /scripts/backup-database-weekly.sh >> /var/log/backup.log 2>&1
```

## Restore Procedures

### Full Database Restore

#### 1. Stop Application

```bash
# Stop application servers
docker-compose stop app worker

# Or systemctl
systemctl stop pricepilot-app
systemctl stop pricepilot-worker
```

#### 2. Drop Existing Database

```bash
# Connect to PostgreSQL
psql -h localhost -U postgres

# Drop and recreate database
DROP DATABASE pricepilot;
CREATE DATABASE pricepilot;
\q
```

#### 3. Restore from Backup

```bash
# Restore using pg_restore
pg_restore -h localhost -U postgres -d pricepilot \
  -v "/backups/pricepilot_20240115_020000.backup"
```

#### 4. Verify Restoration

```sql
-- Check table counts
SELECT 
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- Verify critical data
SELECT COUNT(*) FROM tenants;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM user_products;
```

#### 5. Restart Application

```bash
# Start application servers
docker-compose start app worker

# Or systemctl
systemctl start pricepilot-app
systemctl start pricepilot-worker
```

### Point-in-Time Recovery (PITR)

Restore database to a specific point in time using WAL archives.

#### 1. Restore Base Backup

```bash
# Stop PostgreSQL
systemctl stop postgresql

# Clear data directory
rm -rf /var/lib/postgresql/data/*

# Restore base backup
pg_restore -h localhost -U postgres -d pricepilot \
  "/backups/pricepilot_base_20240115.backup"
```

#### 2. Configure Recovery

Create `recovery.conf`:

```conf
restore_command = 'cp /backups/wal_archive/%f %p'
recovery_target_time = '2024-01-15 14:30:00'
recovery_target_action = 'promote'
```

#### 3. Start PostgreSQL

```bash
# Start PostgreSQL
systemctl start postgresql

# Monitor recovery
tail -f /var/log/postgresql/postgresql.log
```

### Tenant-Specific Restore

Restore data for a single tenant without affecting others.

```sql
-- Begin transaction
BEGIN;

-- Delete existing tenant data
DELETE FROM user_products WHERE tenant_id = '<tenant-uuid>';
DELETE FROM competitor_products WHERE tenant_id = '<tenant-uuid>';
-- ... delete from other tables

-- Restore from backup
\! pg_restore -h localhost -U postgres -d pricepilot \
  --data-only \
  --table='user_products' \
  --table='competitor_products' \
  "/backups/tenant_<tenant-id>_20240115.backup"

-- Verify restoration
SELECT COUNT(*) FROM user_products WHERE tenant_id = '<tenant-uuid>';

-- Commit if successful
COMMIT;
```

## Disaster Recovery

### Recovery Time Objective (RTO)

- **Critical**: 1 hour
- **High**: 4 hours
- **Medium**: 24 hours

### Recovery Point Objective (RPO)

- **Critical data**: 5 minutes (WAL archiving)
- **Standard data**: 24 hours (daily backups)

### DR Procedures

#### 1. Assess Situation

- Determine scope of failure
- Identify last known good state
- Estimate data loss

#### 2. Notify Stakeholders

- Alert operations team
- Notify affected tenants
- Update status page

#### 3. Execute Recovery

- Follow appropriate restore procedure
- Verify data integrity
- Test critical functionality

#### 4. Post-Recovery

- Document incident
- Identify root cause
- Implement preventive measures

## Backup Verification

### Automated Testing

Test backups monthly:

```bash
#!/bin/bash

# Restore to test database
createdb pricepilot_test
pg_restore -d pricepilot_test "/backups/latest.backup"

# Run verification queries
psql -d pricepilot_test -c "SELECT COUNT(*) FROM tenants;"
psql -d pricepilot_test -c "SELECT COUNT(*) FROM users;"

# Drop test database
dropdb pricepilot_test

echo "Backup verification completed"
```

### Manual Verification

Quarterly manual verification:

1. Restore backup to staging environment
2. Verify all tables present
3. Check row counts match production
4. Test critical queries
5. Verify foreign key constraints
6. Document results

## Backup Security

### Encryption

Encrypt backups at rest:

```bash
# Encrypt backup
openssl enc -aes-256-cbc -salt \
  -in pricepilot_backup.backup \
  -out pricepilot_backup.backup.enc \
  -k "$ENCRYPTION_KEY"

# Decrypt backup
openssl enc -d -aes-256-cbc \
  -in pricepilot_backup.backup.enc \
  -out pricepilot_backup.backup \
  -k "$ENCRYPTION_KEY"
```

### Access Control

- Store backups in secure location
- Limit access to backup files
- Use separate credentials for backups
- Audit backup access logs

### Off-Site Storage

- Upload to S3 with encryption
- Use separate AWS account
- Enable versioning
- Configure lifecycle policies

## Monitoring

### Backup Monitoring

Monitor backup health:

```typescript
// Check last backup time
const lastBackup = await db.backupLog.findFirst({
  orderBy: { createdAt: 'desc' }
});

if (Date.now() - lastBackup.createdAt.getTime() > 86400000) {
  // Alert: No backup in 24 hours
  await sendAlert({
    severity: 'critical',
    message: 'Database backup overdue'
  });
}
```

### Alerts

- Backup failure
- Backup size anomaly
- Backup duration exceeds threshold
- Backup verification failure

## Best Practices

1. **Test Restores Regularly**: Monthly restore tests
2. **Automate Everything**: Use scripts and cron jobs
3. **Monitor Backup Health**: Set up alerts
4. **Encrypt Backups**: Protect sensitive data
5. **Off-Site Storage**: Protect against site failures
6. **Document Procedures**: Keep runbooks updated
7. **Verify Backups**: Don't assume backups work

## Troubleshooting

### Backup Fails

```bash
# Check disk space
df -h

# Check PostgreSQL logs
tail -f /var/log/postgresql/postgresql.log

# Verify permissions
ls -la /backups

# Test connection
pg_dump --version
psql -h localhost -U postgres -c "SELECT version();"
```

### Restore Fails

```bash
# Check backup file integrity
pg_restore --list backup.backup

# Verify PostgreSQL version compatibility
psql --version

# Check for conflicting data
# Drop database and retry
```

## Related Documentation

- [Schema Management](schema-management)
- [Tenant Operations](../tenant-management/tenant-operations)
- [Disaster Recovery](../alerting/incident-response)
