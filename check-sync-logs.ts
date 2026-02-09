import { prisma } from './lib/prisma';

async function checkSyncLogs() {
    const site = await prisma.site.findFirst({
        where: {
            tenantId: 'f1bad9f5-30c0-479f-8422-f70fe9748663',
            type: 'USER'
        },
        select: { id: true, baseUrl: true, lastSyncAt: true, isSyncing: true }
    });

    if (!site) {
        console.log('❌ No USER site found');
        return;
    }

    console.log('🔍 Site:', site.baseUrl);
    console.log('Last sync:', site.lastSyncAt);
    console.log('Currently syncing:', site.isSyncing);

    const logs = await prisma.syncLog.findMany({
        where: { siteId: site.id },
        orderBy: { createdAt: 'desc' },
        take: 30
    });

    console.log(`\n📋 Recent sync logs (${logs.length}):`);
    logs.forEach(log => {
        const time = log.createdAt.toLocaleTimeString();
        console.log(`[${time}] [${log.level}] ${log.message}`);
    });

    await prisma.$disconnect();
}

checkSyncLogs();
