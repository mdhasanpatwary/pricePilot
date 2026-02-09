import { prisma } from './lib/prisma';

async function checkImages() {
    const userProducts = await prisma.product.findMany({
        where: {
            tenantId: 'f1bad9f5-30c0-479f-8422-f70fe9748663',
            Site: { type: 'USER' }
        },
        select: {
            id: true,
            title: true,
            imageUrl: true,
            Site: { select: { baseUrl: true } }
        },
        take: 10
    });

    console.log('USER Site Products (first 10):');
    userProducts.forEach(p => {
        console.log(`- ${p.title.substring(0, 50)}: ${p.imageUrl || 'NO IMAGE'}`);
    });

    const withImages = userProducts.filter(p => p.imageUrl).length;
    console.log(`\n${withImages}/${userProducts.length} have images`);

    await prisma.$disconnect();
}

checkImages();
