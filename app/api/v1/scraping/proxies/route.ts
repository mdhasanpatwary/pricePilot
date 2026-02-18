/**
 * Proxy Management API Endpoints
 *
 * Provides CRUD operations for proxy management in the bot protection system.
 *
 * Requirements: 2.1, 2.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { getCachedSession } from "@/lib/auth/cached-session";
import { encryptForStorage } from "@/lib/services/encryption/field-encryption";

function hasProxyAdminAccess(session: any): boolean {
    const role = String(session?.user?.role || '').toUpperCase();
    return Boolean(session?.user) && (role === 'ADMIN' || session?.user?.isSuperAdmin === true);
}

/**
 * Proxy creation schema
 */
const createProxySchema = z.object({
    provider: z.string().min(1, 'Provider is required'),
    host: z.string().min(1, 'Host is required'),
    port: z.number().int().min(1).max(65535, 'Port must be between 1 and 65535'),
    protocol: z.enum(['http', 'https', 'socks5']),
    username: z.string().optional(),
    password: z.string().optional(),
    region: z.string().optional(),
});

/**
 * GET /api/v1/scraping/proxies
 *
 * List all proxies with optional filtering
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getCachedSession();
        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
                { status: 401 }
            );
        }

        // Only admins can manage proxies
        if (!hasProxyAdminAccess(session)) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const provider = searchParams.get('provider');
        const region = searchParams.get('region');

        const where: any = {};
        if (status) where.status = status;
        if (provider) where.provider = provider;
        if (region) where.region = region;

        const proxies = await prisma.proxy.findMany({
            where,
            include: {
                ProxySiteHealth: {
                    select: {
                        competitorWebsiteId: true,
                        successCount: true,
                        failureCount: true,
                        lastSuccessAt: true,
                        lastFailureAt: true,
                        cooldownUntil: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Calculate health metrics for each proxy
        const proxiesWithHealth = proxies.map((proxy) => {
            const globalTotal = proxy.globalSuccessCount + proxy.globalFailureCount;
            const globalSuccessRate = globalTotal > 0 ? (proxy.globalSuccessCount / globalTotal) * 100 : 0;

            const siteHealthSummary = proxy.ProxySiteHealth.map((health) => {
                const siteTotal = health.successCount + health.failureCount;
                const siteSuccessRate = siteTotal > 0 ? (health.successCount / siteTotal) * 100 : 0;
                return {
                    competitorWebsiteId: health.competitorWebsiteId,
                    successRate: siteSuccessRate,
                    totalAttempts: siteTotal,
                    lastSuccessAt: health.lastSuccessAt,
                    lastFailureAt: health.lastFailureAt,
                    cooldownUntil: health.cooldownUntil,
                };
            });

            return {
                id: proxy.id,
                provider: proxy.provider,
                host: proxy.host,
                port: proxy.port,
                protocol: proxy.protocol,
                username: proxy.username,
                region: proxy.region,
                status: proxy.status,
                globalSuccessRate,
                globalSuccessCount: proxy.globalSuccessCount,
                globalFailureCount: proxy.globalFailureCount,
                siteHealth: siteHealthSummary,
                createdAt: proxy.createdAt,
                updatedAt: proxy.updatedAt,
            };
        });

        return NextResponse.json({
            success: true,
            data: { proxies: proxiesWithHealth },
            meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
        });
    } catch (error) {
        logger.error('Error fetching proxies', { error });
        return NextResponse.json(
            {
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch proxies' },
                meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/v1/scraping/proxies
 *
 * Create a new proxy
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getCachedSession();
        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
                { status: 401 }
            );
        }

        // Only admins can manage proxies
        if (!hasProxyAdminAccess(session)) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
                { status: 403 }
            );
        }

        const body = await request.json();
        const validationResult = createProxySchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid proxy data',
                        details: { fields: validationResult.error.flatten().fieldErrors },
                    },
                    meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
                },
                { status: 422 }
            );
        }

        const { provider, host, port, protocol, username, password, region } = validationResult.data;

        // Check if proxy already exists
        const existingProxy = await prisma.proxy.findUnique({
            where: { host_port: { host, port } },
        });

        if (existingProxy) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'PROXY_EXISTS',
                        message: 'A proxy with this host and port already exists',
                    },
                    meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
                },
                { status: 409 }
            );
        }

        let passwordEncrypted: string | undefined = undefined;
        if (password !== undefined) {
            // Hard-fail if encryption isn't configured; never store plaintext silently.
            try {
                passwordEncrypted = encryptForStorage(password);
            } catch (error) {
                logger.error('Proxy password encryption failed', {
                    error: error instanceof Error ? error.message : String(error),
                    host,
                    port,
                    provider,
                });
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'ENCRYPTION_ERROR',
                            message: 'Encryption is not configured',
                        },
                        meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
                    },
                    { status: 500 }
                );
            }
        }

        // Create proxy
        const proxy = await prisma.proxy.create({
            data: {
                provider,
                host,
                port,
                protocol,
                username,
                passwordEncrypted,
                region,
                status: 'active',
            },
        });

        logger.info(`Created proxy ${proxy.id}`, { host, port, provider });

        return NextResponse.json(
            {
                success: true,
                data: {
                    proxy: {
                        id: proxy.id,
                        provider: proxy.provider,
                        host: proxy.host,
                        port: proxy.port,
                        protocol: proxy.protocol,
                        username: proxy.username,
                        region: proxy.region,
                        status: proxy.status,
                        createdAt: proxy.createdAt,
                    },
                },
                meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
            },
            { status: 201 }
        );
    } catch (error) {
        logger.error('Error creating proxy', { error });
        return NextResponse.json(
            {
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to create proxy' },
                meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
            },
            { status: 500 }
        );
    }
}
