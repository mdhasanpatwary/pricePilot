/**
 * Authentication Token Detector Component
 * 
 * Detects and extracts authentication tokens from network traffic.
 * Stores tokens securely in API patterns for reuse.
 */

import type { CapturedRequest } from '@/lib/types/api-detection';

/**
 * Detected authentication token
 */
export interface DetectedAuthToken {
    type: 'bearer' | 'api-key' | 'cookie' | 'custom';
    location: 'header' | 'cookie' | 'query' | 'body';
    key: string;
    value: string;
    pattern?: string; // For dynamic tokens
}

/**
 * AuthTokenDetector class
 * 
 * Analyzes network requests to identify authentication mechanisms
 * and extract tokens for API pattern reuse.
 */
export class AuthTokenDetector {
    /**
     * Common authentication header names
     */
    private static readonly AUTH_HEADERS = [
        'authorization',
        'x-api-key',
        'x-auth-token',
        'x-access-token',
        'api-key',
        'apikey',
        'token',
        'auth-token',
        'access-token',
    ];

    /**
     * Common authentication cookie names
     */
    private static readonly AUTH_COOKIES = [
        'auth',
        'token',
        'session',
        'access_token',
        'api_token',
        'jwt',
        'bearer',
    ];

    /**
     * Common authentication query parameter names
     */
    private static readonly AUTH_QUERY_PARAMS = [
        'api_key',
        'apikey',
        'token',
        'access_token',
        'auth',
        'key',
    ];

    /**
     * Detect authentication tokens from captured requests
     * 
     * Analyzes request headers, cookies, query parameters, and body
     * to identify authentication mechanisms.
     * 
     * @param requests - Captured network requests
     * @returns Array of detected authentication tokens
     */
    detectAuthTokens(requests: CapturedRequest[]): DetectedAuthToken[] {
        const tokens: DetectedAuthToken[] = [];
        const seenTokens = new Set<string>();

        for (const request of requests) {
            // Check headers for auth tokens
            const headerTokens = this.detectHeaderTokens(request);
            for (const token of headerTokens) {
                const key = `${token.type}:${token.key}:${token.value}`;
                if (!seenTokens.has(key)) {
                    tokens.push(token);
                    seenTokens.add(key);
                }
            }

            // Check cookies for auth tokens
            const cookieTokens = this.detectCookieTokens(request);
            for (const token of cookieTokens) {
                const key = `${token.type}:${token.key}:${token.value}`;
                if (!seenTokens.has(key)) {
                    tokens.push(token);
                    seenTokens.add(key);
                }
            }

            // Check query parameters for auth tokens
            const queryTokens = this.detectQueryTokens(request);
            for (const token of queryTokens) {
                const key = `${token.type}:${token.key}:${token.value}`;
                if (!seenTokens.has(key)) {
                    tokens.push(token);
                    seenTokens.add(key);
                }
            }

            // Check request body for auth tokens
            if (request.requestBody) {
                const bodyTokens = this.detectBodyTokens(request);
                for (const token of bodyTokens) {
                    const key = `${token.type}:${token.key}:${token.value}`;
                    if (!seenTokens.has(key)) {
                        tokens.push(token);
                        seenTokens.add(key);
                    }
                }
            }
        }

        return tokens;
    }

    /**
     * Detect authentication tokens in request headers
     * 
     * @param request - Captured request
     * @returns Array of detected tokens
     */
    private detectHeaderTokens(request: CapturedRequest): DetectedAuthToken[] {
        const tokens: DetectedAuthToken[] = [];

        for (const [key, value] of Object.entries(request.headers)) {
            const lowerKey = key.toLowerCase();

            // Check for Authorization header (Bearer, Basic, etc.)
            if (lowerKey === 'authorization') {
                const token = this.parseAuthorizationHeader(value);
                if (token) {
                    tokens.push(token);
                }
                continue;
            }

            // Check for common API key headers
            if (AuthTokenDetector.AUTH_HEADERS.includes(lowerKey)) {
                tokens.push({
                    type: 'api-key',
                    location: 'header',
                    key,
                    value,
                });
            }
        }

        return tokens;
    }

    /**
     * Parse Authorization header to extract token
     * 
     * @param value - Authorization header value
     * @returns Detected token or null
     */
    private parseAuthorizationHeader(value: string): DetectedAuthToken | null {
        // Bearer token
        if (value.startsWith('Bearer ')) {
            return {
                type: 'bearer',
                location: 'header',
                key: 'Authorization',
                value: value.substring(7).trim(),
            };
        }

        // Basic auth (we don't extract credentials, just note it exists)
        if (value.startsWith('Basic ')) {
            return {
                type: 'custom',
                location: 'header',
                key: 'Authorization',
                value: value,
            };
        }

        // Other auth schemes
        return {
            type: 'custom',
            location: 'header',
            key: 'Authorization',
            value,
        };
    }

