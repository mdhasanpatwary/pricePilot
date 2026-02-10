import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { ANTI_BOT_PROFILES } from '@/lib/config/site-profiles';
import { withRateLimit } from '@/lib/middleware/ratelimit';

/**
 * GET /api/v1/admin/site-profiles
 * 
 * Fetch all site profiles from database and include default profile templates
 * 
 * Requirements: 8.7, 6.1, 6.6
 */
async function handleGET(_request: NextRequest) {
    try {
        // Authenticate and verify admin role
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json(
                { error: 'Unauthorized', message: 'Authentication required' },
                { status: 401 }
            );
        }

        // Check if user is super admin
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { isSuperAdmin: true, role: true }
        });

        if (!user?.isSuperAdmin && user?.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Forbidden', message: 'Admin access required' },
                { status: 403 }
            );
        }

        // Fetch all site profiles from database
        const profiles = await prisma.siteProfile.findMany({
            orderBy: { domain: 'asc' }
        });

        // Format profiles for response
        const formattedProfiles = profiles.map((profile: any) => ({
            id: profile.id,
            domain: profile.domain,
            rateLimit: {
                requestsPerMinute: profile.requestsPerMinute,
                concurrentRequests: profile.concurrentRequests
            },
            adaptiveDelay: {
                min: profile.minDelay,
                max: profile.maxDelay,
                multiplier: profile.delayMultiplier
            },
            sessionWarmup: {
                enabled: profile.sessionWarmupEnabled,
                paths: profile.sessionWarmupPaths
            },
            referrerChain: profile.referrerChainEnabled,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt
        }));

        // Include default profile templates
        const templates = [
            {
                name: 'Cloudflare',
                description: 'Optimized for sites protected by Cloudflare',
                profile: {
                    rateLimit: {
                        requestsPerMinute: ANTI_BOT_PROFILES.cloudflare.rateLimit?.requestsPerMinute || 10,
                        concurrentRequests: ANTI_BOT_PROFILES.cloudflare.rateLimit?.concurrentRequests || 2
                    },
                    adaptiveDelay: {
                        min: ANTI_BOT_PROFILES.cloudflare.adaptiveDelay?.baseDelay || 3000,
                        max: ANTI_BOT_PROFILES.cloudflare.adaptiveDelay?.maxDelay || 30000,
                        multiplier: ANTI_BOT_PROFILES.cloudflare.adaptiveDelay?.multiplier || 1.0
                    },
                    sessionWarmup: {
                        enabled: ANTI_BOT_PROFILES.cloudflare.sessionWarmup?.enabled || true,
                        paths: ANTI_BOT_PROFILES.cloudflare.sessionWarmup?.visitPaths || []
                    },
                    referrerChain: ANTI_BOT_PROFILES.cloudflare.referrerChain?.enabled || true
                }
            },
            {
                name: 'PerimeterX',
                description: 'Optimized for sites protected by PerimeterX',
                profile: {
                    rateLimit: {
                        requestsPerMinute: ANTI_BOT_PROFILES.perimeterx.rateLimit?.requestsPerMinute || 8,
                        concurrentRequests: ANTI_BOT_PROFILES.perimeterx.rateLimit?.concurrentRequests || 1
                    },
                    adaptiveDelay: {
                        min: ANTI_BOT_PROFILES.perimeterx.adaptiveDelay?.baseDelay || 4000,
                        max: ANTI_BOT_PROFILES.perimeterx.adaptiveDelay?.maxDelay || 40000,
                        multiplier: ANTI_BOT_PROFILES.perimeterx.adaptiveDelay?.multiplier || 1.0
                    },
                    sessionWarmup: {
                        enabled: ANTI_BOT_PROFILES.perimeterx.sessionWarmup?.enabled || true,
                        paths: ANTI_BOT_PROFILES.perimeterx.sessionWarmup?.visitPaths || ['/about', '/products']
                    },
                    referrerChain: ANTI_BOT_PROFILES.perimeterx.referrerChain?.enabled || true
                }
            },
            {
                name: 'DataDome',
                description: 'Optimized for sites protected by DataDome',
                profile: {
                    rateLimit: {
                        requestsPerMinute: ANTI_BOT_PROFILES.datadome.rateLimit?.requestsPerMinute || 6,
                        concurrentRequests: ANTI_BOT_PROFILES.datadome.rateLimit?.concurrentRequests || 1
                    },
                    adaptiveDelay: {
                        min: ANTI_BOT_PROFILES.datadome.adaptiveDelay?.baseDelay || 5000,
                        max: ANTI_BOT_PROFILES.datadome.adaptiveDelay?.maxDelay || 50000,
                        multiplier: ANTI_BOT_PROFILES.datadome.adaptiveDelay?.multiplier || 1.0
                    },
                    sessionWarmup: {
                        enabled: ANTI_BOT_PROFILES.datadome.sessionWarmup?.enabled || true,
                        paths: ANTI_BOT_PROFILES.datadome.sessionWarmup?.visitPaths || ['/']
                    },
                    referrerChain: ANTI_BOT_PROFILES.datadome.referrerChain?.enabled || true
                }
            }
        ];

        logger.info('[API] Site profiles fetched successfully', {
            profileCount: profiles.length,
            templateCount: templates.length
        });

        return NextResponse.json({
            profiles: formattedProfiles,
            templates
        });

    } catch (error) {
        logger.error('[API] Error fetching site profiles', { error });
        return NextResponse.json(
            {
                error: 'Internal Server Error',
                message: 'Failed to fetch site profiles',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRateLimit(req, 'read', () => handleGET(req));
}

/**
 * POST /api/v1/admin/site-profiles
 * 
 * Create or update a site profile in the database
 * Validates profile configuration and applies changes to SiteProfileManager service
 * 
 * Requirements: 8.8, 6.5, 6.7
 */
async function handlePOST(request: NextRequest) {
    try {
        // Authenticate and verify admin role
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json(
                { error: 'Unauthorized', message: 'Authentication required' },
                { status: 401 }
            );
        }

        // Check if user is super admin
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { isSuperAdmin: true, role: true }
        });

        if (!user?.isSuperAdmin && user?.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Forbidden', message: 'Admin access required' },
                { status: 403 }
            );
        }

        // Parse request body
        const body = await request.json();
        const { id, domain, rateLimit, adaptiveDelay, sessionWarmup, referrerChain } = body;

        // Validation errors array
        const errors: string[] = [];

        // Validate required fields
        if (!domain || typeof domain !== 'string' || domain.trim() === '') {
            errors.push('Domain is required and must be a non-empty string');
        }

        // Validate rate limit
        if (rateLimit) {
            if (typeof rateLimit.requestsPerMinute !== 'number' || rateLimit.requestsPerMinute <= 0) {
                errors.push('requestsPerMinute must be a positive number');
            }
            if (typeof rateLimit.concurrentRequests !== 'number' || rateLimit.concurrentRequests <= 0) {
                errors.push('concurrentRequests must be a positive number');
            }
            if (rateLimit.requestsPerMinute > 1000) {
                errors.push('requestsPerMinute cannot exceed 1000');
            }
            if (rateLimit.concurrentRequests > 50) {
                errors.push('concurrentRequests cannot exceed 50');
            }
        }

        // Validate adaptive delay
        if (adaptiveDelay) {
            if (typeof adaptiveDelay.min !== 'number' || adaptiveDelay.min < 0) {
                errors.push('Minimum delay must be a non-negative number');
            }
            if (typeof adaptiveDelay.max !== 'number' || adaptiveDelay.max < 0) {
                errors.push('Maximum delay must be a non-negative number');
            }
            if (adaptiveDelay.min > adaptiveDelay.max) {
                errors.push('Minimum delay cannot be greater than maximum delay');
            }
            if (typeof adaptiveDelay.multiplier !== 'number' || adaptiveDelay.multiplier <= 0) {
                errors.push('Delay multiplier must be a positive number');
            }
            if (adaptiveDelay.max > 300000) {
                errors.push('Maximum delay cannot exceed 300000ms (5 minutes)');
            }
        }

        // Validate session warmup
        if (sessionWarmup) {
            if (typeof sessionWarmup.enabled !== 'boolean') {
                errors.push('sessionWarmup.enabled must be a boolean');
            }
            if (sessionWarmup.paths && !Array.isArray(sessionWarmup.paths)) {
                errors.push('sessionWarmup.paths must be an array');
            }
            if (sessionWarmup.paths && sessionWarmup.paths.some((p: any) => typeof p !== 'string')) {
                errors.push('All sessionWarmup.paths must be strings');
            }
        }

        // Validate referrer chain
        if (referrerChain !== undefined && typeof referrerChain !== 'boolean') {
            errors.push('referrerChain must be a boolean');
        }

        // Return validation errors if any
        if (errors.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    errors,
                    message: 'Validation failed'
                },
                { status: 400 }
            );
        }

        // Prepare data for database
        const profileData = {
            domain: domain.trim(),
            requestsPerMinute: rateLimit?.requestsPerMinute || 10,
            concurrentRequests: rateLimit?.concurrentRequests || 2,
            minDelay: adaptiveDelay?.min || 1000,
            maxDelay: adaptiveDelay?.max || 3000,
            delayMultiplier: adaptiveDelay?.multiplier || 1.0,
            sessionWarmupEnabled: sessionWarmup?.enabled || false,
            sessionWarmupPaths: sessionWarmup?.paths || [],
            referrerChainEnabled: referrerChain !== undefined ? referrerChain : true
        };

        let profile;

        // Create or update profile
        if (id) {
            // Update existing profile
            profile = await prisma.siteProfile.update({
                where: { id },
                data: profileData
            });

            logger.info('[API] Site profile updated', {
                id: profile.id,
                domain: profile.domain
            });
        } else {
            // Create new profile or update if domain exists
            profile = await prisma.siteProfile.upsert({
                where: { domain: profileData.domain },
                update: profileData,
                create: {
                    ...profileData,
                    id: `site-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    updatedAt: new Date()
                }
            });

            logger.info('[API] Site profile created/updated', {
                id: profile.id,
                domain: profile.domain
            });
        }

        // Apply changes to SiteProfileManager service
        try {
            const { siteProfileManager } = await import('@/lib/config/site-profiles');

            siteProfileManager.updateProfile(profile.domain, {
                rateLimit: {
                    requestsPerMinute: profile.requestsPerMinute,
                    concurrentRequests: profile.concurrentRequests
                },
                adaptiveDelay: {
                    enabled: true,
                    baseDelay: profile.minDelay,
                    maxDelay: profile.maxDelay,
                    multiplier: profile.delayMultiplier
                },
                sessionWarmup: {
                    enabled: profile.sessionWarmupEnabled,
                    visitHomepage: profile.sessionWarmupEnabled,
                    visitPaths: profile.sessionWarmupPaths
                },
                referrerChain: {
                    enabled: profile.referrerChainEnabled
                },
                strategy: 'full-js',
                selectors: {},
                waitTime: profile.minDelay,
                cacheTime: 1800,
                successRate: 0.7,
                retryCount: 2
            });

            logger.info('[API] Site profile applied to SiteProfileManager', {
                domain: profile.domain
            });
        } catch (serviceError) {
            logger.error('[API] Failed to apply profile to SiteProfileManager', {
                error: serviceError,
                domain: profile.domain
            });
            // Continue anyway - profile is saved in database
        }

        // Format response
        const formattedProfile = {
            id: profile.id,
            domain: profile.domain,
            rateLimit: {
                requestsPerMinute: profile.requestsPerMinute,
                concurrentRequests: profile.concurrentRequests
            },
            adaptiveDelay: {
                min: profile.minDelay,
                max: profile.maxDelay,
                multiplier: profile.delayMultiplier
            },
            sessionWarmup: {
                enabled: profile.sessionWarmupEnabled,
                paths: profile.sessionWarmupPaths
            },
            referrerChain: profile.referrerChainEnabled,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt
        };

        return NextResponse.json({
            success: true,
            profile: formattedProfile
        });

    } catch (error) {
        logger.error('[API] Error creating/updating site profile', { error });

        // Handle unique constraint violation
        if (error instanceof Error && error.message.includes('Unique constraint')) {
            return NextResponse.json(
                {
                    success: false,
                    errors: ['A profile with this domain already exists'],
                    message: 'Domain must be unique'
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                error: 'Internal Server Error',
                message: 'Failed to create/update site profile',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    return withRateLimit(req, 'write', () => handlePOST(req));
}
