<?php
/**
 * WebhookService Demo and Usage Examples
 * 
 * This file demonstrates how to use the WebhookService in various scenarios.
 * It is NOT meant to be executed directly, but serves as documentation and
 * reference for developers integrating the webhook functionality.
 * 
 * @package PricePilot
 * @subpackage Examples
 */

// This file should not be executed directly
if (basename(__FILE__) == basename($_SERVER['PHP_SELF'])) {
    die('This file is for reference only and should not be executed directly.');
}

/**
 * Example 1: Trigger a price change webhook
 * 
 * This example shows how to trigger a webhook when a product price changes.
 * Typically called from PriceService::updatePrice() after a successful update.
 */
function example_trigger_price_change_webhook($registry, $productId, $oldPrice, $newPrice) {
    // Load the webhook service
    $registry->get('load')->model('extension/pricepilot/WebhookService');
    $webhookService = $registry->get('model_extension_pricepilot_WebhookService');
    
    // Prepare event data
    $eventData = [
        'product_id' => $productId,
        'product_name' => 'Example Product', // Get from database
        'old_price' => number_format($oldPrice, 2, '.', ''),
        'new_price' => number_format($newPrice, 2, '.', ''),
        'changed_by' => 'API',
        'timestamp' => date('Y-m-d H:i:s')
    ];
    
    // Trigger the webhook event
    $webhookService->triggerEvent('price.changed', $eventData);
    
    // Note: triggerEvent() returns void and handles errors internally
    // Failed webhooks are logged for admin review
}

/**
 * Example 2: Trigger a product update webhook
 * 
 * This example shows how to trigger a webhook when a product is updated.
 * Can be called from various places where product data changes.
 */
function example_trigger_product_update_webhook($registry, $productId, $changes) {
    $registry->get('load')->model('extension/pricepilot/WebhookService');
    $webhookService = $registry->get('model_extension_pricepilot_WebhookService');
    
    $eventData = [
        'product_id' => $productId,
        'product_name' => 'Example Product',
        'changes' => $changes, // e.g., ['price', 'quantity', 'status']
        'updated_at' => date('Y-m-d H:i:s')
    ];
    
    $webhookService->triggerEvent('product.updated', $eventData);
}

/**
 * Example 3: Validate webhook URL before saving configuration
 * 
 * This example shows how to validate a webhook URL in the admin panel
 * before saving it to the database.
 */
function example_validate_webhook_url($registry, $url) {
    $registry->get('load')->model('extension/pricepilot/WebhookService');
    $webhookService = $registry->get('model_extension_pricepilot_WebhookService');
    
    // Validate the URL
    $validation = $webhookService->validateWebhookUrl($url);
    
    if ($validation['valid']) {
        // URL is valid, proceed with saving
        return [
            'success' => true,
            'message' => 'Webhook URL is valid'
        ];
    } else {
        // URL is invalid, show error
        return [
            'success' => false,
            'message' => 'Invalid webhook URL: ' . $validation['error']
        ];
    }
}

/**
 * Example 4: Send a test webhook from admin panel
 * 
 * This example shows how to send a test webhook to verify configuration.
 * Useful for the "Test Connection" button in the admin interface.
 */
function example_send_test_webhook($registry, $url, $secret = null) {
    $registry->get('load')->model('extension/pricepilot/WebhookService');
    $webhookService = $registry->get('model_extension_pricepilot_WebhookService');
    
    // Prepare test data
    $testData = [
        'test' => true,
        'message' => 'This is a test webhook from PricePilot',
        'timestamp' => date('c')
    ];
    
    // Send the webhook
    $result = $webhookService->sendWebhook($url, 'product.updated', $testData, $secret);
    
    if ($result['success']) {
        return [
            'success' => true,
            'message' => 'Test webhook delivered successfully',
            'response_code' => $result['response_code']
        ];
    } else {
        return [
            'success' => false,
            'message' => 'Test webhook failed: ' . $result['error'],
            'response_code' => $result['response_code']
        ];
    }
}

/**
 * Example 5: Get webhooks configured for a specific event
 * 
 * This example shows how to retrieve all webhooks subscribed to an event.
 * Useful for displaying webhook configurations in the admin panel.
 */
function example_get_webhooks_for_event($registry, $event) {
    $registry->get('load')->model('extension/pricepilot/WebhookService');
    $webhookService = $registry->get('model_extension_pricepilot_WebhookService');
    
    // Get webhooks for the event
    $webhooks = $webhookService->getWebhooksForEvent($event);
    
    // Display results
    if (empty($webhooks)) {
        return "No webhooks configured for event: {$event}";
    }
    
    $output = "Webhooks configured for {$event}:\n";
    foreach ($webhooks as $webhook) {
        $output .= "- ID: {$webhook['webhook_id']}, URL: {$webhook['url']}\n";
    }
    
    return $output;
}

/**
 * Example 6: Integration with PriceService
 * 
 * This example shows how to integrate webhook triggering into the
 * PriceService::updatePrice() method.
 */
function example_price_service_integration($registry, $productId, $newPrice) {
    // This code would be added to PriceService::updatePrice()
    
    // ... existing price update code ...
    
    // After successful price update, trigger webhook
    try {
        $registry->get('load')->model('extension/pricepilot/WebhookService');
        $webhookService = $registry->get('model_extension_pricepilot_WebhookService');
        
        $webhookService->triggerEvent('price.changed', [
            'product_id' => $productId,
            'old_price' => $oldPrice, // from earlier in the method
            'new_price' => $newPrice
        ]);
    } catch (Exception $e) {
        // Log error but don't fail the price update
        error_log("Webhook trigger failed: " . $e->getMessage());
    }
    
    // ... rest of the method ...
}

