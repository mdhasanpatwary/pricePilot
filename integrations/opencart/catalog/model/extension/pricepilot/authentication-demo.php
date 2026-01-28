<?php
/**
 * AuthenticationService Usage Examples
 * 
 * This file demonstrates how to use the AuthenticationService class
 * for secure token handling, IP whitelisting, and authentication logging.
 */

// Load the service (in real OpenCart context, this would be done via registry)
require_once('AuthenticationService.php');

// Example 1: Generate a new API token
echo "=== Example 1: Generate New Token ===\n";
$authService = new AuthenticationService($registry);
try {
    $newToken = $authService->generateToken();
    echo "Generated token: {$newToken}\n";
    echo "Token length: " . strlen($newToken) . " characters\n";
    echo "Token is hexadecimal: " . (ctype_xdigit($newToken) ? 'Yes' : 'No') . "\n\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n\n";
}

// Example 2: Validate a token (constant-time comparison)
echo "=== Example 2: Validate Token ===\n";
$validToken = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd";
$invalidToken = "invalid_token_format";

echo "Validating valid token: " . ($authService->validateToken($validToken) ? 'Valid' : 'Invalid') . "\n";
echo "Validating invalid token: " . ($authService->validateToken($invalidToken) ? 'Valid' : 'Invalid') . "\n\n";

// Example 3: Check IP whitelist
echo "=== Example 3: IP Whitelisting ===\n";
// Assume whitelist is configured as: "192.168.1.100,10.0.0.0/8,172.16.0.1"

$testIps = [
    '192.168.1.100',  // Exact match
    '10.0.5.25',      // Matches CIDR range 10.0.0.0/8
    '172.16.0.1',     // Exact match
    '8.8.8.8',        // Not in whitelist
];

foreach ($testIps as $ip) {
    $allowed = $authService->isIpWhitelisted($ip);
    echo "IP {$ip}: " . ($allowed ? 'Allowed' : 'Blocked') . "\n";
}
echo "\n";

// Example 4: Log authentication attempts
echo "=== Example 4: Authentication Logging ===\n";
$clientIp = '192.168.1.50';

// Simulate successful authentication
$authService->logAuthAttempt($clientIp, true);
echo "Logged successful authentication from {$clientIp}\n";

// Simulate failed authentication
$authService->logAuthAttempt($clientIp, false);
echo "Logged failed authentication from {$clientIp}\n";

// Get authentication attempts
$attempts = $authService->getAuthAttempts($clientIp);
echo "Total attempts logged: " . count($attempts) . "\n";

// Get failed attempt count
$failedCount = $authService->getFailedAttemptCount($clientIp, 300);
echo "Failed attempts in last 5 minutes: {$failedCount}\n\n";

// Example 5: Complete authentication flow
echo "=== Example 5: Complete Authentication ===\n";
$token = "a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd";
$ip = "192.168.1.100";

$result = $authService->authenticate($token, $ip);
if ($result['valid']) {
    echo "Authentication successful for IP {$ip}\n";
} else {
    echo "Authentication failed: {$result['error']}\n";
}
echo "\n";

// Example 6: Brute force detection
echo "=== Example 6: Brute Force Detection ===\n";
$attackerIp = '203.0.113.50';

// Simulate 15 failed attempts (triggers security alert at 10+)
for ($i = 1; $i <= 15; $i++) {
    $authService->logAuthAttempt($attackerIp, false);
}

$failedCount = $authService->getFailedAttemptCount($attackerIp, 300);
echo "Failed attempts from {$attackerIp}: {$failedCount}\n";
echo "Security alert should be logged in system log\n\n";

// Example 7: Clear authentication attempts
echo "=== Example 7: Clear Auth Attempts ===\n";
$authService->clearAuthAttempts($attackerIp);
echo "Cleared authentication attempts for {$attackerIp}\n";
$failedCount = $authService->getFailedAttemptCount($attackerIp, 300);
echo "Failed attempts after clearing: {$failedCount}\n\n";

// Example 8: API Controller Integration
echo "=== Example 8: API Controller Usage ===\n";
echo "In your API controller:\n\n";
echo <<<'PHP'
// Load authentication service
$this->load->model('extension/pricepilot/AuthenticationService');
$authService = new AuthenticationService($this->registry);

// Get token and IP from request
$token = $this->request->post['api_token'] ?? '';
$ip = $this->request->server['REMOTE_ADDR'] ?? '';

// Authenticate
$authResult = $authService->authenticate($token, $ip);

if (!$authResult['valid']) {
    // Return 401 Unauthorized
    $this->response->addHeader('HTTP/1.1 401 Unauthorized');
    $this->response->setOutput(json_encode([
        'error' => $authResult['error'],
        'code' => 'AUTH_FAILED'
    ]));
    return;
}

// Continue with authenticated request...
PHP;
echo "\n\n";

// Example 9: Token regeneration in admin panel
echo "=== Example 9: Admin Token Regeneration ===\n";
echo "In your admin controller:\n\n";
echo <<<'PHP'
// Load authentication service
$this->load->model('extension/pricepilot/AuthenticationService');
$authService = new AuthenticationService($this->registry);

// Generate new token
$newToken = $authService->generateToken();

// Save to configuration
$this->load->model('setting/setting');
$settings = $this->model_setting_setting->getSetting('module_pricepilot');
$settings['module_pricepilot_token'] = $newToken;
$settings['module_pricepilot_token_created'] = date('Y-m-d H:i:s');
$this->model_setting_setting->editSetting('module_pricepilot', $settings);

// Log the regeneration
$authService->logMessage('API token regenerated by admin', 'info');

// Display success message
$this->session->data['success'] = 'API token regenerated successfully';
PHP;
echo "\n\n";

echo "=== All Examples Complete ===\n";
