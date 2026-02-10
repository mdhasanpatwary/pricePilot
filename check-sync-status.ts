import { prisma } from './lib/prisma';

async function checkSync() {
    const site = await prisma.site.findFirst({
        where: { id: 'cmlf4ph06000zo08ospo4u7rk' },
        select: {
            id: true,
            baseUrl: true,
            isSyncing: true,
            syncProcessed: true,
            syncTotal: true,
            syncLastAction: true,
            lastSyncAt: true,
        }
    });

    console.log('Site sync status:', JSON.stringify(site, null, 2));

    const logs = await prisma.syncLog.findMany({
        where: { siteId: 'cmlf4ph06000zo08ospo4u7rk' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
            level: true,
            message: true,
            createdAt: true,
        }
    });

    console.log('\nRecent sync logs:');
    logs.forEach(log => {
        console.log(`[${log.level}] ${log.message} (${log.createdAt.toISOString()})`);
    });

    await prisma.$disconnect();
}

checkSync().catch(console.error);
