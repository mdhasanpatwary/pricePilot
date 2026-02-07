/**
 * Reset admin user password
 * Usage: npx tsx scripts/reset-admin-password.ts <email> <new-password>
 */

import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

async function resetPassword() {
    const email = process.argv[2];
    const newPassword = process.argv[3];

    if (!email || !newPassword) {
        console.error('Usage: npx tsx scripts/reset-admin-password.ts <email> <new-password>');
        process.exit(1);
    }

    try {
        // Find user
        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                name: true,
                isSuperAdmin: true,
            },
        });

        if (!user) {
            console.error(`❌ User with email "${email}" not found`);
            process.exit(1);
        }

        console.log(`Found user: ${user.email}`);
        console.log(`Super Admin: ${user.isSuperAdmin ? 'Yes' : 'No'}`);

        // Hash new password
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Update user
        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                emailVerified: new Date(), // Also set email as verified
                isSuperAdmin: true, // Ensure super admin
            },
        });

        console.log('\n✅ Password reset successfully!');
        console.log(`📧 Email: ${email}`);
        console.log(`🔑 New Password: ${newPassword}`);
        console.log(`👑 Super Admin: Yes`);
        console.log(`✉️  Email Verified: Yes`);
        console.log('\nYou can now log in with these credentials.');

    } catch (error) {
        console.error('Error resetting password:', error);
    } finally {
        await prisma.$disconnect();
    }
}

resetPassword();
