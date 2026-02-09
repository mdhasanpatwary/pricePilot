import { prisma } from './lib/prisma';
import bcrypt from 'bcryptjs';

async function checkUser() {
    try {
        const user = await prisma.user.findUnique({
            where: { email: 'admin@pricepilot.com' },
            include: { Tenant: true }
        });

        if (!user) {
            console.log('❌ User not found!');
            return;
        }

        console.log('✅ User found:');
        console.log('   Email:', user.email);
        console.log('   Name:', user.name);
        console.log('   Role:', user.role);
        console.log('   Super Admin:', user.isSuperAdmin);
        console.log('   Tenant:', user.Tenant?.companyName);
        console.log('   Email Verified:', user.emailVerified);

        // Test password
        const testPassword = 'admin123';
        const isValid = await bcrypt.compare(testPassword, user.passwordHash);
        console.log('\n🔑 Password Test:');
        console.log('   Testing password:', testPassword);
        console.log('   Password valid:', isValid);

        if (!isValid) {
            console.log('\n⚠️  Password does not match! Resetting...');
            const newHash = await bcrypt.hash(testPassword, 10);
            await prisma.user.update({
                where: { email: 'admin@pricepilot.com' },
                data: {
                    passwordHash: newHash,
                    emailVerified: new Date()
                }
            });
            console.log('✅ Password reset complete!');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkUser();
