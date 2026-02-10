#!/bin/bash

# Apply Corrected Performance Indexes
# This script applies the corrected database indexes that match the actual schema

set -e  # Exit on error

echo "============================================================================"
echo "CORRECTED PERFORMANCE INDEXES APPLICATION"
echo "============================================================================"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo ""
    echo "Please set DATABASE_URL in your .env file or export it:"
    echo "  export DATABASE_URL='postgresql://user:password@host:port/database'"
    exit 1
fi

echo "✅ DATABASE_URL is set"
echo ""

# Remind about backup
echo "⚠️  IMPORTANT: Have you backed up your database?"
echo ""
echo "If not, run this command first:"
echo "  pg_dump \$DATABASE_URL > backup_\$(date +%Y%m%d_%H%M%S).sql"
echo ""
read -p "Continue with index application? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Aborted by user"
    exit 0
fi

echo ""
echo "============================================================================"
echo "APPLYING CORRECTED INDEXES"
echo "============================================================================"
echo ""

# Apply the corrected migration
echo "📝 Applying corrected performance indexes..."
psql "$DATABASE_URL" -f prisma/migrations/add_performance_indexes_corrected/migration.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Corrected indexes applied successfully!"
    echo ""
else
    echo ""
    echo "❌ Error applying indexes. Check the output above for details."
    exit 1
fi

# Verify index creation
echo "============================================================================"
echo "VERIFYING INDEX CREATION"
echo "============================================================================"
echo ""

echo "📊 Checking created indexes..."
psql "$DATABASE_URL" -c "
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexname LIKE '%_idx'
    AND schemaname = 'public'
ORDER BY tablename, indexname;
" | head -50

echo ""
echo "============================================================================"
echo "NEXT STEPS"
echo "============================================================================"
echo ""
echo "1. Run performance test:"
echo "   npm run measure-queries"
echo ""
echo "2. Verify Tenant query is <10ms"
echo ""
echo "3. Check query-performance-report.json for results"
echo ""
echo "4. If performance is not improved, check PostgreSQL logs"
echo ""
echo "✅ Index application complete!"
