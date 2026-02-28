import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

async function main() {
    const sites = await prisma.site.findMany({
        where: { isAdvancedProtected: true },
        select: { id: true, baseUrl: true, isAdvancedProtected: true }
    });
    console.log("Protected Sites Before Reset:", sites);

    // Unblock DomainProfiles
    await prisma.domainProfile.updateMany({
        where: { OR: [{ needsManualReview: true }, { protectionLevel: { in: ["ADVANCED", "BLOCKED", "CLOUDFLARE", "PERIMETERX", "DATADOME"] } }] },
        data: { needsManualReview: false, protectionLevel: "UNKNOWN" }
    });
    console.log("Reset domain profiles.");

    // Unblock Sites
    const siteUpdate = await prisma.site.updateMany({
        where: { isAdvancedProtected: true },
        data: {
            isAdvancedProtected: false,
            advancedAccessReason: null,
            advancedAccessRequiredAt: null,
            advancedAccessStatus: "NOT_REQUIRED",
            lastSecurityBlockAt: null
        }
    });
    console.log(`Marked ${siteUpdate.count} sites as not advanced protected.`);

    // Reset Product Price Anomalies
    const anomalies = await prisma.product.updateMany({
        where: { priceAnomalyActive: true },
        data: { priceAnomalyActive: false, priceAnomalyDetectedAt: null, priceAnomalyData: Prisma.DbNull }
    });
    console.log(`Cleared ${anomalies.count} price anomalies.`);

    // Clear generic consecutive scrape failures
    const products = await prisma.product.updateMany({
        where: { consecutiveScrapeFailures: { gt: 0 } },
        data: { consecutiveScrapeFailures: 0, lastScrapeFailedAt: null }
    });
    console.log(`Cleared consecutive failure counters for ${products.count} products.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
