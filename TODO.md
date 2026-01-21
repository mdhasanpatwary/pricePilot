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
- [ ] **Market Intelligence Dashboard**: Historical price tracking, market share analysis, and pricing elasticity trends.
- [ ] **Scheduled Reports**: Automated email reports (daily/weekly summaries) with data export
- [ ] **Bulk Operations**: Enhanced bulk update UI with preview, validation, and rollback capability

### User Experience
- [ ] **Onboarding Flow**: Guided tour (driver.js) for first-time users with feature discovery
- [ ] **Search Optimization**: Full-text search with debouncing and search result highlighting

### Infrastructure & Security
- [ ] **Queue System**: Implement job queue (BullMQ/Bull) for async tasks (syncs, notifications, reports)
- [ ] **Runbook**: Operations runbook for common incidents, scaling procedures, and disaster recovery

## 🎯 MVP COMPLETION CHECKLIST

- [ ] Email notifications (P1)
- [ ] Legal pages (P1)
- [ ] Database backups (P0)

---