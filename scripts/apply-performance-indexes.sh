#!/bin/bash

# Apply Performance Indexes Script
# This script applies the performance indexes to the database

set -e

echo "🚀 Applying Performance Indexes..."
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "Please set DATABASE_URL in your .env file"
    exit 1
fi

echo "📊 Database connection configured"
echo ""

# Backup reminder
echo "⚠️  IMPORTANT: Make sure you have a database backup before proceeding!"
echo ""
read -p "Do you have a recent database backup? (yes/no): " backup_confirm

if [ "$backup_confirm" != "yes" ]; then
    echo "❌ Please create a database backup first"
    echo "Run: pg_dump \$DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql"
    exit 1
fi

echo ""
echo "✅ Proceeding with index creation..."
echo ""

# Apply the migration
echo "📝 Applying migration SQL..."
psql "$DATABASE_URL" -f prisma/migrations/add_performance_indexes/migration.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Performance indexes applied successfully!"
    echo ""
    echo "📊 Verifying indexes..."
    echo ""
    
    # Verify some key indexes were created
    psql "$DATABASE_URL" -c "
        SELECT 
            schemaname,
            tablename,
            indexname
        FROM pg_indexes
        WHERE indexname LIKE '%_tenantId_%' 
           OR indexname LIKE '%_status_idx'
           OR indexname LIKE '%_siteId_idx'
        ORDER BY tablename, indexname
        LIMIT 20;
    "
    
    echo ""
    echo "✅ Index verification complete!"
    echo ""
    echo "📈 Next steps:"
    echo "1. Run query performance test: npm run measure-queries"
    echo "2. Compare results with previous report"
    echo "3. Monitor application performance"
    echo ""
else
    echo ""
    echo "❌ Error applying indexes"
    echo "Please check the error messages above"
    exit 1
fi
