/**
 * Session Manager for Bot Protection
 * 
 * Manages cookies and session state for maintaining realistic browsing sessions
 * with competitor websites. Implements cookie lifecycle management, expiration
 * handling, and per-site cookie isolation.
 * 
 * @module SessionManager
 */

import { prisma } from '@/lib/prisma';

/**
 * Cookie interface representing an HTTP cookie
 */
export interface Cookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: Date;
    httpOnly: boolean;
    secure: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Session Manager class for handling cookies and session state
 */
export class SessionManager {
    /**
     * Parse cookie expiration from Set-Cookie header
     * 
     * @param setCookieHeader - The Set-Cookie header value
     * @returns Parsed cookie with expiration
     */
    private parseCookieFromHeader(setCookieHeader: string): Cookie | null {
        try {
            const parts = setCookieHeader.split(';').map(p => p.trim());
            const [nameValue] = parts;
            const [name, value] = nameValue.split('=');

            if (!name || value === undefined) {
                return null;
            }

            const cookie: Cookie = {
                name: name.trim(),
                value: value.trim(),
                domain: '',
                path: '/',
                httpOnly: false,
                secure: false,
            };

            // Parse cookie attributes
            for (let i = 1; i < parts.length; i++) {
                const part = parts[i];
                const [attrName, attrValue] = part.split('=').map(s => s.trim());
                const attrNameLower = attrName.toLowerCase();

                switch (attrNameLower) {
                    case 'expires':
                        cookie.expires = new Date(attrValue);
                        break;
                    case 'max-age':
                        const maxAge = parseInt(attrValue, 10);
                        if (!isNaN(maxAge)) {
                            cookie.expires = new Date(Date.now() + maxAge * 1000);
                        }
                        break;
                    case 'domain':
                        cookie.domain = attrValue;
                        break;
                    case 'path':
                        cookie.path = attrValue;
                        break;
                    case 'httponly':
                        cookie.httpOnly = true;
                        break;
                    case 'secure':
                        cookie.secure = true;
                        break;
                    case 'samesite':
                        const sameSiteValue = attrValue?.toLowerCase();
                        if (sameSiteValue === 'strict' || sameSiteValue === 'lax' || sameSiteValue === 'none') {
                            cookie.sameSite = sameSiteValue.charAt(0).toUpperCase() + sameSiteValue.slice(1) as 'Strict' | 'Lax' | 'None';
                        }
                        break;
                }
            }

            return cookie;
        } catch (error) {
            console.error('Error parsing cookie from header:', error);
            return null;
        }
    }

    /**
     * Parse cookies from response headers
     * 
     * @param headers - Response headers object
     * @returns Array of parsed cookies
     */
    parseCookiesFromHeaders(headers: Record<string, string | string[]>): Cookie[] {
        const cookies: Cookie[] = [];
        const setCookieHeaders = headers['set-cookie'];

        if (!setCookieHeaders) {
            return cookies;
        }

        // Handle both single string and array of strings
        const cookieHeaders = Array.isArray(setCookieHeaders)
            ? setCookieHeaders
            : [setCookieHeaders];

        for (const header of cookieHeaders) {
            const cookie = this.parseCookieFromHeader(header);
            if (cookie) {
                cookies.push(cookie);
            }
        }

        return cookies;
    }

    /**
     * Merge new cookies with existing cookies, updating or adding as needed
     * 
     * @param existingCookies - Current cookies
     * @param newCookies - New cookies to merge
     * @returns Merged cookie array
     */
    private mergeCookies(existingCookies: Cookie[], newCookies: Cookie[]): Cookie[] {
        const cookieMap = new Map<string, Cookie>();

        // Add existing cookies to map
        for (const cookie of existingCookies) {
            const key = `${cookie.name}:${cookie.domain}:${cookie.path}`;
            cookieMap.set(key, cookie);
        }

        // Update or add new cookies
        for (const cookie of newCookies) {
            const key = `${cookie.name}:${cookie.domain}:${cookie.path}`;
            cookieMap.set(key, cookie);
        }

        return Array.from(cookieMap.values());
    }

