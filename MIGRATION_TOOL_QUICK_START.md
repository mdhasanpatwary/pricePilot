# Documentation Migration Tool - Quick Start Guide

## Overview

This tool migrates 104+ documentation files from `/docs` to the new dual-portal structure.

## Quick Start (Recommended)

### 1. Run Analysis (Already Done)

The analysis has already been completed. Review the report:

```bash
cat DOCUMENTATION_ANALYSIS_REPORT.md
```

**Results:**
- 104 documents analyzed
- 44 tenant documents
- 47 admin documents
- 13 documents for both audiences

### 2. Run Full Migration

Execute the complete migration process:

```bash
# Dry run first (safe, no changes)
npx tsx scripts/run-full-migration.ts --dry-run

# Full migration (when ready)
npx tsx scripts/run-full-migration.ts
```

This will:
1. ✅ Analyze all documents
2. ✅ Migrate files to new structure
3. ✅ Generate redirects
4. ✅ Validate links
5. ✅ Create comprehensive report

### 3. Review Reports

After migration, review the generated reports:

```bash
# Comprehensive report (start here)
cat DOCUMENTATION_MIGRATION_COMPREHENSIVE_REPORT.md

# Detailed reports
cat DOCUMENTATION_MIGRATION_REPORT.md
cat DOCUMENTATION_REDIRECT_REPORT.md
```

### 4. Fix Any Issues

If broken links are found:
- Check the comprehensive report for details
- Update links manually
- Re-run validation

### 5. Test in Development

```bash
npm run dev
```

Visit:
- http://localhost:3000/docs (tenant portal)
- http://localhost:3000/admin-docs (admin portal)

Test redirects by visiting old URLs:
- http://localhost:3000/docs/ADMIN_GUIDE

## Individual Steps (Advanced)

If you prefer to run steps separately:

### Step 1: Analyze

```bash
npx tsx scripts/analyze-documentation.ts
```

### Step 2: Migrate

```bash
npx tsx scripts/migrate-documentation.ts
```

### Step 3: Generate Redirects

```bash
npx tsx scripts/generate-redirects.ts
```

## What Gets Migrated

### Tenant Documentation (44 files)
Examples:
- TENANT_GUIDE.md → `/docs-content/tenant/user-guides/tenant-guide.md`
- PRICE_APPROVAL_GUIDE.md → `/docs-content/tenant/pricing/price-approval-guide.md`
- BOT_PROTECTION_USER_GUIDE.md → `/docs-content/tenant/products/bot-protection-user-guide.md`

### Admin Documentation (47 files)
Examples:
- ADMIN_GUIDE.md → `/docs-content/admin/tenant-management/admin-guide.md`
- ARCHITECTURE.md → `/docs-content/admin/deployment/architecture.md`
- MONITORING_SYSTEM.md → `/docs-content/admin/system-monitoring/monitoring-system.md`

### Split Documents (13 files)
These are split into both tenant and admin versions:
- API_DOCUMENTATION_INDEX.md → tenant + admin versions
- MONITORING_UI.md → tenant + admin versions

## Redirects

All old URLs are redirected to new locations:

```
/docs/ADMIN_GUIDE → /docs/tenant-management/admin-guide
/docs/ARCHITECTURE → /admin-docs/deployment/architecture
```

Redirects are stored in the database and handled by middleware.

## Safety Features

✅ **Dry Run Mode** - Test without making changes
✅ **Content Preservation** - No data loss guaranteed
✅ **Link Validation** - Identifies broken links
✅ **Error Handling** - Graceful failure with reports
✅ **Rollback Ready** - Original files remain in `/docs`

## Troubleshooting

### Low Confidence Classifications

If documents have low confidence (<70%):
1. Review the analysis report
2. Check the suggested classification
3. Manually adjust if needed

### Failed Migrations

If migrations fail:
1. Check error messages in report
2. Verify file permissions
3. Ensure target directories exist
4. Re-run migration

### Broken Links

If broken links are found:
1. Review link validation report
2. Update links in source files
3. Re-run migration

## Support

For detailed documentation, see:
- `lib/documentation/migration/README.md` - Full documentation
- `TASK_12_MIGRATION_TOOL_COMPLETE.md` - Implementation details

## Next Steps After Migration

1. ✅ Review comprehensive report
2. ✅ Fix any broken links
3. ✅ Test documentation portals
4. ✅ Verify redirects work
5. ✅ Deploy to production

## Important Notes

- Original files in `/docs` are NOT deleted (safe to keep as backup)
- Redirects are permanent (301)
- Frontmatter is added to all migrated files
- Categories are automatically assigned
- Tags are generated from content

## Ready to Migrate?

Run the full migration:

```bash
npx tsx scripts/run-full-migration.ts
```

The process takes about 30 seconds and generates detailed reports.
