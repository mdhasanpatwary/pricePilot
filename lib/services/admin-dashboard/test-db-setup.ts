/**
 * Test script to verify database schema and data layer setup
 * Run with: npx ts-node lib/services/admin-dashboard/test-db-setup.ts
 */

import { prisma } from "@/lib/prisma";
import { redisSessionManager } from "../redis-session-manager";

async function testDatabaseSetup() {
    console.log("🧪 Testing Admin Dashboard Database Setup...\n");

    try {
        // Test 1: Create a scraping session
        console.log("1️⃣ Testing ScrapingSession model...");
        const session = await prisma.scrapingSession.create({
            data: {
                id: "test-session-" + Date.now(),
                tenantId: "test-tenant",
                tenantName: "Test Tenant",
                siteUrl: "https://example.com",
                targetUrl: "https://example.com/product/123",
                status: "initializing",
                currentStage: "proxy_selection",
                requestsCompleted: 0,
                requestsTotal: 1,
                errors: [],
                metrics: {
                    navigationTime: 0,
                    challengeSolveTime: 0,
                    extractionTime: 0,
                    totalTime: 0,
                },
            },
        });
        console.log("✅ ScrapingSession created:", session.id);

        // Test 2: Create a simulation result
        console.log("\n2️⃣ Testing SimulationResult model...");
        const simulation = await prisma.simulationResult.create({
            data: {
                id: "test-sim-" + Date.now(),
                scenario: "rotation",
                config: {
                    scenario: "rotation",
                    targetSite: "https://example.com",
                    proxyPool: [],
                    requestCount: 10,
                },
                requests: [],
                summary: {
                    totalRequests: 10,
                    successfulRequests: 8,
                    failedRequests: 2,
                    averageResponseTime: 500,
                    proxiesUsed: 3,
                    rotationPattern: [],
                },
                recommendations: ["Test recommendation"],
                startTime: new Date(),
                endTime: new Date(),
            },
        });
        console.log("✅ SimulationResult created:", simulation.id);

        // Test 3: Create a system alert
        console.log("\n3️⃣ Testing SystemAlert model...");
        const alert = await prisma.systemAlert.create({
            data: {
                alertType: "component_failure",
                severity: "warning",
                title: "Test Alert",
                message: "This is a test alert",
                context: { test: true },
                acknowledged: false,
            },
        });
        console.log("✅ SystemAlert created:", alert.id);

        // Test 4: Test Redis session manager
        console.log("\n4️⃣ Testing Redis Session Manager...");
        await redisSessionManager.setSession(session.id, {
            tenantId: session.tenantId,
            status: session.status,
            currentStage: session.currentStage,
            proxyUsed: null,
            startTime: session.startTime.toISOString(),
            metrics: JSON.stringify(session.metrics),
        });
        const redisSession = await redisSessionManager.getSession(session.id);
        console.log("✅ Redis session stored and retrieved:", redisSession?.tenantId);

        // Test 5: Test Redis metrics
        console.log("\n5️⃣ Testing Redis Metrics...");
        await redisSessionManager.setMetrics({
            activeSessions: 5,
            requestsPerMinute: 100,
            avgResponseTime: 250,
            lastUpdated: new Date().toISOString(),
        });
        const metrics = await redisSessionManager.getMetrics();
        console.log("✅ Redis metrics stored and retrieved:", metrics?.activeSessions);

        // Cleanup
        console.log("\n🧹 Cleaning up test data...");
        await prisma.scrapingSession.delete({ where: { id: session.id } });
        await prisma.simulationResult.delete({ where: { id: simulation.id } });
        await prisma.systemAlert.delete({ where: { id: alert.id } });
        await redisSessionManager.deleteSession(session.id, session.tenantId);
        console.log("✅ Cleanup complete");

        console.log("\n✨ All tests passed! Database schema and data layer setup is working correctly.\n");
    } catch (error) {
        console.error("\n❌ Test failed:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run tests
testDatabaseSetup();