    /**
     * Remove expired cookies from an array
     * 
     * @param cookies - Array of cookies
     * @returns Array of non-expired cookies
     */
    private removeExpiredCookies(cookies: Cookie[]): Cookie[] {
        const now = new Date();
        return cookies.filter(cookie => {
            if (!cookie.expires) {
                return true; // Session cookies don't expire
            }
            return new Date(cookie.expires) > now;
        });
    }

    /**
     * Update cookies for a site by merging with existing cookies
     * 
     * @param competitorWebsiteId - The ID of the competitor website
     * @param newCookies - New cookies to add/update
     */
    async updateCookies(competitorWebsiteId: string, newCookies: Cookie[]): Promise<void> {
        try {
            // Get existing cookies
            const existingCookies = await this.getCookies(competitorWebsiteId);

            // Merge cookies
            const mergedCookies = this.mergeCookies(existingCookies, newCookies);

            // Remove expired cookies
            const validCookies = this.removeExpiredCookies(mergedCookies);

            // Store updated cookies
            await this.storeCookies(competitorWebsiteId, validCookies);
        } catch (error) {
            console.error(`Error updating cookies for site ${competitorWebsiteId}:`, error);
            throw error;
        }
    }

    /**
     * Get cookies for a specific competitor website
     * 
     * @param competitorWebsiteId - The ID of the competitor website
     * @returns Array of cookies for the website
     */
    async getCookies(competitorWebsiteId: string): Promise<Cookie[]> {
        try {
            // Fetch cookie jar from database
            const cookieJar = await prisma.scrapingCookieJar.findUnique({
                where: { competitorWebsiteId },
            });

            if (!cookieJar) {
                return [];
            }

            // Check if cookie jar has expired
            if (cookieJar.expiresAt < new Date()) {
                // Cookie jar expired, clear it
                await this.clearCookies(competitorWebsiteId);
                return [];
            }

            // Parse cookies from JSON
            const cookies = cookieJar.cookies as unknown as Cookie[];

            // Filter out expired cookies
            const now = new Date();
            const validCookies = cookies.filter(cookie => {
                if (!cookie.expires) {
                    return true; // Session cookies don't expire
                }
                return new Date(cookie.expires) > now;
            });

            // If we filtered out cookies, update the jar
            if (validCookies.length !== cookies.length) {
                await this.storeCookies(competitorWebsiteId, validCookies);
            }

            return validCookies;
        } catch (error) {
            console.error(`Error getting cookies for site ${competitorWebsiteId}:`, error);
            return [];
        }
    }

    /**
     * Store cookies for a specific competitor website
     * 
     * @param competitorWebsiteId - The ID of the competitor website
     * @param cookies - Array of cookies to store
     */
    async storeCookies(competitorWebsiteId: string, cookies: Cookie[]): Promise<void> {
        try {
            // Calculate expiration time for the cookie jar
            // Use the latest cookie expiration, or default to 24 hours
            const now = new Date();
            let maxExpiration = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours default

            for (const cookie of cookies) {
                if (cookie.expires) {
                    const cookieExpiration = new Date(cookie.expires);
                    if (cookieExpiration > maxExpiration) {
                        maxExpiration = cookieExpiration;
                    }
                }
            }

            // Upsert cookie jar
            await prisma.scrapingCookieJar.upsert({
                where: { competitorWebsiteId },
                create: {
                    competitorWebsiteId,
                    cookies: cookies as any,
                    expiresAt: maxExpiration,
                },
                update: {
                    cookies: cookies as any,
                    expiresAt: maxExpiration,
                    updatedAt: now,
                },
            });
        } catch (error) {
            console.error(`Error storing cookies for site ${competitorWebsiteId}:`, error);
            throw error;
        }
    }

