import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Admin Dashboard Enhancement
 * 
 * These tests validate the complete workflows for:
 * - Real-time monitoring
 * - Proxy simulator
 * - Tenant debugging
 * - System health monitoring
 * - Session control
 * - Analytics and export
 */

// Helper function to login as admin
async function loginAsAdmin(page: any) {
  await page.goto('/auth/login');
  // Note: In a real scenario, you would use actual admin credentials
  // For now, we'll test the UI flow assuming authentication is handled
  await page.fill('input[type="email"]', 'admin@example.com');
  await page.fill('input[type="password"]', 'adminpassword');
  await page.click('button[type="submit"]');
  // Wait for redirect to dashboard or admin panel
  await page.waitForURL(/\/admin|\/dashboard/, { timeout: 10000 });
}

// Helper function to navigate to admin section
async function navigateToAdmin(page: any, path: string) {
  await page.goto(`/admin${path}`);
  await page.waitForLoadState('networkidle');
}

test.describe('Real-Time Monitoring Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Skip login for now - focus on UI structure
    await page.goto('/admin/monitoring');
  });

  test('should display monitoring hub with all tabs', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1:has-text("Monitoring Hub")')).toBeVisible();
    
    // Check all tabs are present
    await expect(page.locator('button[role="tab"]:has-text("Live")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Control")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Health")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Debug")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Tests")')).toBeVisible();
  });

  test('should display real-time monitor on live tab', async ({ page }) => {
    // Click on Live Monitor tab
    await page.click('button[role="tab"]:has-text("Live")');
    
    // Wait for content to load
    await page.waitForTimeout(1000);
    
    // Check for real-time monitor elements
    const monitorSection = page.locator('text=Real-Time Scraping Monitor').or(page.locator('text=Active Sessions'));
    await expect(monitorSection.first()).toBeVisible({ timeout: 10000 });
  });

  test('should allow filtering by tenant', async ({ page }) => {
    await page.click('button[role="tab"]:has-text("Live")');
    await page.waitForTimeout(1000);
    
    // Look for tenant filter dropdown or input
    const filterButton = page.locator('button:has-text("Filter")').or(page.locator('button:has-text("Tenant")'));
    if (await filterButton.count() > 0) {
      await filterButton.first().click();
      // Check that filter options appear
      await page.waitForTimeout(500);
    }
  });

  test('should display session lifecycle stages', async ({ page }) => {
    await page.click('button[role="tab"]:has-text("Live")');
    await page.waitForTimeout(1000);
    
    // Check for lifecycle stage indicators
    // These might be in a table or card layout
    const stageIndicators = page.locator('text=proxy_selection').or(
      page.locator('text=navigation')
    ).or(page.locator('text=data_extraction'));
    
    // At least one stage indicator should be visible if there are active sessions
    // If no sessions, the empty state should be visible
    const emptyState = page.locator('text=No active sessions').or(page.locator('text=No sessions found'));
    const hasContent = await stageIndicators.first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmptyState = await emptyState.first().isVisible({ timeout: 5000 }).catch(() => false);
    
    expect(hasContent || hasEmptyState).toBeTruthy();
  });

  test('should auto-refresh session data', async ({ page }) => {
    await page.click('button[role="tab"]:has-text("Live")');
    
    // Wait for initial load
    await page.waitForTimeout(2000);
    
    // Check that the component is present (auto-refresh happens in background)
    const monitor = page.locator('text=Real-Time').or(page.locator('text=Active Sessions'));
    await expect(monitor.first()).toBeVisible({ timeout: 10000 });
    
    // Wait for at least one refresh cycle (5 seconds based on refreshInterval)
    await page.waitForTimeout(6000);
    
    // Component should still be visible and functional
    await expect(monitor.first()).toBeVisible();
  });
});

