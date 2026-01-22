const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const productsWithImage = await prisma.product.count({
    where: {
      imageUrl: { not: null }
    }
  });
  const totalProducts = await prisma.product.count();
  console.log(`Products with image: ${productsWithImage} / ${totalProducts}`);

  const sample = await prisma.product.findFirst({
    where: { imageUrl: { not: null } },
    select: { title: true, imageUrl: true }
  });
  console.log('Sample product with image:', sample);
}

main().finally(() => prisma.$disconnect());
