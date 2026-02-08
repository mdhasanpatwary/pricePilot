
import { prisma } from '../lib/prisma';

async function main() {
    const tenantId = 'f1bad9f5-30c0-479f-8422-f70fe9748663';
    try {
        const productCount = await prisma.product.count({
            where: { tenantId }
        });
        console.log('Total products for tenant:', productCount);

        const sample = await prisma.product.findMany({
            where: { tenantId },
            take: 3,
            select: { id: true, title: true }
        });
        console.log('Sample IDs for tenant:', JSON.stringify(sample, null, 2));

        const totalProductsGlobal = await prisma.product.count();
        console.log('Total products global:', totalProductsGlobal);

    } catch (e) {
        console.error('Prisma Error:', e);
    }
}

main()
    .finally(async () => {
        await prisma.$disconnect();
    });
