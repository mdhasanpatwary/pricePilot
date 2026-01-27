# Admin Page Consolidation - Test Plan

## Test Objectives
Verify that the consolidated admin pages maintain all functionality while providing improved navigation and user experience.

## Test Scenarios

### 1. Monitoring Hub Tests

#### 1.1 Direct Access
- [ ] Navigate to `/admin/monitoring`
- [ ] Verify page loads with "Live Monitor" tab active by default
- [ ] Verify page title shows "Monitoring Hub"
- [ ] Verify all 4 tabs are visible: Live Monitor, System Health, Debug Center, Diagnostics

#### 1.2 Tab Navigation
- [ ] Click on "System Health" tab
- [ ] Verify SystemHealthMonitor component loads
- [ ] Click on "Debug Center" tab
- [ ] Verify DebugCenterContent component loads
- [ ] Click on "Diagnostics" tab
- [ ] Verify DiagnosticsContent component loads
- [ ] Click back to "Live Monitor" tab
- [ ] Verify RealTimeMonitor component loads

#### 1.3 URL Parameter Navigation
- [ ] Navigate to `/admin/monitoring?tab=health`
- [ ] Verify "System Health" tab is active
- [ ] Navigate to `/admin/monitoring?tab=debug`
- [ ] Verify "Debug Center" tab is active
- [ ] Navigate to `/admin/monitoring?tab=diagnostics`
- [ ] Verify "Diagnostics" tab is active

#### 1.4 Redirect Tests
- [ ] Navigate to `/admin/monitor`
- [ ] Verify redirect to `/admin/monitoring?tab=live`
- [ ] Navigate to `/admin/health`
- [ ] Verify redirect to `/admin/monitoring?tab=health`
- [ ] Navigate to `/admin/debug`
- [ ] Verify redirect to `/admin/monitoring?tab=debug`
- [ ] Navigate to `/admin/diagnostics`
- [ ] Verify redirect to `/admin/monitoring?tab=diagnostics`

#### 1.5 Functionality Tests
- [ ] In Live Monitor tab, verify real-time session updates work
- [ ] In System Health tab, verify health checks can be run
- [ ] In Debug Center tab, verify debug data loads
- [ ] In Diagnostics tab, verify diagnostic tests can be executed

### 2. Analytics Hub Tests

#### 2.1 Direct Access
- [ ] Navigate to `/admin/analytics`
- [ ] Verify page loads with "Scraper Status" tab active by default
- [ ] Verify page title shows "Analytics Hub"
- [ ] Verify all 4 tabs are visible: Scraper Status, Scraping Metrics, Proxy Health, Challenge Stats

#### 2.2 Tab Navigation
- [ ] Click on "Scraping Metrics" tab
- [ ] Verify ScrapingMetricsContent component loads
- [ ] Click on "Proxy Health" tab
- [ ] Verify ProxyHealthContent component loads
- [ ] Click on "Challenge Stats" tab
- [ ] Verify ChallengeStatsContent component loads
- [ ] Click back to "Scraper Status" tab
- [ ] Verify ScraperStatusContent component loads

#### 2.3 URL Parameter Navigation
- [ ] Navigate to `/admin/analytics?tab=metrics`
- [ ] Verify "Scraping Metrics" tab is active
- [ ] Navigate to `/admin/analytics?tab=proxies`
- [ ] Verify "Proxy Health" tab is active
- [ ] Navigate to `/admin/analytics?tab=challenges`
- [ ] Verify "Challenge Stats" tab is active

#### 2.4 Redirect Tests
- [ ] Navigate to `/admin/scrapers`
- [ ] Verify redirect to `/admin/analytics?tab=overview`
- [ ] Navigate to `/admin/proxy-health`
- [ ] Verify redirect to `/admin/analytics?tab=proxies`
- [ ] Navigate to `/admin/challenge-stats`
- [ ] Verify redirect to `/admin/analytics?tab=challenges`
- [ ] Navigate to `/admin/scraping-metrics`
- [ ] Verify redirect to `/admin/analytics?tab=metrics`

#### 2.5 Functionality Tests
- [ ] In Scraper Status tab, verify scraper list loads
- [ ] In Scraping Metrics tab, verify metrics charts display
- [ ] In Proxy Health tab, verify proxy health data loads
- [ ] In Challenge Stats tab, verify challenge statistics display

### 3. Navigation Menu Tests

#### 3.1 Monitoring Hub Menu
- [ ] Open admin sidebar
- [ ] Locate "Monitoring Hub" menu item
- [ ] Verify it has 4 sub-items: Live Monitor, System Health, Debug Center, Diagnostics
- [ ] Click on "Live Monitor" sub-item
- [ ] Verify navigation to `/admin/monitoring` with live tab active
- [ ] Click on "System Health" sub-item
- [ ] Verify navigation to monitoring hub with health tab active

#### 3.2 Analytics Hub Menu
- [ ] Open admin sidebar
- [ ] Locate "Analytics Hub" menu item
- [ ] Verify it has 4 sub-items: Scraper Status, Scraping Metrics, Proxy Health, Challenge Stats
- [ ] Click on "Scraper Status" sub-item
- [ ] Verify navigation to `/admin/analytics` with overview tab active
- [ ] Click on "Proxy Health" sub-item
- [ ] Verify navigation to analytics hub with proxies tab active

#### 3.3 Menu State
- [ ] Navigate to `/admin/monitoring`
- [ ] Verify "Monitoring Hub" menu is expanded
- [ ] Verify active sub-item is highlighted
- [ ] Navigate to `/admin/analytics`
- [ ] Verify "Analytics Hub" menu is expanded
- [ ] Verify active sub-item is highlighted

### 4. Responsive Design Tests

