<?php
/**
 * PricePilot Rate Limit Service
 * Path: catalog/model/extension/pricepilot/RateLimitService.php
 * 
 * Provides request throttling to prevent API abuse through rate limiting.
 * Uses sliding window algorithm with OpenCart cache system for accurate
 * request counting and automatic expiration.
 * 
 * Requirements Addressed:
 * - 3.1: Reject requests exceeding 100 requests per 60 seconds with HTTP 429
 * - 3.2: Return Retry-After header when rate limit exceeded
 * - 3.3: Track request counts per IP address in cache
 * - 3.4: Reset counter when rate limit window expires
 * 
 * @package PricePilot
 * @subpackage Services
 */

require_once __DIR__ . '/Service.php';

class RateLimitService extends Service {
    /**
     * Default rate limit: 100 requests per 60 seconds
     */
    const DEFAULT_LIMIT = 100;
    const DEFAULT_WINDOW = 60;
    
    /**
     * Cache key prefix for rate limiting
     */
    const CACHE_PREFIX = 'ratelimit_';
    
    /**
     * Check if request should be allowed based on rate limits
     * 
     * Implements sliding window algorithm:
     * 1. Calculate current time window
     * 2. Get request count for this IP/endpoint/window
     * 3. Check if count exceeds limit
     * 4. Return allowed status and retry_after if exceeded
     * 
     * @param string $ip IP address making the request
     * @param string $endpoint Endpoint being accessed (e.g., '/api/pricepilot/products')
     * @return array ['allowed' => bool, 'retry_after' => int|null]
     *               - allowed: true if request should be allowed, false if rate limited
     *               - retry_after: seconds until rate limit resets (null if allowed)
     */
    public function checkLimit(string $ip, string $endpoint): array {
        // Get rate limit configuration
        $limit = $this->getConfig('module_pricepilot_rate_limit', self::DEFAULT_LIMIT);
        $window = $this->getConfig('module_pricepilot_rate_window', self::DEFAULT_WINDOW);
        
        // Check if rate limiting is enabled (limit > 0)
        if ($limit <= 0) {
            return [
                'allowed' => true,
                'retry_after' => null
            ];
        }
        
        // Calculate current time window (floor to window boundary)
        $currentTime = time();
        $windowStart = floor($currentTime / $window) * $window;
        
        // Generate cache key: ratelimit_{ip}_{endpoint}_{window}
        $cacheKey = $this->generateCacheKey($ip, $endpoint, $windowStart);
        
        // Get current request count from cache
        $requestCount = $this->cache->get($cacheKey);
        
        // If no count exists, this is the first request in this window
        if ($requestCount === null || $requestCount === false) {
            $requestCount = 0;
        }
        
        // Check if limit exceeded
        if ($requestCount >= $limit) {
            // Calculate seconds until window resets
            $windowEnd = $windowStart + $window;
            $retryAfter = $windowEnd - $currentTime;
            
            $this->logMessage(
                "Rate limit exceeded for IP {$ip} on endpoint {$endpoint}. " .
                "Count: {$requestCount}/{$limit}. Retry after: {$retryAfter}s",
                'warning'
            );
            
            return [
                'allowed' => false,
                'retry_after' => (int)max(1, $retryAfter) // Ensure at least 1 second, cast to int
            ];
        }
        
        // Request is allowed
        return [
            'allowed' => true,
            'retry_after' => null
        ];
    }
    
    /**
     * Record a request for rate limiting
     * 
     * Increments the request counter for the current time window.
     * Uses cache with TTL to automatically expire old counters.
     * 
     * @param string $ip IP address making the request
     * @param string $endpoint Endpoint being accessed
     * @return void
     */
    public function recordRequest(string $ip, string $endpoint): void {
        // Get rate limit configuration
        $window = $this->getConfig('module_pricepilot_rate_window', self::DEFAULT_WINDOW);
        
        // Calculate current time window
        $currentTime = time();
        $windowStart = floor($currentTime / $window) * $window;
        
        // Generate cache key
        $cacheKey = $this->generateCacheKey($ip, $endpoint, $windowStart);
        
        // Get current count
        $requestCount = $this->cache->get($cacheKey);
        
        if ($requestCount === null || $requestCount === false) {
            $requestCount = 0;
        }
        
        // Increment count
        $requestCount++;
        
        // Store in cache with TTL = window duration + buffer
        // Buffer ensures counter doesn't expire before window ends
        $ttl = $window + 10;
        $this->cache->set($cacheKey, $requestCount, $ttl);
        
        $this->logMessage(
            "Recorded request for IP {$ip} on endpoint {$endpoint}. Count: {$requestCount}",
            'info'
        );
    }
    
