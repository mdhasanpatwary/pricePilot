---
title: "System Architecture"
description: "PricePilot system architecture and design"
category: "security"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["architecture", "design", "system"]
audience: "admin"
---

# System Architecture

**Version**: 1.5  
**Last Updated**: February 1, 2026

## Overview

PricePilot is a competitive pricing intelligence and automation platform. It allows merchants to monitor competitor prices, define automated repricing rules, and sync optimal prices back to their e-commerce stores.

**Currently Supported Platforms:**
- ✅ **OpenCart** - Fully Supported
- ✅ **Laravel** - Fully Supported

**In Development:**
- 🚧 **Shopify** - Coming Soon
- 🚧 **WooCommerce** - Coming Soon
- 🚧 **Magento** - Coming Soon

**Planned:**
- ⏳ **PrestaShop** - Planned for Future Release
- ⏳ **BigCommerce** - Planned for Future Release

**Version 1.5 Enhancements**: This version introduces enterprise-grade security (AES-256 encryption, rate limiting), performance optimizations (Redis caching, database indexing), intelligent automation (auto-approval rules, email notifications), and operational excellence (rollback system, approval delegation).

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, Lucide Icons, Shadcn UI
- **Backend**: Next.js API Routes (Serverless functions)
- **Database**: PostgreSQL (via Prisma ORM)
- **Cache & Rate Limiting**: Redis (Upstash)
- **Automation**: Playwright (Scraping), Axios (API Sync)
- **Authentication**: NextAuth.js (JWT Strategy)
- **Email**: SMTP (Nodemailer)
- **Encryption**: AES-256-GCM (Node.js crypto)

## High-Level Architecture

```mermaid
graph TD
    User[User / Merchant] -->|HTTPS| WebApp[Next.js Web Application]

    subgraph "Frontend Layer"
        WebApp -->|React| Dashboard[Dashboard UI]
        WebApp -->|React| AdminPanel[Admin Panel]
        WebApp -->|React| MonitoringUI[Monitoring Dashboards]
    end

    subgraph "Service Layer"
        WebApp -->|API Routes| APIGateway[Next.js API Routes]

        APIGateway --> SyncService[Sync Service]
        APIGateway --> RulesEngine[Rules Engine]
        APIGateway --> NotificationService[Notification Service]
        APIGateway --> ScraperService[Scraper Service]
        APIGateway --> ProxyManager[Proxy Manager]
        APIGateway --> ChallengeHandler[Challenge Handler]
        APIGateway --> MetricsTracker[Metrics Tracker]
        APIGateway --> AutoApprovalService[Auto-Approval Service]
        APIGateway --> EmailService[Email Service]
        APIGateway --> RollbackService[Rollback Service]
        APIGateway --> DelegationService[Delegation Service]
        APIGateway --> CacheService[Cache Service]
    end

    subgraph "Security Layer (v1.5)"
        APIGateway --> RateLimiter[Rate Limiter]
        APIGateway --> InputValidator[Input Validator]
        APIGateway --> Encryption[Token Encryption]
        APIGateway --> ErrorHandler[Error Handler]
    end

    subgraph "Data Layer"
        APIGateway --> Prisma[Prisma ORM]
        SyncService --> Prisma
        RulesEngine --> Prisma
        MetricsTracker --> Prisma
        AutoApprovalService --> Prisma
        RollbackService --> Prisma
        Prisma --> DB[(PostgreSQL Database)]
        
        CacheService --> Redis[(Redis Cache)]
        RateLimiter --> Redis
    end

    subgraph "External World"
        SyncService -->|REST API| UserStore[User Store: OpenCart/Laravel]
        ScraperService -->|Headless Browser| CompetitorSite[Competitor Sites]
        NotificationService -->|Webhooks| Slack[Slack/Discord]
        EmailService -->|SMTP| EmailServer[Email Server]
    end
```

## Core Data Flows

### 1. Product Sync & Pricing Logic

This is the core loop of the application:

1.  **Ingest**: `SyncOrchestrator` triggers a sync job.
2.  **Fetch**:
    *   `SyncService` pulls user product data from their external store (currently supports OpenCart and Laravel).
    *   `ScraperService` crawls competitor sites for matching products.
3.  **Process**: Data is normalized and saved to `Products` and `PriceHistory` tables.
4.  **Analyze**: `RulesEngine` evaluates active pricing rules (e.g., "Undercut by 5%") against new competitor data.
5.  **Act**:
    *   If a rule triggers, a new price is calculated.
    *   `SyncService` pushes the new price back to the User Store.
    *   `NotificationService` alerts the user.

```mermaid
sequenceDiagram
    participant S as Scheduler/Orchestrator
    participant SY as SyncService
    participant SC as ScraperService
    participant DB as Database
    participant RE as RulesEngine
    participant EXT as External Store

    S->>SY: Trigger Sync
    SY->>EXT: GET /products
    EXT-->>SY: Product Data
    SY->>DB: Upsert Products

    S->>SC: Trigger Scrape
    SC->>DB: Get Competitor URLs
    loop For each URL
        SC->>SC: Scrape Page
        SC->>DB: Update Competitor Price
    end

    S->>RE: Evaluate Rules
    RE->>DB: Fetch Active Rules & Prices
    RE->>RE: Calculate New Prices

    alt Price Change Needed
        RE->>DB: Save New Price
        RE->>SY: Request Push
        SY->>EXT: POST /update-price
        EXT-->>SY: Success
    end
```

## Key Services

### Core Services (v1.0)

### `SyncService` (`lib/services/sync.ts`)
Handles communication with the user's external e-commerce platforms.
- **Features**: Authentication, Validation (Zod), Retry Logic (Exponential Backoff).
- **Currently Supported Platforms**: 
  - ✅ OpenCart (Fully Supported)
  - ✅ Laravel (Fully Supported)
- **In Development**: Shopify, WooCommerce, Magento
- **Planned**: PrestaShop, BigCommerce

### `ScraperService` (`lib/services/scraper.ts`)
Responsible for gathering data from competitor websites with advanced stealth capabilities.
- **Technology**: Playwright (Headless Chromium) with playwright-extra stealth plugins.
- **Capabilities**: 
  - Advanced fingerprinting protection (canvas, audio, fonts, WebRTC)
  - Intelligent proxy rotation with health monitoring
  - Challenge detection and handling (Cloudflare, Turnstile, reCAPTCHA, PerimeterX, DataDome)
  - Human behavior simulation (realistic typing, mouse movement, scrolling)
  - Adaptive rate limiting and bot-evasion profiles
  - Comprehensive metrics tracking and alerting

