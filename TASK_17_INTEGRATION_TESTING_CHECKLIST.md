# Task 17: Integration Testing Checklist

## Overview
This document provides a comprehensive manual testing checklist for the Dual Documentation System. Since this project follows a test-free development approach, these manual verification steps ensure all components work together correctly.

## Testing Environment Setup

Before testing, ensure:
- [ ] Database is running and accessible
- [ ] Environment variables are configured (`.env` file)
- [ ] Development server is running (`npm run dev`)
- [ ] You have both regular user and admin accounts for testing

## 1. Tenant User Flow Testing

### Access and Navigation
- [ ] Navigate to `/docs` - should load without authentication
- [ ] Verify documentation homepage displays
- [ ] Check sidebar navigation is visible and functional
- [ ] Verify breadcrumbs appear at top of pages
- [ ] Test table of contents on documentation pages
- [ ] Verify theme toggle works (light/dark mode)
- [ ] Test responsive design on mobile, tablet, desktop

### Content Display
- [ ] Open a documentation page - content renders correctly
- [ ] Verify code blocks have syntax highlighting
- [ ] Check code blocks have copy-to-clipboard buttons
- [ ] Test Mermaid diagrams render properly
- [ ] Verify internal links work correctly
- [ ] Check images and assets load properly

### Search Functionality
- [ ] Use search bar to search for "product"
- [ ] Verify search results appear
- [ ] Check results show title, excerpt, and breadcrumbs
- [ ] Verify clicking a result navigates to that page
- [ ] Test search with no results - should show suggestions
- [ ] Verify search only returns tenant documentation

### Feedback Widget
- [ ] Scroll to bottom of any documentation page
- [ ] Verify feedback widget is visible
- [ ] Submit feedback with rating and comment
- [ ] Verify feedback submission succeeds

## 2. Admin User Flow Testing

### Access Control
- [ ] Log out (if logged in)
- [ ] Navigate to `/admin-docs` - should redirect to login
- [ ] Log in as regular (non-admin) user
- [ ] Navigate to `/admin-docs` - should show 403 Forbidden
- [ ] Log in as admin user
- [ ] Navigate to `/admin-docs` - should load successfully

### Admin Portal Features
- [ ] Verify admin documentation homepage displays
- [ ] Check sidebar shows admin-specific categories
- [ ] Open an admin documentation page
- [ ] Verify content is technical/admin-focused
- [ ] Test search in admin portal
- [ ] Verify search only returns admin documentation

### Analytics Dashboard
- [ ] Navigate to admin analytics page
- [ ] Verify popular pages metrics display
- [ ] Check search analytics are shown
- [ ] Verify feedback summaries appear
- [ ] Test date range filters (if implemented)

## 3. Search Isolation Testing

### Tenant Search Isolation
- [ ] In tenant portal (`/docs`), search for "system monitoring"
- [ ] Verify NO admin documentation appears in results
- [ ] Search for "getting started"
- [ ] Verify only tenant docs appear

### Admin Search Isolation
- [ ] In admin portal (`/admin-docs`), search for "database"
- [ ] Verify NO tenant documentation appears in results
- [ ] Search for "architecture"
- [ ] Verify only admin docs appear

### Search Ranking
- [ ] Search for a term that appears in multiple docs
- [ ] Verify results with title matches rank higher
- [ ] Check results with heading matches rank in middle
- [ ] Verify content-only matches rank lower

## 4. Documentation Hook Testing

### Manual Hook Trigger
Since the hook is automated, we'll verify the components work:

- [ ] Check database for `documentation_suggestions` table
- [ ] Verify suggestion generation logic exists in code
- [ ] Review hook configuration in `lib/documentation/hook.ts`
- [ ] Check that impact analysis function works
- [ ] Verify classification logic (tenant/admin/both)

### Suggestion Review (if suggestions exist)
- [ ] Navigate to suggestions management page (if implemented)
- [ ] View pending suggestions
- [ ] Approve a suggestion
- [ ] Reject a suggestion
- [ ] Verify audit trail is maintained

## 5. Migration Tool Testing

### Pre-Migration Verification
- [ ] Check `/docs` folder has original documentation
- [ ] Count number of files in `/docs` folder
- [ ] Note any important documents

