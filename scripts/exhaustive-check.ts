
import { prisma } from '../lib/prisma';

async function main() {
    const tenantId = 'f1bad9f5-30c0-479f-8422-f70fe9748663';
    const targetId = '4867a87a-f250-4a85-b01f-0c4aeff4400a';

    try {
        const products = await prisma.product.findMany({
            where: { tenantId },
            select: { id: true }
        });

        console.log('Total products for tenant:', products.length);
        const found = products.find(p => p.id === targetId);
        if (found) {
            console.log('SUCCESS: Product found in list!');
        } else {
            console.log('FAILURE: Product NOT found in list.');
            // Check if there's any similar ID
            const similar = products.filter(p => p.id.startsWith('4867'));
            console.log('Products starting with 4867:', similar);
        }

    } catch (e) {
        console.error('Prisma Error:', e);
    }
}

main()
    .finally(async () => {
        await prisma.$disconnect();
    });
