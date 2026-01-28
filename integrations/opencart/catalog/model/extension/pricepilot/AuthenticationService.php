<?php
/**
 * PricePilot AuthenticationService
 * Path: catalog/model/extension/pricepilot/AuthenticationService.php
 * 
 * Centralized authentication and authorization service for the PricePilot plugin.
 * Provides secure token validation, token generation, IP whitelisting, and
 * authentication attempt logging for security monitoring.
 * 
 * Requirements: 4.1, 4.2, 4.4, 4.5
 */

require_once(__DIR__ . '/Service.php');

class AuthenticationService extends Service {
    
    // Configuration keys
    const CONFIG_TOKEN = 'module_pricepilot_token';
    const CONFIG_TOKEN_CREATED = 'module_pricepilot_token_created';
    const CONFIG_IP_WHITELIST = 'module_pricepilot_ip_whitelist';
    
    // Token constants
    const TOKEN_LENGTH = 64; // 64-character hexadecimal token
    const TOKEN_BYTES = 32;  // 32 bytes = 64 hex characters
    
    // Cache keys
    const CACHE_KEY_AUTH_ATTEMPTS = 'pricepilot_auth_attempts_';
    const CACHE_TTL_AUTH_ATTEMPTS = 300; // 5 minutes
    
    /**
     * @var NotificationService Notification service instance
     */
    private $notificationService;
    
    /**
     * Validate API token from request
     * 
     * Requirements: 4.1
     * - Uses constant-time comparison to prevent timing attacks
     * - Compares against stored token in configuration
     * - Returns false if token is missing or invalid
     * 
     * @param string $token Token from request
     * @return bool True if valid, false otherwise
     */
    public function validateToken(string $token): bool {
        // Get stored token from configuration
        $storedToken = $this->getConfig(self::CONFIG_TOKEN);
        
        // If no token is configured, authentication fails
        if ($this->isEmpty($storedToken)) {
            $this->logMessage('Authentication failed: No token configured', 'warning');
            return false;
        }
        
        // Validate token format first (must be 64-char hex)
        if (strlen($token) !== self::TOKEN_LENGTH || !ctype_xdigit($token)) {
            $this->logMessage('Authentication failed: Invalid token format', 'warning');
            return false;
        }
        
        // Use constant-time comparison to prevent timing attacks
        // hash_equals() is designed to take constant time regardless of input
        $isValid = hash_equals($storedToken, $token);
        
        if (!$isValid) {
            $this->logMessage('Authentication failed: Token mismatch', 'warning');
        }
        
        return $isValid;
    }
    
    /**
     * Generate new API token
     * 
     * Requirements: 4.1, 4.2
     * - Uses random_bytes() for cryptographic security
     * - Generates 32 random bytes (256 bits of entropy)
     * - Converts to 64-character hexadecimal string
     * - Returns token ready to be stored in configuration
     * 
     * @return string 64-character hexadecimal token
     * @throws Exception If random_bytes() fails
     */
    public function generateToken(): string {
        try {
            // Generate 32 random bytes using cryptographically secure random number generator
            $randomBytes = random_bytes(self::TOKEN_BYTES);
            
            // Convert to hexadecimal string (32 bytes = 64 hex characters)
            $token = bin2hex($randomBytes);
            
            $this->logMessage('New API token generated successfully', 'info');
            
            return $token;
            
        } catch (Exception $e) {
            $this->logMessage('Failed to generate token: ' . $e->getMessage(), 'error');
            throw new Exception('Failed to generate secure token: ' . $e->getMessage());
        }
    }
    