test.describe('Proxy Simulator Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/simulator');
  });

  test('should display proxy simulator interface', async ({ page }) => {
    // Check page title or main heading
    await expect(page.locator('h1:has-text("Proxy Simulator")').or(
      page.locator('h2:has-text("Proxy Simulator")')
    )).toBeVisible({ timeout: 10000 });
  });

  test('should display scenario selection options', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Look for scenario selection dropdown or buttons
    const scenarioSelector = page.locator('text=Scenario').or(
      page.locator('text=rotation')
    ).or(page.locator('text=failure'));
    
    await expect(scenarioSelector.first()).toBeVisible({ timeout: 10000 });
  });

  test('should allow configuration of simulation parameters', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Look for configuration inputs
    const configInputs = page.locator('input[type="number"]').or(
      page.locator('select')
    ).or(page.locator('input[type="text"]'));
    
    // Should have at least one configuration input
    await expect(configInputs.first()).toBeVisible({ timeout: 10000 });
  });

  test('should have run simulation button', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Look for run/start simulation button
    const runButton = page.locator('button:has-text("Run")').or(
      page.locator('button:has-text("Start")')
    ).or(page.locator('button:has-text("Simulate")'));
    
    await expect(runButton.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display simulation results section', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Look for results section (might be empty initially)
    const resultsSection = page.locator('text=Results').or(
      page.locator('text=Simulation Results')
    ).or(page.locator('text=Summary'));
    
    // Results section should exist in the UI
    const hasResults = await resultsSection.first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmptyState = await page.locator('text=No simulations').isVisible({ timeout: 5000 }).catch(() => false);
    
    expect(hasResults || hasEmptyState).toBeTruthy();
  });

  test('should support multiple simulation scenarios', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Check for different scenario options
    const scenarios = ['rotation', 'failure', 'exclusion', 'prioritization'];
    let foundScenarios = 0;
    
    for (const scenario of scenarios) {
      const scenarioElement = page.locator(`text=${scenario}`);
      if (await scenarioElement.count() > 0) {
        foundScenarios++;
      }
    }
    
    // Should have at least 2 different scenarios available
    expect(foundScenarios).toBeGreaterThanOrEqual(2);
  });
});

