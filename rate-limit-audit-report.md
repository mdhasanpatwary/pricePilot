# Rate Limit Coverage Audit Report

Generated: 2026-01-28T17:35:58.963Z

## Summary

- **Total API Routes**: 122
- **Protected Routes**: 119
- **Unprotected Routes**: 3
- **Coverage**: 97.54%

## Unprotected Routes

### General (3 routes)

#### `v1\auth\[...nextauth]\route.ts`

- **Methods**: 
- **Suggested Limiter**: `read`

#### `v1\cron\cleanup-expired-approvals\route.ts`

- **Methods**: GET
- **Suggested Limiter**: `read`

#### `v1\cron\global-sync\route.ts`

- **Methods**: GET
- **Suggested Limiter**: `read`

## Protected Routes

### read (70 routes)

- `v1\admin\active-sessions\route.ts` [GET]
- `v1\admin\alerts\route.ts` [GET]
- `v1\admin\analytics\challenges\route.ts` [GET]
- `v1\admin\analytics\proxies\route.ts` [GET]
- `v1\admin\analytics\sites\route.ts` [GET]
- `v1\admin\audit-search\route.ts` [GET]
- `v1\admin\backups\route.ts` [GET, POST]
- `v1\admin\backups\[filename]\route.ts` [GET, DELETE]
- `v1\admin\challenge-stats\route.ts` [GET]
- `v1\admin\encryption-metrics\route.ts` [GET]
- `v1\admin\health\route.ts` [GET]
- `v1\admin\human-simulation-config\route.ts` [GET, POST]
- `v1\admin\metrics\dashboard\route.ts` [GET]
- `v1\admin\metrics\tenant\[id]\route.ts` [GET]
- `v1\admin\proxy-health\route.ts` [GET]
- `v1\admin\queue-status\route.ts` [GET]
- `v1\admin\scheduler\route.ts` [GET, POST]
- `v1\admin\scraper-health\route.ts` [GET]
- `v1\admin\scraper-profiles\route.ts` [GET, POST]
- `v1\admin\scrapers\route.ts` [GET]
- `v1\admin\scraping-metrics\route.ts` [GET]
- `v1\admin\sessions\history\route.ts` [GET]
- `v1\admin\sessions\route.ts` [GET]
- `v1\admin\sessions\[id]\route.ts` [GET]
- `v1\admin\simulator\results\route.ts` [GET]
- `v1\admin\simulator\results\[id]\route.ts` [GET]
- `v1\admin\site-profiles\route.ts` [GET, POST]
- `v1\admin\stats\route.ts` [GET]
- `v1\admin\sync-monitor\route.ts` [GET]
- `v1\admin\system-config\route.ts` [GET, POST]
- `v1\admin\system-health\route.ts` [GET]
- `v1\admin\tenants\route.ts` [GET, PATCH, POST, DELETE]
- `v1\admin\users\route.ts` [GET, PATCH, DELETE]
- `v1\alerts\route.ts` [GET]
- `v1\analytics\challenges\route.ts` [GET]
- `v1\analytics\competitor-analysis\route.ts` [GET]
- `v1\analytics\duplicates\route.ts` [GET, POST]
- `v1\analytics\history\route.ts` [GET]
- `v1\analytics\logs\route.ts` [GET]
- `v1\analytics\price-elasticity\route.ts` [GET]
- `v1\analytics\proxies\[proxy]\route.ts` [GET]
- `v1\analytics\reports\download\route.ts` [GET]
- `v1\analytics\sites\[site]\route.ts` [GET]
- `v1\analytics\summary\route.ts` [GET]
- `v1\analytics\tech-intelligence\route.ts` [GET]
- `v1\analytics\top-failing-proxies\route.ts` [GET]
- `v1\analytics\top-failing-sites\route.ts` [GET]
- `v1\audit-logs\route.ts` [GET]
- `v1\competitors\route.ts` [GET, POST, DELETE]
- `v1\downloads\laravel\route.ts` [GET]
- `v1\downloads\opencart\route.ts` [GET]
- `v1\health\route.ts` [GET]
- `v1\integrations\route.ts` [GET, POST, DELETE]
- `v1\matching\route.ts` [GET, POST]
- `v1\notifications\route.ts` [GET, PATCH, DELETE]
- `v1\price-approvals\count\route.ts` [GET]
- `v1\price-approvals\route.ts` [GET, POST]
- `v1\products\route.ts` [GET]
- `v1\proxy-image\route.ts` [GET]
- `v1\rules\route.ts` [GET, POST, PUT, DELETE]
- `v1\tenant\alert-rules\route.ts` [GET, POST, PATCH, DELETE]
- `v1\tenant\backup\route.ts` [GET, PATCH]
- `v1\tenant\limits\route.ts` [GET]
- `v1\tenant\notification-settings\route.ts` [GET, PATCH]
- `v1\tenant\scraping-metrics\route.ts` [GET]
- `v1\tenant\site-config\route.ts` [GET]
- `v1\tenant\team\route.ts` [GET, POST, PATCH, DELETE]
- `v1\user\api-keys\route.ts` [GET, POST]
- `v1\user\notification-preferences\route.ts` [GET, PATCH]
- `v1\webhooks\route.ts` [GET, POST, DELETE]

