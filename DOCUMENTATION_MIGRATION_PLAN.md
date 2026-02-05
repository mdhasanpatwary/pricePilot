# Documentation Migration Plan

## Audit Summary

**Total Documents Analyzed:** 104 files

### Classification Results

- **Tenant Documents:** 24 (23%)
- **Admin Documents:** 46 (44%)
- **Both Audiences:** 34 (33%)

## Tenant Documentation (24 files)

### By Category

#### Getting Started (1)
- XSS_PREVENTION_QUICK_REFERENCE.md

#### Pricing (11)
- API_DOCUMENTATION_INDEX.md
- API_REQUEST_RESPONSE_EXAMPLES.md
- API_USAGE_EXAMPLES.md ✓
- BOT_PROTECTION_USER_GUIDE.md
- BULK_APPROVAL_OPTIMIZATION.md
- INPUT_VALIDATION_GUIDE.md
- LOGGING_GUIDELINES.md
- PRICE_APPROVAL_GUIDE.md ✓
- ROLLBACK_PROCEDURES.md
- ROLLBACK_UI_GUIDE.md ✓
- SAFE_QUERY_PATTERNS.md

#### Products (5)
- FEEDBACK_QUICK_REFERENCE.md ✓
- ROLLBACK_TESTING_GUIDE.md
- SERVICE_ERROR_HANDLING.md
- SKU_GENERATION_STRATEGY.md
- SQL_INJECTION_QUICK_REFERENCE.md

#### Troubleshooting (5)
- ACCESSIBILITY_GUIDE.md ✓
- API_DOCUMENTATION_SETUP.md
- API_VALIDATION_GUIDE.md ✓
- CACHE_WARMING_STRATEGIES.md
- TENANT_GUIDE.md

#### Competitors (1)
- XSS_PREVENTION_GUIDE.md

#### Integrations (1)
- PRICE_UPDATE_API_TESTING_GUIDE.md

## Admin Documentation (46 files)

### By Category

#### System Monitoring (34)
- ADMIN_TROUBLESHOOTING_GUIDE.md
- ALERT_ACKNOWLEDGMENT_QUICK_REFERENCE.md
- ALERT_HISTORY_TRACKING.md
- ALERT_NOTIFICATIONS.md
- ALERT_THRESHOLD_CONFIGURATION.md
- API_TOKEN_MIGRATION_GUIDE.md
- AUTO_APPROVAL_ADMIN_GUIDE.md ✓
- CACHE_ALERTING.md
- CACHE_DEPLOYMENT_CHECKLIST.md
- CACHE_INVALIDATION_PATTERNS.md
- CACHE_MONITORING.md
- CACHE_TROUBLESHOOTING.md
- DATA_CLEANUP_JOBS.md
- DEPLOYMENT_GUIDE.md
- DOCUMENTATION_INDEX.md
- MONITORING_ALERT_ACKNOWLEDGMENT.md
- MONITORING_DEPLOYMENT_CHECKLIST.md
- MONITORING_ENVIRONMENT_VARIABLES.md ✓
- MONITORING_INFRASTRUCTURE_SETUP.md
- MONITORING_README.md
- MONITORING_SYSTEM.md
- MONITORING_TROUBLESHOOTING.md
- RATE_LIMITING.md
- REDIS_CONFIGURATION.md
- REDIS_FREE_TIER_GUIDE.md
- REDIS_MEMORY_CONFIGURATION.md
- RESULT_SELECTION_LOGIC.md
- RETRY_QUEUE.md ✓
- RUNBOOK.md
- SCRAPING_LOG_MANAGEMENT.md
- SECURITY_INCIDENT_PREVENTION.md
- STEALTH_SCRAPING.md
- UPSTASH_DASHBOARD_SETUP.md
- UPTIME_MONITORING.md ✓

#### Security (5)
- ARCHITECTURE.md
- AUTHENTICATION_GUIDE.md
- CORS_CONFIGURATION.md
- ERROR_HANDLING_CLEANUP_SUMMARY.md
- SECURITY_CHECKLIST.md

#### Performance (3)
- DEPLOYMENT.md
- DISTRIBUTED_CACHE_INVALIDATION.md ✓
- PERFORMANCE_MONITORING.md ✓

#### Database (3)
- ADMIN_DASHBOARD_DEPLOYMENT.md
- DATABASE_INDEXES_QUICK_REFERENCE.md
- SQL_INJECTION_AUDIT_REPORT.md

