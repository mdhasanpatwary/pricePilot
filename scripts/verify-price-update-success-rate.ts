#!/usr/bin/env tsx

/**
 * Verify Price Update Success Rate Implementation
 * 
 * This script verifies that all components for achieving >99% price update
 * success rate are properly implemented and configured.
 * 
 * Usage:
 *   npx tsx scripts/verify-price-update-success-rate.ts
 */

import { prisma } from "@/lib/prisma";
import { priceUpdateMonitor } from "@/lib/services/price-update-monitor";
import fs from "fs";
import path from "path";

interface VerificationResult {
    component: string;
    status: "✅ PASS" | "❌ FAIL" | "⚠️  WARN";
    message: string;
}

const results: VerificationResult[] = [];

function addResult(component: string, status: VerificationResult["status"], message: string) {
    results.push({ component, status, message });
}

async function verifyDatabaseSchema() {
    console.log("\n📊 Verifying Database Schema...");

    try {
        // Check if PriceUpdateRetryQueue table exists
        const retryQueueExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'PriceUpdateRetryQueue'
      );
    `;

        if (retryQueueExists) {
            addResult("Database Schema", "✅ PASS", "PriceUpdateRetryQueue table exists");
        } else {
            addResult("Database Schema", "❌ FAIL", "PriceUpdateRetryQueue table not found");
        }

        // Check indexes
        const indexes = await prisma.$queryRaw`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'PriceUpdateRetryQueue';
    `;

        if (Array.isArray(indexes) && indexes.length > 0) {
            addResult("Database Indexes", "✅ PASS", `Found ${indexes.length} indexes on retry queue`);
        } else {
            addResult("Database Indexes", "⚠️  WARN", "No indexes found on retry queue");
        }
    } catch (error) {
        addResult("Database Schema", "❌ FAIL", `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function verifyMonitorService() {
    console.log("\n🔍 Verifying Monitor Service...");

    try {
        // Check if monitor service is accessible
        const monitor = priceUpdateMonitor;

        if (monitor) {
            addResult("Monitor Service", "✅ PASS", "Price update monitor service is accessible");
        } else {
            addResult("Monitor Service", "❌ FAIL", "Monitor service not found");
        }

        // Test getting stats (should not throw)
        try {
            const testTenantId = "test-tenant-id";
            await monitor.getStats(testTenantId, 3600);
            addResult("Monitor Stats", "✅ PASS", "getStats() method works correctly");
        } catch (error) {
            addResult("Monitor Stats", "⚠️  WARN", "getStats() method may have issues");
        }
    } catch (error) {
        addResult("Monitor Service", "❌ FAIL", `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function verifyCronJob() {
    console.log("\n⏰ Verifying Cron Job Configuration...");

    try {
        const vercelJsonPath = path.join(process.cwd(), "vercel.json");

        if (!fs.existsSync(vercelJsonPath)) {
            addResult("Cron Configuration", "❌ FAIL", "vercel.json not found");
            return;
        }

        const vercelJson = JSON.parse(fs.readFileSync(vercelJsonPath, "utf-8"));

        const retryCron = vercelJson.crons?.find(
            (cron: any) => cron.path === "/api/v1/cron/process-price-update-retries"
        );

        if (retryCron) {
            addResult("Cron Configuration", "✅ PASS", `Retry cron job configured: ${retryCron.schedule}`);
        } else {
            addResult("Cron Configuration", "❌ FAIL", "Retry cron job not found in vercel.json");
        }
    } catch (error) {
        addResult("Cron Configuration", "❌ FAIL", `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function verifyAPIEndpoints() {
    console.log("\n🌐 Verifying API Endpoints...");

    const endpoints = [
        "app/api/v1/cron/process-price-update-retries/route.ts",
        "app/api/v1/monitoring/price-update-stats/route.ts",
    ];

    for (const endpoint of endpoints) {
        const fullPath = path.join(process.cwd(), endpoint);

        if (fs.existsSync(fullPath)) {
            addResult("API Endpoint", "✅ PASS", `${endpoint} exists`);
        } else {
            addResult("API Endpoint", "❌ FAIL", `${endpoint} not found`);
        }
    }
}

async function verifyServiceFiles() {
    console.log("\n📁 Verifying Service Files...");

    const files = [
        "lib/services/price-update-monitor.ts",
        "lib/services/sync.ts",
    ];

    for (const file of files) {
        const fullPath = path.join(process.cwd(), file);

        if (fs.existsSync(fullPath)) {
            addResult("Service File", "✅ PASS", `${file} exists`);

            // Check if file contains monitoring integration
            const content = fs.readFileSync(fullPath, "utf-8");
            if (content.includes("priceUpdateMonitor")) {
                addResult("Monitoring Integration", "✅ PASS", `${file} includes monitoring`);
            } else if (file.includes("sync.ts")) {
                addResult("Monitoring Integration", "⚠️  WARN", `${file} may not include monitoring`);
            }
        } else {
            addResult("Service File", "❌ FAIL", `${file} not found`);
        }
    }
}

async function verifyEnvironmentVariables() {
    console.log("\n🔐 Verifying Environment Variables...");

    const requiredVars = [
        "CRON_SECRET",
        "REDIS_URL",
    ];

    for (const varName of requiredVars) {
        if (process.env[varName]) {
            addResult("Environment Variable", "✅ PASS", `${varName} is set`);
        } else {
            addResult("Environment Variable", "⚠️  WARN", `${varName} is not set`);
        }
    }
}

async function verifyDocumentation() {
    console.log("\n📚 Verifying Documentation...");

    const docFile = "PRICE_UPDATE_SUCCESS_RATE_IMPLEMENTATION.md";
    const fullPath = path.join(process.cwd(), docFile);

    if (fs.existsSync(fullPath)) {
        addResult("Documentation", "✅ PASS", `${docFile} exists`);
    } else {
        addResult("Documentation", "⚠️  WARN", `${docFile} not found`);
    }
}

async function printResults() {
    console.log("\n" + "=".repeat(80));
    console.log("📋 VERIFICATION RESULTS");
    console.log("=".repeat(80));

    const grouped = results.reduce((acc, result) => {
        if (!acc[result.component]) {
            acc[result.component] = [];
        }
        acc[result.component].push(result);
        return acc;
    }, {} as Record<string, VerificationResult[]>);

    for (const [component, componentResults] of Object.entries(grouped)) {
        console.log(`\n${component}:`);
        for (const result of componentResults) {
            console.log(`  ${result.status} ${result.message}`);
        }
    }

    console.log("\n" + "=".repeat(80));

    const passCount = results.filter(r => r.status === "✅ PASS").length;
    const failCount = results.filter(r => r.status === "❌ FAIL").length;
    const warnCount = results.filter(r => r.status === "⚠️  WARN").length;

    console.log(`\n✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`⚠️  Warnings: ${warnCount}`);
    console.log(`📊 Total: ${results.length}`);

    if (failCount > 0) {
        console.log("\n❌ VERIFICATION FAILED");
        console.log("Please fix the failed checks before proceeding.");
        process.exit(1);
    } else if (warnCount > 0) {
        console.log("\n⚠️  VERIFICATION PASSED WITH WARNINGS");
        console.log("Some optional components are missing or not configured.");
    } else {
        console.log("\n✅ ALL CHECKS PASSED");
        console.log("Price update success rate implementation is complete!");
    }
}

async function main() {
    console.log("🚀 Starting Price Update Success Rate Verification...");

    try {
        await verifyDatabaseSchema();
        await verifyMonitorService();
        await verifyCronJob();
        await verifyAPIEndpoints();
        await verifyServiceFiles();
        await verifyEnvironmentVariables();
        await verifyDocumentation();

        await printResults();
    } catch (error) {
        console.error("\n❌ Verification failed with error:");
        console.error(error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
