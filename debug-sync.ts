import { prisma } from "./lib/prisma";

async function checkSync() {
  const sites = await prisma.site.findMany({
    where: { type: "USER" },
    include: {
      _count: {
        select: { Product: true }
      },
      SyncLog: {
        orderBy: { createdAt: "desc" },
        take: 5
      }
    }
  });

  console.log("--- SITES STATUS ---");
  sites.forEach(s => {
    console.log(`Site: ${s.baseUrl}`);
    console.log(`  Platform: ${s.platform}`);
    console.log(`  isSyncing: ${s.isSyncing}`);
    console.log(`  Processed: ${s.syncProcessed} / ${s.syncTotal}`);
    console.log(`  Products: ${s._count.Product}`);
    console.log(`  Logs:`);
    s.SyncLog.forEach(l => console.log(`    [${l.level}] ${l.createdAt.toISOString()}: ${l.message}`));
  });
}

checkSync().catch(console.error);
