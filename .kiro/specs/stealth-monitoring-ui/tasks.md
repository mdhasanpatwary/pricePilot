# Implementation Plan: Stealth Monitoring UI

## Overview

This implementation plan breaks down the stealth monitoring UI features into discrete, incremental coding tasks. The approach focuses on building database schema and API endpoints first, then implementing admin panel dashboards, followed by tenant panel features. Each task builds on previous work to ensure no orphaned code.

## Tasks

- [x] 1. Set up database schema and models
  - Add Prisma models for ChallengeAttempt, SiteProfile, Alert, and HumanSimulationConfig
  - Run Prisma migration to create database tables
  - Add indexes for performance-critical queries
  - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6, 8.7, 8.8, 12.7_

- [x] 2. Implement Proxy Health API endpoints
  - [x] 2.1 Create GET /api/v1/admin/proxy-health endpoint
    - Fetch proxy health data from ProxyManager service
    - Calculate aggregate statistics (total, healthy, unhealthy counts)
    - Support time range filtering (24h, 7d, 30d)
    - Format response with stats and proxy list
    - _Requirements: 8.1, 1.1, 1.2, 1.3, 1.5, 1.7_
  
  - [ ]* 2.2 Write unit tests for proxy health endpoint
    - Test successful data retrieval
    - Test time range filtering
    - Test empty proxy pool
    - Test error handling
    - _Requirements: 8.1, 8.10_

- [x] 3. Implement Challenge Stats API endpoints
  - [x] 3.1 Create GET /api/v1/admin/challenge-stats endpoint
    - Fetch challenge attempts from database
    - Group by site and challenge type
    - Calculate solve rates and aggregates
    - Support time range filtering
    - Format response with summary and site breakdown
    - _Requirements: 8.2, 2.1, 2.2, 2.3, 2.5, 2.6_
  
  - [ ]* 3.2 Write unit tests for challenge stats endpoint
    - Test data aggregation
    - Test solve rate calculations
    - Test time range filtering
    - Test empty data scenarios
    - _Requirements: 8.2, 8.10_

- [x] 4. Implement Scraping Metrics API endpoints
  - [x] 4.1 Create GET /api/v1/admin/scraping-metrics endpoint
    - Fetch scraping metrics from database
    - Calculate success rates and block rates
    - Support time range filtering
    - Format response with summary and site metrics
    - _Requirements: 8.3, 3.1, 3.2, 3.3, 3.5_
  
  - [ ]* 4.2 Write unit tests for scraping metrics endpoint
    - Test metrics calculations
    - Test time range filtering
    - Test aggregate statistics
    - Test error scenarios
    - _Requirements: 8.3, 8.10_

- [x] 5. Implement Active Sessions API endpoint
  - [x] 5.1 Create GET /api/v1/admin/active-sessions endpoint
    - Fetch active scraping sessions from Scraper service
    - Include session details (site, tenant, status, proxy, challenge)
    - Calculate aggregate statistics (total sessions, requests/min)
    - Format response with stats and session list
    - _Requirements: 8.9, 7.1, 7.2, 7.3, 7.4, 7.7_
  
  - [ ]* 5.2 Write unit tests for active sessions endpoint
    - Test session data retrieval
    - Test aggregate calculations
    - Test empty sessions scenario
    - _Requirements: 8.9, 8.10_

- [x] 6. Implement Human Simulation Config API endpoints
  - [x] 6.1 Create GET /api/v1/admin/human-simulation-config endpoint
    - Fetch current configuration from database or defaults
    - Format response with all configuration values
    - _Requirements: 8.5, 5.1_
  
  - [x] 6.2 Create POST /api/v1/admin/human-simulation-config endpoint
    - Validate input ranges (typing delays, action pauses)
    - Update configuration in database
    - Apply changes to HumanSimulator service
    - Return validation errors or success response
    - _Requirements: 8.6, 5.5, 5.6_
  
  - [ ]* 6.3 Write unit tests for human simulation config endpoints
    - Test configuration retrieval
    - Test valid configuration updates
    - Test validation error handling
    - Test invalid input ranges
    - _Requirements: 8.5, 8.6, 8.10_

