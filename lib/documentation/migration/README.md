# Documentation Migration Tool

This module provides a comprehensive toolkit for migrating existing documentation files to the new dual-portal structure (tenant and admin documentation).

## Overview

The migration tool consists of four main components:

1. **Analyzer** - Classifies documents as tenant, admin, or both
2. **Migrator** - Moves files to new structure with frontmatter
3. **Redirect Generator** - Creates redirects for moved files
4. **Reporter** - Generates comprehensive migration reports

## Quick Start

### Full Migration (Recommended)

Run the complete migration process:

```bash
# Dry run (no changes)
npx tsx scripts/run-full-migration.ts --dry-run

# Full migration
npx tsx scripts/run-full-migration.ts
```

This will:
- Analyze all 104 documentation files
- Migrate files to new structure
- Generate redirects
- Validate links
- Create comprehensive reports

### Individual Steps

You can also run each step separately:

```bash
# 1. Analyze documents
npx tsx scripts/analyze-documentation.ts

# 2. Migrate documents
npx tsx scripts/migrate-documentation.ts

# 3. Generate redirects
npx tsx scripts/generate-redirects.ts
```

## Components

### 1. Document Analyzer

Analyzes documentation files and classifies them based on:
- Keyword matching (admin, system, deployment → admin)
- Audience indicators (user, tenant, guide → tenant)
- Technical depth (architecture, database → admin)

**Usage:**

```typescript
import { documentAnalyzer } from '@/lib/documentation/migration/analyzer';

const report = await documentAnalyzer.analyzeAllDocuments();
console.log(`Analyzed ${report.totalDocuments} documents`);
```

**Output:**
- Classification (tenant/admin/both)
- Confidence score (0-100%)
- Suggested category
- Reasoning for classification

### 2. Document Migrator

Migrates files to the new structure:
- Moves files to appropriate directories
- Splits documents classified as "both"
- Adds frontmatter metadata
- Preserves all content

**Usage:**

```typescript
import { documentMigrator } from '@/lib/documentation/migration/migrator';

const report = await documentMigrator.migrateDocuments(analyses);
console.log(`Migrated ${report.successfulMigrations} documents`);
```

**Target Structure:**
```
docs-content/
  tenant/
    getting-started/
    products/
    competitors/
    pricing/
    integrations/
    troubleshooting/
  admin/
    system-monitoring/
    tenant-management/
    database/
    security/
    performance/
    alerting/
```

### 3. Redirect Generator

Creates redirects for moved documents:
- Generates old → new path mappings
- Stores redirects in database
- Handles split documents (creates multiple redirects)
- Updates internal links

**Usage:**

```typescript
import { redirectGenerator } from '@/lib/documentation/migration/redirects';

const report = await redirectGenerator.generateRedirects(analyses, migrationResults);
console.log(`Created ${report.createdRedirects} redirects`);
```

**Redirect Format:**
```
/docs/ADMIN_GUIDE.md → /docs/getting-started/admin-guide
/docs/API_DOCUMENTATION.md → /docs/api-reference/api-documentation (tenant)
/docs/API_DOCUMENTATION.md → /admin-docs/api-reference/api-documentation (admin)
```

### 4. Migration Reporter

Generates comprehensive reports:
- Analysis summary
- Migration statistics
- Redirect summary
- Link validation
- Coverage analysis
- Gaps and issues

**Usage:**

```typescript
import { migrationReporter } from '@/lib/documentation/migration/reporter';

const report = await migrationReporter.generateComprehensiveReport(
    analysisReport,
    migrationReport,
    redirectReport
);
```

## Classification Logic

### Admin Documents

Classified as admin if they contain:
- System administration keywords (deployment, infrastructure, database)
- Technical operations (monitoring, alerting, performance)
- Security and configuration (authentication, encryption, CORS)
- High technical depth (architecture, schema, optimization)

### Tenant Documents

Classified as tenant if they contain:
- User-facing features (guide, tutorial, how-to)
- Product features (product, competitor, price, approval)
- Integrations (OpenCart, Laravel)
- User operations (dashboard, report, export)
- Low technical depth (step-by-step, UI-focused)

### Both Audiences

Classified as both if:
- Contains keywords for both audiences
- Scores are close (within 10 points)
- Contains API documentation or general overview

These documents are split into separate tenant and admin versions.

## Frontmatter Format

All migrated documents include frontmatter:

```yaml
---
title: "Document Title"
description: "Brief description of the document"
category: "getting-started"
tags: ["guide", "tutorial", "setup"]
author: "PricePilot Team"
lastReviewed: "2024-01-15"
relatedDocs: ["other-doc-slug"]
migratedFrom: "ORIGINAL_FILE.md"
---
```

## Reports Generated

### 1. Analysis Report
- Classification breakdown
- Confidence scores
- Low-confidence documents (need review)
- Documents to be split

### 2. Migration Report
- Successful/failed migrations
- Target file paths
- Error details

### 3. Redirect Report
- All redirects created
- Old → new path mappings
- Grouped by document type

### 4. Comprehensive Report
- Executive summary
- Success rate
- Link validation results
- Coverage analysis
- Gaps and issues
- Next steps

## Link Validation

The migration tool validates all internal links:
- Checks if target documents exist
- Identifies broken links
- Provides file and link details
- Suggests fixes

## Error Handling

The migration tool handles:
- Missing files
- Invalid frontmatter
- Broken links
- Database errors
- File system errors

All errors are logged and included in reports.

## Best Practices

1. **Always run dry-run first** to preview changes
2. **Review low-confidence classifications** before migration
3. **Backup existing documentation** before running migration
4. **Test redirects** in development environment
5. **Fix broken links** after migration
6. **Verify frontmatter** is complete and accurate

## Troubleshooting

### Low Confidence Classifications

If many documents have low confidence (<70%):
- Review the classification manually
- Adjust keywords in analyzer.ts if needed
- Re-run analysis

### Failed Migrations

If migrations fail:
- Check file permissions
- Verify target directories exist
- Review error messages in report
- Fix issues and re-run

### Broken Links

If broken links are found:
- Review link validation report
- Update links manually or use find/replace
- Re-run validation

## Configuration

### Custom Source/Target Directories

```typescript
const analyzer = new DocumentAnalyzer('custom-docs');
const migrator = new DocumentMigrator('custom-docs', 'custom-target');
```

### Custom Categories

Edit `CATEGORY_PATTERNS` in `analyzer.ts` to add custom categories.

## API Reference

See individual component files for detailed API documentation:
- `analyzer.ts` - Document analysis
- `migrator.ts` - File migration
- `redirects.ts` - Redirect generation
- `reporter.ts` - Report generation