### Migration Execution
- [ ] Run migration script: `npx tsx scripts/migrate-documentation.ts`
- [ ] Review migration report output
- [ ] Verify document counts (tenant/admin/split)
- [ ] Check for any errors or warnings

### Post-Migration Verification
- [ ] Verify `/docs-content/tenant/` has tenant docs
- [ ] Verify `/docs-content/admin/` has admin docs
- [ ] Check frontmatter was added to migrated files
- [ ] Test old URLs redirect to new locations
- [ ] Verify internal links were updated
- [ ] Check no content was lost during migration

### Redirect Testing
- [ ] Try accessing old documentation URL (e.g., `/docs/ADMIN_GUIDE.md`)
- [ ] Verify 301 redirect to new location
- [ ] Check redirect preserves anchor links
- [ ] Test multiple old URLs

## 6. Version Control Testing

### Create Version
- [ ] Open any documentation page as admin
- [ ] Edit the document content
- [ ] Save changes
- [ ] Verify new version is created in database

### View History
- [ ] Navigate to version history for the document
- [ ] Verify all versions are listed
- [ ] Check timestamps and user information
- [ ] View diff between versions
- [ ] Verify changes are highlighted

### Revert Document
- [ ] Select a previous version
- [ ] Click "Revert to this version"
- [ ] Verify document content is restored
- [ ] Check that revert creates a new version entry
- [ ] Verify version history shows the revert action

## 7. Analytics Tracking Testing

### Page View Tracking
- [ ] Open a documentation page
- [ ] Check database `documentation_page_views` table
- [ ] Verify page view was recorded
- [ ] Check document ID, type, and timestamp are correct
- [ ] Verify no PII is stored (only user ID if logged in)

### Search Tracking
- [ ] Perform a search query
- [ ] Check database `documentation_searches` table
- [ ] Verify search was logged
- [ ] Check query, type, and results count
- [ ] Verify timestamp is recorded

### Feedback Tracking
- [ ] Submit feedback on a page
- [ ] Check database `documentation_feedback` table
- [ ] Verify feedback was recorded
- [ ] Check rating, comment, and document ID
- [ ] Verify user ID is stored (if logged in)

### Metrics Aggregation
- [ ] Navigate to admin analytics dashboard
- [ ] Verify popular pages calculation is correct
- [ ] Check search metrics show accurate data
- [ ] Verify bounce rates are calculated
- [ ] Test feedback summary aggregation

## 8. API Endpoints Testing

### Document Retrieval Endpoints

#### GET /api/v1/documentation/tenant/:slug
- [ ] Test with valid tenant document slug
- [ ] Verify returns document with metadata
- [ ] Check both Markdown and HTML are included
- [ ] Test without authentication (should work)
- [ ] Test with invalid slug (should return 404)

#### GET /api/v1/documentation/admin/:slug
- [ ] Test without authentication (should return 401)
- [ ] Test with non-admin user (should return 403)
- [ ] Test with admin user (should return document)
- [ ] Verify document metadata is included

#### GET /api/v1/documentation/:type
- [ ] Test listing tenant documents
- [ ] Test listing admin documents
- [ ] Test with category filter
- [ ] Test with tag filter
- [ ] Verify pagination works (page, limit)

### Search Endpoint

#### GET /api/v1/documentation/search
- [ ] Test search with query parameter
- [ ] Test with type filter (tenant/admin)
- [ ] Test with category filter
- [ ] Test with pagination
- [ ] Verify relevance scores in results
- [ ] Test empty query (should return error)

### Analytics Endpoints

#### POST /api/v1/documentation/analytics/view
- [ ] Send page view event
- [ ] Verify 200 response
- [ ] Check database record created

#### POST /api/v1/documentation/analytics/search
- [ ] Send search event
- [ ] Verify 200 response
- [ ] Check database record created

#### POST /api/v1/documentation/analytics/feedback
- [ ] Send feedback with rating
- [ ] Send feedback with rating and comment
- [ ] Verify validation (rating 1-5)
- [ ] Check database record created

#### GET /api/v1/documentation/analytics/metrics (Admin only)
- [ ] Test without authentication (should return 401)
- [ ] Test with non-admin (should return 403)
- [ ] Test with admin (should return metrics)
- [ ] Verify time range filtering works

