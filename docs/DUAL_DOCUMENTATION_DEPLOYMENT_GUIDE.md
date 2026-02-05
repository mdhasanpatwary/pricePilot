# Dual Documentation System - Deployment Guide

## Prerequisites

### System Requirements
- Node.js 18+ or 20+
- PostgreSQL 14+
- Redis (optional, for caching)
- Git
- npm or yarn

### Access Requirements
- Database credentials
- Admin user account
- Deployment platform access (Vercel, AWS, etc.)

## Installation Steps

### 1. Clone Repository

```bash
git clone <repository-url>
cd pricepilot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create `.env` file in project root:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/pricepilot"

# Authentication
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Redis (optional)
REDIS_URL="redis://localhost:6379"

# Rate Limiting
RATE_LIMIT_ENABLED=true

# Search Configuration
SEARCH_CACHE_TTL=300
SEARCH_INDEX_UPDATE_INTERVAL=60

# Analytics
ANALYTICS_ENABLED=true
ANALYTICS_RETENTION_DAYS=90

# Documentation
DOCS_CONTENT_PATH="./docs-content"
DOCS_CACHE_ENABLED=true
```

### 4. Database Setup

#### Run Migrations

```bash
npx prisma migrate deploy
```

#### Verify Schema

```bash
npx prisma db pull
npx prisma generate
```

#### Seed Initial Data (Optional)

```bash
npm run seed
```


### 5. Migrate Existing Documentation

If you have existing documentation in `/docs` folder:

```bash
# Run migration tool
npm run migrate:docs

# This will:
# - Analyze existing documentation
# - Classify as tenant/admin/both
# - Move to appropriate directories
# - Create redirects
# - Update internal links
# - Generate migration report
```

Review the migration report:

```bash
cat docs-migration-report.json
```

### 6. Index Documentation for Search

```bash
# Index all documentation
npm run index:docs

# Or index specific type
npm run index:docs -- --type tenant
npm run index:docs -- --type admin
```

### 7. Build Application

```bash
npm run build
```

### 8. Start Application

#### Development Mode

```bash
npm run dev
```

Access at: http://localhost:3000

#### Production Mode

```bash
npm run start
```

## Deployment Platforms

### Vercel Deployment

#### 1. Install Vercel CLI

```bash
npm install -g vercel
```

#### 2. Login to Vercel

```bash
vercel login
```

#### 3. Configure Project

```bash
vercel
```

Follow prompts to configure project.

#### 4. Set Environment Variables

```bash
vercel env add DATABASE_URL
vercel env add NEXTAUTH_SECRET
vercel env add NEXTAUTH_URL
# Add other environment variables
```

#### 5. Deploy

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

#### 6. Configure Custom Domain (Optional)

```bash
vercel domains add yourdomain.com
```

### Docker Deployment

#### 1. Create Dockerfile

```dockerfile
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Build application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/docs-content ./docs-content

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

#### 2. Create docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/pricepilot
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
    depends_on:
      - db
      - redis

  db:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=pricepilot
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

#### 3. Build and Run

```bash
# Build image
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```


### AWS Deployment

#### 1. Setup RDS PostgreSQL

```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier pricepilot-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username admin \
  --master-user-password <password> \
  --allocated-storage 20

# Get connection string
aws rds describe-db-instances \
  --db-instance-identifier pricepilot-db \
  --query 'DBInstances[0].Endpoint'
```

#### 2. Setup ElastiCache Redis (Optional)

```bash
# Create Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id pricepilot-cache \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1
```

#### 3. Deploy to Elastic Beanstalk

```bash
# Initialize EB
eb init -p node.js pricepilot

# Create environment
eb create pricepilot-prod

# Set environment variables
eb setenv DATABASE_URL=<rds-url> \
  NEXTAUTH_SECRET=<secret> \
  REDIS_URL=<redis-url>

# Deploy
eb deploy
```

#### 4. Configure Load Balancer

```bash
# Enable HTTPS
eb ssl enable --certificate-arn <cert-arn>

# Configure health check
eb config
```

## Post-Deployment Configuration

### 1. Create Admin User

```bash
# Connect to database
psql $DATABASE_URL

# Create admin user
INSERT INTO users (id, email, name, role, status)
VALUES (
  gen_random_uuid(),
  'admin@pricepilot.com',
  'Admin User',
  'admin',
  'active'
);
```

### 2. Verify Documentation Access

```bash
# Test tenant portal
curl https://yourdomain.com/docs

# Test admin portal (should redirect to login)
curl https://yourdomain.com/admin-docs