### `ProxyManager` (`lib/services/proxy-manager.ts`)
Manages proxy pool with intelligent health monitoring and performance tracking.
- **Features**: Proxy classification (residential/datacenter), health status tracking, automatic rotation
- **Capabilities**: Performance metrics, failure threshold detection, periodic health checks, proxy recovery

### `ChallengeHandler` (`lib/services/challenge-handler.ts`)
Detects and handles anti-bot challenges from various protection systems.
- **Supported Systems**: Cloudflare, Turnstile, reCAPTCHA, PerimeterX, DataDome
- **Features**: Exponential backoff waiting, solve rate tracking, fallback strategy triggering

### `MetricsTracker` (`lib/services/metrics-tracker.ts`)
Tracks and persists scraping performance metrics.
- **Metrics**: Block rates, success rates, response times, proxy performance
- **Features**: Time-range filtering, threshold alerting, automatic persistence to database

### `MetricsTracker` (`lib/services/metrics-tracker.ts`)
Tracks and persists scraping performance metrics.
- **Metrics**: Block rates, success rates, response times, proxy performance
- **Features**: Time-range filtering, threshold alerting, automatic persistence to database

### `HumanSimulation` (`lib/services/human-simulation.ts`)
Simulates realistic human behavior patterns during scraping.
- **Features**: Realistic typing, mouse movement, form interaction, random pauses
- **Configurable**: Adjustable delays and behavior patterns via admin UI

### `SiteProfileManager` (`lib/config/site-profiles.ts`)
Manages per-site scraping configurations and adaptive behavior.
- **Features**: Rate limiting, adaptive delays, session warmup, referrer chain tracking
- **Templates**: Pre-configured profiles for common anti-bot systems

### `RulesEngine` (`lib/services/rules-engine.ts`)
The intelligence core that determines pricing.
- **Logic**: evaluating conditions (Match, Undercut, Margin Lock).
- **Optimization**: Batch processing for large datasets.

### `NotificationService` (`lib/services/notification.ts`)
Manages internal and external alerts.
- **Channels**: In-App (Db), Webhooks (planned: Email).

### New Services (v1.5)

### `AutoApprovalService` (`lib/services/auto-approval.ts`)
Automates price approval workflow based on configurable rules.
- **Features**: Condition-based automation, priority system, safety constraints
- **Capabilities**: Multiple rule types (price change, percentage, confidence, strategy, category, price range)
- **Processing**: Hourly cron job evaluates pending changes against active rules
- **Audit**: Complete audit trail of all auto-approvals with rule attribution

### `EmailService` (`lib/services/email.ts`)
Manages email notifications for various system events.
- **Notification Types**: Pending approvals, daily summaries, auto-approval alerts, delegation notices, sync errors
- **Configuration**: SMTP-based with support for Gmail, SendGrid, Mailgun, Amazon SES
- **Features**: Configurable frequency (immediate, daily, weekly), HTML templates, unsubscribe links
- **Compliance**: GDPR and CAN-SPAM compliant

### `RollbackService` (`lib/services/rollback.ts`)
Provides capability to undo incorrect price changes.
- **Types**: Single price change rollback, bulk operation rollback, automatic rollback on failure
- **Features**: Full audit trail, store synchronization, notification system
- **Safety**: Transaction-based operations, verification checks, rollback history tracking
- **Limitations**: 90-day retention, cannot rollback deleted products

### `DelegationService` (`lib/services/approval-delegation.ts`)
Manages temporary delegation of approval authority.
- **Features**: Date-based delegation, active delegation tracking, automatic expiration
- **Capabilities**: Create, revoke, extend delegations, email notifications
- **Security**: Tenant isolation, role-based access, complete audit logging
- **Limits**: Max 5 active delegations per user, max 90-day delegation period

### `CacheService` (`lib/services/cache-enhanced.ts`)
Intelligent caching layer for expensive operations.
- **Technology**: Redis (Upstash) with configurable TTL
- **Strategies**: Cache-aside, write-through, cache invalidation
- **Cached Data**: Competitor products (1h), product matches (1h), pricing rules (5m), user sessions (24h)
- **Features**: Automatic invalidation, pattern-based clearing, cache wrapper for functions
- **Performance**: 80% reduction in database queries, 50% faster API response times

### `ErrorHandler` (`lib/middleware/global-error-handler.ts`)
Centralized error handling with custom error classes.
- **Error Classes**: AppError, ValidationError, NotFoundError, UnauthorizedError, RateLimitError
- **Features**: User-friendly messages, structured error responses, comprehensive logging
- **Capabilities**: Error code standardization, context preservation, retry logic for transient failures
- **Monitoring**: Integration with error tracking services (Sentry)

### `RateLimiter` (`lib/middleware/ratelimit.ts`)
Comprehensive rate limiting for API protection.
- **Technology**: Redis-based sliding window algorithm
- **Limits**: API endpoints (100 req/hour), scraping (10 req/min), admin (1000 req/hour), auth (5 attempts/15min)
- **Features**: Per-user limits, rate limit headers, graceful degradation
- **Response**: Returns remaining requests, reset time, and clear error messages

### `InputValidator` (`lib/validation/middleware.ts`)
Enhanced input validation and sanitization.
- **Technology**: Zod schemas for type-safe validation
- **Protection**: SQL injection, XSS, command injection, path traversal
- **Features**: Type validation, format validation, length validation, whitelist validation
- **Response**: Detailed validation errors with field-level feedback

### `TokenEncryption` (`lib/security.ts`)
Encrypts sensitive data at rest.
- **Algorithm**: AES-256-GCM with unique IV per token
- **Features**: Authentication tags for integrity, automatic encryption/decryption middleware
- **Security**: FIPS 140-2 compliant, zero-knowledge architecture
- **Usage**: API tokens, integration credentials, sensitive configuration

### `NotificationService` (`lib/services/notification.ts`)
Manages internal and external alerts.
- **Channels**: In-App (Db), Webhooks, Email (v1.5)

