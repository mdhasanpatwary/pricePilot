/**
 * HTTP Scraper Implementation
 * 
 * Provides HTTP-based web scraping with proxy support, cookie management,
 * and timeout handling. Uses axios for HTTP requests.
 */

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Cookie } from './session-manager';

/**
 * Configuration for a scrape request
 */
export interface ScrapeConfig {
    /** Target URL to scrape */
    url: string;
    /** Optional proxy configuration */
    proxy?: ProxyConfig;
    /** User-Agent header value */
    userAgent: string;
    /** Additional HTTP headers */
    headers: Record<string, string>;
    /** Cookies to include in the request */
    cookies: Cookie[];
    /** Request timeout in milliseconds */
    timeout: number;
    /** Whether to follow redirects */
    followRedirects: boolean;
}

/**
 * Proxy configuration
 */
export interface ProxyConfig {
    host: string;
    port: number;
    protocol: 'http' | 'https' | 'socks5';
    username?: string;
    password?: string;
}

/**
 * Response from a scrape request
 */
export interface ScrapeResponse {
    /** HTTP status code */
    statusCode: number;
    /** Response headers */
    headers: Record<string, string>;
    /** Response body (HTML content) */
    body: string;
    /** Final URL after redirects (if any) */
    finalUrl: string;
    /** Redirect URL if redirected */
    redirectUrl?: string;
    /** Response time in milliseconds */
    responseTime: number;
}

/**
 * HTTP Scraper class
 * 
 * Executes HTTP-based scraping with configurable headers, proxy support,
 * and cookie management.
 */
export class HttpScraper {
    /**
     * Execute a scrape request
     * 
     * @param config - Scrape configuration
     * @returns Promise resolving to scrape response
     * @throws Error if request fails
     */
    async scrape(config: ScrapeConfig): Promise<ScrapeResponse> {
        const startTime = Date.now();

        try {
            // Small jitter prevents perfectly periodic request signatures.
            await this.sleep(this.randomJitterMs(30, 140));

            // Build axios request configuration
            const axiosConfig: AxiosRequestConfig = {
                url: config.url,
                method: 'GET',
                headers: {
                    ...config.headers,
                    'User-Agent': config.userAgent,
                },
                timeout: config.timeout,
                maxRedirects: config.followRedirects ? 5 : 0,
                validateStatus: () => true, // Accept all status codes
            };

            // Add cookies to headers if provided
            if (config.cookies.length > 0) {
                const cookieHeader = this.buildCookieHeader(config.cookies);
                axiosConfig.headers!['Cookie'] = cookieHeader;
            }

            // Add proxy configuration if provided
            if (config.proxy) {
                axiosConfig.proxy = this.buildProxyConfig(config.proxy);
            }

            // Execute the request
            const response: AxiosResponse = await axios(axiosConfig);
            const responseTime = Date.now() - startTime;

            // Determine if redirected
            const finalUrl = response.request?.res?.responseUrl || config.url;
            const redirectUrl = finalUrl !== config.url ? finalUrl : undefined;

            return {
                statusCode: response.status,
                headers: response.headers as Record<string, string>,
                body: response.data,
                finalUrl,
                redirectUrl,
                responseTime,
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;

            // Handle axios errors
            if (axios.isAxiosError(error)) {
                if (error.response) {
                    // Server responded with error status
                    return {
                        statusCode: error.response.status,
                        headers: error.response.headers as Record<string, string>,
                        body: error.response.data || '',
                        finalUrl: config.url,
                        responseTime,
                    };
                } else if (error.code === 'ECONNABORTED') {
                    // Timeout error
                    throw new Error(`Request timeout after ${config.timeout}ms`);
                } else if (error.code === 'ECONNREFUSED') {
                    // Connection refused
                    throw new Error('Connection refused');
                } else if (error.code === 'ENOTFOUND') {
                    // DNS resolution failed
                    throw new Error('DNS resolution failed');
                }
            }

            // Re-throw other errors
            throw error;
        }
    }

    /**
     * Build Cookie header from cookie array
     * 
     * @param cookies - Array of cookies
     * @returns Cookie header string
     */
    private buildCookieHeader(cookies: Cookie[]): string {
        return cookies
            .map((cookie) => `${cookie.name}=${cookie.value}`)
            .join('; ');
    }

    /**
     * Build axios proxy configuration
     * 
     * @param proxy - Proxy configuration
     * @returns Axios proxy config
     */
    private buildProxyConfig(proxy: ProxyConfig): AxiosRequestConfig['proxy'] {
        return {
            host: proxy.host,
            port: proxy.port,
            protocol: proxy.protocol,
            auth: proxy.username && proxy.password
                ? {
                    username: proxy.username,
                    password: proxy.password,
                }
                : undefined,
        };
    }

    private randomJitterMs(minMs: number, maxMs: number): number {
        return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    }

    private async sleep(ms: number): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }
}