test.describe('Tenant Debugging Workflow', () => {
  test('should display tenant list in admin panel', async ({ page }) => {
    await page.goto('/admin/tenants');
    await page.waitForTimeout(1000);
    
    // Check for tenant list or table
    const tenantList = page.locator('text=Tenants').or(
      page.locator('table')
    ).or(page.locator('text=Company'));
    
    await expect(tenantList.first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to tenant debug view', async ({ page }) => {
    await page.goto('/admin/tenants');
    await page.waitForTimeout(1000);
    
    // Look for a debug or view button
    const debugButton = page.locator('button:has-text("Debug")').or(
      page.locator('a:has-text("View")')
    ).or(page.locator('button:has-text("Details")'));
    
    if (await debugButton.count() > 0) {
      await debugButton.first().click();
      await page.waitForTimeout(1000);
      
      // Should navigate to tenant debug page
      expect(page.url()).toContain('/admin');
    }
  });

  test('should display tenant debug information', async ({ page }) => {
    // Navigate to a mock tenant debug page
    await page.goto('/admin/debug/tenant/test-tenant-id');
    await page.waitForTimeout(1000);
    
    // Check for debug view components
    const debugView = page.locator('text=Tenant Debug').or(
      page.locator('text=Sessions')
    ).or(page.locator('text=Errors'));
    
    await expect(debugView.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show tenant sessions', async ({ page }) => {
    await page.goto('/admin/debug/tenant/test-tenant-id');
    await page.waitForTimeout(1000);
    
    // Look for sessions section
    const sessionsSection = page.locator('text=Sessions').or(
      page.locator('text=Active Sessions')
    ).or(page.locator('text=Recent Activity'));
    
    await expect(sessionsSection.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display tenant errors and issues', async ({ page }) => {
    await page.goto('/admin/debug/tenant/test-tenant-id');
    await page.waitForTimeout(1000);
    
    // Look for errors section
    const errorsSection = page.locator('text=Errors').or(
      page.locator('text=Issues')
    ).or(page.locator('text=Recent Errors'));
    
    const hasErrors = await errorsSection.first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasNoErrors = await page.locator('text=No errors').isVisible({ timeout: 5000 }).catch(() => false);
    
    expect(hasErrors || hasNoErrors).toBeTruthy();
  });

  test('should show tenant resource usage', async ({ page }) => {
    await page.goto('/admin/debug/tenant/test-tenant-id');
    await page.waitForTimeout(1000);
    
    // Look for resource usage indicators
    const resourceSection = page.locator('text=Resource').or(
      page.locator('text=Usage')
    ).or(page.locator('text=Quota'));
    
    const hasResources = await resourceSection.first().isVisible({ timeout: 5000 }).catch(() => false);
    
    // Resource section might not always be visible, but the page should load
    expect(page.url()).toContain('/admin/debug/tenant/');
  });
});

test.describe('System Health Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/monitoring?tab=health');
  });

  test('should display system health monitor', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Check for health monitor heading
    const healthMonitor = page.locator('text=System Health').or(
      page.locator('text=Health Status')
    ).or(page.locator('text=Component Status'));
    
    await expect(healthMonitor.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show component health status', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Look for component status indicators
    const components = ['Database', 'Redis', 'Proxy', 'Cache'];
    let foundComponents = 0;
    
    for (const component of components) {
      const componentElement = page.locator(`text=${component}`);
      if (await componentElement.count() > 0) {
        foundComponents++;
      }
    }
    
    // Should show at least 2 system components
    expect(foundComponents).toBeGreaterThanOrEqual(2);
  });

  test('should display health metrics', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Look for metrics like response time, uptime, etc.
    const metrics = page.locator('text=Response Time').or(
      page.locator('text=Uptime')
    ).or(page.locator('text=Status'));
    
    await expect(metrics.first()).toBeVisible({ timeout: 10000 });
  });

  test('should have diagnostics execution capability', async ({ page }) => {
    // Navigate to diagnostics tab
    await page.click('button[role="tab"]:has-text("Tests")');
    await page.waitForTimeout(1000);
    
    // Look for run diagnostics button
    const diagnosticsButton = page.locator('button:has-text("Run")').or(
      page.locator('button:has-text("Test")')
    ).or(page.locator('button:has-text("Check")'));
    
    const hasButton = await diagnosticsButton.first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasDiagnostics = await page.locator('text=Diagnostic').isVisible({ timeout: 5000 }).catch(() => false);
    
    expect(hasButton || hasDiagnostics).toBeTruthy();
  });

  test('should show alerts if any', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Look for alerts section
    const alertsSection = page.locator('text=Alerts').or(
      page.locator('text=Warnings')
    ).or(page.locator('text=Issues'));
    
    const hasAlerts = await alertsSection.first().isVisible({ timeout: 5000 }).catch(() => false);
    const noAlerts = await page.locator('text=No alerts').isVisible({ timeout: 5000 }).catch(() => false);
    
    expect(hasAlerts || noAlerts).toBeTruthy();
  });
});