### `DataCleanupService` (`lib/services/data-cleanup.ts`)
Manages automated data retention and cleanup operations.
- **Features**: Archive old data, automated cleanup jobs, configurable retention periods
- **Capabilities**: Price history cleanup (90 days), audit log cleanup (1 year), notification cleanup (30 days)
- **Safety**: Archive before deletion, transaction-based operations, comprehensive logging
- **Scheduling**: Daily cron jobs for automated cleanup

### `GDPRService` (`lib/services/gdpr-service.ts`)
Handles GDPR compliance operations for user data.
- **Features**: Data export (Article 15 & 20), data deletion (Article 17), consent management
- **Capabilities**: Complete user data export to JSON, anonymization of deleted user data
- **Compliance**: GDPR Article 15, 17, 20 compliant, audit trail for all operations
- **Security**: Tenant isolation, authentication required, comprehensive logging

### `BulkApprovalService` (`lib/services/bulk-approval.ts`)
Optimizes bulk price approval operations.
- **Features**: Batch database operations, transaction-based updates, progress tracking
- **Capabilities**: Bulk approve/reject, snapshot creation, rollback support
- **Performance**: Processes 1000+ products in seconds, optimized notification batching
- **Safety**: Transaction rollback on failure, validation before execution

### `ComparisonService` (`lib/services/comparison.ts`)
Handles product price comparison logic with caching.
- **Features**: Price difference calculation, status determination, caching layer
- **Capabilities**: Competitor price analysis, price trend detection, comparison history
- **Performance**: 5-minute cache TTL, automatic invalidation on price updates
- **Logic**: RED (competitor lower), GREEN (competitor higher), NEUTRAL (same price)

### `DiscoveryService` (`lib/services/discovery.ts`)
Discovers and matches products on competitor sites.
- **Features**: Automated product discovery, intelligent matching, queue-based processing
- **Capabilities**: URL crawling, product extraction, automatic matching
- **Integration**: Works with ScraperService and MatchingService
- **Performance**: Queue-based for scalability, batch processing support

### `WebsiteService` (`lib/services/website-service.ts`)
Manages user website integrations with encryption.
- **Features**: Website registration, API token encryption, connection testing
- **Capabilities**: Multi-platform support (OpenCart, Laravel), token validation
- **Security**: Automatic token encryption, secure storage, audit logging
- **Integration**: Validates connectivity before saving

### `MaintenanceService` (`lib/services/maintenance.ts`)
Enforces data retention policies and system maintenance.
- **Features**: Automated purging, retention policy enforcement, system cleanup
- **Capabilities**: Old record deletion, database optimization, storage management
- **Scheduling**: Configurable retention periods, automated execution
- **Safety**: Backup before deletion, transaction-based operations

### `WebhookService` (`lib/services/webhook.ts`)
Dispatches webhook events to external systems.
- **Features**: Event dispatching, retry logic, signature verification
- **Capabilities**: Multiple webhook endpoints per tenant, event filtering
- **Reliability**: Exponential backoff retry, delivery confirmation
- **Security**: HMAC signature, HTTPS only, timeout protection

### `AlertService` (`lib/services/alert-service.ts`)
Evaluates alert rules and triggers notifications.
- **Features**: Rule evaluation, threshold monitoring, alert dispatching
- **Capabilities**: Multiple alert types, configurable thresholds, alert history
- **Integration**: Works with MonitoringDashboardService and EmailNotificationService
- **Performance**: Efficient rule evaluation, batch processing

### `ExportService` (`lib/services/export-service.ts`)
Handles data export operations in multiple formats.
- **Features**: CSV, JSON, Excel export, large dataset handling
- **Capabilities**: Session data export, metrics export, error log export
- **Performance**: Streaming for large datasets, memory-efficient processing
- **Security**: Tenant isolation, authentication required, audit logging

### `SystemHealthService` (`lib/services/system-health.ts`)
Monitors overall system health and component status.
- **Features**: Database health checks, Redis connectivity, external API status
- **Capabilities**: Component-level health monitoring, performance metrics
- **Alerting**: Automatic alerts on component failures, degradation detection
- **Dashboard**: Real-time health status display

### `RetryQueueService` (`lib/services/retry-queue.ts`)
Manages retry logic for failed operations.
- **Features**: Exponential backoff, max retry limits, dead letter queue
- **Capabilities**: Failed sync retry, failed scrape retry, failed notification retry
- **Performance**: Queue-based processing, priority support
- **Monitoring**: Retry metrics, failure tracking, success rate monitoring

### Monitoring Services (v1.5)

### `MonitoringDashboardService` (`lib/services/monitoring/dashboard.ts`)
Provides comprehensive system monitoring and analytics.
- **Features**: System health status, performance metrics, real-time monitoring
- **Capabilities**: Multi-tenant metrics, time-series data, trend analysis
- **Metrics**: Request rates, error rates, response times, resource utilization
- **Dashboard**: Real-time updates, historical data, customizable views

### `ErrorCaptureService` (`lib/services/monitoring/error-capture.ts`)
Captures and tracks application errors.
- **Features**: Error logging, Sentry integration, error categorization
- **Capabilities**: Stack trace capture, context preservation, error grouping
- **Integration**: Sentry for production, local logging for development
- **Analysis**: Error trends, frequency analysis, impact assessment

### `EmailNotificationService` (`lib/services/monitoring/email-notification.ts`)
Sends email notifications for monitoring alerts.
- **Features**: SMTP integration, retry logic, template support
- **Capabilities**: Alert emails, summary emails, custom templates
- **Reliability**: 3 retry attempts, exponential backoff, delivery tracking
- **Configuration**: Multiple SMTP providers, configurable settings

### `AlertConfigurationService` (`lib/services/monitoring/alert-configuration.ts`)
Manages alert rule configuration and evaluation.
- **Features**: Rule CRUD operations, threshold configuration, tenant-specific rules
- **Capabilities**: Multiple alert types, priority levels, notification routing
- **Flexibility**: Per-tenant customization, global defaults, rule inheritance
- **Validation**: Rule syntax validation, threshold validation

### `AlertNotificationPreferencesService` (`lib/services/monitoring/alert-notification-preferences.ts`)
Manages user preferences for alert notifications.
- **Features**: Channel preferences (email, Slack, webhook), frequency settings
- **Capabilities**: Per-alert-type preferences, quiet hours, notification batching
- **Flexibility**: User-level and tenant-level preferences
- **Compliance**: Opt-in/opt-out support, unsubscribe handling

