---
title: "OpenCart Integration Setup"
description: "Step-by-step guide to integrate PricePilot with your OpenCart store"
category: "integrations"
subcategory: null
tags: ["opencart", "integration", "setup", "api"]
author: "PricePilot Team"
lastReviewed: "2024-01-15"
relatedDocs: ["laravel-setup", "quick-start"]
---

# OpenCart Integration Setup

Complete guide to integrating PricePilot with your OpenCart store.

## Prerequisites

Before you begin, ensure you have:

- OpenCart 3.x or 4.x installed
- Admin access to your OpenCart store
- FTP or file manager access (for module installation)
- HTTPS enabled on your store (recommended)

## Installation Steps

### Step 1: Download the PricePilot Module

1. Log in to your PricePilot dashboard
2. Navigate to **Settings** → **Integrations**
3. Click **Download OpenCart Module**
4. Save the `.ocmod.zip` file

### Step 2: Install the Module

#### Via OpenCart Admin Panel

1. Log in to your OpenCart admin panel
2. Go to **Extensions** → **Installer**
3. Click **Upload** button
4. Select the downloaded `.ocmod.zip` file
5. Wait for upload to complete
6. Click **Continue**

#### Via FTP (Alternative Method)

1. Extract the `.ocmod.zip` file
2. Upload contents to your OpenCart root directory
3. Maintain the directory structure
4. Set proper file permissions (644 for files, 755 for directories)

### Step 3: Enable the Extension

1. Go to **Extensions** → **Extensions**
2. Select **Modules** from the extension type dropdown
3. Find **PricePilot** in the list
4. Click **Install** (green + button)
5. Click **Edit** to configure

### Step 4: Generate API Token

In the PricePilot module settings:

1. Click **Generate API Token**
2. Copy the generated token
3. Save the token securely

```typescript
// Example API token
{
  token: "pp_live_1234567890abcdef",
  createdAt: "2024-01-15T10:00:00Z",
  expiresAt: null // Never expires unless regenerated
}
```

### Step 5: Configure PricePilot Dashboard

1. Return to PricePilot dashboard
2. Go to **Settings** → **Integrations**
3. Click **Add Store**
4. Enter your store details:

```typescript
{
  platform: "opencart",
  storeUrl: "https://yourstore.com",
  apiToken: "pp_live_1234567890abcdef"
}
```

5. Click **Test Connection**
6. If successful, click **Save**

### Step 6: Initial Product Sync

PricePilot will automatically sync your products:

1. Go to **Products** → **My Products**
2. Click **Sync Now** for immediate sync
3. Wait 1-2 minutes for sync to complete
4. Verify products appear in the list

## API Endpoints

The PricePilot module exposes these endpoints:

### Get Products

```http
GET /api/pricepilot/products
Authorization: Bearer pp_live_1234567890abcdef

Response:
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "123",
        "sku": "PROD-001",
        "name": "Product Name",
        "price": 99.99,
        "brand": "Brand Name",
        "model": "Model-X",
        "status": "active"
      }
    ]
  }
}
```

### Update Prices

```http
POST /api/pricepilot/products/update
Authorization: Bearer pp_live_1234567890abcdef
Content-Type: application/json

{
  "updates": [
    {
      "id": "123",
      "price": 89.99
    }
  ]
}

Response:
{
  "success": true,
  "data": {
    "updated": 1,
    "failed": 0,
    "results": [
      {
        "id": "123",
        "status": "success",
        "oldPrice": 99.99,
        "newPrice": 89.99
      }
    ]
  }
}
```

## Security Configuration

### API Token Security

Protect your API token:

```php
// The token is stored encrypted in the database
// Never expose it in frontend code
// Regenerate if compromised
```

### IP Whitelisting (Optional)

Restrict API access to PricePilot IPs:

1. Go to module settings
2. Enable **IP Whitelist**
3. Add PricePilot IP addresses:
   - `52.1.2.3`
   - `52.4.5.6`
   - `52.7.8.9`

### Rate Limiting

The module includes built-in rate limiting:

```php
// Default limits
$rateLimits = [
  'products' => 100, // requests per hour
  'updates' => 1000  // updates per hour
];
```

## Troubleshooting

### Module Not Appearing?

**Possible causes:**
- Installation incomplete
- File permissions incorrect
- Cache not cleared

**Solutions:**
```bash
# Clear OpenCart cache
rm -rf system/storage/cache/*

# Check file permissions
chmod 644 upload/admin/controller/extension/module/pricepilot.php
chmod 755 upload/admin/view/template/extension/module/
```

### API Connection Failed?

**Possible causes:**
- Invalid API token
- HTTPS not enabled
- Firewall blocking requests
- Incorrect store URL

**Solutions:**
1. Regenerate API token
2. Enable HTTPS on your store
3. Check firewall rules
4. Verify store URL is correct

### Products Not Syncing?

**Possible causes:**
- Products not published
- Products out of stock
- API token expired

**Solutions:**
1. Ensure products are published and active
2. Check product status in OpenCart
3. Regenerate API token if needed

### Price Updates Not Working?

**Possible causes:**
- Product ID mismatch
- Price validation failed
- API rate limit exceeded

**Solutions:**
1. Verify product IDs are correct
2. Check price constraints
3. Wait and retry if rate limited

## Advanced Configuration

### Custom Product Fields

Map additional product fields:

```php
// In module settings
$customFields = [
  'brand' => 'manufacturer',
  'model' => 'model',
  'sku' => 'sku'
];
```

### Webhook Notifications

Receive real-time updates:

```php
// Configure webhook URL
$webhookUrl = 'https://yourstore.com/api/pricepilot/webhook';

// PricePilot will send notifications for:
// - Product sync completed
// - Price update completed
// - Errors occurred
```

### Multi-Store Setup

For OpenCart multi-store:

1. Install module on main store
2. Generate separate API token for each store
3. Configure each store in PricePilot dashboard

## Maintenance

### Regular Tasks

- **Weekly**: Review sync logs
- **Monthly**: Regenerate API token (security best practice)
- **Quarterly**: Update module to latest version

### Module Updates

1. Download latest version from PricePilot
2. Backup your store
3. Install new version via Extensions → Installer
4. Test API connection
5. Verify product sync

## Support

Need help?

- Check [Troubleshooting Guide](../troubleshooting/common-issues)
- Review [FAQ](../troubleshooting/faq)
- Contact PricePilot support
- Visit OpenCart community forums

## Next Steps

- Set up [Competitor Tracking](../competitors/adding-competitors)
- Configure [Product Matching](../products/product-matching)
- Start [Updating Prices](../pricing/price-updates)
