/**
 * Debug Login Issue
 * Run this to check if your user exists and credentials are correct
 */

import 'dotenv/config';
import { prisma } from './lib/prisma';
import bcrypt from 'bcryptjs';

async function debugLogin() {
    try {
        console.log('🔍 Checking database connection...');
        await prisma.$connect();
        console.log('✅ Database connected\n');

        // Get all users
        console.log('📋 Fetching all users...');
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isSuperAdmin: true,
                tenantId: true,
                passwordHash: true,
            },
        });

        console.log(`Found ${users.length} users:\n`);

        for (const user of users) {
            console.log(`👤 User: ${user.email}`);
            console.log(`   Name: ${user.name || 'N/A'}`);
            console.log(`   Role: ${user.role}`);
            console.log(`   Super Admin: ${user.isSuperAdmin ? 'Yes' : 'No'}`);
            console.log(`   Tenant ID: ${user.tenantId || 'N/A'}`);
            console.log(`   Has Password: ${user.passwordHash ? 'Yes' : 'No'}`);
            console.log('');
        }

        // Check sessions
        console.log('🔐 Checking active sessions...');
        const sessions = await prisma.session.findMany({
            include: {
                User: {
                    select: {
                        email: true,
                    },
                },
            },
        });

        console.log(`Found ${sessions.length} active sessions:\n`);

        for (const session of sessions) {
            const isExpired = new Date(session.expires) < new Date();
            console.log(`📅 Session for: ${session.User.email}`);
            console.log(`   Expires: ${session.expires.toISOString()}`);
            console.log(`   Status: ${isExpired ? '❌ EXPIRED' : '✅ Active'}`);
            console.log(`   Last Used: ${session.lastUsedAt?.toISOString() || 'Never'}`);
            console.log('');
        }

        // Test password for a specific user (you can modify the email)
        const testEmail = process.argv[2];
        const testPassword = process.argv[3];

        if (testEmail && testPassword) {
            console.log(`\n🔑 Testing credentials for: ${testEmail}`);
            const user = await prisma.user.findUnique({
                where: { email: testEmail },
            });

            if (!user) {
                console.log('❌ User not found!');
            } else if (!user.passwordHash) {
                console.log('❌ User has no password set!');
            } else {
                const isValid = await bcrypt.compare(testPassword, user.passwordHash);
                console.log(isValid ? '✅ Password is CORRECT' : '❌ Password is INCORRECT');
            }
        } else {
            console.log('\n💡 To test specific credentials, run:');
            console.log('   npx tsx debug-login.ts your@email.com yourpassword');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debugLogin();