# Test API
curl https://yourdomain.com/api/v1/documentation/tenant
```

### 3. Configure Monitoring

#### Setup Health Checks

```bash
# Add health check endpoint
curl https://yourdomain.com/api/health
```

#### Configure Alerts

Set up alerts for:
- High error rates (> 5%)
- Slow response times (> 1s)
- Database connection failures
- High memory usage (> 80%)

### 4. Setup Backups

#### Database Backups

```bash
# Automated daily backups
# Configure in your database provider

# Manual backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

#### Content Backups

```bash
# Backup documentation content
tar -czf docs-content-$(date +%Y%m%d).tar.gz docs-content/

# Push to Git
git add docs-content/
git commit -m "Backup documentation content"
git push
```

### 5. Configure CDN (Optional)

#### Cloudflare Setup

1. Add domain to Cloudflare
2. Update DNS records
3. Enable caching rules:
   - Cache static assets (images, CSS, JS)
   - Cache documentation pages (5 minutes)
   - Bypass cache for API endpoints

#### AWS CloudFront Setup

```bash
# Create distribution
aws cloudfront create-distribution \
  --origin-domain-name yourdomain.com \
  --default-cache-behavior \
    "ViewerProtocolPolicy=redirect-to-https"
```


## Verification Checklist

After deployment, verify the following:

### Functionality Checks

- [ ] Tenant portal accessible at `/docs`
- [ ] Admin portal requires authentication
- [ ] Search works in both portals
- [ ] Search results are isolated (tenant vs admin)
- [ ] Code blocks have syntax highlighting
- [ ] Mermaid diagrams render correctly
- [ ] Internal links work
- [ ] Feedback widget functional
- [ ] Analytics tracking works
- [ ] Version history accessible (admin)
- [ ] Documentation suggestions system works

### Performance Checks

- [ ] Page load time < 1 second
- [ ] Search response time < 200ms
- [ ] API response time < 100ms
- [ ] No console errors
- [ ] No broken images
- [ ] Mobile responsive

### Security Checks

- [ ] Admin portal requires authentication
- [ ] Non-admin users get 403 on admin portal
- [ ] Rate limiting works
- [ ] HTTPS enabled
- [ ] CSP headers configured
- [ ] No sensitive data in logs
- [ ] API tokens encrypted

### Database Checks

- [ ] All migrations applied
- [ ] Indexes created
- [ ] Full-text search working
- [ ] Backups configured
- [ ] Connection pooling enabled

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

**Symptom:** Cannot connect to database

**Solution:**
```bash
# Check DATABASE_URL format
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check firewall rules
# Ensure application can reach database
```

#### 2. Search Not Working

**Symptom:** Search returns no results

**Solution:**
```bash
# Reindex documentation
npm run index:docs

# Check search index
psql $DATABASE_URL -c "
  SELECT COUNT(*) FROM documentation_documents 
  WHERE to_tsvector('english', title || ' ' || content) IS NOT NULL
"
```

#### 3. Slow Page Loads

**Symptom:** Pages take > 2 seconds to load

**Solution:**
```bash
# Enable caching
export DOCS_CACHE_ENABLED=true

# Check database query performance
# Review slow query logs

# Enable Redis caching
export REDIS_URL=<redis-url>
```

#### 4. Migration Errors

**Symptom:** Documentation migration fails

**Solution:**
```bash
# Check file permissions
ls -la docs-content/

# Validate Markdown files
npm run validate:docs

# Run migration with verbose logging
npm run migrate:docs -- --verbose
```

#### 5. Authentication Issues

**Symptom:** Cannot access admin portal

**Solution:**
```bash
# Check NEXTAUTH_SECRET is set
echo $NEXTAUTH_SECRET

# Verify user role in database
psql $DATABASE_URL -c "
  SELECT id, email, role FROM users WHERE email = 'admin@example.com'
"

# Update user role if needed
psql $DATABASE_URL -c "
  UPDATE users SET role = 'admin' WHERE email = 'admin@example.com'
"
```


## Maintenance

### Regular Tasks

#### Daily
```bash
# Check error logs
npm run logs:errors

# Monitor performance
npm run monitor:performance

# Check search index health
npm run check:search-index
```

#### Weekly
```bash
# Review documentation suggestions
# Access admin portal → Documentation Suggestions

# Update popular pages
# Review analytics dashboard

# Check for broken links
npm run validate:links
```