- [x] 7. Implement Site Profiles API endpoints
  - [x] 7.1 Create GET /api/v1/admin/site-profiles endpoint
    - Fetch all site profiles from database
    - Include default profile templates
    - Format response with profiles and templates
    - _Requirements: 8.7, 6.1, 6.6_
  
  - [x] 7.2 Create POST /api/v1/admin/site-profiles endpoint
    - Validate profile configuration (rate limits, delays, warmup)
    - Create or update site profile in database
    - Apply changes to SiteProfileManager service
    - Return validation errors or success response
    - _Requirements: 8.8, 6.5, 6.7_
  
  - [x] 7.3 Create DELETE /api/v1/admin/site-profiles/:id endpoint
    - Validate profile exists
    - Delete profile from database
    - Return success response
    - _Requirements: 8.8_
  
  - [ ]* 7.4 Write unit tests for site profiles endpoints
    - Test profile retrieval
    - Test profile creation and updates
    - Test profile deletion
    - Test validation errors
    - _Requirements: 8.7, 8.8, 8.10_

- [-] 8. Implement Alerts API endpoints
  - [x] 8.1 Create GET /api/v1/admin/alerts endpoint
    - Fetch alerts from database
    - Support filtering by acknowledged status and severity
    - Calculate unacknowledged count
    - Format response with alerts and count
    - _Requirements: 12.4, 12.6_
  
  - [x] 8.2 Create POST /api/v1/admin/alerts/:id/acknowledge endpoint
    - Mark alert as acknowledged in database
    - Update acknowledgedAt timestamp
    - Return updated alert
    - _Requirements: 12.5_
  
  - [x] 8.3 Implement alert creation logic in MetricsTracker
    - Create alert when block rate exceeds threshold
    - Create alert when all proxies unhealthy
    - Create alert when solve rate drops below threshold
    - Persist alerts to database
    - _Requirements: 12.1, 12.2, 12.3, 12.7_
  
  - [ ]* 8.4 Write unit tests for alerts endpoints
    - Test alert retrieval and filtering
    - Test alert acknowledgment
    - Test alert creation logic
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

- [x] 9. Checkpoint - Ensure all API tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement Admin Proxy Health Dashboard
  - [x] 10.1 Create proxy health page component
    - Create app/admin/proxy-health/page.tsx
    - Implement data fetching from API endpoint
    - Display stats cards (total, healthy, unhealthy proxies)
    - Display proxy table with all information
    - Add time range selector
    - Add refresh button
    - Add status indicators and badges
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_
  
  - [ ]* 10.2 Write property test for proxy information completeness
    - **Property 1: Proxy Information Completeness**
    - **Validates: Requirements 1.2**
  
  - [ ]* 10.3 Write property test for proxy metrics completeness
    - **Property 2: Proxy Metrics Completeness**
    - **Validates: Requirements 1.3**
  
  - [ ]* 10.4 Write property test for unhealthy proxy highlighting
    - **Property 3: Unhealthy Proxy Highlighting**
    - **Validates: Requirements 1.4**

- [x] 11. Implement Admin Challenge Stats Dashboard
  - [x] 11.1 Create challenge stats page component
    - Create app/admin/challenge-stats/page.tsx
    - Implement data fetching from API endpoint
    - Display summary cards with aggregate statistics
    - Display site table with challenge breakdown
    - Add challenge type pie chart
    - Add solve rate trend line chart
    - Add time range selector
    - Add warning indicators for low solve rates
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  
  - [ ]* 11.2 Write property test for challenge data completeness
    - **Property 6: Challenge Data Completeness**
    - **Validates: Requirements 2.2**
  
  - [ ]* 11.3 Write property test for low solve rate warning
    - **Property 8: Low Solve Rate Warning**
    - **Validates: Requirements 2.4**