### Rate Limiting
- [ ] Make multiple rapid requests to tenant docs
- [ ] Verify rate limit headers are present
- [ ] Test exceeding rate limit (should return 429)
- [ ] Verify rate limit resets after time period

## 9. Error Handling Testing

### Content Errors
- [ ] Try to access non-existent document
- [ ] Verify 404 error page displays
- [ ] Check error message is user-friendly
- [ ] Test with malformed slug

### Access Control Errors
- [ ] Access admin docs without authentication
- [ ] Verify redirect to login page
- [ ] Access admin docs as non-admin
- [ ] Verify 403 Forbidden page displays

### Search Errors
- [ ] Test search with very long query
- [ ] Test search with special characters
- [ ] Verify graceful error handling
- [ ] Check fallback to popular pages if search fails

### Validation Errors
- [ ] Submit feedback with invalid rating (e.g., 10)
- [ ] Verify validation error message
- [ ] Test API with missing required fields
- [ ] Check error response format

## 10. Security Testing

### Input Validation
- [ ] Test XSS in search query
- [ ] Verify output is escaped
- [ ] Test SQL injection in search
- [ ] Verify parameterized queries prevent injection

### Authentication
- [ ] Verify JWT tokens are validated
- [ ] Test with expired token
- [ ] Test with invalid token
- [ ] Verify token refresh works

### Authorization
- [ ] Verify tenant isolation (can't access other tenant's data)
- [ ] Test admin-only endpoints as regular user
- [ ] Verify proper 403 responses

### Content Security
- [ ] Check CSP headers are set
- [ ] Verify HTTPS is enforced (in production)
- [ ] Test that user-generated content is sanitized
- [ ] Verify no sensitive data in logs

## 11. Performance Testing

### Page Load Times
- [ ] Measure documentation page load time
- [ ] Target: < 1 second for initial load
- [ ] Check time to interactive
- [ ] Verify lazy loading of images

### Search Performance
- [ ] Measure search query response time
- [ ] Target: < 200ms for search results
- [ ] Test with complex queries
- [ ] Verify search index is optimized

### Database Queries
- [ ] Check for N+1 query problems
- [ ] Verify indexes are used
- [ ] Test with large result sets
- [ ] Monitor query execution times

## 12. Accessibility Testing

### Keyboard Navigation
- [ ] Navigate documentation using only keyboard
- [ ] Verify all interactive elements are reachable
- [ ] Test Tab, Shift+Tab, Enter, Escape keys
- [ ] Check focus indicators are visible

### Screen Reader
- [ ] Test with screen reader (if available)
- [ ] Verify headings are properly structured
- [ ] Check alt text on images
- [ ] Verify ARIA labels are present

### Color Contrast
- [ ] Check contrast ratios in light mode
- [ ] Check contrast ratios in dark mode
- [ ] Verify text is readable
- [ ] Test with color blindness simulator

## Test Results Summary

### Passed Tests
- Document tests passed: _____ / _____
- Search tests passed: _____ / _____
- Hook tests passed: _____ / _____
- Migration tests passed: _____ / _____
- Version control tests passed: _____ / _____
- Analytics tests passed: _____ / _____
- API tests passed: _____ / _____
- Error handling tests passed: _____ / _____
- Security tests passed: _____ / _____
- Performance tests passed: _____ / _____
- Accessibility tests passed: _____ / _____

### Issues Found
List any issues discovered during testing:

1. 
2. 
3. 

### Recommendations
List any recommendations for improvements:

1. 
2. 
3. 

## Sign-Off

- [ ] All critical tests passed
- [ ] All issues documented
- [ ] System ready for deployment

**Tested by:** ___________________  
**Date:** ___________________  
**Signature:** ___________________

---

## Quick Verification Commands

For quick verification of system components:

```bash
# Check database tables exist
npx prisma db pull

# Verify documentation files exist
ls -la docs-content/tenant/
ls -la docs-content/admin/

# Check redirects in database
npx prisma studio
# Navigate to documentationRedirect table

# Verify search index
# Run a search query in the UI and check results

# Check analytics data
# Navigate to admin analytics dashboard
```

## Automated Verification Script

While this project doesn't use automated tests, you can run this verification script to check basic functionality:

```bash
# Run the integration verification
npx tsx scripts/test-integration-complete.ts
```

Note: This script requires database connection and may need environment variables configured.
