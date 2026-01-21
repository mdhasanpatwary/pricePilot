# 📋 PricePilot Roadmap & TODO

> **Last Updated:** January 2026
> **Version:** 1.0 Production
> **Status:** Core features implemented, production hardening in progress

---

## 🔴 CRITICAL - Production Readiness (P0)

### Security & Compliance
- [x] **Session Management**: Add session timeout, concurrent session limits, and device management
  - ✅ Configured 24h session timeout and 1h refresh policy
  - ✅ Enforced 5 concurrent session limit with auto-revocation of oldest
  - ✅ Implemented Session Revocation API and revoked check in JWT
  - ✅ Added "Active Sessions" UI to Dashboard Settings for device management
- [x] **Email Verification**: Token generation, mock email service, and login enforcement
- [x] **Password Reset Flow**: Secure token-based reset with history & anti-enumeration
- [x] **Role-Based Access Control (RBAC)**: Team management (Admin, Editor, Viewer) for tenants
- [x] **Super Admin Management**: Universal Users Dashboard to monitor & manage every account on the platform
  - ✅ Cross-tenant user list with real-time session tracking
  - ✅ Remote password resets and role modifications
  - ✅ Bulk account auditing and termination capabilities

### Data Protection & Reliability
- [ ] **Database Backups**: Automated daily backups with point-in-time recovery capability
- [ ] **Data Retention Policies**: Implement data archival and deletion policies (GDPR compliance)
- [ ] **Transaction Safety**: Add retry logic and idempotency keys for critical operations

---

## 🟠 HIGH PRIORITY - Feature Completeness (P1)

### Core Features
- [ ] **Alert Center**: Email and Slack/webhook notifications for competitor price changes. Set custom thresholds and frequency.
- [ ] **Match Approval Workflow**: UI to review, approve, or reject automated product matches with side-by-side verification.
- [ ] **Market Intelligence Dashboard**: Historical price tracking, market share analysis, and pricing elasticity trends.
- [ ] **Notification Center**: In-app notification system for sync status, rule executions, errors
- [ ] **Scheduled Reports**: Automated email reports (daily/weekly summaries) with data export
- [ ] **Bulk Operations**: Enhanced bulk update UI with preview, validation, and rollback capability
- [x] **Tenant Activity Audit**: Track internal actions (rule changes, product deletions) for accountability (Recorded for every action).

### User Experience
- [ ] **Onboarding Flow**: Guided tour (driver.js) for first-time users with feature discovery
- [ ] **Loading States**: Skeleton loaders and progressive loading for better perceived performance
- [ ] **Error Boundaries**: React error boundaries with graceful fallback UI
- [ ] **Pagination**: Implement server-side pagination for large product lists (currently loads all)
- [ ] **Search Optimization**: Full-text search with debouncing and search result highlighting

---

## 🧹 TECHNICAL DEBT & MAINTENANCE

### Infrastructure & Security
- [x] **Email Verification**: Implemented token-based flow & mock service
- [x] **Universal RBAC**: Multi-role support (Admin/Editor/Viewer) across all layers
- [x] **Advanced Session Tracking**: Real-time device monitoring for Super Admins
- [ ] **Queue System**: Implement job queue (BullMQ/Bull) for async tasks (syncs, notifications, reports)
- [ ] **Architecture Diagrams**: System architecture documentation with data flow diagrams
- [ ] **Runbook**: Operations runbook for common incidents, scaling procedures, and disaster recovery

---

## 📊 KNOWN ISSUES & BUGS

### Current Bugs
- [ ] **Sync Restart Issue**: Fixed - competitor sync auto-restart after completion (RESOLVED)
- [ ] **Database Cascade**: Fixed - cascade delete rules for related data (RESOLVED)

---

## 🎯 MVP COMPLETION CHECKLIST

- [x] RBAC & Advanced Session Management (P0)
- [x] Super Admin Universal User Control (P0)
- [x] Security Hardening (P0)
- [ ] Email notifications (P1)
- [ ] Legal pages (P1)
- [ ] Database backups (P0)

---