    /**
     * Detect authentication tokens in cookies
     * 
     * @param request - Captured request
     * @returns Array of detected tokens
     */
    private detectCookieTokens(request: CapturedRequest): DetectedAuthToken[] {
        const tokens: DetectedAuthToken[] = [];

        // Parse Cookie header
        const cookieHeader = request.headers['cookie'] || request.headers['Cookie'];
        if (!cookieHeader) {
            return tokens;
        }

        // Parse cookies
        const cookies = this.parseCookies(cookieHeader);

        for (const [name, value] of Object.entries(cookies)) {
            const lowerName = name.toLowerCase();

            // Check if cookie name matches common auth cookie names
            const isAuthCookie = AuthTokenDetector.AUTH_COOKIES.some((authCookie) =>
                lowerName.includes(authCookie)
            );

            if (isAuthCookie) {
                tokens.push({
                    type: 'cookie',
                    location: 'cookie',
                    key: name,
                    value,
                });
            }
        }

        return tokens;
    }

    /**
     * Parse cookie header into key-value pairs
     * 
     * @param cookieHeader - Cookie header value
     * @returns Cookie key-value pairs
     */
    private parseCookies(cookieHeader: string): Record<string, string> {
        const cookies: Record<string, string> = {};

        const parts = cookieHeader.split(';');
        for (const part of parts) {
            const [name, ...valueParts] = part.split('=');
            if (name && valueParts.length > 0) {
                cookies[name.trim()] = valueParts.join('=').trim();
            }
        }

        return cookies;
    }

    /**
     * Detect authentication tokens in query parameters
     * 
     * @param request - Captured request
     * @returns Array of detected tokens
     */
    private detectQueryTokens(request: CapturedRequest): DetectedAuthToken[] {
        const tokens: DetectedAuthToken[] = [];

        try {
            const url = new URL(request.url);

            for (const [key, value] of url.searchParams.entries()) {
                const lowerKey = key.toLowerCase();

                // Check if query param matches common auth param names
                if (AuthTokenDetector.AUTH_QUERY_PARAMS.includes(lowerKey)) {
                    tokens.push({
                        type: 'api-key',
                        location: 'query',
                        key,
                        value,
                    });
                }
            }
        } catch (error) {
            // Invalid URL, skip
        }

        return tokens;
    }

    /**
     * Detect authentication tokens in request body
     * 
     * @param request - Captured request
     * @returns Array of detected tokens
     */
    private detectBodyTokens(request: CapturedRequest): DetectedAuthToken[] {
        const tokens: DetectedAuthToken[] = [];

        if (!request.requestBody) {
            return tokens;
        }

        try {
            // Try to parse as JSON
            const body = JSON.parse(request.requestBody);

            // Look for common auth fields in body
            for (const key of Object.keys(body)) {
                const lowerKey = key.toLowerCase();

                if (
                    lowerKey.includes('token') ||
                    lowerKey.includes('auth') ||
                    lowerKey.includes('key')
                ) {
                    tokens.push({
                        type: 'custom',
                        location: 'body',
                        key,
                        value: String(body[key]),
                    });
                }
            }
        } catch (error) {
            // Not JSON, try URL-encoded
            try {
                const params = new URLSearchParams(request.requestBody);

                for (const [key, value] of params.entries()) {
                    const lowerKey = key.toLowerCase();

                    if (AuthTokenDetector.AUTH_QUERY_PARAMS.includes(lowerKey)) {
                        tokens.push({
                            type: 'api-key',
                            location: 'body',
                            key,
                            value,
                        });
                    }
                }
            } catch (error) {
                // Not URL-encoded either, skip
            }
        }

        return tokens;
    }

    /**
     * Apply detected auth tokens to request headers
     * 
     * Adds authentication tokens to request headers for API pattern reuse.
     * 
     * @param headers - Existing request headers
     * @param tokens - Detected authentication tokens
     * @returns Updated headers with auth tokens
     */
    applyAuthTokens(
        headers: Record<string, string>,
        tokens: DetectedAuthToken[]
    ): Record<string, string> {
        const updatedHeaders = { ...headers };

        for (const token of tokens) {
            if (token.location === 'header') {
                updatedHeaders[token.key] = token.value;
            } else if (token.location === 'cookie') {
                // Add to Cookie header
                const existingCookie = updatedHeaders['Cookie'] || '';
                const newCookie = `${token.key}=${token.value}`;

                if (existingCookie) {
                    updatedHeaders['Cookie'] = `${existingCookie}; ${newCookie}`;
                } else {
                    updatedHeaders['Cookie'] = newCookie;
                }
            }
        }

        return updatedHeaders;
    }

    /**
     * Apply detected auth tokens to query parameters
     * 
     * @param queryParams - Existing query parameters
     * @param tokens - Detected authentication tokens
     * @returns Updated query parameters with auth tokens
     */
    applyAuthQueryParams(
        queryParams: Record<string, string>,
        tokens: DetectedAuthToken[]
    ): Record<string, string> {
        const updatedParams = { ...queryParams };

        for (const token of tokens) {
            if (token.location === 'query') {
                updatedParams[token.key] = token.value;
            }
        }

        return updatedParams;
    }

    /**
     * Check if a token appears to be dynamic (changes between requests)
     * 
     * @param tokens - Array of detected tokens from multiple requests
     * @param tokenKey - Token key to check
     * @returns True if token appears dynamic
     */
    isDynamicToken(tokens: DetectedAuthToken[], tokenKey: string): boolean {
        const values = tokens
            .filter((t) => t.key === tokenKey)
            .map((t) => t.value);

        // If we see multiple different values for the same key, it's likely dynamic
        const uniqueValues = new Set(values);
        return uniqueValues.size > 1;
    }
}
