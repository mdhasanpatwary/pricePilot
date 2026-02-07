/**
 * Create Admin User
 * Creates a new admin user with tenant
 */

import 'dotenv/config';
import { prisma } from './lib/prisma';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

async function createAdmin() {
    try {
        console.log('🔄 Connecting to database...');
        await prisma.$connect();
        console.log('✅ Connected\n');

        // Get email and password from command line or use defaults
        const email = process.argv[2] || 'admin@pricepilot.com';
        const password = process.argv[3] || 'admin123';
        const companyName = process.argv[4] || 'PricePilot Admin';

        console.log('📝 Creating admin user...');
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);
        console.log(`   Company: ${companyName}\n`);

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            console.log('⚠️  User already exists!');
            console.log('   Updating password...\n');

            const hashedPassword = await bcrypt.hash(password, 10);
            await prisma.user.update({
                where: { email },
                data: { passwordHash: hashedPassword },
            });

            console.log('✅ Password updated successfully!');
            console.log(`\n👉 Login at: http://localhost:3000/auth/login`);
            console.log(`   Email: ${email}`);
            console.log(`   Password: ${password}`);
            return;
        }

        // Create tenant first
        console.log('🏢 Creating tenant...');
        const tenant = await prisma.tenant.create({
            data: {
                id: randomUUID(),
                companyName,
                planType: 'PREMIUM',
                updatedAt: new Date(),
            },
        });
        console.log(`✅ Tenant created: ${tenant.companyName}\n`);

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create admin user
        console.log('👤 Creating admin user...');
        await prisma.user.create({
            data: {
                id: randomUUID(),
                email,
                name: 'Admin',
                passwordHash: hashedPassword,
                role: 'ADMIN',
                isSuperAdmin: true,
                tenantId: tenant.id,
                emailVerified: new Date(), // Auto-verify for admin
                updatedAt: new Date(),
            },
        });

        console.log('✅ Admin user created successfully!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 Setup Complete!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`\n👉 Login at: http://localhost:3000/auth/login`);
        console.log(`\n📧 Email: ${email}`);
        console.log(`🔑 Password: ${password}`);
        console.log(`\n⚠️  IMPORTANT: Change your password after first login!`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createAdmin();
