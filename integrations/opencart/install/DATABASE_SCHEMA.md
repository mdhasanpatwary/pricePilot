# PricePilot Database Schema

## Entity Relationship Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         OpenCart Core Tables                         │
│                    (oc_product, oc_setting, etc.)                   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ References
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PricePilot Custom Tables                        │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐      ┌──────────────────────────┐
│  pricepilot_activity_log │      │   pricepilot_api_logs    │
├──────────────────────────┤      ├──────────────────────────┤
│ • log_id (PK)           │      │ • log_id (PK)           │
│ • product_id            │      │ • endpoint              │
│ • product_name          │      │ • method                │
│ • old_price             │      │ • ip_address            │
│ • new_price             │      │ • request_data          │
│ • changed_by            │      │ • response_code         │
│ • store_id              │      │ • response_time         │
│ • date_added            │      │ • date_added            │
└──────────────────────────┘      └──────────────────────────┘
         │                                   │
         │ Logs price changes                │ Logs API calls
         │                                   │
         ▼                                   ▼
┌──────────────────────────┐      ┌──────────────────────────┐
│pricepilot_product_mapping│      │   pricepilot_webhooks    │
├──────────────────────────┤      ├──────────────────────────┤
│ • mapping_id (PK)       │      │ • webhook_id (PK)       │
│ • product_id            │      │ • url                   │
│ • competitor_url        │      │ • events                │
│ • competitor_name       │      │ • secret                │
│ • date_added            │      │ • status                │
│ • date_modified         │      │ • date_added            │
└──────────────────────────┘      │ • date_modified         │
         │                         └──────────────────────────┘
         │ Maps to competitors              │
         │                                  │ Notifies on events
         ▼                                  ▼
┌──────────────────────────┐      ┌──────────────────────────┐
│   pricepilot_queue       │      │pricepilot_price_backups  │
├──────────────────────────┤      ├──────────────────────────┤
│ • job_id (PK)           │      │ • backup_id (PK)        │
│ • job_type              │      │ • backup_data           │
│ • job_data              │      │ • product_count         │
│ • status                │      │ • created_by            │
│ • progress              │      │ • date_added            │
│ • result                │      └──────────────────────────┘
│ • retry_count           │               │
│ • priority              │               │ Stores backups
│ • date_added            │               │
│ • date_started          │               ▼
│ • date_completed        │      [Restore capability]
└──────────────────────────┘
         │
         │ Processes jobs
         ▼
[Background Processing]
```

## Table Details

### 1. pricepilot_activity_log
**Purpose:** Audit trail for all price changes

**Key Features:**
- Tracks old and new prices
- Records who made the change (API, Admin, etc.)
- Supports multi-store installations
- Indexed for fast product and date queries

**Typical Queries:**
```sql
-- Get price history for a product
SELECT * FROM pricepilot_activity_log 
WHERE product_id = 123 
ORDER BY date_added DESC;

-- Get today's price changes
SELECT * FROM pricepilot_activity_log 
WHERE DATE(date_added) = CURDATE();

-- Get changes by store
SELECT * FROM pricepilot_activity_log 
WHERE store_id = 1;
```

### 2. pricepilot_api_logs
**Purpose:** Monitor and debug API requests

**Key Features:**
- Logs all API endpoints accessed
- Records request and response data
- Tracks response times for performance monitoring
- Indexed for IP-based security analysis

**Typical Queries:**
```sql
-- Get API calls from specific IP
SELECT * FROM pricepilot_api_logs 
WHERE ip_address = '192.168.1.1';

-- Get failed requests
SELECT * FROM pricepilot_api_logs 
WHERE response_code >= 400;

-- Get average response time by endpoint
SELECT endpoint, AVG(response_time) as avg_time 
FROM pricepilot_api_logs 
GROUP BY endpoint;
```

### 3. pricepilot_product_mapping
**Purpose:** Link products to competitor products

**Key Features:**
- Maps OpenCart products to competitor URLs
- Supports multiple competitors per product
- Unique constraint prevents duplicate mappings
- Tracks creation and modification dates

**Typical Queries:**
```sql
-- Get all competitors for a product
SELECT * FROM pricepilot_product_mapping 
WHERE product_id = 123;

-- Get all products mapped to a competitor
SELECT * FROM pricepilot_product_mapping 
WHERE competitor_name = 'Amazon';

-- Check if mapping exists
SELECT COUNT(*) FROM pricepilot_product_mapping 
WHERE product_id = 123 
AND competitor_url = 'https://example.com/product';
```

### 4. pricepilot_webhooks
**Purpose:** Configure real-time event notifications

**Key Features:**
- Stores webhook URLs and event subscriptions
- Includes HMAC secret for signature verification
- Status flag for enabling/disabling webhooks
- Supports multiple events per webhook

**Typical Queries:**
```sql
-- Get active webhooks for an event
SELECT * FROM pricepilot_webhooks 
WHERE status = 1 
AND FIND_IN_SET('product.updated', events);

-- Get all webhook configurations
SELECT * FROM pricepilot_webhooks 
ORDER BY date_added DESC;

