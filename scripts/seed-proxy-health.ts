import { prisma } from "../lib/prisma";

async function seedProxyHealth() {
    console.log("Seeding proxy health data...");

    // Create some test proxy health records
    const proxies = [
        {
            proxyUrl: "http://proxy1.example.com:8080",
            proxyType: "residential",
            isHealthy: true,
            successCount: 1250,
            failureCount: 50,
            avgResponseTime: 450,
            lastChecked: new Date(),
        },
        {
            proxyUrl: "http://proxy2.example.com:8080",
            proxyType: "datacenter",
            isHealthy: true,
            successCount: 2100,
            failureCount: 100,
            avgResponseTime: 320,
            lastChecked: new Date(),
        },
        {
            proxyUrl: "http://proxy3.example.com:8080",
            proxyType: "residential",
            isHealthy: false,
            successCount: 450,
            failureCount: 550,
            avgResponseTime: 1200,
            lastChecked: new Date(),
        },
        {
            proxyUrl: "http://proxy4.example.com:8080",
            proxyType: "datacenter",
            isHealthy: true,
            successCount: 3200,
            failureCount: 80,
            avgResponseTime: 280,
            lastChecked: new Date(),
        },
        {
            proxyUrl: "http://proxy5.example.com:8080",
            proxyType: "residential",
            isHealthy: false,
            successCount: 120,
            failureCount: 380,
            avgResponseTime: 2500,
            lastChecked: new Date(),
        },
    ];

    for (const proxy of proxies) {
        await prisma.proxyHealth.upsert({
            where: { proxyUrl: proxy.proxyUrl },
            update: proxy,
            create: proxy,
        });
    }

    // Create some proxy metrics for the last 24 hours
    const now = new Date();
    for (const proxy of proxies) {
        for (let i = 0; i < 24; i++) {
            const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
            const totalRequests = Math.floor(Math.random() * 100) + 50;
            const successRate = proxy.isHealthy ? 0.85 + Math.random() * 0.1 : 0.3 + Math.random() * 0.3;
            const successfulRequests = Math.floor(totalRequests * successRate);
            const failedRequests = totalRequests - successfulRequests;

            await prisma.proxyMetrics.create({
                data: {
                    proxy: proxy.proxyUrl,
                    timestamp,
                    totalRequests,
                    successfulRequests,
                    failedRequests,
                    successRate: Math.round(successRate * 100 * 10) / 10, // Convert to percentage with 1 decimal
                    avgResponseTime: proxy.avgResponseTime + Math.floor(Math.random() * 200) - 100,
                },
            });
        }
    }

    console.log("Proxy health data seeded successfully!");
}

seedProxyHealth()
    .catch((e) => {
        console.error("Error seeding proxy health data:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