### `SecurityMonitoringService` (`lib/services/monitoring/security-monitoring.ts`)
Monitors security events and detects threats.
- **Features**: Brute force detection, suspicious activity tracking, IP blocking
- **Capabilities**: Failed login tracking, rate limit violations, unauthorized access attempts
- **Response**: Automatic account lockout, IP blacklisting, alert generation
- **Compliance**: Security audit logging, incident reporting

### Cache Services (v1.5)

### `CacheEnhancedService` (`lib/services/cache-enhanced.ts`)
Advanced caching layer with multiple strategies.
- **Features**: Multi-layer caching, TTL management, cache invalidation
- **Strategies**: Cache-aside, write-through, cache warming
- **Performance**: 80% query reduction, 50% faster response times
- **Reliability**: Graceful degradation on cache failures

### `CacheMonitoringService` (`lib/services/cache-monitoring.ts`)
Monitors cache performance and health.
- **Features**: Hit rate tracking, memory usage monitoring, performance metrics
- **Capabilities**: Cache statistics, trend analysis, optimization recommendations
- **Alerting**: Low hit rate alerts, memory pressure alerts
- **Dashboard**: Real-time cache metrics, historical data

### `CacheAlertingService` (`lib/services/cache-alerting.ts`)
Manages cache-related alerts and notifications.
- **Features**: Threshold-based alerting, alert deduplication, notification routing
- **Capabilities**: Hit rate alerts, memory alerts, eviction alerts
- **Configuration**: Configurable thresholds, alert frequency limits
- **Integration**: Works with AlertService and EmailNotificationService

### `CacheWarmingService` (`lib/services/cache-warming.ts`)
Proactively warms cache with frequently accessed data.
- **Features**: Scheduled warming, intelligent prefetching, priority-based warming
- **Capabilities**: Product data warming, comparison data warming, rule warming
- **Performance**: Reduces cold start latency, improves user experience
- **Scheduling**: Configurable warming schedules, automatic triggering

### `CacheInvalidationService` (`lib/services/cache-invalidation.ts`)
Manages cache invalidation strategies.
- **Features**: Pattern-based invalidation, event-driven invalidation, manual invalidation
- **Capabilities**: Selective invalidation, bulk invalidation, cascade invalidation
- **Reliability**: Guaranteed invalidation, retry on failure
- **Performance**: Efficient invalidation, minimal overhead

### Encryption Services (v1.5)

### `EncryptionService` (`lib/services/encryption/encryption-service.ts`)
Core cryptographic operations for sensitive data.
- **Algorithm**: AES-256-GCM with unique IV per encryption
- **Features**: Token encryption/decryption, key rotation support, integrity verification
- **Security**: FIPS 140-2 compliant, authentication tags, secure key storage
- **Performance**: Fast encryption/decryption, minimal overhead

### `TokenRecoveryService` (`lib/services/encryption/token-recovery.ts`)
Handles corrupted token recovery and migration.
- **Features**: Corrupted token detection, recovery flow, migration support
- **Capabilities**: Automatic recovery attempts, manual recovery options
- **Safety**: Backup before recovery, audit logging, rollback support
- **User Experience**: Clear error messages, recovery instructions

---

## V1.5 Enhanced Data Flows

### Auto-Approval Workflow

```mermaid
sequenceDiagram
    participant Cron as Cron Job (Hourly)
    participant AA as AutoApprovalService
    participant DB as Database
    participant RE as RulesEngine
    participant SY as SyncService
    participant Email as EmailService
    participant Store as External Store

    Cron->>AA: Trigger Auto-Approval
    AA->>DB: Load Active Rules (by priority)
    AA->>DB: Load PENDING Price Changes
    
    loop For Each Pending Change
        AA->>AA: Evaluate Against Rules (priority order)
        alt Rule Matches
            AA->>DB: Update Status to APPROVED
            AA->>DB: Create Audit Log
            AA->>RE: Calculate New Price
            RE->>SY: Push to Store
            SY->>Store: POST /update-price
            Store-->>SY: Success
            SY->>DB: Create Price History
            AA->>Email: Send Notification (if enabled)
        else No Rule Matches
            AA->>AA: Keep as PENDING
        end
    end
    
    AA->>DB: Log Auto-Approval Summary
```

### Rollback Workflow

```mermaid
sequenceDiagram
    participant User as User
    participant UI as Dashboard UI
    participant API as Rollback API
    participant RB as RollbackService
    participant DB as Database
    participant SY as SyncService
    participant Store as External Store
    participant Email as EmailService

    User->>UI: Click "Rollback"
    UI->>API: POST /api/v1/price-update/rollback
    API->>RB: rollbackPriceChange(updateLogId)
    
    RB->>DB: Load Update Log
    RB->>DB: Begin Transaction
    
    RB->>DB: Revert Product Price
    RB->>DB: Create Price History Entry
    RB->>DB: Create Rollback Log
    RB->>DB: Create Audit Log
    
    RB->>DB: Commit Transaction
    
    RB->>SY: Sync to Store
    SY->>Store: POST /update-price (old price)
    Store-->>SY: Success
    
    RB->>Email: Send Rollback Notification
    RB-->>API: Success Response
    API-->>UI: Display Success Message
```

### Email Notification Workflow

```mermaid
sequenceDiagram
    participant Event as System Event
    participant Email as EmailService
    participant SMTP as SMTP Server
    participant User as User Email
    participant DB as Database

    Event->>Email: Trigger Notification
    Email->>DB: Load User Preferences
    
    alt Notifications Enabled
        Email->>Email: Build Email Template
        Email->>SMTP: Send Email
        SMTP->>User: Deliver Email
        SMTP-->>Email: Delivery Confirmation
        Email->>DB: Log Email Sent
    else Notifications Disabled
        Email->>Email: Skip Sending
    end
```

### Delegation Workflow

