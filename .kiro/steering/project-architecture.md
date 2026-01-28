---
inclusion: always
---

# PricePilot Project Architecture

## Project Identity
**Name:** PricePilot  
**Type:** Multi-tenant SaaS Platform  
**Objective:** E-commerce price intelligence and automated pricing management

## Core Tech Stack
- **Frontend:** Next.js
- **Backend:** Node.js
- **Database:** PostgreSQL
- **Worker/Scheduler:** Node.js cron / queue
- **Supported Platforms (v1):**
  - OpenCart (via custom module)
  - Laravel (via API / package)

## System Architecture Principles

### Security First
- NO admin credentials storage
- NO direct database access to user websites
- API token-based authentication only
- All integrations via secure REST APIs
- Audit logging for all price changes

### Scalability
- Multi-tenant architecture
- Queue-based background processing
- Efficient database indexing
- Caching strategies for competitor data
- Rate limiting for external scraping

### SaaS Best Practices
- Tenant isolation
- API-first design
- Webhook support for real-time updates
- Comprehensive audit trails
- Rollback-ready data structures

## Module Breakdown

### Frontend (Next.js)
- User dashboard
- Product matching interface
- Excel-like comparison table
- Price update panel
- Audit logs viewer
- Settings & integrations

### Backend (Node.js)
- Multi-tenant API
- User authentication
- Product synchronization
- Competitor scraping orchestration
- Price comparison engine
- Update execution engine

### Worker/Scheduler
- Scheduled competitor scraping
- Product matching jobs
- Price history tracking
- Notification delivery
- Data retention policies

## Integration Architecture

### OpenCart Module
- Installable .ocmod.zip package
- Exposes secure product APIs
- Read: GET /api/pricepilot/products
- Update: POST /api/pricepilot/products/update
- Authentication via API token

### Laravel Package
- Composer-installable package
- Service provider registration
- Route registration
- API endpoints for product CRUD
- Middleware for authentication

## Critical Features

### Product Matching Engine
Priority order:
1. SKU exact match
2. Brand + model match
3. Fuzzy title match
4. Manual override capability

### Price Comparison Logic
Status determination:
- **RED:** Competitor price < user price (action needed)
- **GREEN:** Competitor price > user price (competitive)
- **NEUTRAL:** Same price

### Price Update Options
- Fixed undercut (e.g., $50, $100, custom)
- Percentage undercut (e.g., 5%, 10%)
- Safety constraints:
  - Minimum price floor
  - Maximum discount limit
  - Update only RED items (default)
- Supports bulk and single updates

## Data Flow

1. **User Onboarding:** User connects website via API token
2. **Product Sync:** System fetches user products via API
3. **Competitor Setup:** User adds competitor URLs
4. **Scraping:** Worker crawls competitor sites
5. **Matching:** Engine matches products automatically
6. **Comparison:** System calculates price differences
7. **Report:** Excel-like table displays results
8. **Action:** User selects update strategy
9. **Execution:** System updates prices via API
10. **Audit:** All changes logged with rollback data

## Non-Negotiable Requirements

- User-friendly for non-technical users
- No direct database access to user sites
- Real-time progress feedback
- Comprehensive error handling
- Clean, maintainable codebase
- Documentation-quality UI
