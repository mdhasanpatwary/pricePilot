/**
 * Documentation Redirect Middleware
 * 
 * Handles 301 permanent redirects for moved documentation files.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRedirect } from '@/lib/documentation/migration/redirects';

/**
 * Middleware to handle documentation redirects
 * 
 * Checks if the requested path has a redirect and returns 301 if found.
 */
export async function documentationRedirectMiddleware(
    request: NextRequest
): Promise<NextResponse | null> {
    const pathname = request.nextUrl.pathname;

    // Only handle /docs/* paths
    if (!pathname.startsWith('/docs/') && !pathname.startsWith('/admin-docs/')) {
        return null;
    }

    try {
        // Check for redirect
        const newPath = await getRedirect(pathname);

        if (newPath) {
            // Create redirect URL
            const redirectUrl = new URL(newPath, request.url);

            // Preserve query parameters
            redirectUrl.search = request.nextUrl.search;

            // Return 301 permanent redirect
            return NextResponse.redirect(redirectUrl, { status: 301 });
        }

        return null;
    } catch (error) {
        console.error('Error checking documentation redirect:', error);
        return null;
    }
}
