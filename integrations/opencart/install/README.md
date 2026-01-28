# PricePilot OpenCart Plugin - Database Installation

This directory contains database migration scripts for the PricePilot OpenCart plugin. These scripts create all necessary custom tables required for the plugin to function.

## Tables Created

The installation process creates the following tables:

### 1. pricepilot_activity_log
**Purpose:** Track all price changes made through the plugin  
**Requirements:** 31.1

**Columns:**
- `log_id` - Auto-incrementing primary key
- `product_id` - OpenCart product ID
- `product_name` - Product name at time of change
- `old_price` - Previous price value
- `new_price` - Updated price value
- `changed_by` - Source of change (API, Admin, etc.)
- `store_id` - Multi-store support
- `date_added` - Timestamp of change

**Indexes:**
- Primary key on `log_id`
- Index on `product_id` for product-specific queries
- Index on `date_added` for date range filtering
- Index on `store_id` for multi-store filtering

### 2. pricepilot_api_logs
**Purpose:** Log all API requests and responses for monitoring and debugging  
**Requirements:** 31.2

**Columns:**
- `log_id` - Auto-incrementing primary key
- `endpoint` - API endpoint path
- `method` - HTTP method (GET, POST, etc.)
- `ip_address` - Client IP address
- `request_data` - Request payload (JSON)
- `response_code` - HTTP response code
- `response_time` - Response time in seconds
- `date_added` - Timestamp of request

**Indexes:**
- Primary key on `log_id`
- Index on `date_added` for time-based queries
- Index on `ip_address` for IP-based filtering
- Index on `endpoint` for endpoint-specific analysis

### 3. pricepilot_product_mapping
**Purpose:** Map OpenCart products to competitor products for price tracking  
**Requirements:** 31.3

**Columns:**
- `mapping_id` - Auto-incrementing primary key
- `product_id` - OpenCart product ID
- `competitor_url` - Competitor product URL
- `competitor_name` - Competitor name
- `date_added` - Creation timestamp
- `date_modified` - Last update timestamp

**Indexes:**
- Primary key on `mapping_id`
- Index on `product_id` for product lookups
- Unique constraint on `product_id` + `competitor_url` to prevent duplicates

### 4. pricepilot_webhooks
**Purpose:** Store webhook configurations for real-time event notifications  
**Requirements:** 31.4

**Columns:**
- `webhook_id` - Auto-incrementing primary key
- `url` - Webhook endpoint URL
- `events` - Comma-separated list of events to monitor
- `secret` - HMAC secret for signature verification
- `status` - Active/inactive status
- `date_added` - Creation timestamp
- `date_modified` - Last update timestamp

**Indexes:**
- Primary key on `webhook_id`
- Index on `status` for active webhook queries

### 5. pricepilot_queue
**Purpose:** Queue system for background processing of long-running operations  
**Requirements:** 31.5

**Columns:**
- `job_id` - UUID primary key
- `job_type` - Type of job (bulk_update, webhook_batch, etc.)
- `job_data` - Job parameters (JSON)
- `status` - Job status (pending, processing, completed, failed, cancelled)
- `progress` - Progress percentage (0-100)
- `result` - Job result data (JSON)
- `retry_count` - Number of retry attempts
- `priority` - Job priority (1-10)
- `date_added` - Job creation timestamp
- `date_started` - Job start timestamp
- `date_completed` - Job completion timestamp

**Indexes:**
- Primary key on `job_id`
- Index on `status` for status-based queries
- Index on `priority` for priority queue processing
- Index on `date_added` for FIFO processing

### 6. pricepilot_price_backups
**Purpose:** Store price backups for restoration capability  
**Requirements:** 31.5

**Columns:**
- `backup_id` - UUID primary key
- `backup_data` - Backup data (JSON)
- `product_count` - Number of products in backup
- `created_by` - User who created backup
- `date_added` - Backup creation timestamp

**Indexes:**
- Primary key on `backup_id`
- Index on `date_added` for chronological queries

## Installation Methods

### Method 1: Automated Installation (Recommended)