    /**
     * Reset rate limit for an IP address
     * 
     * Clears rate limit counters for the specified IP and endpoint.
     * If no endpoint specified, clears common API endpoints.
     * Useful for manual override or testing purposes.
     * 
     * @param string $ip IP address to reset
     * @param string|null $endpoint Specific endpoint to reset (null for all common endpoints)
     * @return void
     */
    public function resetLimit(string $ip, ?string $endpoint = null): void {
        // Get rate limit configuration
        $window = $this->getConfig('module_pricepilot_rate_window', self::DEFAULT_WINDOW);
        
        // Calculate current time window
        $currentTime = time();
        $windowStart = floor($currentTime / $window) * $window;
        
        if ($endpoint !== null) {
            // Clear specific endpoint
            $cacheKey = $this->generateCacheKey($ip, $endpoint, $windowStart);
            $this->cache->delete($cacheKey);
            
            $this->logMessage(
                "Rate limit reset for IP {$ip} on endpoint {$endpoint}",
                'info'
            );
        } else {
            // Common endpoints to clear
            $endpoints = [
                '/api/pricepilot/products',
                '/api/pricepilot/update',
                '/api/pricepilot/bulk-update',
                '/api/pricepilot/stock-update',
                '/api/pricepilot/test' // For testing
            ];
            
            // Clear cache for each endpoint
            foreach ($endpoints as $ep) {
                $cacheKey = $this->generateCacheKey($ip, $ep, $windowStart);
                $this->cache->delete($cacheKey);
            }
            
            $this->logMessage(
                "Rate limit reset for IP {$ip}",
                'info'
            );
        }
    }
    
    /**
     * Generate cache key for rate limiting
     * 
     * Format: ratelimit_{ip}_{endpoint_hash}_{window}
     * Uses MD5 hash of endpoint to keep key length manageable
     * 
     * @param string $ip IP address
     * @param string $endpoint Endpoint path
     * @param int $windowStart Window start timestamp
     * @return string Cache key
     */
    private function generateCacheKey(string $ip, string $endpoint, int $windowStart): string {
        // Sanitize IP (remove invalid characters)
        $sanitizedIp = preg_replace('/[^0-9a-fA-F:.]/', '', $ip);
        
        // Hash endpoint to keep key length manageable
        $endpointHash = md5($endpoint);
        
        return self::CACHE_PREFIX . $sanitizedIp . '_' . $endpointHash . '_' . $windowStart;
    }
    
    /**
     * Get current request count for IP and endpoint
     * 
     * Utility method for monitoring and debugging.
     * 
     * @param string $ip IP address
     * @param string $endpoint Endpoint path
     * @return int Current request count in this window
     */
    public function getCurrentCount(string $ip, string $endpoint): int {
        $window = $this->getConfig('module_pricepilot_rate_window', self::DEFAULT_WINDOW);
        $currentTime = time();
        $windowStart = floor($currentTime / $window) * $window;
        
        $cacheKey = $this->generateCacheKey($ip, $endpoint, $windowStart);
        $count = $this->cache->get($cacheKey);
        
        return ($count === null || $count === false) ? 0 : (int)$count;
    }
    
    /**
     * Get rate limit configuration
     * 
     * Returns current rate limit settings.
     * 
     * @return array ['limit' => int, 'window' => int]
     */
    public function getRateLimitConfig(): array {
        return [
            'limit' => $this->getConfig('module_pricepilot_rate_limit', self::DEFAULT_LIMIT),
            'window' => $this->getConfig('module_pricepilot_rate_window', self::DEFAULT_WINDOW)
        ];
    }
}
