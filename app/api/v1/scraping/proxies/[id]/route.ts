/**
 * Individual Proxy Management API Endpoints
 *
 * Provides operations for individual proxy management.
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
 * Proxy update schema
 */
const updateProxySchema = z.object({
    provider: z.string().min(1).optional(),
    host: z.string().min(1).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    protocol: z.enum(['http', 'https', 'socks5']).optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    region: z.string().optional(),
    status: z.enum(['active', 'disabled']).optional(),
});

/**
 * GET /api/v1/scraping/proxies/:id
 *
 * Get a specific proxy by ID
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let proxyId: string | undefined;
    try {
        const session = await getCachedSession();
        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
                { status: 401 }
            );
        }

        if (!hasProxyAdminAccess(session)) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
                { status: 403 }
            );
        }

        const { id } = await params;
        proxyId = id;

        const proxy = await prisma.proxy.findUnique({
            where: { id },
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
        });

        if (!proxy) {
            return NextResponse.json(
                {
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Proxy not found' },
                    meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
                },
                { status: 404 }
            );
        }

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

        return NextResponse.json({
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
                    globalSuccessRate,
                    globalSuccessCount: proxy.globalSuccessCount,
                    globalFailureCount: proxy.globalFailureCount,
                    siteHealth: siteHealthSummary,
                    createdAt: proxy.createdAt,
                    updatedAt: proxy.updatedAt,
                },
            },
            meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
        });
    } catch (error) {
        logger.error('Error fetching proxy', { error, proxyId });
        return NextResponse.json(
            {
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch proxy' },
                meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
            },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/v1/scraping/proxies/:id
 *
 * Update a proxy
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let proxyId: string | undefined;
    try {
        const session = await getCachedSession();
        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
                { status: 401 }
            );
        }

        if (!hasProxyAdminAccess(session)) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
                { status: 403 }
            );
        }

        const { id } = await params;
        proxyId = id;

        const body = await request.json();
        const validationResult = updateProxySchema.safeParse(body);

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

        // Check if proxy exists
        const existingProxy = await prisma.proxy.findUnique({
            where: { id },
        });

        if (!existingProxy) {
            return NextResponse.json(
                {
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Proxy not found' },
                    meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
                },
                { status: 404 }
            );
        }

        const { provider, host, port, protocol, username, password, region, status } = validationResult.data;

        // If host or port is being changed, check for conflicts
        if ((host || port) && (host !== existingProxy.host || port !== existingProxy.port)) {
            const conflictingProxy = await prisma.proxy.findUnique({
                where: {
                    host_port: {
                        host: host || existingProxy.host,
                        port: port || existingProxy.port,
                    },
                },
            });

            if (conflictingProxy && conflictingProxy.id !== id) {
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
        }

        // Update proxy
        const updateData: any = {};
        if (provider !== undefined) updateData.provider = provider;
        if (host !== undefined) updateData.host = host;
        if (port !== undefined) updateData.port = port;
        if (protocol !== undefined) updateData.protocol = protocol;
        if (username !== undefined) updateData.username = username;
        if (password !== undefined) {
            // Hard-fail if encryption isn't configured; never store plaintext silently.
            try {
                updateData.passwordEncrypted = encryptForStorage(password);
            } catch (error) {
                logger.error('Proxy password encryption failed', {
                    error: error instanceof Error ? error.message : String(error),
                    proxyId: id,
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
        if (region !== undefined) updateData.region = region;
        if (status !== undefined) updateData.status = status;

        const updatedProxy = await prisma.proxy.update({
            where: { id },
            data: updateData,
        });

        logger.info(`Updated proxy ${id}`, { changes: Object.keys(updateData) });

        return NextResponse.json({
            success: true,
            data: {
                proxy: {
                    id: updatedProxy.id,
                    provider: updatedProxy.provider,
                    host: updatedProxy.host,
                    port: updatedProxy.port,
                    protocol: updatedProxy.protocol,
                    username: updatedProxy.username,
                    region: updatedProxy.region,
                    status: updatedProxy.status,
                    updatedAt: updatedProxy.updatedAt,
                },
            },
            meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
        });
    } catch (error) {
        logger.error('Error updating proxy', { error, proxyId });
        return NextResponse.json(
            {
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to update proxy' },
                meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/v1/scraping/proxies/:id
 *
 * Delete a proxy
 */
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let proxyId: string | undefined;
    try {
        const session = await getCachedSession();
        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
                { status: 401 }
            );
        }

        if (!hasProxyAdminAccess(session)) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
                { status: 403 }
            );
        }

        const { id } = await params;
        proxyId = id;

        // Check if proxy exists
        const existingProxy = await prisma.proxy.findUnique({
            where: { id },
        });

        if (!existingProxy) {
            return NextResponse.json(
                {
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Proxy not found' },
                    meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
                },
                { status: 404 }
            );
        }

        // Delete proxy (cascade will delete related site health records)
        await prisma.proxy.delete({
            where: { id },
        });

        logger.info(`Deleted proxy ${id}`, { host: existingProxy.host, port: existingProxy.port });

        return NextResponse.json({
            success: true,
            data: { message: 'Proxy deleted successfully' },
            meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
        });
    } catch (error) {
        logger.error('Error deleting proxy', { error, proxyId });
        return NextResponse.json(
            {
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to delete proxy' },
                meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
            },
            { status: 500 }
        );
    }
}
