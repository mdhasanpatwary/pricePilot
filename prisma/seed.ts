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
  const userSiteData = await prisma.site.create({
    data: {
      tenantId: tenant.id,
      type: "USER",
      platform: "OPENCART",
      baseUrl: "https://test-store.com",
      apiToken: "test-token",
    },
  });

  // 3b. Create Competitor Sites
  const competitor1 = await prisma.site.create({
    data: {
      tenantId: tenant.id,
      type: "COMPETITOR",
      platform: "GENERIC",
      baseUrl: "https://competitor1.com",
    },
  });

  const competitor2 = await prisma.site.create({
    data: {
      tenantId: tenant.id,
      type: "COMPETITOR",
      platform: "GENERIC",
      baseUrl: "https://competitor2.com",
    },
  });

  // 4. Create Products for User Store
  const userProduct1 = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      siteId: userSiteData.id,
      title: "Wireless Gaming Mouse",
      sku: "WGM-001",
      brand: "TechGear",
      model: "Pro X",
      category: "Electronics",
      currentPrice: 79.99,
      inStock: true,
      stockLevel: 50,
      imageUrl: "https://example.com/images/mouse.jpg",
    },
  });

  const userProduct2 = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      siteId: userSiteData.id,
      title: "Mechanical Keyboard RGB",
      sku: "MKB-002",
      brand: "KeyMaster",
      model: "Elite 87",
      category: "Electronics",
      currentPrice: 129.99,
      inStock: true,
      stockLevel: 30,
      imageUrl: "https://example.com/images/keyboard.jpg",
    },
  });

  const userProduct3 = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      siteId: userSiteData.id,
      title: "USB-C Hub 7-in-1",
      sku: "HUB-003",
      brand: "ConnectPro",
      model: "Hub Max",
      category: "Accessories",
      currentPrice: 49.99,
      inStock: true,
      stockLevel: 100,
      imageUrl: "https://example.com/images/hub.jpg",
    },
  });

  // 5. Create Competitor Products
  const compProduct1 = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      siteId: competitor1.id,
      title: "Wireless Gaming Mouse Pro X",
      sku: "COMP-WGM-001",
      brand: "TechGear",
      model: "Pro X",
      category: "Electronics",
      currentPrice: 74.99,
      inStock: true,
      url: "https://competitor1.com/products/gaming-mouse",
      imageUrl: "https://example.com/images/mouse-comp.jpg",
    },
  });

  const compProduct2 = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      siteId: competitor1.id,
      title: "Mechanical Keyboard RGB Elite",
      sku: "COMP-MKB-002",
      brand: "KeyMaster",
      model: "Elite 87",
      category: "Electronics",
      currentPrice: 119.99,
      inStock: true,
      url: "https://competitor1.com/products/keyboard",
      imageUrl: "https://example.com/images/keyboard-comp.jpg",
    },
  });

  const compProduct3 = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      siteId: competitor2.id,
      title: "USB-C Hub 7-Port",
      sku: "COMP-HUB-003",
      brand: "ConnectPro",
      model: "Hub Max",
      category: "Accessories",
      currentPrice: 44.99,
      inStock: true,
      url: "https://competitor2.com/products/usb-hub",
      imageUrl: "https://example.com/images/hub-comp.jpg",
    },
  });

  // 6. Create Product Matches
  await prisma.productMatch.createMany({
    data: [
      {
        userProductId: userProduct1.id,
        competitorProductId: compProduct1.id,
        matchType: "AUTO_MODEL",
        confidenceScore: 95.5,
        status: "APPROVED",
      },
      {
        userProductId: userProduct2.id,
        competitorProductId: compProduct2.id,
        matchType: "AUTO_MODEL",
        confidenceScore: 92.0,
        status: "APPROVED",
      },
      {
        userProductId: userProduct3.id,
        competitorProductId: compProduct3.id,
        matchType: "AUTO_MODEL",
        confidenceScore: 88.5,
        status: "PENDING",
      },
    ],
  });

  // 7. Create Price History
  await prisma.priceHistory.createMany({
    data: [
      {
        productId: userProduct1.id,
        price: 79.99,
        recordedAt: new Date(),
      },
      {
        productId: userProduct1.id,
        price: 84.99,
        recordedAt: new Date(Date.now() - 86400000), // 1 day ago
      },
      {
        productId: compProduct1.id,
        price: 74.99,
        recordedAt: new Date(),
      },
      {
        productId: compProduct1.id,
        price: 79.99,
        recordedAt: new Date(Date.now() - 86400000),
      },
    ],
  });

  // 8. Create a Pricing Rule
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

  // 9. Seed test data for new tables

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
  await prisma.concurrencyState.deleteMany(); // Clear existing data first
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
