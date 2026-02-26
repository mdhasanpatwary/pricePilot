---
title: "Database Schema Management"
description: "Guide to managing PricePilot database schema and migrations"
category: "database"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
subcategory: null
tags: ["database", "schema", "migrations", "prisma"]
relatedDocs: ["backup-restore", "health-checks"]
---

# Database Schema Management

Comprehensive guide to managing the PricePilot database schema.

## Schema Overview

PricePilot uses PostgreSQL with Prisma ORM for database management.

### Core Tables

```sql
-- Tenants and Users
tenants
users

-- Products and Competitors
user_products
competitor_websites
competitor_products
product_matches

-- Pricing
price_history
price_updates

-- Documentation System
documentation_documents
documentation_versions
documentation_suggestions
documentation_page_views
documentation_searches
documentation_feedback
documentation_redirects

-- Monitoring and Alerts
monitoring_metrics
alert_rules
alert_instances
alert_notifications
```

## Prisma Schema

The schema is defined in `prisma/schema.prisma`:

```prisma
model Tenant {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique
  plan      String
  status    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  users     User[]
  products  UserProduct[]
  // ... other relations
}
```

## Migrations

### Creating Migrations

```bash
# Create a new migration
npx prisma migrate dev --name add_documentation_tables

# Create migration without applying
npx prisma migrate dev --create-only
```

### Applying Migrations

```bash
# Apply pending migrations
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

### Migration Best Practices

1. **Test First**: Always test migrations on staging
2. **Backup**: Create backup before production migrations
3. **Rollback Plan**: Have rollback scripts ready
4. **Off-Peak**: Run during low-traffic periods
5. **Monitor**: Watch for performance issues

## Schema Changes

### Adding a Column

```sql
-- Migration: add_min_price_to_products
ALTER TABLE user_products
ADD COLUMN min_price DECIMAL(10,2);

-- Add index if needed
CREATE INDEX idx_user_products_min_price 
ON user_products(min_price);
```

### Adding a Table

```sql
-- Migration: create_documentation_tables
CREATE TABLE documentation_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(10) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(type, slug)
);
```

### Modifying a Column

```sql
-- Migration: change_price_precision
ALTER TABLE user_products
ALTER COLUMN current_price TYPE DECIMAL(12,4);
```

## Indexes

### Creating Indexes

```sql
-- Composite index for common queries
CREATE INDEX idx_user_products_tenant_status 
ON user_products(tenant_id, status);

-- Full-text search index
CREATE INDEX idx_docs_search 
ON documentation_documents 
USING GIN(to_tsvector('english', title || ' ' || content));
```

### Monitoring Index Usage

```sql
-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## Data Integrity

### Foreign Key Constraints

```sql
-- Add foreign key
ALTER TABLE user_products
ADD CONSTRAINT fk_user_products_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id)
ON DELETE CASCADE;
```

### Check Constraints

```sql
-- Add check constraint
ALTER TABLE user_products
ADD CONSTRAINT chk_price_positive
CHECK (current_price >= 0);
```

## Performance Optimization

### Vacuum and Analyze

```sql
-- Vacuum specific table
VACUUM ANALYZE user_products;

-- Vacuum entire database
VACUUM ANALYZE;
```

### Reindexing

```sql
-- Reindex specific index
REINDEX INDEX idx_user_products_tenant_status;

-- Reindex entire table
REINDEX TABLE user_products;
```

## Troubleshooting

### Migration Failed

```bash
# Check migration status
npx prisma migrate status

# Mark migration as applied (if manually fixed)
npx prisma migrate resolve --applied MIGRATION_NAME

# Mark migration as rolled back
npx prisma migrate resolve --rolled-back MIGRATION_NAME
```

### Schema Drift

```bash
# Check for schema drift
npx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource prisma/schema.prisma
```

## Next Steps

- Set up [Backup and Restore](backup-restore)
- Review [Performance Tuning](../performance/optimization-guide)
- Configure [Monitoring](../system-monitoring/health-checks)