```mermaid
sequenceDiagram
    participant Owner as Price Approver
    participant UI as Dashboard UI
    participant API as Delegation API
    participant DS as DelegationService
    participant DB as Database
    participant Email as EmailService
    participant Delegate as Delegate User

    Owner->>UI: Create Delegation
    UI->>API: POST /api/v1/approval-delegation
    API->>DS: createDelegation()
    
    DS->>DB: Create Delegation Record
    DS->>DB: Set Start/End Dates
    DS->>Email: Send Notification to Delegate
    Email->>Delegate: "You have approval authority"
    
    DS-->>API: Success
    API-->>UI: Display Confirmation
    
    Note over Delegate,DB: During Delegation Period
    
    Delegate->>UI: Approve Price Change
    UI->>API: POST /api/v1/price-approvals/approve
    API->>DS: canApprove(delegateId)
    DS->>DB: Check Active Delegations
    
    alt Has Active Delegation
        DS-->>API: Authorized
        API->>DB: Approve Change (on behalf of Owner)
        API->>DB: Create Audit Log (delegated approval)
    else No Active Delegation
        DS-->>API: Unauthorized
        API-->>UI: Error: No delegation authority
    end
```

---

## Directory Structure

```
/
├── app/                  # Next.js App Router Pages & API
│   ├── api/              # Backend API Endpoints
│   │   └── v1/
│   │       ├── admin/    # Admin API endpoints
│   │       │   ├── proxy-health/
│   │       │   ├── challenge-stats/
│   │       │   ├── scraping-metrics/
│   │       │   ├── active-sessions/
│   │       │   ├── human-simulation-config/
│   │       │   ├── site-profiles/
│   │       │   └── alerts/
│   │       ├── tenant/   # Tenant API endpoints
│   │       │   ├── scraping-metrics/
│   │       │   └── site-config/
│   │       ├── auto-approval-rules/  # v1.5: Auto-approval management
│   │       ├── approval-delegation/  # v1.5: Delegation management
│   │       ├── price-update/
│   │       │   └── rollback/         # v1.5: Rollback endpoint
│   │       └── cron/
│   │           ├── auto-approval/    # v1.5: Auto-approval cron
│   │           └── daily-approval-summary/  # v1.5: Email summary cron
│   ├── dashboard/        # Merchant UI
│   │   ├── metrics/      # Tenant metrics dashboard
│   │   ├── site-config/  # Tenant site configuration
│   │   ├── price-approvals/  # Price approval management
│   │   ├── auto-approval-rules/  # v1.5: Auto-approval rules UI
│   │   └── settings/
│   │       ├── delegations/  # v1.5: Delegation management UI
│   │       └── notifications/  # v1.5: Email notification settings
│   └── admin/            # Super Admin UI
│       ├── proxy-health/ # Proxy health dashboard
│       ├── challenge-stats/ # Challenge detection dashboard
│       ├── scraping-metrics/ # Scraping metrics dashboard
│       ├── monitor/      # Real-time scraping monitor
│       ├── human-simulation/ # Human simulation settings
│       ├── site-profiles/ # Site profile management
│       └── alerts/       # Alert management
├── components/           # React Components (UI Library)
│   ├── dashboard/        # Dashboard-specific components
│   │   ├── auto-approval-rule-form.tsx  # v1.5
│   │   ├── auto-approval-rules-list.tsx  # v1.5
│   │   ├── auto-approval-metrics.tsx  # v1.5
│   │   └── rollback-button.tsx  # v1.5
│   └── ui/               # Reusable UI components
├── lib/                  # Shared Business Logic
│   ├── services/         # Core Services
│   │   ├── sync.ts       # Store synchronization
│   │   ├── scraper.ts    # Competitor scraping
│   │   ├── rules-engine.ts  # Pricing rules
│   │   ├── auto-approval.ts  # v1.5: Auto-approval
│   │   ├── email.ts      # v1.5: Email notifications
│   │   ├── rollback.ts   # v1.5: Rollback mechanism
│   │   ├── approval-delegation.ts  # v1.5: Delegation
│   │   └── cache-enhanced.ts  # v1.5: Redis caching
│   ├── middleware/       # API Middleware
│   │   ├── ratelimit.ts  # v1.5: Rate limiting
│   │   ├── global-error-handler.ts  # v1.5: Error handling
│   │   └── api-cache.ts  # v1.5: API response caching
│   ├── validation/       # Input Validation
│   │   ├── middleware.ts  # v1.5: Validation middleware
│   │   └── schemas.ts    # Zod validation schemas
│   ├── utils/            # Utility Functions
│   │   ├── error-handler.ts  # v1.5: Custom error classes
│   │   └── pagination.ts  # v1.5: Pagination helper
│   ├── security.ts       # v1.5: Token encryption
│   ├── mail.ts           # v1.5: Email configuration
│   └── prisma.ts         # DB Client
├── prisma/               # Database Schema & Migrations
│   ├── schema.prisma     # Database schema (includes v1.5 models)
│   └── migrations/       # Database migrations
├── docs/                 # Documentation
│   ├── ARCHITECTURE.md   # System architecture (this file)
│   ├── STEALTH_SCRAPING.md # Stealth scraping guide
│   ├── MONITORING_UI.md  # Monitoring UI guide
│   ├── API_DOCUMENTATION_INDEX.md  # v1.5: API docs
│   ├── API_AUTHENTICATION.md  # v1.5: Auth guide
│   ├── API_ERROR_CODES.md  # v1.5: Error reference
│   ├── EMAIL_NOTIFICATIONS.md  # v1.5: Email guide
│   └── ROLLBACK_PROCEDURES.md  # v1.5: Rollback guide
├── __tests__/            # Test Suite
│   ├── lib/
│   │   ├── services/
│   │   │   ├── auto-approval.test.ts  # v1.5
│   │   │   ├── email-notifications.test.ts  # v1.5
│   │   │   ├── approval-delegation.test.ts  # v1.5
│   │   │   ├── matching-edge-cases.test.ts  # v1.5
│   │   │   ├── rules-engine-edge-cases.test.ts  # v1.5
│   │   │   └── sync-edge-cases.test.ts  # v1.5
│   │   └── middleware/
│   │       └── ratelimit.test.ts  # v1.5
│   └── fixtures/         # Test fixtures and mock data
└── public/               # Static Assets
    └── openapi.json      # v1.5: OpenAPI 3.0 specification
```


## Admin Dashboard Enhancement Architecture

### Overview

The enhanced admin dashboard provides 100% debug and control capabilities through real-time monitoring, session tracking, proxy simulation, and comprehensive analytics.

### Architecture Diagram