#### Alerting (1)
- MONITORING_NOTIFICATION_SETUP.md

## Mixed Audience Documentation (34 files)

These documents serve both tenants and admins and will need to be split:

### High Confidence (33)
- ADMIN_API_REFERENCE.md
- ADMIN_DASHBOARD_ENHANCEMENT_GUIDE.md
- ADMIN_GUIDE.md
- ALERT_ACKNOWLEDGMENT_GUIDE.md
- ALERT_NOTIFICATIONS_QUICK_REFERENCE.md
- API_AUTHENTICATION.md
- API_ERROR_CODES.md
- API_MONITORING.md
- AUTHENTICATION_TROUBLESHOOTING_QUICK_REFERENCE.md
- BOT_PROTECTION_API_REFERENCE.md
- BOT_PROTECTION_CONFIGURATION_GUIDE.md
- BOT_PROTECTION_TROUBLESHOOTING_GUIDE.md
- CACHE_CONFIGURATION.md
- CACHE_QUICK_REFERENCE.md
- CORS_QUICK_REFERENCE.md
- EMAIL_NOTIFICATIONS.md
- EMAIL_NOTIFICATION_GUIDE.md
- EMAIL_NOTIFICATION_INTEGRATION_EXAMPLES.md
- ENCRYPTION_QUICK_REFERENCE.md
- ENVIRONMENT_VARIABLES.md
- ERROR_HANDLING_GUIDE.md
- GDPR_COMPLIANCE_GUIDE.md
- INPUT_SANITIZATION.md
- MIGRATION_GUIDE_V1.5.md
- MONITORING_ALERT_CONFIGURATION.md
- MONITORING_UI.md
- RETRY_LOGIC.md
- ROLLBACK_COMPLETE_SUMMARY.md
- ROLLBACK_IMPLEMENTATION_SUMMARY.md
- SECURITY_HEADERS.md
- SECURITY_HEADERS_QUICK_REFERENCE.md
- TEST_INSTANCE_SETUP_GUIDE.md
- USER_SATISFACTION_GUIDE.md

### Needs Manual Review (1)
- SITE_PROFILE_EXAMPLES.md

## Identified Gaps

### Critical Missing Documentation

1. **Getting Started Guide for Tenants**
   - Quick introduction to PricePilot
   - First-time setup walkthrough
   - Basic concepts and terminology

2. **Quick Start Guide for Tenants**
   - 5-minute setup guide
   - Minimal steps to get first results
   - Common first tasks

3. **Tenant Management Documentation (Admin)**
   - Creating and managing tenants
   - Tenant configuration
   - Tenant lifecycle management

## Migration Strategy

### Phase 1: Pure Tenant Docs (24 files)
Move to `/docs-content/tenant/` with appropriate categorization

### Phase 2: Pure Admin Docs (46 files)
Move to `/docs-content/admin/` with appropriate categorization

### Phase 3: Mixed Docs (34 files)
Split into separate tenant and admin versions:
- Extract tenant-relevant sections → `/docs-content/tenant/`
- Extract admin-relevant sections → `/docs-content/admin/`
- Create cross-references between related docs

### Phase 4: Fill Gaps
Create missing critical documentation:
- Tenant Getting Started Guide
- Tenant Quick Start Guide
- Admin Tenant Management Guide

## Category Mapping

### Tenant Categories
- `getting-started/` - Introduction, setup, basics
- `products/` - Product management, SKU, matching
- `competitors/` - Competitor tracking, scraping
- `pricing/` - Price updates, approval workflows
- `integrations/` - OpenCart, Laravel plugins
- `troubleshooting/` - FAQs, common issues

### Admin Categories
- `system-monitoring/` - Monitoring, alerts, metrics
- `tenant-management/` - Tenant operations (NEW)
- `database/` - Schema, migrations, backups
- `security/` - Auth, encryption, compliance
- `performance/` - Optimization, caching, scaling
- `alerting/` - Alert configuration, incidents

## Next Steps

1. ✅ Complete audit (DONE)
2. ⏳ Migrate tenant documentation
3. ⏳ Migrate admin documentation
4. ⏳ Split mixed-audience documentation
5. ⏳ Create missing documentation
6. ⏳ Update internal links
7. ⏳ Create redirects
8. ⏳ Validate migration

## Notes

- ✓ = High confidence classification
- ~ = Medium confidence classification
- ? = Low confidence, needs manual review
- All content will be preserved during migration
- Redirects will be created for all moved documents
- Internal links will be updated automatically