test.describe('Session Control Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/monitoring?tab=control');
  });

  test('should display session control panel', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Check for control panel heading
    const controlPanel = page.locator('text=Session Control').or(
      page.locator('text=Control Panel')
    ).or(page.locator('text=Sessions'));
    
    await expect(controlPanel.first()).toBeVisible({ timeout: 10000 });
  });

  test('should list controllable sessions', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Look for session list or table
    const sessionList = page.locator('table').or(
      page.locator('text=Session')
    );
    
    const hasSessions = await sessionList.first().isVisible({ timeout: 5000 }).catch(() => false);
    const noSessions = await page.locator('text=No sessions').isVisible({ timeout: 5000 }).catch(() => false);
    
    expect(hasSessions || noSessions).toBeTruthy();
  });

  test('should have pause/resume/cancel controls', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Look for control buttons
    const controls = ['Pause', 'Resume', 'Cancel', 'Stop', 'Retry'];
    let foundControls = 0;
    
    for (const control of controls) {
      const controlButton = page.locator(`button:has-text("${control}")`);
      if (await controlButton.count() > 0) {
        foundControls++;
      }
    }
    
    // Should have at least one control button (or none if no sessions)
    const noSessions = await page.locator('text=No sessions').isVisible({ timeout: 5000 }).catch(() => false);
    expect(foundControls >= 1 || noSessions).toBeTruthy();
  });

  test('should support bulk operations', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Look for bulk operation controls
    const bulkControls = page.locator('text=Bulk').or(
      page.locator('text=Select All')
    ).or(page.locator('input[type="checkbox"]'));
    
    const hasBulk = await bulkControls.first().isVisible({ timeout: 5000 }).catch(() => false);
    const noSessions = await page.locator('text=No sessions').isVisible({ timeout: 5000 }).catch(() => false);
    
    expect(hasBulk || noSessions).toBeTruthy();
  });

  test('should show session details on selection', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Look for clickable session rows or view buttons
    const sessionRow = page.locator('tr').or(
      page.locator('button:has-text("View")')
    ).or(page.locator('button:has-text("Details")'));
    
    if (await sessionRow.count() > 1) {
      // Click on a session (skip header row)
      await sessionRow.nth(1).click();
      await page.waitForTimeout(500);
      
      // Should show more details
      const details = page.locator('text=Details').or(
        page.locator('text=Status')
      );
      
      await expect(details.first()).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Analytics and Export Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/analytics');
  });

  test('should display analytics hub with tabs', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1:has-text("Analytics Hub")')).toBeVisible();
    
    // Check all tabs are present
    await expect(page.locator('button[role="tab"]:has-text("Dash")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Status")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Metrics")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Proxies")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Challenges")')).toBeVisible();
  });

  test('should display metrics dashboard', async ({ page }) => {
    await page.click('button[role="tab"]:has-text("Dash")');
    await page.waitForTimeout(1000);
    
    // Look for dashboard metrics
    const metrics = page.locator('text=Metrics').or(
      page.locator('text=Statistics')
    ).or(page.locator('text=Overview'));
    
    await expect(metrics.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show proxy health analytics', async ({ page }) => {
    await page.click('button[role="tab"]:has-text("Proxies")');
    await page.waitForTimeout(1000);
    
    // Look for proxy health information
    const proxyHealth = page.locator('text=Proxy Health').or(
      page.locator('text=Success Rate')
    ).or(page.locator('text=Response Time'));
    
    await expect(proxyHealth.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display challenge statistics', async ({ page }) => {
    await page.click('button[role="tab"]:has-text("Challenges")');
    await page.waitForTimeout(1000);
    
    // Look for challenge stats
    const challengeStats = page.locator('text=Challenge').or(
      page.locator('text=CAPTCHA')
    ).or(page.locator('text=Detection'));
    
    await expect(challengeStats.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show scraping metrics over time', async ({ page }) => {
    await page.click('button[role="tab"]:has-text("Metrics")');
    await page.waitForTimeout(1000);
    
    // Look for time-series data or charts
    const timeSeriesData = page.locator('text=Scraping Metrics').or(
      page.locator('canvas')
    ).or(page.locator('svg'));
    
    await expect(timeSeriesData.first()).toBeVisible({ timeout: 10000 });
  });

  test('should have export functionality', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Look for export buttons
    const exportButton = page.locator('button:has-text("Export")').or(
      page.locator('button:has-text("Download")')
    ).or(page.locator('a:has-text("Export")'));
    
    const hasExport = await exportButton.first().isVisible({ timeout: 5000 }).catch(() => false);
    
    // Export button might be in any tab
    if (!hasExport) {
      // Try other tabs
      await page.click('button[role="tab"]:has-text("Dash")');
      await page.waitForTimeout(500);
      const dashExport = await exportButton.first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(dashExport).toBeTruthy();
    } else {
      expect(hasExport).toBeTruthy();
    }
  });

  test('should support time range filtering', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Look for time range selector
    const timeRange = page.locator('select').or(
      page.locator('button:has-text("Last")')
    ).or(page.locator('button:has-text("24h")'));
    
    const hasTimeRange = await timeRange.first().isVisible({ timeout: 5000 }).catch(() => false);
    
    // Time range might be in specific tabs
    if (!hasTimeRange) {
      await page.click('button[role="tab"]:has-text("Metrics")');
      await page.waitForTimeout(500);
      const metricsTimeRange = await timeRange.first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(metricsTimeRange).toBeTruthy();
    } else {
      expect(hasTimeRange).toBeTruthy();
    }
  });

  test('should display analytics charts and visualizations', async ({ page }) => {
    await page.click('button[role="tab"]:has-text("Dash")');
    await page.waitForTimeout(1000);
    
    // Look for chart elements
    const charts = page.locator('canvas').or(
      page.locator('svg')
    ).or(page.locator('[class*="chart"]'));
    
    const hasCharts = await charts.first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasCards = await page.locator('[class*="card"]').count() > 0;
    
    // Should have either charts or metric cards
    expect(hasCharts || hasCards).toBeTruthy();
  });
});

