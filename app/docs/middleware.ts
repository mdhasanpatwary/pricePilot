import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { applyCSPHeaders } from '@/lib/documentation/security';

/**
 * Middleware for documentation routes
 * Applies Content Security Policy headers
 */
export function middleware(_request: NextRequest) {
    const response = NextResponse.next();

    // Apply CSP headers to all documentation pages
    applyCSPHeaders(response.headers);

    return response;
}

export const config = {
    matcher: '/docs/:path*',
};
