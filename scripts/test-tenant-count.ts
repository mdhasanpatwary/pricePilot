
import { prisma } from '../lib/prisma';

async function main() {
    console.log('Starting test...');
    const start = Date.now();
    const count = await prisma.tenant.count();
    const end = Date.now();
    console.log(`Tenant count: ${count}, Time: ${end - start}ms`);
    await prisma.$disconnect();
}

main().catch(console.error);
