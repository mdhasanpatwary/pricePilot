
import { prisma } from '../lib/prisma';

async function main() {
    const productId = '4867a87a-f250-4a85-b01f-0c4aeff4400a';
    try {
        const product = await prisma.product.findUnique({
            where: { id: productId },
            select: {
                id: true,
                tenantId: true,
                title: true,
            }
        });

        console.log('Product Check:', JSON.stringify(product, null, 2));

        if (product) {
            const tenant = await prisma.tenant.findUnique({
                where: { id: product.tenantId }
            });
            console.log('Tenant Check:', JSON.stringify(tenant, null, 2));
        } else {
            console.log('Product not found in DB with ID:', productId);
            // Check if it exists with different casing or as a subset? No, ID is UUID.
            // Let's check a few products from the table
            const anyProducts = await prisma.product.findMany({ take: 5 });
            console.log('Sample Products IDs:', anyProducts.map(p => p.id));
        }
    } catch (e) {
        console.error('Prisma Error:', e);
    }
}

main()
    .finally(async () => {
        await prisma.$disconnect();
    });