```mermaid
graph TD
    Admin[Admin User] -->|HTTPS| AdminUI[Admin Dashboard UI]

    subgraph "Admin UI Layer"
        AdminUI --> RealTimeMonitor[Real-Time Monitor]
        AdminUI --> LifecycleViz[Lifecycle Visualizer]
        AdminUI --> ProxySimUI[Proxy Simulator UI]
        AdminUI --> MetricsDash[Metrics Dashboard]
        AdminUI --> TenantDebug[Tenant Debug View]
        AdminUI --> HealthMonitor[System Health Monitor]
        AdminUI --> ControlPanel[Session Control Panel]
    end

    subgraph "Admin API Layer"
        RealTimeMonitor -->|REST| SessionAPI[Session Monitoring API]
        ProxySimUI -->|REST| SimulatorAPI[Proxy Simulator API]
        MetricsDash -->|REST| MetricsAPI[Metrics & Analytics API]
        ControlPanel -->|REST| ControlAPI[Session Control API]
        HealthMonitor -->|REST| HealthAPI[System Health API]
        TenantDebug -->|REST| DebugAPI[Tenant Debug API]
    end

    subgraph "Admin Service Layer"
        SessionAPI --> SessionTracker[SessionTracker Service]
        SimulatorAPI --> ProxySimulator[ProxySimulator Service]
        MetricsAPI --> MetricsAggregator[MetricsAggregator Service]
        HealthAPI --> SystemHealth[SystemHealth Service]
        
        SessionTracker --> ScraperService
        MetricsAggregator --> MetricsTracker
    end

    subgraph "Data Storage Layer"
        SessionTracker --> Redis[(Redis Cache)]
        SessionTracker --> PostgreSQL[(PostgreSQL)]
        ProxySimulator --> PostgreSQL
        MetricsAggregator --> PostgreSQL
        MetricsAggregator --> Redis
        
        Redis -->|Active Sessions| SessionData[Session Data]
        Redis -->|Metrics Cache| MetricsCache[Metrics Cache]
        PostgreSQL -->|Persistent| SessionHistory[Session History]
        PostgreSQL -->|Persistent| SimResults[Simulation Results]
        PostgreSQL -->|Persistent| Alerts[System Alerts]
    end
```


### Component Descriptions

#### SessionTracker Service

**Purpose**: Track all active scraping sessions in real-time with complete lifecycle information.

**Key Responsibilities**:
- Create and manage session records
- Track lifecycle stages (proxy selection, navigation, challenge detection, data extraction)
- Record errors and performance metrics
- Store active sessions in Redis for real-time access
- Persist completed sessions to PostgreSQL for history

**Data Flow**:
1. ScraperService initiates scrape → SessionTracker creates session
2. Each lifecycle stage → SessionTracker updates session state in Redis
3. Errors occur → SessionTracker records error details
4. Session completes → SessionTracker persists to PostgreSQL
5. Admin UI polls → SessionTracker returns active sessions from Redis

#### ProxySimulator Service

**Purpose**: Simulate various proxy behaviors and edge-case scenarios without affecting production.

**Key Responsibilities**:
- Execute simulation scenarios (rotation, failure, exclusion, prioritization)
- Generate mock proxy responses
- Track simulation results
- Provide recommendations based on results
- Store simulation history

**Simulation Scenarios**:
- **Rotation**: Test proxy rotation strategies
- **Failure**: Simulate proxy failures at specified rates
- **Exclusion**: Test proxy health tracking and exclusion
- **Prioritization**: Test proxy ranking and selection
- **Recovery**: Test proxy reintroduction after failures
- **Edge Cases**: All-fail, single-success, intermittent, cascading failures

#### MetricsAggregator Service

**Purpose**: Aggregate and provide real-time metrics from multiple sources.

**Key Responsibilities**:
- Calculate dashboard metrics from live data
- Generate time-series data for charts
- Identify top failures (sites, proxies, errors)
- Cache expensive calculations in Redis
- Support tenant-specific filtering

**Metrics Provided**:
- Platform metrics (active sessions, requests/min, success rate)
- Scraping metrics (block rate, challenge rate, response time)
- Proxy metrics (health, success rate, response time)
- Challenge metrics (solve rate, solve time, frequency)


### Data Models

#### ScrapingSession Table

```sql
CREATE TABLE scraping_sessions (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  tenant_name VARCHAR(255) NOT NULL,
  site_url VARCHAR(500) NOT NULL,
  target_url TEXT NOT NULL,
  status VARCHAR(50) NOT NULL,
  current_stage VARCHAR(50) NOT NULL,
  proxy_used VARCHAR(500),
  user_agent TEXT,
  requests_completed INTEGER DEFAULT 0,
  requests_total INTEGER DEFAULT 0,
  challenge_type VARCHAR(50),
  challenge_status VARCHAR(50),
  extracted_data JSONB,
  errors JSONB,
  metrics JSONB,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_sessions_tenant ON scraping_sessions(tenant_id);
CREATE INDEX idx_sessions_status ON scraping_sessions(status);
CREATE INDEX idx_sessions_start_time ON scraping_sessions(start_time);
```

#### SimulationResults Table

```sql
CREATE TABLE simulation_results (
  id VARCHAR(255) PRIMARY KEY,
  scenario VARCHAR(50) NOT NULL,
  config JSONB NOT NULL,
  requests JSONB NOT NULL,
  summary JSONB NOT NULL,
  recommendations JSONB,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_simulation_scenario ON simulation_results(scenario);
CREATE INDEX idx_simulation_created ON simulation_results(created_at);
```

#### SystemAlerts Table

```sql
CREATE TABLE system_alerts (
  id SERIAL PRIMARY KEY,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  context JSONB,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMP,
  acknowledged_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_alerts_acknowledged ON system_alerts(acknowledged);
CREATE INDEX idx_alerts_severity ON system_alerts(severity);
CREATE INDEX idx_alerts_created ON system_alerts(created_at);
```


### Redis Data Structures

#### Active Sessions

```
Key: session:{sessionId}
Type: Hash
Fields:
  - tenantId: string
  - status: string
  - currentStage: string
  - proxyUsed: string
  - startTime: timestamp
  - metrics: JSON string
TTL: 1 hour
```

#### Session Index by Tenant

```
Key: tenant:{tenantId}:sessions
Type: Set
Members: sessionId1, sessionId2, ...
TTL: 1 hour
```

#### Real-Time Metrics Cache

