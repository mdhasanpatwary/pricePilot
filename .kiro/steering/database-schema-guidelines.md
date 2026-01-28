---
inclusion: always
---

# Database Schema Guidelines

## Database: PostgreSQL

## Schema Design Principles

### Multi-Tenancy
- All tables must include `tenantId` for isolation
- Row-level security policies where applicable
- Indexes on tenant columns for performance

### Audit Trail
- Track created/updated timestamps
- Store user who made changes
- Maintain history for critical data (prices, updates)

### Data Integrity
- Foreign key constraints
- NOT NULL where appropriate
- Check constraints for business rules
- Unique constraints for natural keys

## Core Tables Structure

### Users & Tenants
```
tenants
- id (PK)
- name
- slug (unique)
- plan
- status
- createdAt
- updatedAt

users
- id (PK)
- tenantId (FK)
- email (unique)
- name
- role
- status
- createdAt
- updatedAt
```

### User Website Integration
```
user_websites
- id (PK)
- tenantId (FK)
- platform (opencart, laravel)
- baseUrl
- apiToken (encrypted)
- status
- lastSyncAt
- createdAt
- updatedAt
```

### Products
```
user_products
- id (PK)
- tenantId (FK)
- websiteId (FK)
- externalId (platform product ID)
- sku
- name
- brand
- model
- currentPrice
- minPrice (safety constraint)
- status
- lastSyncAt
- createdAt
- updatedAt

competitor_websites
- id (PK)
- tenantId (FK)
- name
- baseUrl
- status
- lastScrapedAt
- createdAt
- updatedAt

competitor_products
- id (PK)
- tenantId (FK)
- competitorWebsiteId (FK)
- url
- sku
- name
- brand
- model
- currentPrice
- lastScrapedAt
- createdAt
- updatedAt
```

### Product Matching
```
product_matches
- id (PK)
- tenantId (FK)
- userProductId (FK)
- competitorProductId (FK)
- matchType (sku, brand_model, fuzzy, manual)
- confidence (0-100)
- status (active, rejected)
- createdBy (userId)
- createdAt
- updatedAt
```

### Price History
```
price_history
- id (PK)
- tenantId (FK)
- productId (FK)
- productType (user, competitor)
- price
- recordedAt
- createdAt
```

### Price Updates
```
price_updates
- id (PK)
- tenantId (FK)
- userProductId (FK)
- oldPrice
- newPrice
- updateStrategy (fixed, percentage)
- updateValue
- status (pending, success, failed)
- executedBy (userId)
- executedAt
- errorMessage
- createdAt
- updatedAt
```

### Audit Logs
```
audit_logs
- id (PK)
- tenantId (FK)
- userId (FK)
- action
- entityType
- entityId
- oldValue (JSON)
- newValue (JSON)
- ipAddress
- userAgent
- createdAt
```

## Indexing Strategy

### Performance Indexes
- tenantId on all tables
- Foreign keys
- Frequently queried columns (status, createdAt)
- Composite indexes for common queries

### Example Indexes
```sql
CREATE INDEX idx_user_products_tenant_status ON user_products(tenantId, status);
CREATE INDEX idx_competitor_products_tenant_website ON competitor_products(tenantId, competitorWebsiteId);
CREATE INDEX idx_product_matches_user_product ON product_matches(userProductId);
CREATE INDEX idx_price_history_product_recorded ON price_history(productId, recordedAt DESC);
```

## Data Retention

### Hot Data (Fast Access)
- Current prices
- Active products
- Recent updates (30 days)

### Warm Data (Archived)
- Price history (older than 30 days)
- Completed updates (older than 90 days)

### Cold Data (Long-term Storage)
- Audit logs (older than 1 year)
- Deleted products (soft delete)

## Security Considerations

### Sensitive Data
- Encrypt API tokens at rest
- Hash passwords with bcrypt
- Use environment variables for secrets
- Never log sensitive data

### Access Control
- Row-level security by tenantId
- API authentication required
- Rate limiting on endpoints
- Input validation on all writes

## Migration Strategy

### Version Control
- Use Prisma migrations
- Sequential migration files
- Rollback scripts for each migration
- Test migrations on staging first

### Data Migration
- Backup before migration
- Run migrations during low-traffic periods
- Verify data integrity after migration
- Monitor performance post-migration