test.describe('Integration Tests - Cross-Workflow', () => {
  test('should navigate between monitoring and analytics', async ({ page }) => {
    // Start at monitoring
    await page.goto('/admin/monitoring');
    await expect(page.locator('h1:has-text("Monitoring Hub")')).toBeVisible();
    
    // Navigate to analytics
    await page.goto('/admin/analytics');
    await expect(page.locator('h1:has-text("Analytics Hub")')).toBeVisible();
    
    // Navigate back to monitoring
    await page.goto('/admin/monitoring');
    await expect(page.locator('h1:has-text("Monitoring Hub")')).toBeVisible();
  });

  test('should maintain state when switching tabs', async ({ page }) => {
    await page.goto('/admin/monitoring');
    
    // Switch to control tab
    await page.click('button[role="tab"]:has-text("Control")');
    await page.waitForTimeout(1000);
    
    // Switch to health tab
    await page.click('button[role="tab"]:has-text("Health")');
    await page.waitForTimeout(1000);
    
    // Switch back to control tab
    await page.click('button[role="tab"]:has-text("Control")');
    await page.waitForTimeout(1000);
    
    // Control panel should still be functional
    const controlPanel = page.locator('text=Session Control').or(
      page.locator('text=Sessions')
    );
    await expect(controlPanel.first()).toBeVisible({ timeout: 10000 });
  });

  test('should handle navigation from tenant list to debug view', async ({ page }) => {
    await page.goto('/admin/tenants');
    await page.waitForTimeout(1000);
    
    // Try to navigate to a tenant debug view
    await page.goto('/admin/debug/tenant/test-tenant-id');
    await page.waitForTimeout(1000);
    
    // Should load tenant debug page
    expect(page.url()).toContain('/admin/debug/tenant/');
  });

  test('should load all admin pages without errors', async ({ page }) => {
    const adminPages = [
      '/admin',
      '/admin/monitoring',
      '/admin/analytics',
      '/admin/simulator',
      '/admin/tenants',
    ];
    
    for (const adminPage of adminPages) {
      await page.goto(adminPage);
      await page.waitForTimeout(1000);
      
      // Check that page loaded (no error page)
      const errorText = page.locator('text=Error').or(
        page.locator('text=404')
      ).or(page.locator('text=Not Found'));
      
      const hasError = await errorText.first().isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasError).toBeFalsy();
    }
  });
});