    /**
     * Check if IP address is whitelisted
     * 
     * Requirements: 4.4
     * - Checks if IP whitelist is enabled in configuration
     * - Returns true if whitelist is disabled (allows all IPs)
     * - Supports individual IP addresses
     * - Supports CIDR notation for IP ranges (e.g., 192.168.1.0/24)
     * - Supports comma-separated list of IPs and ranges
     * 
     * @param string $ip IP address to check
     * @return bool True if whitelisted or whitelist disabled, false otherwise
     */
    public function isIpWhitelisted(string $ip): bool {
        // Get IP whitelist from configuration
        $whitelist = $this->getConfig(self::CONFIG_IP_WHITELIST);
        
        // If whitelist is not configured or empty, allow all IPs
        if ($this->isEmpty($whitelist)) {
            return true;
        }
        
        // Parse whitelist (comma-separated values)
        $allowedIps = array_map('trim', explode(',', $whitelist));
        
        // Check each entry in whitelist
        foreach ($allowedIps as $allowedIp) {
            // Skip empty entries
            if (empty($allowedIp)) {
                continue;
            }
            
            // Check if it's a CIDR notation (e.g., 192.168.1.0/24)
            if (strpos($allowedIp, '/') !== false) {
                if ($this->ipMatchesCidr($ip, $allowedIp)) {
                    return true;
                }
            } else {
                // Direct IP match
                if ($ip === $allowedIp) {
                    return true;
                }
            }
        }
        
        // IP not found in whitelist
        $this->logMessage("IP {$ip} not in whitelist", 'warning');
        return false;
    }
    
    /**
     * Log authentication attempt
     * 
     * Requirements: 4.5
     * - Records authentication attempts for security monitoring
     * - Stores IP address, timestamp, and success/failure status
     * - Uses cache for temporary storage (5-minute TTL)
     * - Can be used to detect brute force attacks
     * 
     * @param string $ip IP address
     * @param bool $success Whether authentication succeeded
     * @return void
     */
    public function logAuthAttempt(string $ip, bool $success): void {
        $cacheKey = self::CACHE_KEY_AUTH_ATTEMPTS . md5($ip);
        
        // Get existing attempts from cache
        $attempts = $this->cache->get($cacheKey);
        if (!is_array($attempts)) {
            $attempts = [];
        }
        
        // Add new attempt
        $attempts[] = [
            'timestamp' => $this->getCurrentTimestamp(),
            'success' => $success,
            'ip' => $ip
        ];
        
        // Keep only last 100 attempts to prevent memory issues
        if (count($attempts) > 100) {
            $attempts = array_slice($attempts, -100);
        }
        
        // Store in cache
        $this->cache->set($cacheKey, $attempts, self::CACHE_TTL_AUTH_ATTEMPTS);
        
        // Log to system log
        $status = $success ? 'successful' : 'failed';
        $this->logMessage("Authentication attempt from {$ip}: {$status}", $success ? 'info' : 'warning');
        
        // If failed, check for potential brute force attack
        if (!$success) {
            $this->checkBruteForce($ip, $attempts);
        }
    }
    
    /**
     * Get authentication attempts for an IP address
     * 
     * Helper method to retrieve authentication attempt history for monitoring
     * 
     * @param string $ip IP address
     * @return array Array of authentication attempts
     */
    public function getAuthAttempts(string $ip): array {
        $cacheKey = self::CACHE_KEY_AUTH_ATTEMPTS . md5($ip);
        $attempts = $this->cache->get($cacheKey);
        
        return is_array($attempts) ? $attempts : [];
    }
    
    /**
     * Get failed authentication count for an IP address
     * 
     * Helper method to count failed authentication attempts within a time window
     * 
     * @param string $ip IP address
     * @param int $windowSeconds Time window in seconds (default: 300 = 5 minutes)
     * @return int Number of failed attempts
     */
    public function getFailedAttemptCount(string $ip, int $windowSeconds = 300): int {
        $attempts = $this->getAuthAttempts($ip);
        $cutoffTime = strtotime("-{$windowSeconds} seconds");
        $failedCount = 0;
        
        foreach ($attempts as $attempt) {
            $attemptTime = strtotime($attempt['timestamp']);
            if ($attemptTime >= $cutoffTime && !$attempt['success']) {
                $failedCount++;
            }
        }
        
        return $failedCount;
    }
    
