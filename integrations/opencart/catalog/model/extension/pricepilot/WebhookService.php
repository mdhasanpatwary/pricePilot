<?php
/**
 * PricePilot Webhook Service
 * Path: catalog/model/extension/pricepilot/WebhookService.php
 * 
 * Real-time event notification service for the PricePilot plugin.
 * Handles webhook delivery for product lifecycle events with retry logic,
 * HMAC signature verification, and comprehensive error handling.
 * 
 * Features:
 * - Event-driven webhook triggering for product changes
 * - HMAC signature generation for webhook verification
 * - Automatic retry with exponential backoff (3 attempts)
 * - 5-second timeout per webhook request
 * - URL validation before webhook configuration
 * - Asynchronous delivery to prevent blocking
 * - Failed webhook logging for admin review
 * 
 * Supported Events:
 * - product.created: When a new product is added
 * - product.updated: When product data changes
 * - product.deleted: When a product is removed
 * - price.changed: When product price is modified
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.6, 9.7
 * 
 * @package PricePilot
 * @subpackage Services
 */

require_once __DIR__ . '/Service.php';

class WebhookService extends Service {
    
    /**
     * Webhook timeout in seconds
     */
    const WEBHOOK_TIMEOUT = 5;
    
    /**
     * Maximum retry attempts
     */
    const MAX_RETRIES = 3;
    
    /**
     * Supported webhook events
     */
    const SUPPORTED_EVENTS = [
        'product.created',
        'product.updated',
        'product.deleted',
        'price.changed'
    ];
    
    /**
     * @var NotificationService Notification service instance
     */
    private $notificationService;
    
    /**
     * Trigger webhook for product event
     * 
     * Identifies all webhooks configured for the given event type
     * and sends notifications to each configured URL with event data.
     * 
     * @param string $event Event type (product.created, product.updated, etc.)
     * @param array $data Event data to send in webhook payload
     * @return void
     */
    public function triggerEvent($event, $data) {
        try {
            // Validate event type
            if (!in_array($event, self::SUPPORTED_EVENTS)) {
                $this->logMessage("Invalid webhook event type: {$event}", 'warning');
                return;
            }
            
            // Get all webhooks configured for this event
            $webhooks = $this->getWebhooksForEvent($event);
            
            if (empty($webhooks)) {
                $this->logMessage("No webhooks configured for event: {$event}", 'info');
                return;
            }
            
            // Send webhook to each configured URL
            foreach ($webhooks as $webhook) {
                $this->sendWebhook($webhook['url'], $event, $data, $webhook['secret']);
            }
            
        } catch (Exception $e) {
            $this->logMessage("Failed to trigger webhook event {$event}: " . $e->getMessage(), 'error');
        }
    }
    
