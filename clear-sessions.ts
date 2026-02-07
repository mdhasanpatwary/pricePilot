/**
 * Clear all sessions - Use this if you're logged out and can't log back in
 */

import 'dotenv/config'; // Load .env file
import { prisma } from './lib/prisma';

async function clearSessions() {
    try {
        console.log('🔄 Connecting to database...');

        // Check if DATABASE_URL is set
        if (!process.env.DATABASE_URL) {
            console.error('❌ DATABASE_URL is not set in .env file');
            process.exit(1);
        }

        await prisma.$connect();
        console.log('✅ Connected\n');

        console.log('🗑️  Clearing all sessions...');
        const result = await prisma.session.deleteMany();
        console.log(`✅ Cleared ${result.count} sessions\n`);

        console.log('✨ Done! You can now login again.');
        console.log('👉 Go to: http://localhost:3000/auth/login');

    } catch (error) {
        console.error('❌ Error:', error);
        console.error('\n💡 Tip: Make sure your dev server is NOT running when you run this script.');
        console.error('   Stop it with Ctrl+C first, then run this script again.');
    } finally {
        await prisma.$disconnect();
    }
}

clearSessions();