    /**
     * Check for brute force attack pattern
     * 
     * Internal method to detect potential brute force attacks
     * Logs a security alert if threshold is exceeded
     * Sends email notification when threshold is exceeded (Requirement 20.2)
     * 
     * @param string $ip IP address
     * @param array $attempts Array of authentication attempts
     * @return void
     */
    private function checkBruteForce(string $ip, array $attempts): void {
        // Count failed attempts in last 5 minutes
        $recentFailures = 0;
        $cutoffTime = strtotime('-5 minutes');
        
        foreach ($attempts as $attempt) {
            $attemptTime = strtotime($attempt['timestamp']);
            if ($attemptTime >= $cutoffTime && !$attempt['success']) {
                $recentFailures++;
            }
        }
        
        // If more than 10 failed attempts in 5 minutes, log security alert
        if ($recentFailures > 10) {
            $this->logMessage(
                "SECURITY ALERT: Potential brute force attack from {$ip} - {$recentFailures} failed attempts in 5 minutes",
                'error'
            );
            
            // Send security notification (Requirement 20.2)
            $this->getNotificationService()->sendEmailNotification(
                'Security Alert: Potential Brute Force Attack',
                "Multiple failed authentication attempts detected from IP address {$ip}.\n\n" .
                "Failed attempts in last 5 minutes: {$recentFailures}\n" .
                "Time: " . date('Y-m-d H:i:s') . "\n\n" .
                "This may indicate a brute force attack attempt. Consider blocking this IP address if the activity continues.",
                NotificationService::TYPE_SECURITY,
                NotificationService::PRIORITY_CRITICAL
            );
        }
    }
    
    /**
     * Get notification service instance (lazy loading)
     * 
     * @return NotificationService
     */
    private function getNotificationService() {
        if ($this->notificationService === null) {
            require_once __DIR__ . '/NotificationService.php';
            $this->notificationService = new NotificationService($this->registry);
        }
        return $this->notificationService;
    }
    
    /**
     * Check if IP matches CIDR notation
     * 
     * Internal helper method to check if an IP address matches a CIDR range
     * Supports both IPv4 and basic IPv6
     * 
     * @param string $ip IP address to check
     * @param string $cidr CIDR notation (e.g., 192.168.1.0/24)
     * @return bool True if IP matches CIDR range
     */
    private function ipMatchesCidr(string $ip, string $cidr): bool {
        // Parse CIDR notation
        list($subnet, $mask) = explode('/', $cidr);
        
        // Convert IP and subnet to long integers for comparison
        $ipLong = ip2long($ip);
        $subnetLong = ip2long($subnet);
        
        // If conversion failed, return false
        if ($ipLong === false || $subnetLong === false) {
            return false;
        }
        
        // Calculate network mask
        $maskLong = -1 << (32 - (int)$mask);
        
        // Apply mask to both IP and subnet and compare
        return ($ipLong & $maskLong) === ($subnetLong & $maskLong);
    }
    
    /**
     * Clear authentication attempts for an IP address
     * 
     * Helper method to clear authentication attempt history
     * Useful for testing or after resolving security issues
     * 
     * @param string $ip IP address
     * @return void
     */
    public function clearAuthAttempts(string $ip): void {
        $cacheKey = self::CACHE_KEY_AUTH_ATTEMPTS . md5($ip);
        $this->cache->delete($cacheKey);
        $this->logMessage("Cleared authentication attempts for {$ip}", 'info');
    }
    
    /**
     * Validate token and IP address together
     * 
     * Convenience method that combines token validation and IP whitelisting
     * 
     * @param string $token API token
     * @param string $ip IP address
     * @return array ['valid' => bool, 'error' => string|null]
     */
    public function authenticate(string $token, string $ip): array {
        // Check IP whitelist first
        if (!$this->isIpWhitelisted($ip)) {
            $this->logAuthAttempt($ip, false);
            return [
                'valid' => false,
                'error' => 'IP address not whitelisted'
            ];
        }
        
        // Validate token
        if (!$this->validateToken($token)) {
            $this->logAuthAttempt($ip, false);
            return [
                'valid' => false,
                'error' => 'Invalid API token'
            ];
        }
        
        // Authentication successful
        $this->logAuthAttempt($ip, true);
        return [
            'valid' => true,
            'error' => null
        ];
    }
}
