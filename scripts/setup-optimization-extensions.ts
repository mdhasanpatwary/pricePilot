/**
 * Setup Database Optimization Extensions
 * 
 * This script sets up the required PostgreSQL extensions for database optimization:
 * - pg_stat_statements: Query performance monitoring
 * - pgstattuple: Table and index bloat analysis
 * 
 * Usage: npx tsx scripts/setup-optimization-extensions.ts
 */

import { prisma } from '@/lib/prisma';

async function setupExtensions() {
    console.log('Setting up database optimization extensions...\n');

    try {
        // Enable pg_stat_statements
        console.log('1. Enabling pg_stat_statements extension...');
        await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pg_stat_statements');
        console.log('   ✓ pg_stat_statements enabled');

        // Enable pgstattuple
        console.log('2. Enabling pgstattuple extension...');
        await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pgstattuple');
        console.log('   ✓ pgstattuple enabled');

        // Check if extensions are enabled
        console.log('\n3. Verifying extensions...');
        const extensions = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension 
      WHERE extname IN ('pg_stat_statements', 'pgstattuple')
    `;

        console.log('   Installed extensions:');
        extensions.forEach(ext => {
            console.log(`   - ${ext.extname}`);
        });

        // Reset pg_stat_statements to start fresh
        console.log('\n4. Resetting pg_stat_statements...');
        await prisma.$executeRawUnsafe('SELECT pg_stat_statements_reset()');
        console.log('   ✓ Statistics reset');

        console.log('\n✅ Database optimization extensions setup complete!');
        console.log('\nNote: Some configuration changes may require database restart.');
        console.log('If you have superuser access, you can configure:');
        console.log('  - pg_stat_statements.max = 10000');
        console.log('  - pg_stat_statements.track = \'all\'');
        console.log('  - pg_stat_statements.save = true');

    } catch (error) {
        console.error('\n❌ Error setting up extensions:', error);

        if (error instanceof Error) {
            if (error.message.includes('permission denied')) {
                console.error('\nPermission Error: You need superuser privileges to create extensions.');
                console.error('Please ask your database administrator to run:');
                console.error('  CREATE EXTENSION IF NOT EXISTS pg_stat_statements;');
                console.error('  CREATE EXTENSION IF NOT EXISTS pgstattuple;');
            }
        }

        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

setupExtensions();
