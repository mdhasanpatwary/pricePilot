/**
 * Apply Search Performance Indexes
 * 
 * This script applies database indexes to optimize documentation search performance.
 * Run this script to improve search response times to <200ms.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applySearchPerformanceIndexes() {
    console.log('🚀 Applying search performance indexes...\n');

    try {
        // 1. Full-text search index with GIN
        console.log('📊 Creating full-text search index...');
        await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "idx_docs_fulltext_search" ON "DocumentationDocument" 
        USING GIN(to_tsvector('english', title || ' ' || title || ' ' || content))
    `;
        console.log('✅ Full-text search index created\n');

        // 2. Composite index for type + category filtering
        console.log('📊 Creating type+category composite index...');
        await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "idx_docs_type_category_updated" 
        ON "DocumentationDocument"(type, category, "updatedAt" DESC)
    `;
        console.log('✅ Type+category index created\n');

        // 3. Index for search analytics
        console.log('📊 Creating search analytics index...');
        await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "idx_search_type_date_results" 
        ON "DocumentationSearch"(type, "searchedAt" DESC, "resultsCount")
    `;
        console.log('✅ Search analytics index created\n');

        // 4. Index for popular pages
        console.log('📊 Creating popular pages index...');
        await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "idx_pageviews_doc_count" 
        ON "DocumentationPageView"("documentId", "viewedAt" DESC)
    `;
        console.log('✅ Popular pages index created\n');

        // 5. Index for feedback aggregation
        console.log('📊 Creating feedback aggregation index...');
        await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "idx_feedback_doc_rating" 
        ON "DocumentationFeedback"("documentId", rating, "createdAt" DESC)
    `;
        console.log('✅ Feedback index created\n');

        // 6. Partial index for pending suggestions
        console.log('📊 Creating pending suggestions partial index...');
        await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "idx_suggestions_pending" 
        ON "DocumentationSuggestion"(status, "createdAt" DESC) 
        WHERE status = 'PENDING'
    `;
        console.log('✅ Pending suggestions index created\n');

        // 7. Index for version history
        console.log('📊 Creating version history index...');
        await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "idx_versions_doc_created" 
        ON "DocumentationVersion"("documentId", "createdAt" DESC)
    `;
        console.log('✅ Version history index created\n');

        // 8. Create statistics for query planner
        console.log('📊 Creating query planner statistics...');
        await prisma.$executeRaw`
      CREATE STATISTICS IF NOT EXISTS "docs_type_category_stats" 
        ON type, category FROM "DocumentationDocument"
    `;
        await prisma.$executeRaw`
      CREATE STATISTICS IF NOT EXISTS "search_type_query_stats" 
        ON type, query FROM "DocumentationSearch"
    `;
        console.log('✅ Query planner statistics created\n');

        // 9. Analyze tables for optimal query planning
        console.log('📊 Analyzing tables for query optimization...');
        await prisma.$executeRaw`ANALYZE "DocumentationDocument"`;
        await prisma.$executeRaw`ANALYZE "DocumentationSearch"`;
        await prisma.$executeRaw`ANALYZE "DocumentationPageView"`;
        await prisma.$executeRaw`ANALYZE "DocumentationFeedback"`;
        console.log('✅ Table analysis complete\n');

        console.log('✨ All search performance indexes applied successfully!');
        console.log('📈 Expected search response time: <200ms');

    } catch (error) {
        console.error('❌ Error applying indexes:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the script
applySearchPerformanceIndexes()
    .then(() => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });
