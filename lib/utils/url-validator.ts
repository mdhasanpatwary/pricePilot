/**
 * URL Validator Utility
 * 
 * Provides centralized validation for URLs to prevent SSRF (Server-Side Request Forgery) attacks.
 * It checks if a URL points to private, loopback, or cloud metadata IP ranges.
 */

import { logger } from '../logger';
import { isIP } from 'net';

/**
 * Checks if a URL is safe for outbound requests from the server.
 * 
 * @param urlString - The URL to validate
 * @returns true if the URL is safe, false if it's potentially an SSRF attempt
 */
export function isUrlSafe(urlString: string): boolean {
    if (!urlString) return false;

    try {
        const url = new URL(urlString);

        // 1. Only allow http and https protocols
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            logger.warn('[SSRF] Blocked invalid protocol', { url: urlString, protocol: url.protocol });
            return false;
        }

        const hostname = url.hostname.toLowerCase();

        // 2. Block localhost and loopback names
        if (hostname === 'localhost' || hostname === 'localhost.localdomain' || hostname.endsWith('.localhost')) {
            logger.warn('[SSRF] Blocked loopback hostname', { url: urlString });
            return false;
        }

        // 3. If hostname is an IP, check if it's private/restricted
        if (isIP(hostname)) {
            if (isPrivateIP(hostname)) {
                logger.warn('[SSRF] Blocked private IP', { url: urlString, ip: hostname });
                return false;
            }
        }

        // 4. Block common cloud metadata hostnames
        const metadataHostnames = [
            'metadata.google.internal', // GCP
            'instance-data',            // AWS/OpenStack
            '169.254.169.254',          // AWS/Azure/GCP/Alibaba/DigitalOcean
            'metadata',                 // Generic
        ];

        if (metadataHostnames.includes(hostname)) {
            logger.warn('[SSRF] Blocked metadata hostname', { url: urlString });
            return false;
        }

        return true;
    } catch (error) {
        logger.error('[SSRF] Error parsing URL for validation', { url: urlString, error: error instanceof Error ? error.message : String(error) });
        return false;
    }
}

/**
 * Checks if an IP address is in a private or restricted range.
 * Covers:
 * - IPv4 Loopback (127.0.0.0/8)
 * - IPv4 Private (RFC 1918: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
 * - IPv4 Link-Local (169.254.0.0/16)
 * - IPv6 Loopback (::1/128)
 * - IPv6 Unique Local (fc00::/7)
 * - IPv6 Link-Local (fe80::/10)
 */
function isPrivateIP(ip: string): boolean {
    // Basic regex checks for common private ranges
    // For production, a more robust library like 'ipaddr.js' or 'ip' is recommended,
    // but we can start with these well-known patterns.

    // IPv4 patterns
    if (ip.startsWith('127.')) return true; // Loopback
    if (ip.startsWith('10.')) return true;  // Class A
    if (ip.startsWith('192.168.')) return true; // Class C
    if (ip.startsWith('169.254.')) return true; // Link-local

    // Class B (172.16.0.0 to 172.31.255.255)
    if (ip.startsWith('172.')) {
        const secondOctet = parseInt(ip.split('.')[1], 10);
        if (secondOctet >= 16 && secondOctet <= 31) return true;
    }

    // IPv6 patterns
    if (ip === '::1') return true;
    if (ip.startsWith('fe80:')) return true;
    if (ip.startsWith('fc00:')) return true;
    if (ip.startsWith('fd')) return true;

    return false;
}
