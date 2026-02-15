
import 'dotenv/config';
import { prisma } from '../lib/prisma';

async function main() {
    console.log('Fetching slow queries...');
    const slowQueries = await prisma.slowQuery.findMany({
        orderBy: { executionTimeMs: 'desc' },
        take: 10
    });
    console.log(JSON.stringify(slowQueries, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value, 2));
    await prisma.$disconnect();
}

main().catch(console.error);
