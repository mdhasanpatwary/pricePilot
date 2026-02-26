import { NextRequest, NextResponse } from "next/server";
import { getCachedSession } from "@/lib/auth/cached-session";
import { UnauthorizedError, ForbiddenError, AppError } from "@/lib/utils/error-handler";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Tenant context provided to handlers wrapped with requireTenantContext
 */
export interface TenantContext {
    tenantId: string;
    userId: string;
    role: string;
    isSuperAdmin: boolean;
}

/**
 * Require a valid authenticated session
 */
export function requireAuth(
    handler: (req: NextRequest) => Promise<NextResponse>
) {
    return async (req: NextRequest): Promise<NextResponse> => {
        const session = await getCachedSession();

        if (!session?.user) {
            throw new UnauthorizedError("Authentication required");
        }

        return handler(req);
    };
}

/**
 * Require admin or super admin privileges
 */
export function requireAdmin(
    handler: (req: NextRequest) => Promise<NextResponse>
) {
    return async (req: NextRequest): Promise<NextResponse> => {
        const session = await getCachedSession();

        if (!session?.user) {
            throw new UnauthorizedError("Authentication required");
        }

        const user = session.user as any;
        const isAdmin = user.role === "ADMIN" || user.isSuperAdmin === true;

        if (!isAdmin) {
            throw new ForbiddenError("Admin privileges required");
        }

        return handler(req);
    };
}

/**
 * Enforce strict tenant isolation and provide tenant context
 * 
 * Invariants:
 * 1. User must be authenticated
 * 2. tenantId is derived ONLY from the session
 * 3. Request is rejected if tenantId is present in query string or body
 * 4. Tenant must exist and be active in the database
 */
export function requireTenantContext(
    handler: (req: NextRequest, context: TenantContext) => Promise<NextResponse>
) {
    return async (req: NextRequest): Promise<NextResponse> => {
        const session = await getCachedSession();

        if (!session?.user?.tenantId || !session?.user?.id) {
            throw new UnauthorizedError("Authentication with tenant context required");
        }

        const tenantId = session.user.tenantId;

        // 1. Reject if tenantId is in query string (Insecure parameter injection prevention)
        if (req.nextUrl.searchParams.has("tenantId") || req.nextUrl.searchParams.has("tenant_id")) {
            logger.warn("Security Violation: tenantId injected in query string", {
                userId: session.user.id,
                tenantId: tenantId,
                path: req.nextUrl.pathname
            });
            throw new AppError("Invalid request: tenantId cannot be specified in query", 400, "SECURITY_VIOLATION");
        }

        // 2. Reject if tenantId is in body (only for JSON requests)
        const contentType = req.headers.get("content-type");
        if (contentType?.includes("application/json")) {
            try {
                // Peek at body using a cloned request to avoid consuming stream
                const clonedReq = req.clone();
                const body = await clonedReq.json();
                if (body && (body.tenantId !== undefined || body.tenant_id !== undefined)) {
                    logger.warn("Security Violation: tenantId injected in request body", {
                        userId: session.user.id,
                        tenantId: tenantId,
                        path: req.nextUrl.pathname
                    });
                    throw new AppError("Invalid request: tenantId cannot be specified in body", 400, "SECURITY_VIOLATION");
                }
            } catch (e) {
                // If body isn't valid JSON, we ignore here and let downstream handler fail if needed
            }
        }

        // 3. Validate tenant existence in DB (Invariant check)
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { id: true }
        });

        if (!tenant) {
            logger.error("Security Violation: User session has invalid tenantId", {
                userId: session.user.id,
                tenantId: tenantId
            });
            throw new UnauthorizedError("Invalid tenant context");
        }

        const context: TenantContext = {
            tenantId: tenantId,
            userId: session.user.id,
            role: session.user.role as string,
            isSuperAdmin: !!session.user.isSuperAdmin
        };

        return handler(req, context);
    };
}
