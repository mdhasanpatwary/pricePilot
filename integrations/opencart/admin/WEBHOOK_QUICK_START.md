# Webhook Management Quick Start Guide

## Overview

This guide will help you quickly set up and configure webhooks in the PricePilot OpenCart plugin.

## What are Webhooks?

Webhooks allow PricePilot to send real-time notifications to your external systems when product events occur in your OpenCart store. This enables you to:

- Sync product data with external systems in real-time
- Trigger automated workflows when prices change
- Monitor product lifecycle events
- Integrate with third-party services (Zapier, Make, custom apps)

## Quick Setup (5 Minutes)

### Step 1: Access Webhook Management

1. Log in to your OpenCart admin panel
2. Navigate to: **Extensions** → **Modules** → **PricePilot**
3. Click **Dashboard**
4. Click **Webhooks** (or navigate directly to `extension/module/pricepilot/webhookList`)

### Step 2: Create Your First Webhook

1. Click the **"Add Webhook"** button
2. Enter your webhook URL:
   - Example: `https://your-app.com/webhooks/pricepilot`
   - For testing: Use [webhook.site](https://webhook.site) to get a test URL
3. Select the events you want to receive:
   - ☑ **Product Created** - New products added
   - ☑ **Product Updated** - Product data modified
   - ☑ **Product Deleted** - Products removed
   - ☑ **Price Changed** - Prices updated via API
4. Copy the auto-generated **Secret Key** (you'll need this for verification)
5. Set **Status** to **Active**
6. Click **Save**

### Step 3: Test Your Webhook

#### Using webhook.site (Recommended for Testing)

1. Go to [webhook.site](https://webhook.site)
2. Copy the unique URL provided
3. Add this URL as a webhook in PricePilot
4. Trigger a product event (update a price via API)
5. Check webhook.site to see the received payload

#### Using Your Own Endpoint

1. Create an endpoint that accepts POST requests
2. Add the endpoint URL as a webhook
3. Trigger a product event
4. Check your server logs for the webhook delivery

## Webhook Payload Structure

When an event occurs, PricePilot sends a POST request with this structure:

```json
{
  "event": "price.changed",
  "timestamp": "2024-01-15T10:30:00+00:00",
  "store_id": 0,
  "data": {
    "product_id": 123,
    "name": "Product Name",
    "old_price": "89.99",
    "new_price": "99.99",
    "changes": ["price", "quantity"]
  }
}
```

## Verifying Webhook Authenticity

All webhooks include an HMAC signature in the `X-PricePilot-Signature` header. Verify it like this:

### PHP Example

```php
<?php
// Get the webhook payload
$payload = file_get_contents('php://input');

// Get the signature from headers
$receivedSignature = $_SERVER['HTTP_X_PRICEPILOT_SIGNATURE'] ?? '';

// Your webhook secret key (from PricePilot admin)
$secretKey = 'your-64-character-secret-key-here';

// Compute the expected signature
$expectedSignature = hash_hmac('sha256', $payload, $secretKey);

// Verify the signature
if (hash_equals($expectedSignature, $receivedSignature)) {
    // Webhook is authentic, process it
    $data = json_decode($payload, true);
    
    // Handle the event
    switch ($data['event']) {
        case 'price.changed':
            // Handle price change
            break;
        case 'product.created':
            // Handle product creation
            break;
        // ... other events
    }
    
    // Return 200 OK
    http_response_code(200);
    echo json_encode(['status' => 'success']);
} else {
    // Invalid signature, reject the webhook
    http_response_code(401);
    echo json_encode(['error' => 'Invalid signature']);
}
```

### Node.js Example

```javascript
const crypto = require('crypto');
const express = require('express');
const app = express();

app.post('/webhooks/pricepilot', express.raw({type: 'application/json'}), (req, res) => {
    const payload = req.body.toString();
    const receivedSignature = req.headers['x-pricepilot-signature'];
    const secretKey = 'your-64-character-secret-key-here';
    
    // Compute expected signature
    const expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(payload)
        .digest('hex');
    
    // Verify signature
    if (crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(receivedSignature)
    )) {
        // Webhook is authentic
        const data = JSON.parse(payload);
        
        // Handle the event
        console.log('Received event:', data.event);
        
        res.status(200).json({status: 'success'});
    } else {
        // Invalid signature
        res.status(401).json({error: 'Invalid signature'});
    }
});

app.listen(3000);
```

### Python Example

```python
import hmac
import hashlib
import json
from flask import Flask, request

app = Flask(__name__)

@app.route('/webhooks/pricepilot', methods=['POST'])
def webhook():
    payload = request.get_data()
    received_signature = request.headers.get('X-PricePilot-Signature', '')
    secret_key = 'your-64-character-secret-key-here'
    
    # Compute expected signature
    expected_signature = hmac.new(
        secret_key.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    # Verify signature
    if hmac.compare_digest(expected_signature, received_signature):
        # Webhook is authentic
        data = json.loads(payload)
        
        # Handle the event
        print(f"Received event: {data['event']}")
        
        return {'status': 'success'}, 200
    else:
        # Invalid signature
        return {'error': 'Invalid signature'}, 401

if __name__ == '__main__':
    app.run(port=3000)
```

## Common Use Cases

### 1. Sync Prices to External Database

```php
// When price changes, update external database
if ($data['event'] === 'price.changed') {
    $productId = $data['data']['product_id'];
    $newPrice = $data['data']['new_price'];
    
    // Update your database
    $db->query("UPDATE products SET price = ? WHERE id = ?", [$newPrice, $productId]);
}
```

### 2. Send Slack Notification

```php
// Notify team when prices change
if ($data['event'] === 'price.changed') {
    $message = sprintf(
        "Price changed for %s: %s → %s",
        $data['data']['name'],
        $data['data']['old_price'],
        $data['data']['new_price']
    );
    
    // Send to Slack
    $slack->sendMessage($message);
}
```

### 3. Trigger Zapier Workflow

1. Create a Zapier webhook trigger
2. Copy the webhook URL from Zapier
3. Add it as a webhook in PricePilot
4. Configure your Zapier workflow to process the events

## Managing Webhooks

### Edit a Webhook

1. Go to webhook list
2. Click the **Edit** button (pencil icon)
3. Modify URL, events, or status
4. Click **Save**

### Disable a Webhook

1. Edit the webhook
2. Change **Status** to **Inactive**
3. Click **Save**

(The webhook will remain configured but won't receive notifications)

### Delete a Webhook

1. Go to webhook list
2. Click the **Delete** button (trash icon)
3. Confirm deletion

**Warning**: This action cannot be undone!

### Regenerate Secret Key

1. Edit the webhook
2. Click **Regenerate** next to the secret key
3. Confirm regeneration
4. Copy the new secret key
5. Update your webhook endpoint with the new secret
6. Click **Save**

**Important**: The old secret will no longer work after regeneration!

## Troubleshooting

### Webhook Not Receiving Events

1. **Check webhook status**: Ensure it's set to **Active**
2. **Verify URL**: Make sure the URL is accessible from your server
3. **Check events**: Ensure you've selected the events you want to receive
4. **Test endpoint**: Use webhook.site to verify your endpoint is working
5. **Check firewall**: Ensure your server allows incoming requests from OpenCart

### Signature Verification Failing

1. **Check secret key**: Ensure you're using the correct secret from PricePilot
2. **Check payload**: Verify you're computing the signature on the raw request body
3. **Check encoding**: Ensure the secret and payload are properly encoded
4. **Use timing-safe comparison**: Use `hash_equals()` in PHP or equivalent

### Webhook Timing Out

1. **Optimize endpoint**: Ensure your endpoint responds quickly (< 5 seconds)
2. **Process asynchronously**: Queue webhook processing for later
3. **Return 200 immediately**: Don't wait for processing to complete

### Webhook Delivery Failed

1. **Check logs**: Failed webhooks are logged in `pricepilot_api_logs` table
2. **Verify endpoint**: Ensure your endpoint returns 2xx status code
3. **Check retries**: PricePilot retries failed webhooks 3 times
4. **Review error**: Check the error message in the logs

## Best Practices

### Security

1. **Always verify signatures**: Never trust webhook data without verification
2. **Use HTTPS**: Always use HTTPS URLs for webhooks
3. **Keep secrets secure**: Store secret keys in environment variables
4. **Rotate secrets regularly**: Regenerate secrets periodically

### Performance

1. **Respond quickly**: Return 200 OK within 5 seconds
2. **Process asynchronously**: Queue webhook processing for background jobs
3. **Handle duplicates**: Implement idempotency to handle duplicate deliveries
4. **Log everything**: Keep detailed logs for debugging

### Reliability

1. **Handle retries**: Be prepared to receive the same webhook multiple times
2. **Return proper status codes**: Return 2xx for success, 4xx/5xx for errors
3. **Monitor failures**: Set up alerts for webhook delivery failures
4. **Test regularly**: Periodically test your webhook endpoints

## Advanced Configuration

### Multiple Webhooks

You can configure multiple webhooks for different purposes:

- **Webhook 1**: Send all events to your main application
- **Webhook 2**: Send only price changes to your analytics system
- **Webhook 3**: Send product deletions to your inventory system

### Event Filtering

Select only the events you need for each webhook:

- **Analytics webhook**: Only subscribe to `price.changed`
- **Sync webhook**: Subscribe to all events
- **Notification webhook**: Only subscribe to `product.deleted`

### Webhook Chaining

Use webhooks to trigger other webhooks:

1. PricePilot sends webhook to your app
2. Your app processes the event
3. Your app sends webhook to third-party service
4. Third-party service performs action

## Support

For issues or questions:

1. Check the webhook logs in `pricepilot_api_logs` table
2. Review the implementation documentation
3. Test with webhook.site to isolate issues
4. Contact PricePilot support with log details

## Next Steps

1. Set up your first webhook
2. Test with webhook.site
3. Implement signature verification
4. Build your webhook handler
5. Monitor webhook deliveries
6. Set up error alerts

## Resources

- [webhook.site](https://webhook.site) - Test webhook URLs
- [Zapier Webhooks](https://zapier.com/apps/webhook/integrations) - Zapier integration
- [Make (Integromat)](https://www.make.com/en/help/tools/webhooks) - Make integration
- [HMAC Signature Verification](https://en.wikipedia.org/wiki/HMAC) - Security details

---

**Last Updated**: January 28, 2026
**Version**: 1.0.0
