/**
 * Index Recommendations API Endpoint
 * 
 * GET /api/v1/admin/performance/index-recommendations
 * 
 * Returns index optimization recommendations including missing indexes,
 * unused indexes, and index usage statistics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIndexManager } from '@/lib/services/index-manager';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const includeUnused = searchParams.get('includeUnused') !== 'false';
        const minDaysSinceUse = parseInt(searchParams.get('minDaysSinceUse') || '30', 10);

        const indexManager = getIndexManager();

        // Get index suggestions
        const suggestions = await indexManager.suggestIndexes();

        // Get unused indexes if requested
        const unusedIndexes = includeUnused
            ? await indexManager.findUnusedIndexes(minDaysSinceUse)
            : [];

        // Get index statistics
        const indexStats = await indexManager.getIndexStats();

        // Calculate summary metrics
        const totalIndexes = indexStats.length;
        const totalIndexSize = indexStats.reduce((sum, idx) => sum + idx.sizeBytes, 0);
        const unusedIndexSize = unusedIndexes.reduce((sum, idx) => sum + idx.sizeBytes, 0);
        const fragmentedIndexes = indexStats.filter(idx => idx.fragmentation > 30).length;

        // Categorize suggestions by impact
        const highImpact = suggestions.filter(s => s.estimatedImpact === 'high');
        const mediumImpact = suggestions.filter(s => s.estimatedImpact === 'medium');
        const lowImpact = suggestions.filter(s => s.estimatedImpact === 'low');

        // Determine health status
        let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (highImpact.length > 5 || fragmentedIndexes > 10) {
            healthStatus = 'critical';
        } else if (highImpact.length > 0 || fragmentedIndexes > 5) {
            healthStatus = 'warning';
        }

        return NextResponse.json({
            success: true,
            data: {
                healthStatus,
                suggestions: {
                    high: highImpact.map(s => ({
                        tableName: s.tableName,
                        columns: s.columns,
                        reason: s.reason,
                        estimatedImpact: s.estimatedImpact,
                        createStatement: s.createStatement,
                    })),
                    medium: mediumImpact.map(s => ({
                        tableName: s.tableName,
                        columns: s.columns,
                        reason: s.reason,
                        estimatedImpact: s.estimatedImpact,
                        createStatement: s.createStatement,
                    })),
                    low: lowImpact.map(s => ({
                        tableName: s.tableName,
                        columns: s.columns,
                        reason: s.reason,
                        estimatedImpact: s.estimatedImpact,
                        createStatement: s.createStatement,
                    })),
                },
                unusedIndexes: unusedIndexes.map(idx => ({
                    indexName: idx.indexName,
                    tableName: idx.tableName,
                    sizeBytes: idx.sizeBytes,
                    sizeMB: (idx.sizeBytes / (1024 * 1024)).toFixed(2),
                    lastUsed: idx.lastUsed ? idx.lastUsed.toISOString() : null,
                    dropStatement: idx.dropStatement,
                })),
                statistics: {
                    totalIndexes,
                    totalIndexSizeMB: (totalIndexSize / (1024 * 1024)).toFixed(2),
                    unusedIndexCount: unusedIndexes.length,
                    unusedIndexSizeMB: (unusedIndexSize / (1024 * 1024)).toFixed(2),
                    fragmentedIndexes,
                    potentialSavingsMB: (unusedIndexSize / (1024 * 1024)).toFixed(2),
                },
                summary: {
                    totalSuggestions: suggestions.length,
                    highImpactCount: highImpact.length,
                    mediumImpactCount: mediumImpact.length,
                    lowImpactCount: lowImpact.length,
                },
            },
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Error fetching index recommendations:', error);

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INDEX_RECOMMENDATIONS_ERROR',
                    message: 'Failed to fetch index recommendations',
                    details: error instanceof Error ? error.message : 'Unknown error',
                },
            },
            { status: 500 }
        );
    }
}