- [x] 12. Implement Admin Scraping Metrics Dashboard
  - [x] 12.1 Create scraping metrics page component
    - Create app/admin/scraping-metrics/page.tsx
    - Implement data fetching from API endpoint
    - Display summary cards with platform-wide metrics
    - Display site table with metrics and status
    - Add success rate trend chart
    - Add block rate trend chart
    - Add time range selector
    - Add export button (CSV/JSON)
    - Add drill-down to site details
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  
  - [ ]* 12.2 Write property test for site metrics completeness
    - **Property 11: Site Metrics Completeness**
    - **Validates: Requirements 3.2**
  
  - [ ]* 12.3 Write property test for high block rate highlighting
    - **Property 12: High Block Rate Highlighting**
    - **Validates: Requirements 3.4**
  
  - [x] 12.4 Implement data export functionality
    - Add export to CSV function
    - Add export to JSON function
    - Generate filename with timestamp
    - Trigger browser download
    - Log export action
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_
  
  - [ ]* 12.5 Write property test for export data completeness
    - **Property 33: Export Data Completeness**
    - **Validates: Requirements 10.4**

- [x] 13. Implement Admin Real-Time Scraping Monitor
  - [x] 13.1 Create scraping monitor page component
    - Create app/admin/scraping-monitor/page.tsx
    - Implement data fetching from API endpoint
    - Display stats cards with real-time metrics
    - Display active sessions table
    - Add status indicators with animations
    - Implement auto-refresh (5 seconds)
    - Add auto-refresh toggle
    - Add filter by tenant/site
    - Add session detail modal
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
  
  - [ ]* 13.2 Write property test for active session information completeness
    - **Property 25: Active Session Information Completeness**
    - **Validates: Requirements 7.2**
  
  - [ ]* 13.3 Write property test for session auto-refresh
    - **Property 28: Session Auto-Refresh**
    - **Validates: Requirements 7.5**

- [x] 14. Implement Admin Human Simulation Settings
  - [x] 14.1 Create human simulation settings page component
    - Create app/admin/human-simulation/page.tsx
    - Implement data fetching from API endpoint
    - Display form with all configuration fields
    - Add range sliders for delays
    - Add toggles for mouse movement and corrections
    - Display recommended value indicators
    - Implement form validation
    - Add save button with API call
    - Add reset to defaults button
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  
  - [ ]* 14.2 Write property test for configuration validation errors
    - **Property 20: Configuration Validation Errors**
    - **Validates: Requirements 5.5**
  
  - [ ]* 14.3 Write property test for configuration update application
    - **Property 21: Configuration Update Application**
    - **Validates: Requirements 5.6**

- [x] 15. Implement Admin Site Profile Management
  - [x] 15.1 Create site profiles page component
    - Create app/admin/site-profiles/page.tsx
    - Implement data fetching from API endpoint
    - Display list of configured profiles
    - Add new profile button
    - Create profile editor modal/drawer
    - Add template selector with defaults
    - Implement form validation
    - Add save and delete actions
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_
  
  - [ ]* 15.2 Write property test for site profile validation errors
    - **Property 23: Site Profile Validation Errors**
    - **Validates: Requirements 6.5**
  
  - [ ]* 15.3 Write property test for site profile update application
    - **Property 24: Site Profile Update Application**
    - **Validates: Requirements 6.7**

- [x] 16. Checkpoint - Ensure all admin panel features work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Implement Tenant Metrics API endpoint
  - [x] 17.1 Create GET /api/v1/tenant/scraping-metrics endpoint
    - Authenticate and get tenant ID
    - Fetch metrics only for tenant's sites
    - Calculate overall success rate and block rate
    - Include per-site metrics with status
    - Include challenge detection statistics
    - Support time range filtering
    - _Requirements: 8.4, 4.1, 4.2, 4.3, 4.5, 4.7_
  
  - [ ]* 17.2 Write unit tests for tenant metrics endpoint
    - Test tenant data isolation
    - Test metrics calculations
    - Test authentication
    - _Requirements: 8.4, 4.1, 8.10_

