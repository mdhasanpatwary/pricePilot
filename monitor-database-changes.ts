/**
 * Monitor Database Changes
 * Continuously monitors user/tenant count to detect deletions
 */

import 'dotenv/config';
import { prisma } from './lib/prisma';

let previousCounts = {
    tenants: 0,
    users: 0,
};

async function checkCounts() {
    try {
        const counts = {
            tenants: await prisma.tenant.count(),
            users: await prisma.user.count(),
        };

        const timestamp = new Date().toISOString();

        // Check if counts decreased
        if (counts.tenants < previousCounts.tenants) {
            console.log(`\n🚨 [${timestamp}] ALERT: Tenants decreased from ${previousCounts.tenants} to ${counts.tenants}`);
        }

        if (counts.users < previousCounts.users) {
            console.log(`\n🚨 [${timestamp}] ALERT: Users decreased from ${previousCounts.users} to ${counts.users}`);
        }

        // Log current status
        if (counts.tenants !== previousCounts.tenants || counts.users !== previousCounts.users) {
            console.log(`[${timestamp}] Tenants: ${counts.tenants}, Users: ${counts.users}`);
        }

        previousCounts = counts;

    } catch (error) {
        console.error('Error checking counts:', error);
    }
}

async function main() {
    console.log('🔍 Starting database monitor...');
    console.log('   Checking every 5 seconds for changes');
    console.log('   Press Ctrl+C to stop\n');

    await prisma.$connect();

    // Initial count
    previousCounts = {
        tenants: await prisma.tenant.count(),
        users: await prisma.user.count(),
    };

    console.log(`Initial counts - Tenants: ${previousCounts.tenants}, Users: ${previousCounts.users}\n`);

    // Check every 5 seconds
    setInterval(checkCounts, 5000);
}

main().catch(console.error);