#### 4.1 Mobile View (< 640px)
- [ ] Open monitoring hub on mobile
- [ ] Verify tabs show abbreviated labels (Live, Health, Debug, Tests)
- [ ] Verify tab navigation works on mobile
- [ ] Open analytics hub on mobile
- [ ] Verify tabs show abbreviated labels (Status, Metrics, Proxies, Challenges)

#### 4.2 Tablet View (640px - 1024px)
- [ ] Open monitoring hub on tablet
- [ ] Verify tabs show full labels
- [ ] Verify layout is responsive
- [ ] Open analytics hub on tablet
- [ ] Verify tabs show full labels

#### 4.3 Desktop View (> 1024px)
- [ ] Open monitoring hub on desktop
- [ ] Verify optimal layout with full labels
- [ ] Open analytics hub on desktop
- [ ] Verify optimal layout with full labels

### 5. Data Persistence Tests

#### 5.1 Tab State
- [ ] Navigate to `/admin/monitoring?tab=health`
- [ ] Refresh the page
- [ ] Verify "System Health" tab remains active
- [ ] Navigate to `/admin/analytics?tab=metrics`
- [ ] Refresh the page
- [ ] Verify "Scraping Metrics" tab remains active

#### 5.2 Data Loading
- [ ] Open monitoring hub
- [ ] Switch between tabs
- [ ] Verify data loads correctly for each tab
- [ ] Open analytics hub
- [ ] Switch between tabs
- [ ] Verify data loads correctly for each tab

### 6. Error Handling Tests

#### 6.1 Invalid Tab Parameter
- [ ] Navigate to `/admin/monitoring?tab=invalid`
- [ ] Verify fallback to default tab (live)
- [ ] Navigate to `/admin/analytics?tab=invalid`
- [ ] Verify fallback to default tab (overview)

#### 6.2 API Failures
- [ ] Simulate API failure in monitoring hub
- [ ] Verify error messages display appropriately
- [ ] Simulate API failure in analytics hub
- [ ] Verify error messages display appropriately

### 7. Performance Tests

#### 7.1 Initial Load
- [ ] Measure time to first contentful paint for monitoring hub
- [ ] Measure time to first contentful paint for analytics hub
- [ ] Verify load times are acceptable (< 2 seconds)

#### 7.2 Tab Switching
- [ ] Measure time to switch between tabs in monitoring hub
- [ ] Measure time to switch between tabs in analytics hub
- [ ] Verify switching is smooth and responsive

### 8. Accessibility Tests

#### 8.1 Keyboard Navigation
- [ ] Use Tab key to navigate through monitoring hub tabs
- [ ] Use Enter/Space to activate tabs
- [ ] Verify focus indicators are visible
- [ ] Repeat for analytics hub

#### 8.2 Screen Reader
- [ ] Test monitoring hub with screen reader
- [ ] Verify tab labels are announced correctly
- [ ] Verify content changes are announced
- [ ] Repeat for analytics hub

#### 8.3 ARIA Attributes
- [ ] Inspect monitoring hub tabs for proper ARIA attributes
- [ ] Verify role="tablist", role="tab", role="tabpanel"
- [ ] Verify aria-selected states
- [ ] Repeat for analytics hub

## Test Results Template

### Test Execution Date: ___________
### Tester: ___________
### Environment: ___________

| Test ID | Test Name | Status | Notes |
|---------|-----------|--------|-------|
| 1.1 | Direct Access - Monitoring | ☐ Pass ☐ Fail | |
| 1.2 | Tab Navigation - Monitoring | ☐ Pass ☐ Fail | |
| 1.3 | URL Parameters - Monitoring | ☐ Pass ☐ Fail | |
| 1.4 | Redirects - Monitoring | ☐ Pass ☐ Fail | |
| 1.5 | Functionality - Monitoring | ☐ Pass ☐ Fail | |
| 2.1 | Direct Access - Analytics | ☐ Pass ☐ Fail | |
| 2.2 | Tab Navigation - Analytics | ☐ Pass ☐ Fail | |
| 2.3 | URL Parameters - Analytics | ☐ Pass ☐ Fail | |
| 2.4 | Redirects - Analytics | ☐ Pass ☐ Fail | |
| 2.5 | Functionality - Analytics | ☐ Pass ☐ Fail | |
| 3.1 | Monitoring Hub Menu | ☐ Pass ☐ Fail | |
| 3.2 | Analytics Hub Menu | ☐ Pass ☐ Fail | |
| 3.3 | Menu State | ☐ Pass ☐ Fail | |
| 4.1 | Mobile View | ☐ Pass ☐ Fail | |
| 4.2 | Tablet View | ☐ Pass ☐ Fail | |
| 4.3 | Desktop View | ☐ Pass ☐ Fail | |
| 5.1 | Tab State Persistence | ☐ Pass ☐ Fail | |
| 5.2 | Data Loading | ☐ Pass ☐ Fail | |
| 6.1 | Invalid Parameters | ☐ Pass ☐ Fail | |
| 6.2 | API Failures | ☐ Pass ☐ Fail | |
| 7.1 | Initial Load Performance | ☐ Pass ☐ Fail | |
| 7.2 | Tab Switching Performance | ☐ Pass ☐ Fail | |
| 8.1 | Keyboard Navigation | ☐ Pass ☐ Fail | |
| 8.2 | Screen Reader | ☐ Pass ☐ Fail | |
| 8.3 | ARIA Attributes | ☐ Pass ☐ Fail | |

## Issues Found

| Issue ID | Description | Severity | Status |
|----------|-------------|----------|--------|
| | | | |

## Sign-off

- [ ] All critical tests passed
- [ ] All high-priority issues resolved
- [ ] Documentation updated
- [ ] Ready for production deployment

**Tester Signature:** ___________
**Date:** ___________
