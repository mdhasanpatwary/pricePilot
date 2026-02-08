/**
 * Check Database Status
 * Shows all important data in the database
 */

import 'dotenv/config';
import { prisma } from './lib/prisma';

async function checkDatabase() {
    try {
        console.log('🔍 Checking database status...\n');
        await prisma.$connect();

        // Count all important tables
        const counts = {
            tenants: await prisma.tenant.count(),
            users: await prisma.user.count(),
            sites: await prisma.site.count(),
            products: await prisma.product.count(),
            scrapingSessions: await prisma.scrapingSession.count(),
            syncLogs: await prisma.syncLog.count(),
            sessions: await prisma.session.count(),
        };

        console.log('📊 Database Statistics:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`👥 Tenants: ${counts.tenants}`);
        console.log(`👤 Users: ${counts.users}`);
        console.log(`🏪 Sites: ${counts.sites}`);
        console.log(`📦 Products: ${counts.products}`);
        console.log(`🔄 Scraping Sessions: ${counts.scrapingSessions}`);
        console.log(`📝 Sync Logs: ${counts.syncLogs}`);
        console.log(`🔐 Active Sessions: ${counts.sessions}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Show users
        if (counts.users > 0) {
            console.log('👥 Users in database:');
            const users = await prisma.user.findMany({
                select: {
                    email: true,
                    name: true,
                    role: true,
                    isSuperAdmin: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
            });

            for (const user of users) {
                console.log(`   📧 ${user.email}`);
                console.log(`      Name: ${user.name || 'N/A'}`);
                console.log(`      Role: ${user.role}${user.isSuperAdmin ? ' (Super Admin)' : ''}`);
                console.log(`      Created: ${user.createdAt.toISOString()}`);
                console.log('');
            }
        } else {
            console.log('⚠️  No users found in database!');
            console.log('   Run: npx tsx create-admin.ts\n');
        }

        // Show tenants
        if (counts.tenants > 0) {
            console.log('🏢 Tenants in database:');
            const tenants = await prisma.tenant.findMany({
                select: {
                    companyName: true,
                    planType: true,
                    createdAt: true,
                    _count: {
                        select: {
                            User: true,
                            Site: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            for (const tenant of tenants) {
                console.log(`   🏢 ${tenant.companyName}`);
                console.log(`      Plan: ${tenant.planType}`);
                console.log(`      Users: ${tenant._count.User}`);
                console.log(`      Sites: ${tenant._count.Site}`);
                console.log(`      Created: ${tenant.createdAt.toISOString()}`);
                console.log('');
            }
        }

        // Check if database looks healthy
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        if (counts.users === 0) {
            console.log('❌ Database is EMPTY - No users found');
            console.log('   This is why you cannot login!');
            console.log('\n💡 Solution: Run this command to create admin user:');
            console.log('   npx tsx create-admin.ts\n');
        } else {
            console.log('✅ Database looks healthy');
            console.log(`   ${counts.users} user(s) found`);
            console.log(`   ${counts.tenants} tenant(s) found\n`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDatabase();
