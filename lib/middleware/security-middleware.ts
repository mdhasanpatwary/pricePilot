/**
 * Security Middleware
 *
 * Integrates incident prevention and security monitoring into request handling.
 * Checks for blocked IPs, analyzes threats, and enforces security policies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { incidentPreventionService } from '../services/security/incident-prevention';
import { securityMonitoringService, SecurityEventContext } from '../services/monitoring/security-monitoring';
import { logger } from '../logger';

/**
 * Extract IP address from request
 */
function getIPAddress(req: NextRequest): string {
    // Check for forwarded IP (behind proxy)
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }

    // Check for real IP
    const realIP = req.headers.get('x-real-ip');
    if (realIP) {
        return realIP;
    }

    // Fallback to unknown (NextRequest doesn't have ip property)
    return 'unknown';
}

/**
 * Create security event context from request
 */
function createSecurityContext(req: NextRequest): SecurityEventContext {
    const ipAddress = getIPAddress(req);
    const userAgent = req.headers.get('user-agent') || undefined;
    const url = new URL(req.url);

    return {
        ipAddress,
        userAgent,
        endpoint: url.pathname,
        method: req.method,
        requestId: req.headers.get('x-request-id') || undefined,
    };
}

/**
 * Security middleware wrapper
 *
 * Wraps API route handlers with security checks
 */
export function withSecurity(
    handler: (req: NextRequest) => Promise<NextResponse>
) {
    return async (req: NextRequest): Promise<NextResponse> => {
        const context = createSecurityContext(req);

        try {
            // Check if IP is blocked
            const isBlocked = await incidentPreventionService.isBlocked(context.ipAddress);

            if (isBlocked) {
                logger.warn('Blocked IP attempted access', {
                    ipAddress: context.ipAddress,
                    endpoint: context.endpoint,
                });

                // Record unauthorized access attempt
                await securityMonitoringService.recordUnauthorizedAccess(context);

                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'IP_BLOCKED',
                            message: 'Access denied. Your IP address has been blocked due to suspicious activity.',
                        },
                    },
                    { status: 403 }
                );
            }

            // Analyze threat level
            const { threatLevel, actions: _actions, reason } = await incidentPreventionService.analyzeThreat(
                context
            );

            // Log high-threat requests
            if (threatLevel === 'high' || threatLevel === 'critical') {
                logger.warn('High-threat request detected', {
                    ipAddress: context.ipAddress,
                    endpoint: context.endpoint,
                    threatLevel,
                    reason,
                });
            }

            // Execute the handler
            const response = await handler(req);

            // Track response status for security monitoring
            if (response.status === 401 || response.status === 403) {
                await securityMonitoringService.recordUnauthorizedAccess({
                    ...context,
                    statusCode: response.status,
                });
            }

            return response;
        } catch (error) {
            logger.error('Security middleware error - FAILING CLOSED', {
                error: error instanceof Error ? error.message : String(error),
                context,
            });

            // FAIL-CLOSED: Reject request on middleware errors to ensure security
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'SECURITY_MIDDLEWARE_ERROR',
                        message: 'A security processing error occurred. Access denied for safety.',
                    },
                },
                { status: 500 }
            );
        }
    };
}

/**
 * Track authentication failure
 *
 * Call this function when authentication fails
 */
export async function trackAuthFailure(
    req: NextRequest,
    email?: string
): Promise<void> {
    const context = createSecurityContext(req);
    if (email) {
        context.email = email;
    }

    await securityMonitoringService.recordAuthFailure(context);
    await incidentPreventionService.handleSecurityEvent('auth_failure', context);
}

/**
 * Track rate limit violation
 *
 * Call this function when rate limit is exceeded
 */
export async function trackRateLimitViolation(req: NextRequest): Promise<void> {
    const context = createSecurityContext(req);

    await securityMonitoringService.recordRateLimitViolation(context);
    await incidentPreventionService.handleSecurityEvent('rate_limit_exceeded', context);
}

/**
 * Track unauthorized access
 *
 * Call this function when unauthorized access is attempted
 */
export async function trackUnauthorizedAccess(req: NextRequest): Promise<void> {
    const context = createSecurityContext(req);

    await securityMonitoringService.recordUnauthorizedAccess(context);
    await incidentPreventionService.handleSecurityEvent('unauthorized_access', context);
}

/**
 * Check if CAPTCHA is required for IP
 */
export async function requiresCaptcha(_ipAddress: string): Promise<boolean> {
    // This would check Redis for the require_captcha flag
    // For now, return false
    return false;
}
