/**
 * API Detection Management Endpoint
 * 
 * POST /api/v1/competitors/:id/detect-api
 * Triggers manual API detection for a competitor website
 * Forces re-detection even if cached pattern exists
 * 
 * Requirements: 1.1 - Automatic API Detection
 */

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/middleware/global-error-handler';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/lib/utils/error-handler';
import { prisma } from '@/lib/prisma';
import { APIDetector } from '@/lib/services/api-detection/api-detector';
import { apiCache } from '@/lib/services/api-detection/api-cache';
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

async function handlePOST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getCachedSession();

    if (!session?.user) {
        throw new UnauthorizedError('Authentication required to trigger API detection');
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

    if (!competitorSite.baseUrl) {
        throw new ValidationError(
            'Competitor site does not have a valid base URL',
            { baseUrl: ['Base URL is required for API detection'] }
        );
    }

    // Parse request body for options
    const body = await req.json().catch(() => ({}));
    const options = {
        timeout: body.timeout || 30000,
        maxPages: body.maxPages || 3,
        minConfidence: body.minConfidence || 70,
    };

    // Initialize API detector
    const detector = new APIDetector();

    try {
        // Run detection (force re-detection by not checking cache)
        const patterns = await detector.detectAPIs(
            competitorSite.baseUrl,
            options,
            competitorId,
            tenantId
        );

        // Store discovered patterns in cache
        if (patterns.length > 0) {
            const bestPattern = patterns[0];
            await apiCache.storePattern(competitorId, {
                tenantId,
                competitorWebsiteId: competitorId,
                url: bestPattern.url!,
                method: bestPattern.method!,
                headers: bestPattern.headers || {},
                queryParams: bestPattern.queryParams || {},
                bodyTemplate: bestPattern.bodyTemplate,
                responseFormat: bestPattern.responseFormat!,
                dataPath: bestPattern.dataPath!,
                fieldMappings: bestPattern.fieldMappings || [],
                confidenceScore: bestPattern.confidenceScore || 0,
                paginationPattern: bestPattern.paginationPattern,
                successCount: 0,
                failureCount: 0,
            });
        }

        // Format response
        const formattedPatterns = patterns.map((pattern) => ({
            url: pattern.url,
            method: pattern.method,
            responseFormat: pattern.responseFormat,
            confidenceScore: pattern.confidenceScore,
            dataPath: pattern.dataPath,
            fieldMappings: pattern.fieldMappings,
            paginationPattern: pattern.paginationPattern,
            headers: pattern.headers,
            queryParams: pattern.queryParams,
        }));

        return NextResponse.json({
            success: true,
            data: {
                competitorId,
                competitorUrl: competitorSite.baseUrl,
                detectionOptions: options,
                patternsDiscovered: patterns.length,
                patterns: formattedPatterns,
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'DETECTION_FAILED',
                    message: 'Failed to detect API patterns',
                    details: {
                        competitorId,
                        competitorUrl: competitorSite.baseUrl,
                        error: errorMessage,
                    },
                },
                meta: {
                    requestId: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 500 }
        );
    }
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    return withRequestContextAndRateLimit(
        req,
        'write',
        withErrorHandling((req) => handlePOST(req, context))
    );
}