### write (22 routes)

- `v1\admin\alerts\[id]\acknowledge\route.ts` [POST]
- `v1\admin\diagnostics\route.ts` [POST]
- `v1\admin\maintenance\route.ts` [POST]
- `v1\admin\scraper-playground\route.ts` [POST]
- `v1\admin\sessions\bulk\route.ts` [POST]
- `v1\admin\sessions\clear\route.ts` [POST]
- `v1\admin\sessions\[id]\cancel\route.ts` [POST]
- `v1\admin\sessions\[id]\pause\route.ts` [POST]
- `v1\admin\sessions\[id]\resume\route.ts` [POST]
- `v1\admin\sessions\[id]\retry\route.ts` [POST]
- `v1\admin\simulator\run\route.ts` [POST]
- `v1\admin\site-profiles\[id]\route.ts` [DELETE]
- `v1\admin\sites\[id]\route.ts` [PATCH]
- `v1\alerts\[id]\acknowledge\route.ts` [POST]
- `v1\competitors\[id]\settings\route.ts` [PUT]
- `v1\price-update\bulk\route.ts` [POST]
- `v1\pricing\evaluate\route.ts` [POST]
- `v1\products\[id]\match\route.ts` [POST]
- `v1\products\[id]\route.ts` [DELETE]
- `v1\tenant\maintenance\route.ts` [POST]
- `v1\tenant\site-config\[siteId]\route.ts` [PATCH]
- `v1\user\api-keys\[id]\route.ts` [DELETE]

### auth (11 routes)

- `v1\admin\debug\route.ts` [GET]
- `v1\admin\debug\tenant\[id]\route.ts` [GET]
- `v1\admin\verify-code\route.ts` [POST]
- `v1\auth\change-password\route.ts` [POST]
- `v1\auth\forgot-password\route.ts` [POST]
- `v1\auth\register\route.ts` [POST]
- `v1\auth\reset-password\route.ts` [POST]
- `v1\auth\verify\route.ts` [GET]
- `v1\debug\check-all-data\route.ts` [GET]
- `v1\debug\seed-my-data\route.ts` [POST]
- `v1\debug\session\route.ts` [GET]

### importExport (8 routes)

- `v1\admin\export\analytics\route.ts` [GET]
- `v1\admin\export\errors\route.ts` [GET]
- `v1\admin\export\metrics\route.ts` [GET]
- `v1\admin\export\sessions\route.ts` [GET]
- `v1\exports\competitors\route.ts` [GET]
- `v1\exports\products\route.ts` [GET]
- `v1\imports\competitors\route.ts` [POST]
- `v1\imports\products\route.ts` [POST]

### sync (5 routes)

- `v1\competitors\sync\route.ts` [POST]
- `v1\competitors\sync\stop\route.ts` [POST]
- `v1\integrations\sync\route.ts` [POST]
- `v1\integrations\sync\stop\route.ts` [POST]
- `v1\sync\full\route.ts` [POST]

### api (3 routes)

- `v1\products\bulk\rollback\route.ts` [POST]
- `v1\products\bulk\route.ts` [POST]
- `v1\tenant\sessions\route.ts` [GET, DELETE]

## Status

⚠️ **WARNING**: 3 routes need rate limiting protection.
