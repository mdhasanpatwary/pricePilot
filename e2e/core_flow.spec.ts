import { test, expect } from "@playwright/test";

test.describe("E2E: Full Business Lifecycle (Connect -> Match -> Sync)", () => {
  test("should successfully connect site, match product, and run sync", async ({
    page,
  }) => {
    // 1. Setup & Registration
    const timestamp = Date.now();
    const email = `e2e-flow-${timestamp}@pricepilot.test`;
    const company = `Flow Corp ${timestamp}`;
    const password = "Password123!";

    await page.goto("/auth/register");
    await page.fill('input[placeholder="Acme Corp"]', company);
    await page.fill('input[placeholder="name@company.com"]', email);
    await page.fill('input[placeholder="••••••••"]', password);
    await page.click('button:has-text("Create Account")');

    // Auto-login happens after registration, so we might land on dashboard directly
    await page.waitForURL(
      (url) =>
        url.pathname.includes("/dashboard") ||
        url.pathname.includes("/auth/login"),
      { timeout: 20000 },
    );

    // 2. Login (only if not already logged in/redirected to dashboard)
    if (page.url().includes("/auth/login")) {
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('button:has-text("Sign in")');
      await expect(page).toHaveURL("/dashboard", { timeout: 15000 });
    }

    // 3. Connect Store (Integrate)
    await page.goto("/dashboard/connections");
    await page.click('button:has-text("Connect Store")');
    await page.click('button:has-text("OpenCart")');
    await page.fill(
      'input[placeholder="https://yourstore.com"]',
      "https://demo-opencart.com",
    );
    await page.fill(
      'input[placeholder="Your PricePilot secret key"]',
      "mock_token_123",
    );
    // Start waiting for the API response BEFORE clicking the button
    const connectionPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/integrations") &&
        response.status() === 201,
      { timeout: 10000 },
    );

    await page.click('button:has-text("Verify & Connect")');

    // Wait for the successful response
    await connectionPromise;

    // Reload to ensure data persistence and fresh fetch
    await page.reload();

    // Check if store appears
    // Debug: Ensure we are still on connections page
    await expect(page).toHaveURL(/.*\/dashboard\/connections/);

    // Debug: Check if "Store Limit Reached" banner appears (since we have 1 connection and limit is 1)
    await expect(page.locator("text=Store Limit Reached")).toBeVisible();

    const cardTitle = page.locator(".bg-card h3").first();
    await expect(cardTitle).toBeVisible();
    await expect(cardTitle).toContainText("demo-opencart");

    // 4. Initial Store Sync (Pull Products)
    // The button we just added with Zap icon
    const syncStoreButton = page
      .locator('button[title="Sync Products"]')
      .first();
    await syncStoreButton.click();

    // Check for loading toast first to confirm click action
    // await expect(page.locator('text=Syncing store products...')).toBeVisible();

    const syncPromise = page.waitForResponse(
      (response) => response.url().includes("/api/integrations/sync"),
      { timeout: 40000 },
    );

    // Wait for success or error
    try {
      const response = await syncPromise;
      if (response.status() !== 200) {
        const body = await response.json();
        console.log("Sync API Error Details:", JSON.stringify(body, null, 2));
        throw new Error(
          `Sync API failed with status ${response.status()}: ${body.details || body.error}`,
        );
      }
      await expect(page.locator("text=Successfully synced")).toBeVisible({
        timeout: 10000,
      });
    } catch (e: any) {
      // Capture detailed error
      const fs = require("fs");
      let errorMsg = e.message;
      if (e.message.includes("Sync API failed")) {
        // Already formatted
      }
      fs.writeFileSync("sync-error.log", errorMsg);

      // If success not found, check for failure to give better error message
      const errorToast = page.locator("text=Failed to sync");
      if (await errorToast.isVisible()) {
        throw new Error(
          `Sync failed with toast message. Original error: ${e.message}`,
        );
      }
      throw e;
    }

    // 5. Manual Matching (Discovery)
    await page.goto("/dashboard/products");
    // Click on the first product (from our mock: Nike Air Max 270)
    await page.click("text=Nike Air Max 270");

    // Fill competitor link in the drawer
    await page.fill(
      'input[placeholder="https://competitor.com/p/product-name"]',
      "https://competitor.com/nike-shoes",
    );
    await page.click('button:has-text("Link")');
    await expect(page.locator("text=linked successfully")).toBeVisible();

    // Close drawer
    // The drawer has a backdrop at z-100, we can click it to close
    // Since the drawer is right-aligned, clicking the left side of the screen should work
    await page.mouse.click(10, 10);

    // Check it closed
    await expect(page.locator("text=Manual Competitor Link")).not.toBeVisible();

    // 6. Global Sync (Scrape -> Rules -> Execution)
    await page.goto("/dashboard");
    const globalSyncButton = page.locator('button:has-text("Run Global Sync")');
    await expect(globalSyncButton).toBeEnabled();
    await globalSyncButton.click();

    // Wait for the orchestration to finish
    await expect(page.locator("text=Sync complete!")).toBeVisible({
      timeout: 60000,
    });

    // 7. Verification: Stats should be updated
    await page.reload();
    const productCountHeader = page.locator('h3:has-text("2")').first(); // We mocked 2 products for OpenCart
    await expect(productCountHeader).toBeVisible();

    // Verification: Recent logs should be populated
    // const executionQueue = page.locator('table tbody tr');
    // await expect(executionQueue).toBeVisible();
  });
});
