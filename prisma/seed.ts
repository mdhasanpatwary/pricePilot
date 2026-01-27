const { prisma } = require("../lib/prisma");
const bcrypt = require("bcryptjs");

async function main() {
  console.log("Seeding database for E2E tests...");

  // 0. Cleanup
  await prisma.pricingRule.deleteMany();
  await prisma.productMatch.deleteMany();
  await prisma.priceHistory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.site.deleteMany();

  // 1. Create a Test Tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: "test-tenant-id" },
    update: {},
    create: {
      id: "test-tenant-id",
      companyName: "E2E Test Corp",
    },
  });

  // 2. Create a Test User
  const hashedPassword = await bcrypt.hash("password123", 10);
  await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: { passwordHash: hashedPassword },
    create: {
      email: "test@example.com",
      passwordHash: hashedPassword,
      tenantId: tenant.id,
      role: "ADMIN",
    },
  });

  // 3. Create a User Site (Integration)
  await prisma.site.create({
    data: {
      tenantId: tenant.id,
      type: "USER",
      platform: "OPENCART",
      baseUrl: "https://test-store.com",
      apiToken: "test-token",
    },
  });

  // 4. Create an Initial Product for the User
  // Note: Unused variable removed to satisfy strict TS
  await prisma.product.create({
    data: {
      tenantId: tenant.id,
      siteId: (
        await prisma.site.findFirst({
          where: { tenantId: tenant.id, type: "USER" },
        })
      ).id,
      title: "E2E Test Product",
      sku: "E2E-SKU-001",
      currentPrice: 100.0,
    },
  });

  // 5. Create a Pricing Rule
  await prisma.pricingRule.create({
    data: {
      tenantId: tenant.id,
      name: "Default Undercut",
      strategy: "UNDERCUT",
      parameter: 0.5,
      priority: 1,
      isActive: true,
    },
  });

  // 6. Seed test data for new tables

  // Seed CaptchaSolveAttempt test data
  await prisma.captchaSolveAttempt.createMany({
    data: [
      {
        site: "example.com",
        captchaType: "recaptcha_v2",
        success: true,
        solveTime: 15000,
        cost: 0.003,
        timestamp: new Date(Date.now() - 3600000), // 1 hour ago
      },
      {
        site: "example.com",
        captchaType: "hcaptcha",
        success: true,
        solveTime: 12000,
        cost: 0.002,
        timestamp: new Date(Date.now() - 7200000), // 2 hours ago
      },
      {
        site: "test-store.com",
        captchaType: "recaptcha_v3",
        success: false,
        solveTime: 30000,
        cost: 0.003,
        errorMessage: "Timeout waiting for solution",
        timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
      },
    ],
  });

  // Seed RetryQueue test data
  const userSite = await prisma.site.findFirst({
    where: { tenantId: tenant.id, type: "USER" },
  });

  const testProduct = await prisma.product.findFirst({
    where: { tenantId: tenant.id },
  });

  if (userSite && testProduct) {
    await prisma.retryQueue.createMany({
      data: [
        {
          tenantId: tenant.id,
          siteId: userSite.id,
          productId: testProduct.id,
          url: "https://example.com/product/123",
          retryCount: 1,
          maxRetries: 4,
          nextRetryAt: new Date(Date.now() + 300000), // 5 minutes from now
          lastAttemptAt: new Date(),
          lastError: "Network timeout",
          status: "PENDING",
        },
        {
          tenantId: tenant.id,
          siteId: userSite.id,
          productId: testProduct.id,
          url: "https://example.com/product/456",
          retryCount: 3,
          maxRetries: 4,
          nextRetryAt: new Date(Date.now() + 3600000), // 1 hour from now
          lastAttemptAt: new Date(Date.now() - 900000), // 15 minutes ago
          lastError: "HTTP 429 - Rate Limited",
          status: "PENDING",
        },
        {
          tenantId: tenant.id,
          siteId: userSite.id,
          productId: testProduct.id,
          url: "https://example.com/product/789",
          retryCount: 4,
          maxRetries: 4,
          nextRetryAt: new Date(Date.now() - 3600000), // 1 hour ago (should have been retried)
          lastAttemptAt: new Date(Date.now() - 7200000), // 2 hours ago
          lastError: "Captcha solve failed",
          status: "FAILED",
        },
      ],
    });
  }

  // Seed ConcurrencyState test data
  await prisma.concurrencyState.createMany({
    data: [
      {
        site: "example.com",
        currentConcurrency: 5,
        activeRequests: 3,
        lastAdjustedAt: new Date(Date.now() - 600000), // 10 minutes ago
        adjustmentReason: "High success rate - increased by 10%",
      },
      {
        site: "test-store.com",
        currentConcurrency: 2,
        activeRequests: 1,
        lastAdjustedAt: new Date(Date.now() - 1800000), // 30 minutes ago
        adjustmentReason: "Block rate exceeded 20% - reduced by 50%",
      },
      {
        site: "competitor-site.com",
        currentConcurrency: 3,
        activeRequests: 0,
        lastAdjustedAt: new Date(Date.now() - 3600000), // 1 hour ago
        adjustmentReason: "Initial concurrency",
      },
    ],
  });

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