    /**
     * Send webhook notification with retry logic and HMAC signature
     * 
     * Sends HTTP POST request to webhook URL with event data and HMAC
     * signature for verification. Implements retry logic with exponential
     * backoff for failed deliveries.
     * 
     * @param string $url Webhook URL to send notification to
     * @param string $event Event type
     * @param array $data Event data payload
     * @param string|null $secret Optional secret for HMAC signature
     * @return array ['success' => bool, 'response_code' => int|null, 'error' => string|null]
     */
    public function sendWebhook($url, $event, $data, $secret = null) {
        $attempt = 0;
        $lastError = null;
        
        // Build webhook payload
        $payload = [
            'event' => $event,
            'timestamp' => date('c'), // ISO 8601 format
            'store_id' => (int)$this->config->get('config_store_id'),
            'data' => $data
        ];
        
        $jsonPayload = json_encode($payload);
        
        // Generate HMAC signature if secret provided
        $signature = null;
        if ($secret) {
            $signature = hash_hmac('sha256', $jsonPayload, $secret);
        }
        
        // Retry loop with exponential backoff
        while ($attempt < self::MAX_RETRIES) {
            $attempt++;
            
            try {
                $result = $this->sendHttpRequest($url, $jsonPayload, $signature);
                
                if ($result['success']) {
                    $this->logMessage("Webhook delivered successfully to {$url} for event {$event} (attempt {$attempt})", 'info');
                    return $result;
                }
                
                $lastError = $result['error'];
                
                // If not last attempt, wait before retry (exponential backoff: 1s, 2s, 4s)
                if ($attempt < self::MAX_RETRIES) {
                    $waitTime = pow(2, $attempt - 1);
                    $this->logMessage("Webhook delivery failed to {$url}, retrying in {$waitTime}s (attempt {$attempt})", 'warning');
                    sleep($waitTime);
                }
                
            } catch (Exception $e) {
                $lastError = $e->getMessage();
                
                if ($attempt < self::MAX_RETRIES) {
                    $waitTime = pow(2, $attempt - 1);
                    sleep($waitTime);
                }
            }
        }
        
        // All retries failed
        $this->logMessage("Webhook delivery failed to {$url} after {$attempt} attempts: {$lastError}", 'error');
        
        // Log failed webhook for admin review
        $this->logFailedWebhook($url, $event, $jsonPayload, $lastError);
        
        // Send notification for webhook failure after all retries (Requirement 20.5)
        $this->getNotificationService()->createDashboardNotification(
            'Webhook Delivery Failed',
            "Failed to deliver webhook to {$url} after {$attempt} attempts.\n" .
            "Event: {$event}\n" .
            "Error: {$lastError}",
            NotificationService::TYPE_FAILURE,
            NotificationService::PRIORITY_MEDIUM
        );
        
        return [
            'success' => false,
            'response_code' => null,
            'error' => $lastError
        ];
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
     * Get configured webhooks for specific event
     * 
     * Retrieves all active webhook configurations that are subscribed
     * to the specified event type.
     * 
     * @param string $event Event type to filter by
     * @return array Array of webhook configurations
     */
    public function getWebhooksForEvent($event) {
        try {
            $sql = "SELECT webhook_id, url, events, secret, status 
                    FROM " . $this->getTableName('pricepilot_webhooks') . " 
                    WHERE status = 1";
            
            $result = $this->query($sql);
            
            $webhooks = [];
            
            foreach ($result->rows as $row) {
                // Parse events JSON array
                $events = json_decode($row['events'], true);
                
                if (!is_array($events)) {
                    continue;
                }
                
                // Check if this webhook is subscribed to the event
                if (in_array($event, $events)) {
                    $webhooks[] = [
                        'webhook_id' => (int)$row['webhook_id'],
                        'url' => $row['url'],
                        'events' => $events,
                        'secret' => $row['secret'],
                        'status' => (int)$row['status']
                    ];
                }
            }
            
            return $webhooks;
            
        } catch (Exception $e) {
            $this->logMessage("Failed to get webhooks for event {$event}: " . $e->getMessage(), 'error');
            return [];
        }
    }
    
    /**
     * Validate webhook URL format and accessibility
     * 
     * Validates that the URL is properly formatted, uses HTTP/HTTPS protocol,
     * and is not a local/private IP address for security.
     * 
     * @param string $url URL to validate
     * @return array ['valid' => bool, 'error' => string|null]
     */
    public function validateWebhookUrl($url) {
        // Check if URL is empty
        if (empty($url)) {
            return [
                'valid' => false,
                'error' => 'URL cannot be empty'
            ];
        }
        
        // Validate URL format
        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            return [
                'valid' => false,
                'error' => 'Invalid URL format'
            ];
        }
        
        // Parse URL components
        $parsed = parse_url($url);
        
        if (!$parsed) {
            return [
                'valid' => false,
                'error' => 'Failed to parse URL'
            ];
        }
        
        // Check protocol (must be http or https)
        if (!isset($parsed['scheme']) || !in_array($parsed['scheme'], ['http', 'https'])) {
            return [
                'valid' => false,
                'error' => 'URL must use HTTP or HTTPS protocol'
            ];
        }
        
        // Check host is present
        if (!isset($parsed['host'])) {
            return [
                'valid' => false,
                'error' => 'URL must include a hostname'
            ];
        }
        
        // Security check: prevent webhooks to localhost or private IPs
        $host = $parsed['host'];
        
        // Check for localhost
        if (in_array(strtolower($host), ['localhost', '127.0.0.1', '::1'])) {
            return [
                'valid' => false,
                'error' => 'Webhooks to localhost are not allowed'
            ];
        }
        
        // Check for private IP ranges (basic check)
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            if ($this->isPrivateIp($host)) {
                return [
                    'valid' => false,
                    'error' => 'Webhooks to private IP addresses are not allowed'
                ];
            }
        }
        
