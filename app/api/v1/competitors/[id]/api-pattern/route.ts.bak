/**
 * API Pattern Management Endpoint
 * 
 * GET /api/v1/competitors/:id/api-pattern
 * Retrieves cached API pattern for a competitor website with metrics
 * 
 * DELETE /api/v1/competitors/:id/api-pattern
 * Invalidates cached pattern and forces re-detection on next scrape
 * 
 * Requirements: 6.3 - Cache lookup, 6.5 - Cache invalidation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { withRateLimit } from '@/lib/middleware/ratelimit';
import { withErrorHandling } from '@/lib/middleware/global-error-handler';
import { UnauthorizedError, NotFoundError } from '@/lib/utils/error-handler';
import { prisma } from '@/lib/prisma';
import { apiCache } from '@/lib/services/api-detection/api-cache';

async function handleGET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        throw new UnauthorizedError('Authentication required to view API patterns');
    }

    const tenantId = session.user.tenantId;
    const { id: competitorId } = await params;

    // Verify the competitor site belongs to this tenant
    const competitorSite = await prisma.site.findFirst({
        where: {
            id: competitorId,
            tenantId,
            type: 'COMPETITOR',
        },
    });

    if (!competitorSite) {
        throw new NotFoundError('Competitor site', competitorId);
    }

    // Retrieve cached pattern
    const pattern = await apiCache.getPattern(competitorId);

    if (!pattern) {
        return NextResponse.json({
            success: true,
            data: {
                competitorId,
                competitorUrl: competitorSite.baseUrl,
                hasCachedPattern: false,
                pattern: null,
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    }

    // Calculate success rate
    const totalAttempts = pattern.successCount + pattern.failureCount;
    const successRate = totalAttempts > 0
        ? (pattern.successCount / totalAttempts) * 100
        : 0;

    // Format response with metrics
    return NextResponse.json({
        success: true,
        data: {
            competitorId,
            competitorUrl: competitorSite.baseUrl,
            hasCachedPattern: true,
            pattern: {
                id: pattern.id,
                url: pattern.url,
                method: pattern.method,
                responseFormat: pattern.responseFormat,
                confidenceScore: pattern.confidenceScore,
                dataPath: pattern.dataPath,
                fieldMappings: pattern.fieldMappings,
                paginationPattern: pattern.paginationPattern,
                headers: pattern.headers,
                queryParams: pattern.queryParams,
                bodyTemplate: pattern.bodyTemplate,
            },
            metrics: {
                successCount: pattern.successCount,
                failureCount: pattern.failureCount,
                totalAttempts,
                successRate: Math.round(successRate * 100) / 100,
                lastUsedAt: pattern.lastUsedAt,
                createdAt: pattern.createdAt,
                updatedAt: pattern.updatedAt,
            },
        },
        meta: {
            requestId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
        },
    });
}

async function handleDELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        throw new UnauthorizedError('Authentication required to invalidate API patterns');
    }

    const tenantId = session.user.tenantId;
    const { id: competitorId } = await params;

    // Verify the competitor site belongs to this tenant
    const competitorSite = await prisma.site.findFirst({
        where: {
            id: competitorId,
            tenantId,
            type: 'COMPETITOR',
        },
    });

    if (!competitorSite) {
        throw new NotFoundError('Competitor site', competitorId);
    }

    // Check if pattern exists before invalidation
    const existingPattern = await apiCache.getPattern(competitorId);

    // Invalidate cached pattern
    await apiCache.invalidatePattern(competitorId);

    return NextResponse.json({
        success: true,
        data: {
            competitorId,
            competitorUrl: competitorSite.baseUrl,
            invalidated: !!existingPattern,
            message: existingPattern
                ? 'API pattern cache invalidated successfully. Re-detection will occur on next scrape.'
                : 'No cached pattern found. Nothing to invalidate.',
        },
        meta: {
            requestId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
        },
    });
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    return withRateLimit(
        req,
        'read',
        withErrorHandling((req) => handleGET(req, context))
    );
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    return withRateLimit(
        req,
        'write',
        withErrorHandling((req) => handleDELETE(req, context))
    );
}