    /**
     * Clear all cookies for a specific competitor website
     * 
     * @param competitorWebsiteId - The ID of the competitor website
     */
    async clearCookies(competitorWebsiteId: string): Promise<void> {
        try {
            await prisma.scrapingCookieJar.delete({
                where: { competitorWebsiteId },
            });

            console.log(`Cleared cookies for site ${competitorWebsiteId}`);
        } catch (error) {
            // If the record doesn't exist, that's fine
            if ((error as any).code === 'P2025') {
                return;
            }
            console.error(`Error clearing cookies for site ${competitorWebsiteId}:`, error);
            throw error;
        }
    }

    /**
     * Check if a session is valid for a specific competitor website
     * 
     * @param competitorWebsiteId - The ID of the competitor website
     * @returns True if session is valid, false otherwise
     */
    async isSessionValid(competitorWebsiteId: string): Promise<boolean> {
        try {
            const cookieJar = await prisma.scrapingCookieJar.findUnique({
                where: { competitorWebsiteId },
            });

            if (!cookieJar) {
                return false;
            }

            // Check if cookie jar has expired
            if (cookieJar.expiresAt < new Date()) {
                return false;
            }

            // Check if we have any cookies
            const cookies = cookieJar.cookies as unknown as Cookie[];
            if (!cookies || cookies.length === 0) {
                return false;
            }

            // Check if at least one cookie is still valid
            const now = new Date();
            const hasValidCookie = cookies.some(cookie => {
                if (!cookie.expires) {
                    return true; // Session cookies are valid
                }
                return new Date(cookie.expires) > now;
            });

            return hasValidCookie;
        } catch (error) {
            console.error(`Error checking session validity for site ${competitorWebsiteId}:`, error);
            return false;
        }
    }

    /**
     * Detect if an error is session-related
     * 
     * @param error - Error object or message
     * @returns True if error is session-related
     */
    isSessionError(error: Error | string): boolean {
        const errorMessage = typeof error === 'string' ? error : error.message;
        const errorMessageLower = errorMessage.toLowerCase();

        // Common session-related error patterns
        const sessionErrorPatterns = [
            'session expired',
            'session invalid',
            'session timeout',
            'unauthorized',
            'authentication required',
            'login required',
            'access denied',
            'forbidden',
            'csrf',
            'token expired',
            'token invalid',
            'cookie expired',
            'cookie invalid',
        ];

        return sessionErrorPatterns.some(pattern =>
            errorMessageLower.includes(pattern)
        );
    }

    /**
     * Handle session-related errors by clearing cookies
     * 
     * @param competitorWebsiteId - The ID of the competitor website
     * @param error - The error that occurred
     */
    async handleSessionError(competitorWebsiteId: string, error: Error | string): Promise<void> {
        try {
            // Check if this is a session-related error
            if (!this.isSessionError(error)) {
                return;
            }

            // Clear cookies for this site
            await this.clearCookies(competitorWebsiteId);

            // Log the session clearing event
            const errorMessage = typeof error === 'string' ? error : error.message;
            console.log(`Session cleared for site ${competitorWebsiteId} due to error: ${errorMessage}`);
        } catch (clearError) {
            console.error(`Error handling session error for site ${competitorWebsiteId}:`, clearError);
        }
    }

    /**
     * Clear session on authentication failure
     * 
     * @param competitorWebsiteId - The ID of the competitor website
     * @param statusCode - HTTP status code
     */
    async handleAuthenticationFailure(competitorWebsiteId: string, statusCode: number): Promise<void> {
        // Status codes that indicate authentication/session issues
        const authFailureCodes = [401, 403];

        if (authFailureCodes.includes(statusCode)) {
            await this.clearCookies(competitorWebsiteId);
            console.log(`Session cleared for site ${competitorWebsiteId} due to HTTP ${statusCode}`);
        }
    }
}
