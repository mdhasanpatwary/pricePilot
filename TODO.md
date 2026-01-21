# 📋 PricePilot Roadmap & TODO

> **Last Updated:** January 2026
> **Version:** 1.0 Production
> **Status:** Core features implemented, production hardening in progress

---

## 🔴 CRITICAL - Production Readiness (P0)

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
- [ ] **Activity Log UI**: Create a dashboard page for merchants to view their organizational audit logs (currently only accessible via API).
- [ ] **Role-Based UI Hardening**: Dynamically hide/disable UI elements based on the authenticated user's role (Admin vs Editor vs Viewer).

### User Experience
- [ ] **Onboarding Flow**: Guided tour (driver.js) for first-time users with feature discovery
- [ ] **Loading States**: Skeleton loaders and progressive loading for better perceived performance
- [ ] **Error Boundaries**: React error boundaries with graceful fallback UI
- [ ] **Pagination**: Implement server-side pagination for large product lists (currently loads all)
- [ ] **Search Optimization**: Full-text search with debouncing and search result highlighting

---

## 🧹 TECHNICAL DEBT & MAINTENANCE

### Infrastructure & Security
- [ ] **Queue System**: Implement job queue (BullMQ/Bull) for async tasks (syncs, notifications, reports)
- [ ] **Architecture Diagrams**: System architecture documentation with data flow diagrams
- [ ] **Runbook**: Operations runbook for common incidents, scaling procedures, and disaster recovery

---

## 📊 KNOWN ISSUES & BUGS

### Edge Cases to Address
- [ ] **Concurrent Sync Prevention**: Race condition handling for simultaneous sync requests (partially implemented)
- [ ] **Large Dataset Handling**: Memory optimization for tenants with 10,000+ products
- [ ] **Network Failures**: Graceful degradation when external store APIs are unreachable
- [ ] **Invalid Product Data**: Handle malformed/missing product data from external stores gracefully

---

## 🎯 MVP COMPLETION CHECKLIST

- [ ] Email notifications (P1)
- [ ] Legal pages (P1)
- [ ] Database backups (P0)

---