/**
 * Example 7: Webhook payload structure
 * 
 * This example shows the structure of webhook payloads sent to external systems.
 */
function example_webhook_payload_structure() {
    // Example payload for price.changed event
    $priceChangedPayload = [
        'event' => 'price.changed',
        'timestamp' => '2024-01-15T10:30:00+00:00', // ISO 8601 format
        'store_id' => 0,
        'data' => [
            'product_id' => 123,
            'product_name' => 'Example Product',
            'old_price' => '99.99',
            'new_price' => '89.99',
            'changed_by' => 'API'
        ]
    ];
    
    // Example payload for product.updated event
    $productUpdatedPayload = [
        'event' => 'product.updated',
        'timestamp' => '2024-01-15T10:30:00+00:00',
        'store_id' => 0,
        'data' => [
            'product_id' => 123,
            'product_name' => 'Example Product',
            'changes' => ['price', 'quantity'],
            'updated_at' => '2024-01-15 10:30:00'
        ]
    ];
    
    // Example payload for product.created event
    $productCreatedPayload = [
        'event' => 'product.created',
        'timestamp' => '2024-01-15T10:30:00+00:00',
        'store_id' => 0,
        'data' => [
            'product_id' => 124,
            'product_name' => 'New Product',
            'price' => '149.99',
            'quantity' => 100,
            'status' => 1
        ]
    ];
    
    // Example payload for product.deleted event
    $productDeletedPayload = [
        'event' => 'product.deleted',
        'timestamp' => '2024-01-15T10:30:00+00:00',
        'store_id' => 0,
        'data' => [
            'product_id' => 125,
            'product_name' => 'Deleted Product'
        ]
    ];
    
    return [
        'price.changed' => $priceChangedPayload,
        'product.updated' => $productUpdatedPayload,
        'product.created' => $productCreatedPayload,
        'product.deleted' => $productDeletedPayload
    ];
}

/**
 * Example 8: Webhook consumer - Verifying HMAC signature
 * 
 * This example shows how a webhook consumer (external system) should
 * verify the HMAC signature to ensure the webhook is authentic.
 * 
 * This code would run on the webhook consumer's server, NOT in OpenCart.
 */
function example_verify_webhook_signature($receivedPayload, $receivedSignature, $secret) {
    // Compute expected signature
    $expectedSignature = hash_hmac('sha256', $receivedPayload, $secret);
    
    // Compare signatures using constant-time comparison
    if (hash_equals($expectedSignature, $receivedSignature)) {
        // Signature is valid, process the webhook
        return true;
    } else {
        // Signature is invalid, reject the webhook
        return false;
    }
}

/**
 * Example 9: Webhook consumer - Complete webhook handler
 * 
 * This is a complete example of how to handle incoming webhooks on the
 * consumer side (external system receiving webhooks from PricePilot).
 * 
 * This code would run on the webhook consumer's server, NOT in OpenCart.
 */
function example_webhook_consumer_handler() {
    // Get the raw POST data
    $rawPayload = file_get_contents('php://input');
    
    // Get the signature from headers
    $receivedSignature = $_SERVER['HTTP_X_PRICEPILOT_SIGNATURE'] ?? '';
    
    // Your webhook secret (configured in PricePilot admin)
    $secret = 'your_webhook_secret_here';
    
    // Verify signature
    $expectedSignature = hash_hmac('sha256', $rawPayload, $secret);
    
    if (!hash_equals($expectedSignature, $receivedSignature)) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid signature']);
        exit;
    }
    
    // Parse the payload
    $payload = json_decode($rawPayload, true);
    
    if (!$payload) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
        exit;
    }
    
    // Process based on event type
    switch ($payload['event']) {
        case 'price.changed':
            // Handle price change
            $productId = $payload['data']['product_id'];
            $newPrice = $payload['data']['new_price'];
            // ... your business logic ...
            break;
            
        case 'product.updated':
            // Handle product update
            $productId = $payload['data']['product_id'];
            $changes = $payload['data']['changes'];
            // ... your business logic ...
            break;
            
        case 'product.created':
            // Handle new product
            $productId = $payload['data']['product_id'];
            // ... your business logic ...
            break;
            
        case 'product.deleted':
            // Handle product deletion
            $productId = $payload['data']['product_id'];
            // ... your business logic ...
            break;
            
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Unknown event type']);
            exit;
    }
    
    // Return success response
    http_response_code(200);
    echo json_encode(['success' => true]);
}

/**
 * Example 10: Error handling and logging
 * 
 * This example shows how webhook errors are handled and logged.
 */
function example_webhook_error_handling($registry) {
    $registry->get('load')->model('extension/pricepilot/WebhookService');
    $webhookService = $registry->get('model_extension_pricepilot_WebhookService');
    
    // Attempt to send webhook
    $result = $webhookService->sendWebhook(
        'https://example.com/webhook',
        'price.changed',
        ['product_id' => 123],
        'secret'
    );
    
    // Check result
    if (!$result['success']) {
        // Webhook failed after all retries
        // Error is already logged in pricepilot_api_logs table
        
        // Optionally, send admin notification
        // (This would be implemented in NotificationService - Task 26)
        error_log("Webhook delivery failed: " . $result['error']);
        
        // The main operation (price update) should still succeed
        // Webhook failures don't block the primary functionality
    }
}

// End of examples
