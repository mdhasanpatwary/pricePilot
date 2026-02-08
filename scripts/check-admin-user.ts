/**
 * Check if admin user exists and has correct permissions
 */

import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

async function checkAdminUser() {
    try {
        console.log('Checking for admin users...\n');

        // Find all users
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                isSuperAdmin: true,
                passwordHash: true,
                tenantId: true,
                createdAt: true,
            },
        });

        if (users.length === 0) {
            console.log('❌ No users found in database!');
            console.log('\nTo create an admin user, run:');
            console.log('npm run seed');
            return;
        }

        console.log(`Found ${users.length} user(s):\n`);

        for (const user of users) {
            console.log(`📧 Email: ${user.email}`);
            console.log(`👤 Name: ${user.name || 'N/A'}`);
            console.log(`🔑 Super Admin: ${user.isSuperAdmin ? '✅ YES' : '❌ NO'}`);
            console.log(`🔐 Has Password: ${user.passwordHash ? '✅ YES' : '❌ NO'}`);
            console.log(`🏢 Tenant ID: ${user.tenantId || 'N/A'}`);
            console.log(`📅 Created: ${user.createdAt.toISOString()}`);

            // Test password if provided
            if (process.argv[2] && user.passwordHash) {
                const testPassword = process.argv[2];
                const isValid = await bcrypt.compare(testPassword, user.passwordHash);
                console.log(`🔓 Password "${testPassword}" valid: ${isValid ? '✅ YES' : '❌ NO'}`);
            }

            console.log('---\n');
        }

        // Check for super admins
        const superAdmins = users.filter(u => u.isSuperAdmin);
        if (superAdmins.length === 0) {
            console.log('⚠️  WARNING: No super admin users found!');
            console.log('\nTo make a user super admin, run:');
            console.log(`UPDATE "User" SET "isSuperAdmin" = true WHERE email = 'your-email@example.com';`);
        } else {
            console.log(`✅ Found ${superAdmins.length} super admin(s)`);
        }

    } catch (error) {
        console.error('Error checking users:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkAdminUser();
