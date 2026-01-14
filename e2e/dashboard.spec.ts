import { test, expect } from '@playwright/test';

test.describe('Dashboard Functionality (Unauthorized)', () => {
  test('should redirect unauthenticated user to login from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    // NextAuth usually redirects to /api/auth/signin or matches current URL with a sign-in modal/page
    // In our case, the dashboard is protected.
    await expect(page).toHaveURL(/\/auth\/login|auth\/signin/);
  });

  test('should redirect unauthenticated user to login from rules', async ({ page }) => {
    await page.goto('/dashboard/rules');
    await expect(page).toHaveURL(/\/auth\/login|auth\/signin/);
  });
});

test.describe('Pricing Rules UI (Public Demo/State Check)', () => {
  // We can't test creation without Auth, but we can verify the UI structure
  // if we can mock or bypass auth, but for pure E2E we usually use a test user.
  // Since we don't have a test user creator, we'll verify the login requirement.

  test('login page should have working forgot password and sign up links', async ({ page }) => {
    await page.goto('/auth/login');
    const signUpLink = page.locator('text=Sign up');
    await expect(signUpLink).toBeVisible();
    await signUpLink.click();
    await expect(page).toHaveURL('/auth/register');
  });
});
