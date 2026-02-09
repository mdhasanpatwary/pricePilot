import { prisma } from './lib/prisma';

async function checkData() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@pricepilot.com' },
    select: { id: true, tenantId: true, email: true }
  });

  if (!user) {
    console.log('❌ User not found');
    process.exit(1);
  }

  console.log('✅ User found:', user.email);
  console.log('Tenant ID:', user.tenantId);

  const sites = await prisma.site.findMany({
    where: { tenantId: user.tenantId },
    select: { id: true, type: true, baseUrl: true, platform: true }
  });

  console.log('\n📊 Sites:', sites.length);
  sites.forEach(s => console.log('  -', s.type, s.platform, s.baseUrl));

  const products = await prisma.product.findMany({
    where: { tenantId: user.tenantId },
    select: { id: true, title: true, siteId: true }
  });

  console.log('\n📦 Products:', products.length);

  await prisma.$disconnect();
}

checkData();
