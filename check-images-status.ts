import { prisma } from './lib/prisma';

async function checkImageStatus() {
  try {
    console.log('Checking product images in database...\n');

    const products = await prisma.product.findMany({
      select: {
        id: true,
        title: true,
        imageUrl: true,
        Site: {
          select: {
            type: true,
            baseUrl: true,
          }
        }
      },
      take: 10,
    });

    console.log(`Found ${products.length} products (showing first 10):\n`);

    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.title}`);
      console.log(`   Site Type: ${product.Site.type}`);
      console.log(`   Image URL: ${product.imageUrl || 'NOT SET'}`);
      console.log('');
    });

    const totalProducts = await prisma.product.count();
    const productsWithImages = await prisma.product.count({
      where: {
        imageUrl: {
          not: null,
        }
      }
    });

    console.log(`\nSummary:`);
    console.log(`Total products: ${totalProducts}`);
    console.log(`Products with images: ${productsWithImages}`);
    console.log(`Products without images: ${totalProducts - productsWithImages}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkImageStatus();
