import { prisma } from "./lib/prisma";

async function checkData() {
  console.log("Checking database data...\n");

  const tenants = await prisma.tenant.findMany();
  console.log(`Tenants: ${tenants.length}`);
  tenants.forEach(t => console.log(`  - ${t.companyName} (${t.id})`));

  const users = await prisma.user.findMany();
  console.log(`\nUsers: ${users.length}`);
  users.forEach(u => console.log(`  - ${u.email} (tenant: ${u.tenantId})`));

  const sites = await prisma.site.findMany();
  console.log(`\nSites: ${sites.length}`);
  sites.forEach(s => console.log(`  - ${s.baseUrl} (${s.type}) - tenant: ${s.tenantId}`));

  const products = await prisma.product.findMany({
    include: { Site: true }
  });
  console.log(`\nProducts: ${products.length}`);
  products.forEach(p => console.log(`  - ${p.title} (${p.sku}) - site: ${p.Site.baseUrl} (${p.Site.type})`));

  await prisma.$disconnect();
}

checkData().catch(console.error);
