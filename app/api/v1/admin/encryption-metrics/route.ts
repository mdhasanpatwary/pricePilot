/**
 * API endpoint for encryption performance metrics
 * Provides metrics for monitoring dashboard
 * 
 * Requirements: 4.5, 7.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { encryptionPerformanceMonitor } from '@/lib/services/encryption/performance-monitor';
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

/**
 * GET /api/v1/admin/encryption-metrics
 * Returns encryption performance metrics
 * 
 * Requires admin authentication
 */
async function handleGET(_request: NextRequest) {
    try {
        // Check authentication
        const session = await getCachedSession();

        if (!session || !session.user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Check if user is admin
        if (session.user.role !== 'admin') {
            return NextResponse.json(
                { success: false, error: 'Forbidden - Admin access required' },
                { status: 403 }
            );
        }

        // Get all metrics
        const metrics = encryptionPerformanceMonitor.getAllMetrics();

        return NextResponse.json({
            success: true,
            data: {
                encryption: {
                    count: metrics.encryption.count,
                    avgLatency: parseFloat(metrics.encryption.avgLatency.toFixed(2)),
                    minLatency: parseFloat(metrics.encryption.minLatency.toFixed(2)),
                    maxLatency: parseFloat(metrics.encryption.maxLatency.toFixed(2)),
                    successRate: parseFloat((metrics.encryption.successRate * 100).toFixed(1)),
                    failureRate: parseFloat((metrics.encryption.failureRate * 100).toFixed(1)),
                },
                decryption: {
                    count: metrics.decryption.count,
                    avgLatency: parseFloat(metrics.decryption.avgLatency.toFixed(2)),
                    minLatency: parseFloat(metrics.decryption.minLatency.toFixed(2)),
                    maxLatency: parseFloat(metrics.decryption.maxLatency.toFixed(2)),
                    successRate: parseFloat((metrics.decryption.successRate * 100).toFixed(1)),
                    failureRate: parseFloat((metrics.decryption.failureRate * 100).toFixed(1)),
                },
                migration: {
                    totalAttempts: metrics.migration.totalAttempts,
                    successfulMigrations: metrics.migration.successfulMigrations,
                    failedMigrations: metrics.migration.failedMigrations,
                    skippedMigrations: metrics.migration.skippedMigrations,
                    successRate: parseFloat((metrics.migration.successRate * 100).toFixed(1)),
                    failureRate: parseFloat((metrics.migration.failureRate * 100).toFixed(1)),
                },
            },
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('[EncryptionMetrics] Error fetching metrics:', error);

        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch encryption metrics',
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, 'read', handleGET);
}