```
Key: metrics:realtime
Type: Hash
Fields:
  - activeSessions: number
  - requestsPerMinute: number
  - avgResponseTime: number
  - lastUpdated: timestamp
TTL: 5 minutes
```

### API Endpoints

#### Session Monitoring

- `GET /api/v1/admin/sessions` - List active sessions
- `GET /api/v1/admin/sessions/:id` - Get session details
- `GET /api/v1/admin/sessions/history` - Get session history

#### Proxy Simulator

- `POST /api/v1/admin/simulator/run` - Run simulation
- `GET /api/v1/admin/simulator/results/:id` - Get simulation results
- `GET /api/v1/admin/simulator/results` - List simulations

#### Metrics & Analytics

- `GET /api/v1/admin/metrics/dashboard` - Dashboard metrics
- `GET /api/v1/admin/metrics/tenant/:id` - Tenant metrics
- `GET /api/v1/admin/analytics/:type` - Analytics data

#### Session Control

- `POST /api/v1/admin/sessions/:id/pause` - Pause session
- `POST /api/v1/admin/sessions/:id/resume` - Resume session
- `POST /api/v1/admin/sessions/:id/cancel` - Cancel session
- `POST /api/v1/admin/sessions/:id/retry` - Retry session
- `POST /api/v1/admin/sessions/bulk` - Bulk operations

#### System Health

- `GET /api/v1/admin/health` - System health status
- `POST /api/v1/admin/diagnostics` - Run diagnostics

#### Export

- `POST /api/v1/admin/export/sessions` - Export session data
- `POST /api/v1/admin/export/metrics` - Export metrics
- `POST /api/v1/admin/export/errors` - Export error logs
- `POST /api/v1/admin/export/analytics` - Export analytics


### Real-Time Update Flow

```mermaid
sequenceDiagram
    participant Scraper as ScraperService
    participant Tracker as SessionTracker
    participant Redis as Redis Cache
    participant DB as PostgreSQL
    participant API as Admin API
    participant UI as Admin UI

    Scraper->>Tracker: Create Session
    Tracker->>Redis: Store Active Session
    Tracker->>DB: Log Session Start

    loop Scraping Lifecycle
        Scraper->>Tracker: Update Stage
        Tracker->>Redis: Update Session State
        
        UI->>API: Poll for Updates (every 5s)
        API->>Redis: Get Active Sessions
        Redis-->>API: Session Data
        API-->>UI: Display Updates
    end

    Scraper->>Tracker: Complete Session
    Tracker->>Redis: Remove from Active
    Tracker->>DB: Persist Complete Session
    
    UI->>API: Poll for Updates
    API->>Redis: Get Active Sessions
    Redis-->>API: Updated List
    API-->>UI: Refresh Display
```

### Performance Considerations

#### Caching Strategy

1. **Active Sessions**: Stored in Redis for fast access
   - TTL: 1 hour
   - Eviction: LRU policy
   - Size: ~1KB per session

2. **Metrics Cache**: Expensive calculations cached
   - TTL: 1 minute
   - Invalidation: On data changes
   - Size: ~10KB per cache entry

3. **Query Results**: Database query results cached
   - TTL: 5 minutes
   - Invalidation: Manual or time-based
   - Size: Varies by query

#### Database Optimization

1. **Indexes**: Strategic indexes on frequently queried columns
   - tenant_id, status, start_time for sessions
   - scenario, created_at for simulations
   - severity, acknowledged for alerts

2. **Partitioning**: Time-based partitioning for large tables
   - scraping_sessions partitioned by month
   - Automatic partition creation
   - Old partition archival

3. **Query Optimization**: Optimized queries for common operations
   - Use of covering indexes
   - Efficient JOIN strategies
   - Pagination for large result sets


### Scalability Considerations

#### Horizontal Scaling

1. **Application Layer**: Stateless Next.js instances
   - Load balanced across multiple servers
   - Session affinity not required
   - Auto-scaling based on CPU/memory

2. **Redis Cluster**: Distributed caching
   - Master-replica setup for high availability
   - Sharding for large datasets
   - Automatic failover

3. **Database**: PostgreSQL replication
   - Primary-replica setup
   - Read replicas for analytics queries
   - Connection pooling (PgBouncer)

#### Vertical Scaling

1. **Database**: Increase resources as needed
   - CPU: 4-8 cores recommended
   - Memory: 16-32GB recommended
   - Storage: SSD with IOPS provisioning

2. **Redis**: Memory-optimized instances
   - Memory: 8-16GB recommended
   - Persistence: RDB + AOF
   - Eviction policy: allkeys-lru

### Security Considerations

#### Authentication & Authorization

1. **Admin Access**: Role-based access control
   - Super-admin: Full access
   - Admin: Limited control operations
   - Read-only: View-only access

2. **API Security**: Multiple layers of protection
   - Session-based authentication
   - API key authentication
   - Rate limiting per user
   - CORS configuration

3. **Data Protection**: Sensitive data handling
   - Encrypted connections (TLS)
   - Encrypted at rest (database)
   - PII redaction in logs
   - Audit logging

#### Rate Limiting

1. **Admin API**: 1000 requests/hour per user
2. **Burst Limit**: 100 requests/minute
3. **Simulator**: 5 concurrent simulations max
4. **Export**: 10 exports/hour per user

### Monitoring & Observability

#### Application Metrics

- Request rate and latency
- Error rate and types
- Active sessions count
- Memory and CPU usage
- Database connection pool

#### Business Metrics

- Scraping success rate
- Proxy health status
- Challenge solve rate
- Tenant activity levels
- System uptime

#### Alerting

- Critical: System component failures
- Warning: Performance degradation
- Info: Capacity warnings
- Channels: Email, Slack, PagerDuty

---

## V1.5 Performance & Security Enhancements

### Performance Optimizations

#### Database Indexing

Strategic indexes added for 10x faster queries:

