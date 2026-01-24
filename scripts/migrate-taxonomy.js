
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting data migration: Categories & Brands...");

  try {
    // 1. Fetch all unique Categories from User Products
    const userProducts = await prisma.product.findMany({
      where: { site: { type: "USER" } },
      select: { id: true, category: true, brand: true, tenantId: true }
    });

    const uniqueCategories = new Set();
    const uniqueBrands = new Set();

    userProducts.forEach(p => {
      if (p.category) uniqueCategories.add(`${p.tenantId}:${p.category}`);
      if (p.brand) uniqueBrands.add(`${p.tenantId}:${p.brand}`);
    });

    console.log(`📊 Found ${uniqueCategories.size} unique categories and ${uniqueBrands.size} unique brands.`);

    // 2. Create Categories
    const categoryMap = new Map(); // key: "tenantId:Name" -> id
    for (const item of uniqueCategories) {
      const [tenantId, name] = item.split(/:(.+)/); // Split only on first colon
      if (!name) continue;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      
      // Upsert Category
      const cat = await prisma.category.upsert({
        where: {
          tenantId_slug: { tenantId, slug }
        },
        update: {},
        create: {
          tenantId,
          name,
          slug
        }
      });
      categoryMap.set(item, cat.id);
    }

    // 3. Create Brands
    const brandMap = new Map();
    for (const item of uniqueBrands) {
      const [tenantId, name] = item.split(/:(.+)/);
      if (!name) continue;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      const brand = await prisma.brand.upsert({
        where: {
          tenantId_slug: { tenantId, slug }
        },
        update: {},
        create: {
          tenantId,
          name,
          slug,
          aliases: [name]
        }
      });
      brandMap.set(item, brand.id);
    }

    // 4. Update Products
    console.log("🔗 Linking products to new normalized tables...");
    let updatedCount = 0;
    
    for (const p of userProducts) {
      const data = {};
      if (p.category) {
        const catId = categoryMap.get(`${p.tenantId}:${p.category}`);
        if (catId) data.categoryId = catId;
      }
      if (p.brand) {
        const brandId = brandMap.get(`${p.tenantId}:${p.brand}`);
        if (brandId) data.brandId = brandId;
      }

      if (Object.keys(data).length > 0) {
        await prisma.product.update({
          where: { id: p.id },
          data
        });
        updatedCount++;
      }
    }

    console.log(`✅ Successfully normalized ${updatedCount} products.`);
  } catch (error) {
    console.error("Critical Error during migration:", error);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
