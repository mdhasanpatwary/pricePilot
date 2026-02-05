# Documentation Content Structure

This directory contains the source content for PricePilot's dual documentation system.

## Directory Structure

```
docs-content/
├── tenant/           # Tenant-facing documentation
│   ├── getting-started/
│   ├── products/
│   ├── competitors/
│   ├── pricing/
│   ├── integrations/
│   └── troubleshooting/
└── admin/            # Admin-facing documentation
    ├── system-monitoring/
    ├── tenant-management/
    ├── database/
    ├── security/
    ├── performance/
    └── alerting/
```

## Documentation Types

### Tenant Documentation (`/tenant`)

User-facing documentation for PricePilot customers. Accessible at `/docs` without authentication.

**Categories:**
- **getting-started**: Introduction, quick start guides, onboarding
- **products**: Product setup, matching, management
- **competitors**: Adding competitors, scraping configuration
- **pricing**: Price updates, strategies, rules
- **integrations**: OpenCart, Laravel, and other platform integrations
- **troubleshooting**: Common issues, FAQ, support

### Admin Documentation (`/admin`)

Technical documentation for system administrators. Accessible at `/admin-docs` with admin authentication.

**Categories:**
- **system-monitoring**: Health checks, performance metrics, monitoring
- **tenant-management**: Tenant operations, user management
- **database**: Schema management, migrations, backup/restore
- **security**: Authentication, authorization, security configurations
- **performance**: Optimization, caching, scaling
- **alerting**: Alert configuration, incident response

## File Format

All documentation files use Markdown with YAML frontmatter:

```markdown
---
title: "Document Title"
description: "Brief description of the document"
category: "category-name"
subcategory: null
tags: ["tag1", "tag2", "tag3"]
author: "PricePilot Team"
lastReviewed: "2024-01-15"
relatedDocs: ["related-doc-slug", "another-doc-slug"]
---

# Document Title

Your markdown content here...
```

## Frontmatter Fields

### Required Fields

- **title** (string): The document title displayed in navigation and search
- **description** (string): Brief description for search results and metadata
- **category** (string): Must match the directory name (e.g., "getting-started")
- **tags** (array): Keywords for search and categorization
- **author** (string): Document author or team
- **lastReviewed** (string): ISO date of last review (YYYY-MM-DD)

### Optional Fields

- **subcategory** (string | null): Optional subcategory for nested organization
- **relatedDocs** (array): Slugs of related documents for cross-referencing

## File Naming Conventions

- Use lowercase with hyphens: `product-setup.md`
- Use descriptive names: `opencart-setup.md` not `setup.md`
- Keep names concise but clear
- Match the primary heading in the document

## Content Guidelines

### Writing Style

- **Tenant Docs**: User-friendly, non-technical language
- **Admin Docs**: Technical, detailed, assumes system knowledge
- Use clear headings and subheadings
- Include code examples where appropriate
- Add diagrams using Mermaid syntax

### Code Blocks

Use fenced code blocks with language specification:

\`\`\`typescript
const example = "code here";
\`\`\`

### Internal Links

Reference other docs using relative paths or slugs:

```markdown
See [Product Setup](../products/product-setup) for details.
```

### Diagrams

Use Mermaid for diagrams:

\`\`\`mermaid
graph TD
    A[Start] --> B[Process]
    B --> C[End]
\`\`\`

## Validation

Validate the documentation structure using:

```bash
npx tsx scripts/validate-docs-structure.ts
```

This checks:
- Required directories exist
- All files have valid frontmatter
- Frontmatter fields are correct types
- Categories match directory structure
- No empty content

## Adding New Documentation

### 1. Choose the Right Portal

- **Tenant**: User-facing features, guides, tutorials
- **Admin**: System administration, technical operations

### 2. Select Category

Place the file in the appropriate category directory.

### 3. Create File

```bash
# Tenant documentation
touch docs-content/tenant/category-name/new-doc.md

# Admin documentation
touch docs-content/admin/category-name/new-doc.md
```

### 4. Add Frontmatter

Copy the frontmatter template and fill in all required fields.

### 5. Write Content

Follow the content guidelines and writing style for your portal type.

### 6. Validate

Run the validation script to ensure proper formatting:

```bash
npx tsx scripts/validate-docs-structure.ts
```

### 7. Test Locally

Start the development server and verify:
- Document renders correctly
- Links work properly
- Code blocks have syntax highlighting
- Diagrams render correctly

## Updating Existing Documentation

1. Update the content
2. Update `lastReviewed` date in frontmatter
3. Add to `relatedDocs` if referencing new documents
4. Run validation script
5. Test changes locally

## Best Practices

### Content Organization

- One topic per document
- Use clear, descriptive headings
- Include table of contents for long documents
- Link to related documentation

### Maintenance

- Review documentation quarterly
- Update `lastReviewed` date when reviewing
- Remove outdated information
- Keep code examples current

### Search Optimization

- Use descriptive titles
- Include relevant keywords in tags
- Write clear descriptions
- Use headings that match search queries

### Accessibility

- Use semantic heading hierarchy (H1 → H2 → H3)
- Provide alt text for images
- Use descriptive link text
- Ensure code examples are readable

## Migration from Old Documentation

If migrating from the existing `/docs` folder:

1. **Classify**: Determine if content is tenant, admin, or both
2. **Split**: Create separate versions if content serves both audiences
3. **Update**: Add frontmatter and update formatting
4. **Validate**: Run validation script
5. **Create Redirects**: Set up redirects from old URLs

See the migration tool documentation for automated migration.

## Related Documentation

- [Dual Documentation System Design](.kiro/specs/dual-documentation-system/design.md)
- [Implementation Tasks](.kiro/specs/dual-documentation-system/tasks.md)
- [Validation Script](../scripts/validate-docs-structure.ts)

## Support

For questions about documentation structure or content:

- Review the design document
- Check existing documentation for examples
- Contact the development team