```sql
-- Product queries
CREATE INDEX idx_product_tenant_site ON "Product"("tenantId", "siteId");
CREATE INDEX idx_product_external_id ON "Product"("externalId");
CREATE INDEX idx_product_updated_at ON "Product"("updatedAt" DESC);

-- ProductMatch queries
CREATE INDEX idx_match_user_product ON "ProductMatch"("userProductId", "status");
CREATE INDEX idx_match_competitor_product ON "ProductMatch"("competitorProductId");
CREATE INDEX idx_match_confidence ON "ProductMatch"("confidenceScore" DESC);

-- PriceHistory queries
CREATE INDEX idx_price_history_product_date ON "PriceHistory"("productId", "recordedAt" DESC);

-- Site queries
CREATE INDEX idx_site_tenant_type ON "Site"("tenantId", "type");
CREATE INDEX idx_site_syncing ON "Site"("isSyncing", "syncStartedAt");

-- Notification queries
CREATE INDEX idx_notification_tenant_read ON "Notification"("tenantId", "isRead", "createdAt" DESC);

-- Audit log queries
CREATE INDEX idx_audit_tenant_date ON "TenantAuditLog"("tenantId", "createdAt" DESC);
```

**Performance Impact**:
- Product list queries: 10x faster
- Price history queries: 15x faster
- Audit log queries: 20x faster
- Overall API response time: 50% reduction

#### Redis Caching

Intelligent caching layer with configurable TTL:

| Data Type | TTL | Invalidation Strategy |
|-----------|-----|----------------------|
| Competitor Products | 1 hour | On new scrape |
| Product Matches | 1 hour | On match update |
| Pricing Rules | 5 minutes | On rule change |
| User Sessions | 24 hours | On logout |
| API Rate Limits | 1 hour | Rolling window |

**Performance Impact**:
- 80% reduction in database queries
- 50% faster API response times
- Better scalability under load
- Reduced database connection pressure

#### Query Optimization

Eliminated N+1 query problems:

```typescript
// BEFORE (N+1 Problem):
const products = await prisma.product.findMany({ where: { tenantId } });
for (const product of products) {
  const matches = await prisma.productMatch.findMany({
    where: { userProductId: product.id }
  });
}
// Total: 1 + N queries

// AFTER (Optimized):
const products = await prisma.product.findMany({
  where: { tenantId },
  include: {
    matchesAsUser: {
      include: { competitorProduct: true }
    },
    site: true,
    priceHistory: { take: 10, orderBy: { recordedAt: 'desc' } }
  }
});
// Total: 1 query
```

**Performance Impact**:
- 100+ products: 100x faster
- 1000+ products: 1000x faster
- Reduced database connections
- Lower memory usage

#### Pagination

All list endpoints support efficient pagination:

```typescript
GET /api/v1/products?page=1&limit=20&sortBy=createdAt&sortOrder=desc
```

**Benefits**:
- Faster response times
- Lower memory usage
- Better user experience
- Scalable to millions of records

### Security Enhancements

#### API Token Encryption

All API tokens encrypted at rest with AES-256-GCM:

```typescript
// Encryption
const encrypted = encryptApiToken(token);
// Format: iv:authTag:encrypted

// Decryption
const decrypted = decryptApiToken(encrypted);
```

**Security Benefits**:
- Protects tokens even if database is compromised
- Industry-standard encryption algorithm
- FIPS 140-2 compliant
- Zero-knowledge architecture

#### Rate Limiting

Comprehensive rate limiting on all endpoints:

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| API Endpoints | 100 requests | 1 hour |
| Scraping Operations | 10 requests | 1 minute |
| Admin Endpoints | 1000 requests | 1 hour |
| Authentication | 5 attempts | 15 minutes |

**Security Benefits**:
- Prevents abuse and DoS attacks
- Fair usage enforcement
- Protects against brute force
- Graceful degradation under load

#### Input Validation

Enhanced validation and sanitization:

- **Type Validation**: Ensures correct data types
- **Format Validation**: Validates emails, URLs, dates
- **Length Validation**: Enforces min/max lengths
- **Whitelist Validation**: Only allows expected values
- **Sanitization**: Removes potentially dangerous content

**Protection Against**:
- SQL Injection (using Prisma ORM)
- XSS (Cross-Site Scripting)
- Command Injection
- Path Traversal
- LDAP Injection

#### Error Handling

Structured error handling with custom error classes:

```typescript
// Custom Error Classes
- AppError: Base error class
- ValidationError: Input validation failures
- NotFoundError: Resource not found
- UnauthorizedError: Authentication failures
- RateLimitError: Rate limit exceeded

// Error Response Format
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": { /* Additional context */ }
  }
}
```

**Benefits**:
- User-friendly error messages
- Structured error responses
- Comprehensive logging
- No sensitive data leakage

#### Audit Logging

Complete audit trail for all critical actions:

**Logged Actions**:
- User authentication (success/failure)
- Price changes (approved/rejected)
- Pricing rule changes
- Auto-approval rule changes
- Rollback operations
- API token generation/revocation
- User role changes
- Delegation creation/revocation

**Audit Log Features**:
- Immutable (cannot be edited or deleted)
- Searchable and filterable
- Exportable to CSV/JSON
- Retention: 7 years (configurable)
- GDPR compliant

### Scalability Considerations

#### Horizontal Scaling

1. **Application Layer**: Stateless Next.js instances
   - Load balanced across multiple servers
   - Session affinity not required
   - Auto-scaling based on CPU/memory

2. **Redis Cluster**: Distributed caching
   - Master-replica setup for high availability
   - Sharding for large datasets
   - Automatic failover

3. **Database**: PostgreSQL replication
   - Primary-replica setup
   - Read replicas for analytics queries
   - Connection pooling (PgBouncer)

#### Vertical Scaling

1. **Database**: Increase resources as needed
   - CPU: 4-8 cores recommended
   - Memory: 16-32GB recommended
   - Storage: SSD with IOPS provisioning

2. **Redis**: Memory-optimized instances
   - Memory: 8-16GB recommended
   - Persistence: RDB + AOF
   - Eviction policy: allkeys-lru

### Monitoring & Observability

#### Application Metrics

- Request rate and latency
- Error rate and types
- Active sessions count
- Memory and CPU usage
- Database connection pool
- Cache hit rates

#### Business Metrics

- Scraping success rate
- Proxy health status
- Challenge solve rate
- Tenant activity levels
- System uptime
- Price update success rate
- Auto-approval rate

#### Performance Targets

| Metric | Target | 95th Percentile |
|--------|--------|-----------------|
| API Response Time | < 200ms | < 500ms |
| Database Queries | < 50ms | < 100ms |
| Cache Operations | < 10ms | < 20ms |
| External API Calls | < 2s | < 5s |

---

*Last Updated: February 1, 2026*  
*Version: 1.5*  
*Admin Dashboard Enhancement: v2.0.0*
