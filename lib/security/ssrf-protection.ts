/**
 * SSRF (Server-Side Request Forgery) Protection
 *
 * Provides URL validation to prevent SSRF attacks by blocking:
 * - Private/internal IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, etc.)
 * - Localhost and loopback addresses
 * - Cloud metadata endpoints (AWS, GCP, Azure)
 * - Link-local addresses
 *
 * Phase 7 Security Hardening
 */

/**
 * List of blocked IP ranges (CIDR notation) for SSRF protection
 */
const BLOCKED_IP_RANGES = [
  // Private ranges (RFC 1918)
  { start: '10.0.0.0', end: '10.255.255.255', name: 'Private Class A' },
  { start: '172.16.0.0', end: '172.31.255.255', name: 'Private Class B' },
  { start: '192.168.0.0', end: '192.168.255.255', name: 'Private Class C' },
  
  // Loopback/localhost
  { start: '127.0.0.0', end: '127.255.255.255', name: 'Loopback' },
  
  // Link-local (RFC 3927)
  { start: '169.254.0.0', end: '169.254.255.255', name: 'Link-Local' },
  
  // Shared Address Space (RFC 6598)
  { start: '100.64.0.0', end: '100.127.255.255', name: 'Shared Address Space' },
  
  // "This Network" (RFC 1122)
  { start: '0.0.0.0', end: '0.255.255.255', name: 'This Network' },
  
  // Broadcast
  { start: '255.255.255.255', end: '255.255.255.255', name: 'Broadcast' },
];

/**
 * List of blocked hostnames for SSRF protection
 */
const BLOCKED_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  '[::1]',
];

/**
 * List of cloud metadata endpoints (these provide internal credentials/data)
 */
const BLOCKED_METADATA_ENDPOINTS = [
  // AWS
  '169.254.169.254',
  'metadata.google.internal',
  'instance-data-service.internal',
  
  // GCP
  'metadata.google.internal',
  '169.254.169.254',
  
  // Azure
  '169.254.169.254',
  'metadata.azure.com',
  '169.254.169.254',
];

/**
 * Convert IPv4 string to number for range comparison
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) return -1;
  
  return (
    (parseInt(parts[0], 10) << 24) +
    (parseInt(parts[1], 10) << 16) +
    (parseInt(parts[2], 10) << 8) +
    parseInt(parts[3], 10)
  );
}

/**
 * Check if IP is in blocked range
 */
function isIpInBlockedRange(ip: string): boolean {
  const ipNum = ipToNumber(ip);
  if (ipNum === -1) return false;
  
  for (const range of BLOCKED_IP_RANGES) {
    const startNum = ipToNumber(range.start);
    const endNum = ipToNumber(range.end);
    
    if (ipNum >= startNum && ipNum <= endNum) {
      return true;
    }
  }
  
  return false;
}

/**
 * Validate URL for SSRF protection
 *
 * @param urlString - URL to validate
 * @returns { allowed: boolean; reason?: string }
 *
 * @example
 * ```typescript
 * const result = validateUrlForSSRP('https://example.com');
 * if (!result.allowed) {
 *   throw new Error(`URL blocked: ${result.reason}`);
 * }
 * ```
 */
export function validateUrlForSSRP(urlString: string): { allowed: boolean; reason?: string } {
  try {
    const url = new URL(urlString);
    
    // Check for blocked protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { allowed: false, reason: `Protocol '${url.protocol}' not allowed` };
    }
    
    const hostname = url.hostname.toLowerCase();
    
    // Check for blocked hostnames
    if (BLOCKED_HOSTNAMES.includes(hostname)) {
      return { allowed: false, reason: `Hostname '${hostname}' is blocked (loopback)` };
    }
    
    // Check for blocked metadata endpoints
    if (BLOCKED_METADATA_ENDPOINTS.includes(hostname)) {
      return { allowed: false, reason: `Hostname '${hostname}' is blocked (metadata endpoint)` };
    }
    
    // Check for IPv6 loopback
    if (hostname === '::1' || hostname.startsWith('[::1]')) {
      return { allowed: false, reason: 'IPv6 loopback address blocked' };
    }
    
    // Try to resolve and check if it's a private IP
    // Note: In a real implementation, you'd use a DNS resolver here
    // For now, we check common patterns
    
    // Check for IPv4 addresses directly in hostname
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Pattern.test(hostname)) {
      if (isIpInBlockedRange(hostname)) {
        return { allowed: false, reason: `IP address '${hostname}' is in blocked range` };
      }
    }
    
    // Additional check: block URLs with authentication in path
    // (potential for credential exposure)
    if (url.password || url.username) {
      return { allowed: false, reason: 'URLs with embedded credentials are blocked' };
    }
    
    return { allowed: true };
  } catch (error) {
    return { allowed: false, reason: `Invalid URL: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Validate multiple URLs for SSRF protection
 */
export function validateUrlsForSSRP(urls: string[]): { allowed: boolean; blocked?: string[] } {
  const blocked: string[] = [];
  
  for (const url of urls) {
    const result = validateUrlForSSRP(url);
    if (!result.allowed) {
      blocked.push(`${url} - ${result.reason}`);
    }
  }
  
  return {
    allowed: blocked.length === 0,
    blocked: blocked.length > 0 ? blocked : undefined,
  };
}

/**
 * Extract and validate all URLs from user input
 *
 * Useful for detecting SSRF attempts embedded in form fields
 */
export function extractAndValidateUrls(text: string): { allowed: boolean; urls: Array<{ url: string; valid: boolean; reason?: string }> } {
  // Simple URL pattern - in production use a more robust library
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlPattern) || [];
  
  const urls = matches.map(url => {
    const result = validateUrlForSSRP(url);
    return {
      url,
      valid: result.allowed,
      reason: result.reason,
    };
  });
  
  const hasBlockedUrls = urls.some(u => !u.valid);
  
  return {
    allowed: !hasBlockedUrls,
    urls,
  };
}
