
import { prisma } from '../lib/prisma';

async function main() {
    const idsToCheck = [
        '4867a87a-f250-4a85-b01f-0c4aeff4400a',
        '6671c765-1da8-45c4-9cfd-3b267ef1822f',
        '914e07aa-03c8-48bc-a97d-254c2dd8fd0e'
    ];

    try {
        const products = await prisma.product.findMany({
            where: { id: { in: idsToCheck } },
            select: { id: true, tenantId: true, title: true }
        });

        console.log('Found products:', JSON.stringify(products, null, 2));

        const totalCount = await prisma.product.count();
        console.log('Total products in database:', totalCount);

    } catch (e) {
        console.error('Prisma Error:', e);
    }
}

main()
    .finally(async () => {
        await prisma.$disconnect();
    });
