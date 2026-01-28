# Database Schema Changelog

All notable changes to the PricePilot database schema will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-28

### Added - Initial Database Schema

#### Tables Created
- **pricepilot_activity_log** - Price change audit trail
  - Columns: log_id, product_id, product_name, old_price, new_price, changed_by, store_id, date_added
  - Indexes: log_id (PK), product_id, date_added, store_id
  - Requirements: 31.1

- **pricepilot_api_logs** - API request/response logging
  - Columns: log_id, endpoint, method, ip_address, request_data, response_code, response_time, date_added
  - Indexes: log_id (PK), date_added, ip_address, endpoint
  - Requirements: 31.2

- **pricepilot_product_mapping** - Competitor product mappings
  - Columns: mapping_id, product_id, competitor_url, competitor_name, date_added, date_modified
  - Indexes: mapping_id (PK), product_id
  - Constraints: UNIQUE(product_id, competitor_url)
  - Requirements: 31.3

- **pricepilot_webhooks** - Webhook configurations
  - Columns: webhook_id, url, events, secret, status, date_added, date_modified
  - Indexes: webhook_id (PK), status
  - Requirements: 31.4

- **pricepilot_queue** - Background job queue
  - Columns: job_id, job_type, job_data, status, progress, result, retry_count, priority, date_added, date_started, date_completed
  - Indexes: job_id (PK), status, priority, date_added
  - Requirements: 31.5

- **pricepilot_price_backups** - Price backup storage
  - Columns: backup_id, backup_data, product_count, created_by, date_added
  - Indexes: backup_id (PK), date_added
  - Requirements: 31.5

#### Installation Tools
- **install.php** - Web-based automated installer
  - Executes all SQL migrations in order
  - Provides real-time feedback
  - Verifies table creation
  - Includes security warnings

- **uninstall.php** - Web-based uninstaller
  - Two-step confirmation process
  - Shows data counts before deletion
  - Verifies table removal
  - Multiple safety warnings

#### Documentation
- **README.md** - Comprehensive installation guide
  - Table descriptions and purposes
  - Three installation methods
  - Troubleshooting guide
  - Maintenance recommendations

- **QUICK_START.md** - Quick reference guide
  - 3-step installation process
  - Verification checklist
  - Common troubleshooting

- **DATABASE_SCHEMA.md** - Technical schema documentation
  - Entity relationship diagrams
  - Query examples for each table
  - Index strategy explanation
  - Data flow diagrams

- **IMPLEMENTATION_SUMMARY.md** - Implementation details
  - Design decisions
  - Requirements traceability
  - Testing recommendations
  - Next steps

- **CHANGELOG.md** - This file
  - Version history
  - Schema changes tracking

### Technical Details

#### Database Engine
- InnoDB for all tables (ACID compliance, crash recovery)

#### Character Set
- UTF8MB4 with utf8mb4_general_ci collation (full Unicode support)

#### Data Types
- `decimal(15,4)` for prices (supports large values with 4 decimal places)
- `varchar(45)` for IP addresses (IPv4 and IPv6 support)
- `text` and `longtext` for JSON data
- `datetime` for timestamps (OpenCart standard)
- `enum` for status fields (database-level validation)

#### Index Strategy
- Primary keys on all tables
- Indexes on foreign key columns
- Indexes on frequently filtered columns (date, status, IP)
- Unique constraints to prevent duplicates
- Composite indexes for multi-column queries

#### Security Features
- IF NOT EXISTS clauses for safe re-execution
- Prepared statement support in design
- Input validation at database level (data types, constraints)
- Secure defaults (status = 1, changed_by = 'API')

### Migration Files

All migrations are numbered for sequential execution:

1. `001_create_pricepilot_activity_log.sql`
2. `002_create_pricepilot_api_logs.sql`
3. `003_create_pricepilot_product_mapping.sql`
4. `004_create_pricepilot_webhooks.sql`
5. `005_create_pricepilot_queue.sql`
6. `006_create_pricepilot_price_backups.sql`

### Compatibility

- OpenCart 3.0+
- OpenCart 4.0+
- MySQL 5.6+
- MariaDB 10.0+
- PHP 7.2+

### Known Issues

None at this time.

### Breaking Changes

None - this is the initial release.

---

## Future Versions

### [1.1.0] - Planned

#### Potential Enhancements
- Add foreign key constraints to product_id columns
- Implement table partitioning for large log tables
- Add full-text search indexes for product names
- Create audit table for schema changes
- Add compression for backup_data column

#### Potential Optimizations
- Analyze query patterns and add composite indexes
- Implement automatic archiving for old logs
- Add database-level cleanup procedures
- Optimize JSON storage format

---

## Version History

- **1.0.0** (2024-01-28) - Initial database schema implementation
  - 6 tables created
  - Installation tools provided
  - Comprehensive documentation
  - All requirements (31.1-31.5) satisfied

---

## Notes

### Upgrade Path
When upgrading from this version:
1. Backup database before applying migrations
2. Test in staging environment first
3. Run new migrations in numbered order
4. Verify all tables and indexes
5. Update application code as needed

### Rollback Procedure
To rollback this version:
1. Backup current database
2. Run uninstall.php or manually drop tables
3. Restore previous database backup
4. Clear OpenCart cache

### Data Migration
If migrating from a previous custom implementation:
1. Export existing data
2. Install new schema
3. Transform data to new format
4. Import into new tables
5. Verify data integrity

---

## Maintenance Log

### Recommended Maintenance Tasks

#### Daily
- [ ] Monitor queue for stuck jobs
- [ ] Check API logs for errors

#### Weekly
- [ ] Review activity log growth
- [ ] Clean completed queue jobs (>7 days)

#### Monthly
- [ ] Archive old activity logs (>90 days)
- [ ] Archive old API logs (>90 days)
- [ ] Clean old price backups (>30 days)
- [ ] Review storage usage

#### Quarterly
- [ ] Analyze index usage with EXPLAIN
- [ ] Optimize table structure
- [ ] Review and update documentation
- [ ] Performance testing with production data

---

## Support

For questions or issues related to the database schema:
1. Check the README.md for detailed documentation
2. Review IMPLEMENTATION_SUMMARY.md for technical details
3. Consult DATABASE_SCHEMA.md for query examples
4. Contact PricePilot support team

---

## Contributors

- PricePilot Development Team
- OpenCart Plugin Implementation Team

---

## License

This database schema is part of the PricePilot OpenCart Plugin.
See the main plugin LICENSE file for details.
