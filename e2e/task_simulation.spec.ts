import { test, expect } from '@playwright/test';

test.describe('Full Task Simulation', () => {
  test('New User Experience: Register -> Login -> Add Competitor -> Check Rules', async ({ page }) => {
    const uniqueEmail = `e2e-${Date.now()}@example.com`;

    // 1. Register a NEW User
    await page.goto('/auth/register');
    await page.fill('input[placeholder="Acme Corp"]', 'E2E Testing Inc');
    await page.fill('input[placeholder="name@company.com"]', uniqueEmail);
    await page.fill('input[placeholder="••••••••"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for redirect to login or success message
    await expect(page).toHaveURL('/auth/login', { timeout: 15000 });

    // 2. Perform Login with the newly created user
    await page.fill('input[type="email"]', uniqueEmail);
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Ensure we reach the dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });

    // 3. Navigate to Competitors and try adding one
    await page.goto('/dashboard/competitors');
    await page.click('text=Add Site');

    // 4. Test Form Validation (Refactored logic)
    await page.fill('input[placeholder="https://competitor.com"]', 'invalid-url');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Please enter a valid URL')).toBeVisible();

    // 5. Navigate to Pricing Engine
    await page.goto('/dashboard/rules');
    await expect(page.locator('text=Pricing Engine')).toBeVisible();
    await expect(page.locator('text=Define how your prices adjust')).toBeVisible();
  });
});
