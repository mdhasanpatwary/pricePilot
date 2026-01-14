import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should allow a user to navigate to register page from login', async ({ page }) => {
    await page.goto('/auth/login');
    await page.click('text=Sign up');
    await expect(page).toHaveURL('/auth/register');
  });

  test('should show validation errors for empty fields on register', async ({ page }) => {
    await page.goto('/auth/register');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Company name must be at least 2 characters')).toBeVisible();
    await expect(page.locator('text=Please enter a valid work email')).toBeVisible();
    // Use an exact match or regex for the password error to be precise
    await expect(page.locator('text=Password must be at least 8 characters')).toBeVisible();
  });

  test('should show error on invalid login', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Check for error message
    const errorMsg = page.locator('text=Invalid email or password');
    await expect(errorMsg).toBeVisible();
  });
});

test.describe('Dashboard Navigation', () => {
  test('should load landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/PricePilot/);
    await expect(page.locator('text=Win Every Price Battle')).toBeVisible();
  });
});

