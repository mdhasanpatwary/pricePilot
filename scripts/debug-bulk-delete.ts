
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const productId = '4867a87a-f250-4a85-b01f-0c4aeff4400a';
    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
            id: true,
            tenantId: true,
            title: true,
            siteId: true,
        }
    });

    console.log('Product Check:', JSON.stringify(product, null, 2));

    if (product) {
        const tenant = await prisma.tenant.findUnique({
            where: { id: product.tenantId }
        });
        console.log('Tenant Check:', JSON.stringify(tenant, null, 2));
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