#### Monthly
```bash
# Database maintenance
psql $DATABASE_URL -c "VACUUM ANALYZE"

# Review and archive old analytics
npm run archive:analytics

# Update dependencies
npm update
npm audit fix

# Review and update documentation
# Check for outdated content
```

### Scaling

#### Horizontal Scaling

When traffic increases:

1. **Add more instances**
   ```bash
   # Vercel: Automatic scaling
   # AWS: Increase instance count
   # Docker: Scale with docker-compose
   docker-compose up -d --scale app=3
   ```

2. **Add database read replicas**
   ```bash
   # Configure read replicas in DATABASE_URL
   DATABASE_READ_URL=postgresql://...
   ```

3. **Enable CDN caching**
   - Cache static assets
   - Cache documentation pages
   - Purge cache on updates

#### Vertical Scaling

When performance degrades:

1. **Upgrade database**
   - Increase CPU/memory
   - Add more storage
   - Enable connection pooling

2. **Optimize queries**
   ```bash
   # Analyze slow queries
   npm run analyze:queries
   
   # Add missing indexes
   npm run optimize:indexes
   ```

3. **Enable Redis caching**
   ```bash
   # Cache search results
   # Cache popular pages
   # Cache API responses
   ```

### Backup and Recovery

#### Backup Strategy

```bash
# Automated daily backups
0 2 * * * /usr/local/bin/backup-database.sh
0 3 * * * /usr/local/bin/backup-content.sh

# Retention: 30 days
# Storage: S3 or equivalent
```

#### Recovery Procedure

```bash
# 1. Stop application
docker-compose down

# 2. Restore database
psql $DATABASE_URL < backup-20240205.sql

# 3. Restore content
tar -xzf docs-content-20240205.tar.gz

# 4. Reindex search
npm run index:docs

# 5. Start application
docker-compose up -d

# 6. Verify
curl https://yourdomain.com/api/health
```

### Monitoring and Alerts

#### Metrics to Monitor

- Request rate
- Response time (p50, p95, p99)
- Error rate
- Database connections
- Memory usage
- CPU usage
- Disk usage
- Cache hit rate

#### Alert Thresholds

- Error rate > 5%
- Response time p95 > 1s
- Database connections > 80%
- Memory usage > 80%
- Disk usage > 85%

#### Monitoring Tools

- **Application:** Sentry, New Relic, Datadog
- **Infrastructure:** CloudWatch, Prometheus, Grafana
- **Logs:** ELK Stack, Splunk, Papertrail

## Security Hardening

### Production Security Checklist

- [ ] HTTPS enabled with valid certificate
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] Rate limiting enabled
- [ ] API tokens encrypted at rest
- [ ] Database credentials secured
- [ ] Environment variables not committed to Git
- [ ] Admin access restricted by IP (optional)
- [ ] Regular security updates applied
- [ ] Audit logging enabled
- [ ] Backup encryption enabled

### Security Updates

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Update dependencies
npm update

# Review security advisories
npm audit --json | jq '.advisories'
```

## Support and Resources

### Documentation
- API Reference: `/docs/DUAL_DOCUMENTATION_API_REFERENCE.md`
- Architecture: `/docs/DUAL_DOCUMENTATION_ARCHITECTURE.md`
- User Guides: `/docs/DUAL_DOCUMENTATION_USER_GUIDES.md`

### Getting Help
- GitHub Issues: <repository-url>/issues
- Email Support: support@pricepilot.com
- Documentation: https://docs.pricepilot.com

### Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Database
npm run db:migrate       # Run migrations
npm run db:seed          # Seed database
npm run db:reset         # Reset database

# Documentation
npm run migrate:docs     # Migrate existing docs
npm run index:docs       # Index documentation
npm run validate:docs    # Validate documentation
npm run validate:links   # Check for broken links

# Maintenance
npm run logs:errors      # View error logs
npm run monitor:performance  # Monitor performance
npm run archive:analytics    # Archive old analytics
npm run optimize:indexes     # Optimize database indexes
```

## Rollback Procedure

If deployment fails or issues arise:

```bash
# 1. Identify last working version
git log --oneline

# 2. Revert to previous version
git revert <commit-hash>

# 3. Rebuild and deploy
npm run build
vercel --prod

# 4. Verify rollback
curl https://yourdomain.com/api/health

# 5. Investigate issue
# Review logs and error reports
# Fix issue in development
# Test thoroughly before redeploying
```

## Conclusion

The Dual Documentation System is now deployed and ready for use. Regular maintenance and monitoring will ensure optimal performance and reliability.

For questions or issues, refer to the troubleshooting section or contact support.
