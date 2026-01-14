const { prisma } = require('../lib/prisma');
const bcrypt = require('bcryptjs');

async function main() {
  console.log('Seeding database for E2E tests...');

  // 0. Cleanup
  await prisma.pricingRule.deleteMany();
  await prisma.productMatch.deleteMany();
  await prisma.priceHistory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.site.deleteMany();

  // 1. Create a Test Tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: 'test-tenant-id' },
    update: {},
    create: {
      id: 'test-tenant-id',
      companyName: 'E2E Test Corp',
    },
  });

  // 2. Create a Test User
  const hashedPassword = await bcrypt.hash('password123', 10);
  await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: { passwordHash: hashedPassword },
    create: {
      email: 'test@example.com',
      passwordHash: hashedPassword,
      tenantId: tenant.id,
      role: 'ADMIN',
    },
  });

  // 3. Create a User Site (Integration)
  const userSite = await prisma.site.create({
    data: {
      tenantId: tenant.id,
      type: 'USER',
      platform: 'OPENCART',
      baseUrl: 'https://test-store.com',
      apiToken: 'test-token',
    },
  });

  // 4. Create an Initial Product for the User
  const product = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      siteId: userSite.id,
      title: 'E2E Test Product',
      sku: 'E2E-SKU-001',
      currentPrice: 100.00,
    },
  });

  // 5. Create a Pricing Rule
  await prisma.pricingRule.create({
    data: {
      tenantId: tenant.id,
      name: 'Default Undercut',
      strategy: 'UNDERCUT',
      parameter: 0.50,
      priority: 1,
      isActive: true,
    }
  });

  console.log('Seeding complete!');
  console.log('User: test@example.com / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