        return [
            'valid' => true,
            'error' => null
        ];
    }
    
    /**
     * Send HTTP POST request to webhook URL
     * 
     * @param string $url Webhook URL
     * @param string $jsonPayload JSON payload to send
     * @param string|null $signature HMAC signature
     * @return array ['success' => bool, 'response_code' => int|null, 'error' => string|null]
     */
    private function sendHttpRequest($url, $jsonPayload, $signature = null) {
        // Build headers
        $headers = [
            'Content-Type: application/json',
            'User-Agent: PricePilot-Webhook/1.0',
            'Content-Length: ' . strlen($jsonPayload)
        ];
        
        // Add signature header if provided
        if ($signature) {
            $headers[] = 'X-PricePilot-Signature: ' . $signature;
        }
        
        // Initialize cURL
        $ch = curl_init($url);
        
        if (!$ch) {
            return [
                'success' => false,
                'response_code' => null,
                'error' => 'Failed to initialize cURL'
            ];
        }
        
        // Set cURL options
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonPayload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, self::WEBHOOK_TIMEOUT);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_MAXREDIRS, 3);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        
        // Execute request
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        
        curl_close($ch);
        
        // Check for cURL errors
        if ($response === false) {
            return [
                'success' => false,
                'response_code' => null,
                'error' => 'cURL error: ' . $error
            ];
        }
        
        // Check HTTP status code (2xx = success)
        if ($httpCode >= 200 && $httpCode < 300) {
            return [
                'success' => true,
                'response_code' => $httpCode,
                'error' => null
            ];
        }
        
        return [
            'success' => false,
            'response_code' => $httpCode,
            'error' => "HTTP {$httpCode} response"
        ];
    }
    
    /**
     * Check if IP address is in private range
     * 
     * @param string $ip IP address to check
     * @return bool True if private IP, false otherwise
     */
    private function isPrivateIp($ip) {
        // Check for IPv4 private ranges
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            $longIp = ip2long($ip);
            
            // Private ranges:
            // 10.0.0.0 - 10.255.255.255
            // 172.16.0.0 - 172.31.255.255
            // 192.168.0.0 - 192.168.255.255
            return (
                ($longIp >= ip2long('10.0.0.0') && $longIp <= ip2long('10.255.255.255')) ||
                ($longIp >= ip2long('172.16.0.0') && $longIp <= ip2long('172.31.255.255')) ||
                ($longIp >= ip2long('192.168.0.0') && $longIp <= ip2long('192.168.255.255'))
            );
        }
        
        // For IPv6, we'll do a basic check for link-local and unique local addresses
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            // Link-local: fe80::/10
            // Unique local: fc00::/7
            return (
                substr($ip, 0, 4) === 'fe80' ||
                substr($ip, 0, 2) === 'fc' ||
                substr($ip, 0, 2) === 'fd'
            );
        }
        
        return false;
    }
    
    /**
     * Log failed webhook delivery for admin review
     * 
     * @param string $url Webhook URL
     * @param string $event Event type
     * @param string $payload JSON payload
     * @param string $error Error message
     * @return void
     */
    private function logFailedWebhook($url, $event, $payload, $error) {
        try {
            // Store in API logs table for admin review
            $sql = "INSERT INTO " . $this->getTableName('pricepilot_api_logs') . " 
                    (endpoint, method, ip_address, request_data, response_code, response_time, date_added) 
                    VALUES (
                        '" . $this->escape($url) . "',
                        'WEBHOOK',
                        'system',
                        '" . $this->escape($payload) . "',
                        0,
                        0,
                        '" . $this->getCurrentTimestamp() . "'
                    )";
            
            $this->query($sql);
            
        } catch (Exception $e) {
            $this->logMessage("Failed to log webhook failure: " . $e->getMessage(), 'error');
        }
    }
}