-- Disable a webhook
UPDATE pricepilot_webhooks 
SET status = 0 
WHERE webhook_id = 1;
```

### 5. pricepilot_queue
**Purpose:** Background job processing system

**Key Features:**
- Supports multiple job types
- Priority-based processing
- Progress tracking for long-running jobs
- Automatic retry with retry count
- Comprehensive status tracking

**Typical Queries:**
```sql
-- Get pending jobs by priority
SELECT * FROM pricepilot_queue 
WHERE status = 'pending' 
ORDER BY priority DESC, date_added ASC;

-- Get job status
SELECT status, progress, result 
FROM pricepilot_queue 
WHERE job_id = 'uuid-here';

-- Clean completed jobs
DELETE FROM pricepilot_queue 
WHERE status IN ('completed', 'failed') 
AND date_completed < DATE_SUB(NOW(), INTERVAL 7 DAY);
```

### 6. pricepilot_price_backups
**Purpose:** Store price snapshots for restoration

**Key Features:**
- Stores complete price data in JSON format
- Tracks number of products in backup
- Records who created the backup
- Indexed for chronological queries

**Typical Queries:**
```sql
-- Get recent backups
SELECT backup_id, product_count, created_by, date_added 
FROM pricepilot_price_backups 
ORDER BY date_added DESC 
LIMIT 10;

-- Get backup data
SELECT backup_data 
FROM pricepilot_price_backups 
WHERE backup_id = 'uuid-here';

-- Clean old backups
DELETE FROM pricepilot_price_backups 
WHERE date_added < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

## Index Strategy

### Performance Indexes
- **Primary Keys:** Fast unique lookups
- **Foreign Keys:** Efficient joins with OpenCart tables
- **Date Columns:** Time-based filtering and sorting
- **Status Columns:** Filter active/inactive records
- **Composite Indexes:** Multi-column queries

### Index Usage Examples

```sql
-- Uses idx_product_id
EXPLAIN SELECT * FROM pricepilot_activity_log WHERE product_id = 123;

-- Uses idx_date_added
EXPLAIN SELECT * FROM pricepilot_api_logs 
WHERE date_added > '2024-01-01';

-- Uses idx_status
EXPLAIN SELECT * FROM pricepilot_queue WHERE status = 'pending';

-- Uses unique_product_competitor
EXPLAIN SELECT * FROM pricepilot_product_mapping 
WHERE product_id = 123 AND competitor_url = 'https://example.com';
```

## Data Flow

### Price Update Flow
```
1. API Request → pricepilot_api_logs (log request)
2. Validate → ValidationService
3. Update Price → OpenCart oc_product table
4. Log Change → pricepilot_activity_log
5. Trigger Webhook → pricepilot_webhooks (if configured)
6. Send Notification → External system
```

### Bulk Update Flow
```
1. API Request → pricepilot_api_logs
2. Check Size → If >100 products
3. Create Job → pricepilot_queue
4. Return Job ID → Client
5. Background Process → Process queue
6. Update Products → oc_product + pricepilot_activity_log
7. Update Job Status → pricepilot_queue (completed)
```

### Backup/Restore Flow
```
1. Create Backup → Query current prices
2. Store Backup → pricepilot_price_backups (JSON)
3. Restore Request → Retrieve backup data
4. Apply Prices → Update oc_product
5. Log Changes → pricepilot_activity_log
```

## Storage Estimates

### Growth Rates (Approximate)

| Table | Growth Rate | Cleanup Recommended |
|-------|-------------|---------------------|
| activity_log | ~100 rows/day | 90 days |
| api_logs | ~1000 rows/day | 90 days |
| product_mapping | Static | Manual |
| webhooks | Static | Manual |
| queue | Transient | 7 days |
| price_backups | ~1 per week | 30 days |

### Storage Requirements

For a store with 10,000 products:

| Table | Estimated Size | Notes |
|-------|---------------|-------|
| activity_log | ~50 MB/year | With daily updates |
| api_logs | ~200 MB/year | With moderate API usage |
| product_mapping | ~1 MB | 10,000 mappings |
| webhooks | <1 MB | ~10 webhooks |
| queue | ~10 MB | Active jobs only |
| price_backups | ~5 MB/backup | JSON compressed |

## Maintenance Schedule

### Daily
- Monitor queue for stuck jobs
- Check API logs for errors

### Weekly
- Review activity log growth
- Clean completed queue jobs

### Monthly
- Archive old activity logs (>90 days)
- Archive old API logs (>90 days)
- Clean old price backups (>30 days)

### Quarterly
- Analyze index usage
- Optimize table structure
- Review storage usage

## Security Considerations

1. **Sensitive Data:**
   - API logs may contain sensitive request data
   - Webhook secrets should be encrypted
   - Backup data contains pricing information

2. **Access Control:**
   - Restrict direct database access
   - Use application-level permissions
   - Audit database user permissions

3. **Data Retention:**
   - Implement automatic cleanup
   - Archive old data before deletion
   - Comply with data retention policies

## Future Enhancements

Potential schema improvements:

1. **Foreign Keys:**
   - Add FK constraints to product_id columns
   - Link to OpenCart core tables

2. **Partitioning:**
   - Partition activity_log by date
   - Partition api_logs by date

3. **Additional Indexes:**
   - Full-text search on product names
   - Composite indexes for complex queries

4. **Audit Tables:**
   - Track schema changes
   - Log configuration changes

## Version History

- **v1.0.0** - Initial schema implementation
  - All 6 tables created
  - Basic indexes added
  - Documentation completed