- [x] 18. Implement Tenant Site Config API endpoints
  - [x] 18.1 Create GET /api/v1/tenant/site-config endpoint
    - Authenticate and get tenant ID
    - Fetch site configurations for tenant's sites
    - Include allowed ranges based on plan
    - Format response with sites and constraints
    - _Requirements: 11.1, 11.5_
  
  - [x] 18.2 Create PATCH /api/v1/tenant/site-config/:siteId endpoint
    - Authenticate and verify site ownership
    - Validate settings against plan limits
    - Validate delay ranges
    - Update site configuration
    - Return validation errors or success
    - _Requirements: 11.3, 11.4, 11.6_
  
  - [ ]* 18.3 Write unit tests for tenant site config endpoints
    - Test site ownership verification
    - Test plan limit validation
    - Test configuration updates
    - _Requirements: 11.1, 11.3, 11.4, 11.6_

- [x] 19. Implement Tenant Metrics Dashboard
  - [x] 19.1 Create tenant metrics page component
    - Create app/tenant/metrics/page.tsx
    - Implement data fetching from API endpoint
    - Display overview cards with tenant-wide metrics
    - Display site health status cards
    - Add recommendations panel for issues
    - Add challenge detection summary
    - Add time range filter
    - Add status legend
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  
  - [ ]* 19.2 Write property test for tenant data isolation
    - **Property 14: Tenant Data Isolation**
    - **Validates: Requirements 4.1**
  
  - [ ]* 19.3 Write property test for issue recommendations display
    - **Property 17: Issue Recommendations Display**
    - **Validates: Requirements 4.4**

- [x] 20. Implement Tenant Site Configuration
  - [x] 20.1 Create tenant site config page component
    - Create app/tenant/site-config/page.tsx
    - Implement data fetching from API endpoint
    - Display list of tenant sites
    - Create configuration form for each site
    - Add toggle for session warmup
    - Add delay range sliders with constraints
    - Add impact preview calculation
    - Implement form validation
    - Add save button with API call
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_
  
  - [ ]* 20.2 Write property test for tenant delay range constraints
    - **Property 36: Tenant Delay Range Constraints**
    - **Validates: Requirements 11.3**
  
  - [ ]* 20.3 Write property test for configuration impact preview
    - **Property 40: Configuration Impact Preview**
    - **Validates: Requirements 11.7**

- [x] 21. Implement Alert System UI
  - [x] 21.1 Add alert indicator to admin navigation
    - Display unacknowledged alert count badge
    - Add link to alerts page
    - Update count on new alerts
    - _Requirements: 12.6_
  
  - [x] 21.2 Create alerts page component
    - Create app/admin/alerts/page.tsx
    - Implement data fetching from API endpoint
    - Display alerts with severity indicators
    - Add filter by severity and acknowledged status
    - Add acknowledge button for each alert
    - Display alert details (site, proxy, timestamp)
    - _Requirements: 12.4, 12.5, 12.6_
  
  - [ ]* 21.3 Write property test for alert information completeness
    - **Property 43: Alert Information Completeness**
    - **Validates: Requirements 12.4**
  
  - [ ]* 21.4 Write property test for alert acknowledgment state update
    - **Property 44: Alert Acknowledgment State Update**
    - **Validates: Requirements 12.5**

- [x] 22. Implement Responsive Design
  - [x] 22.1 Add responsive layouts to all dashboards
    - Implement mobile layout (single column)
    - Implement tablet layout (two columns)
    - Implement desktop layout (multi-column)
    - Make charts responsive
    - Test on different viewport sizes
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  
  - [x] 22.2 Add accessibility features
    - Add keyboard navigation support
    - Ensure color contrast compliance
    - Add text alternatives for visual indicators
    - Test with screen readers
    - _Requirements: 9.5, 9.6, 9.7_
  
  - [ ]* 22.3 Write property test for visual indicator text alternatives
    - **Property 32: Visual Indicator Text Alternatives**
    - **Validates: Requirements 9.7**

- [x] 23. Checkpoint - Ensure all features work end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 24. Documentation and final cleanup
  - Update /docs with new dashboard features
  - Add API endpoint documentation
  - Add user guide for admin dashboards
  - Add user guide for tenant features
  - Add JSDoc comments to all components
  - Update navigation menus
  - _Requirements: All requirements_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout implementation
- Property tests validate universal correctness properties
- Unit tests validate specific examples, edge cases, and error conditions
- The implementation integrates with existing backend services
- All new features follow existing UI patterns and design system