1. Upload the entire `install` directory to your OpenCart root directory
2. Access the installer via browser: `http://yourstore.com/install/install.php`
3. Follow the on-screen instructions
4. **Important:** Delete the `install` directory after successful installation

### Method 2: Manual Installation via phpMyAdmin

1. Log in to phpMyAdmin
2. Select your OpenCart database
3. Execute each SQL file in order:
   - `001_create_pricepilot_activity_log.sql`
   - `002_create_pricepilot_api_logs.sql`
   - `003_create_pricepilot_product_mapping.sql`
   - `004_create_pricepilot_webhooks.sql`
   - `005_create_pricepilot_queue.sql`
   - `006_create_pricepilot_price_backups.sql`

### Method 3: Command Line Installation

```bash
# Navigate to the install/sql directory
cd /path/to/opencart/install/sql

# Execute each migration in order
mysql -u username -p database_name < 001_create_pricepilot_activity_log.sql
mysql -u username -p database_name < 002_create_pricepilot_api_logs.sql
mysql -u username -p database_name < 003_create_pricepilot_product_mapping.sql
mysql -u username -p database_name < 004_create_pricepilot_webhooks.sql
mysql -u username -p database_name < 005_create_pricepilot_queue.sql
mysql -u username -p database_name < 006_create_pricepilot_price_backups.sql
```

## Verification

After installation, verify all tables were created successfully:

```sql
SHOW TABLES LIKE 'pricepilot_%';
```

You should see 6 tables:
- pricepilot_activity_log
- pricepilot_api_logs
- pricepilot_product_mapping
- pricepilot_price_backups
- pricepilot_queue
- pricepilot_webhooks

## Troubleshooting

### Error: Table already exists
If you see "Table already exists" errors, you can either:
1. Drop the existing tables and re-run the installation
2. Skip the migration for that table if it's already correct

### Error: Access denied
Ensure your database user has the following permissions:
- CREATE
- ALTER
- INDEX
- INSERT
- SELECT

### Error: Unknown collation
If you see collation errors, your MySQL version may not support `utf8mb4_general_ci`. Edit the SQL files and change to `utf8_general_ci`.

## Uninstallation

To remove all PricePilot tables:

```sql
DROP TABLE IF EXISTS pricepilot_activity_log;
DROP TABLE IF EXISTS pricepilot_api_logs;
DROP TABLE IF EXISTS pricepilot_product_mapping;
DROP TABLE IF EXISTS pricepilot_webhooks;
DROP TABLE IF EXISTS pricepilot_queue;
DROP TABLE IF EXISTS pricepilot_price_backups;
```

**Warning:** This will permanently delete all data. Make sure to backup your data before uninstalling.

## Database Maintenance

### Log Cleanup
The activity and API logs can grow large over time. Consider setting up a cron job to clean old logs:

```sql
-- Delete activity logs older than 90 days
DELETE FROM pricepilot_activity_log WHERE date_added < DATE_SUB(NOW(), INTERVAL 90 DAY);

-- Delete API logs older than 90 days
DELETE FROM pricepilot_api_logs WHERE date_added < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

### Backup Cleanup
Price backups should be cleaned periodically:

```sql
-- Delete backups older than 30 days
DELETE FROM pricepilot_price_backups WHERE date_added < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

### Queue Cleanup
Completed and failed jobs can be cleaned:

```sql
-- Delete completed jobs older than 7 days
DELETE FROM pricepilot_queue 
WHERE status IN ('completed', 'failed', 'cancelled') 
AND date_completed < DATE_SUB(NOW(), INTERVAL 7 DAY);
```

## Support

For issues or questions:
- Check the main plugin documentation
- Review the troubleshooting section above
- Contact PricePilot support

## Version Compatibility

- OpenCart 3.0+
- OpenCart 4.0+
- MySQL 5.6+
- MariaDB 10.0+

## Security Notes

1. **Delete install.php after installation** - The installer should not be accessible in production
2. **Backup your database** - Always backup before running migrations
3. **Test in staging first** - Test the installation in a staging environment before production
4. **Review permissions** - Ensure database user has only necessary permissions
