/**
 * CORS Middleware
 * 
 * Provides CORS (Cross-Origin Resource Sharing) configuration for API routes.
 * Implements security best practices:
 * - No wildcards in production
 * - Whitelist-based origin validation
 * - Restricted methods and headers
 * - Preflight request handling
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Get allowed origins from environment variable
 * Falls back to NEXTAUTH_URL if ALLOWED_ORIGINS is not set
 */
function getAllowedOrigins(): string[] {
    const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;

    if (allowedOriginsEnv) {
        return allowedOriginsEnv.split(',').map(origin => origin.trim());
    }

    // Fallback to NEXTAUTH_URL
    const nextAuthUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    return [nextAuthUrl];
}

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string | null): boolean {
    if (!origin) {
        return false;
    }

    const allowedOrigins = getAllowedOrigins();

    // In development, allow localhost with any port
    if (process.env.NODE_ENV === 'development') {
        if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
            return true;
        }
    }

    // Check exact match
    return allowedOrigins.includes(origin);
}

/**
 * CORS configuration
 */
export const corsConfig = {
    allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'X-CSRF-Token',
        'X-Requested-With',
        'Accept',
        'Accept-Version',
        'Content-Length',
        'Content-MD5',
        'Content-Type',
        'Date',
        'X-Api-Version',
        'Authorization',
    ],
    exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
    ],
    maxAge: 86400, // 24 hours
    credentials: true,
};

/**
 * Apply CORS headers to response
 */
export function applyCorsHeaders(
    response: NextResponse,
    origin: string | null
): NextResponse {
    if (isOriginAllowed(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin!);
        response.headers.set('Access-Control-Allow-Credentials', 'true');
        response.headers.set(
            'Access-Control-Allow-Methods',
            corsConfig.allowedMethods.join(', ')
        );
        response.headers.set(
            'Access-Control-Allow-Headers',
            corsConfig.allowedHeaders.join(', ')
        );
        response.headers.set(
            'Access-Control-Expose-Headers',
            corsConfig.exposedHeaders.join(', ')
        );
        response.headers.set(
            'Access-Control-Max-Age',
            corsConfig.maxAge.toString()
        );
    }

    return response;
}

/**
 * Handle CORS preflight requests (OPTIONS)
 */
export function handleCorsPreflightRequest(request: NextRequest): NextResponse | null {
    const origin = request.headers.get('origin');

    // Only handle OPTIONS requests
    if (request.method !== 'OPTIONS') {
        return null;
    }

    // Check if origin is allowed
    if (!isOriginAllowed(origin)) {
        return new NextResponse(null, {
            status: 403,
            statusText: 'Forbidden',
        });
    }

    // Create preflight response
    const response = new NextResponse(null, {
        status: 204,
        statusText: 'No Content',
    });

    // Apply CORS headers
    return applyCorsHeaders(response, origin);
}

/**
 * CORS middleware wrapper for API routes
 */
export function withCors(
    handler: (request: NextRequest) => Promise<NextResponse>
) {
    return async (request: NextRequest): Promise<NextResponse> => {
        const origin = request.headers.get('origin');

        // Handle preflight requests
        if (request.method === 'OPTIONS') {
            const preflightResponse = handleCorsPreflightRequest(request);
            if (preflightResponse) {
                return preflightResponse;
            }
        }

        // Execute the handler
        const response = await handler(request);

        // Apply CORS headers to response
        return applyCorsHeaders(response, origin);
    };
}

/**
 * Validate CORS configuration
 * Throws error if configuration is insecure in production
 */
export function validateCorsConfig(): void {
    const isProduction = process.env.NODE_ENV === 'production';
    const allowedOrigins = getAllowedOrigins();

    if (isProduction) {
        // Check for wildcards
        if (allowedOrigins.some(origin => origin === '*')) {
            throw new Error(
                'CORS: Wildcard (*) origins are not allowed in production. ' +
                'Please specify exact domains in ALLOWED_ORIGINS environment variable.'
            );
        }

        // Check for localhost in production
        if (allowedOrigins.some(origin =>
            origin.includes('localhost') || origin.includes('127.0.0.1')
        )) {
            console.warn(
                'CORS Warning: localhost origins detected in production environment. ' +
                'This may be a security risk.'
            );
        }

        // Ensure HTTPS in production
        if (allowedOrigins.some(origin => origin.startsWith('http://'))) {
            console.warn(
                'CORS Warning: HTTP origins detected in production environment. ' +
                'Consider using HTTPS for all origins.'
            );
        }
    }
}
