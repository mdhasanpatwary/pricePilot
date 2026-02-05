---
title: "Laravel Integration Setup"
description: "Connect your Laravel e-commerce store to PricePilot"
category: "integrations"
subcategory: null
tags: ["laravel", "integration", "setup"]
author: "PricePilot Team"
lastReviewed: "2024-01-15"
relatedDocs: ["opencart-setup", "product-setup"]
---

# Laravel Integration Setup

Connect your Laravel e-commerce store to PricePilot for automated price management.

## Prerequisites

- Laravel 9.x or higher
- PHP 8.1 or higher
- Composer installed
- Admin access to your Laravel application

## Installation Steps

### Step 1: Install PricePilot Package

Install the PricePilot Laravel package via Composer:

```bash
composer require pricepilot/laravel-integration
```

### Step 2: Publish Configuration

Publish the configuration file:

```bash
php artisan vendor:publish --provider="PricePilot\LaravelIntegration\PricePilotServiceProvider"
```

This creates `config/pricepilot.php` in your Laravel application.

### Step 3: Configure API Token

1. Log in to your PricePilot account
2. Go to **Settings** > **Integrations**
3. Click **Generate API Token**
4. Copy the generated token

Add the token to your `.env` file:

```env
PRICEPILOT_API_TOKEN=your_api_token_here
PRICEPILOT_API_URL=https://api.pricepilot.com/v1
```

### Step 4: Run Migrations

The package includes migrations for tracking sync status:

```bash
php artisan migrate
```

### Step 5: Configure Product Model

Add the `PricePilotProduct` trait to your Product model:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use PricePilot\LaravelIntegration\Traits\PricePilotProduct;

class Product extends Model
{
    use PricePilotProduct;
    
    // Your existing model code...
}
```

## Configuration

### Basic Configuration

Edit `config/pricepilot.php`:

```php
<?php

return [
    // API Configuration
    'api_token' => env('PRICEPILOT_API_TOKEN'),
    'api_url' => env('PRICEPILOT_API_URL', 'https://api.pricepilot.com/v1'),
    
    // Product Model
    'product_model' => \App\Models\Product::class,
    
    // Field Mapping
    'field_mapping' => [
        'id' => 'id',
        'sku' => 'sku',
        'name' => 'name',
        'price' => 'price',
        'brand' => 'brand',
        'model' => 'model',
    ],
    
    // Sync Settings
    'auto_sync' => true,
    'sync_frequency' => 'hourly', // hourly, daily, manual
];
```

### Field Mapping

Map your Laravel product fields to PricePilot fields:

```php
'field_mapping' => [
    'id' => 'id',                    // Required
    'sku' => 'sku',                  // Required
    'name' => 'name',                // Required
    'price' => 'price',              // Required
    'brand' => 'brand',              // Optional
    'model' => 'model_number',       // Optional (if different field name)
],
```

## Usage

### Manual Product Sync

Sync products to PricePilot manually:

```bash
php artisan pricepilot:sync-products
```

### Automatic Sync

Enable automatic sync in configuration:

```php
'auto_sync' => true,
'sync_frequency' => 'hourly',
```

Then add to your scheduler in `app/Console/Kernel.php`:

```php
protected function schedule(Schedule $schedule)
{
    $schedule->command('pricepilot:sync-products')
             ->hourly();
}
```

### Receiving Price Updates

PricePilot will send price updates via webhook. Configure the webhook URL:

1. In PricePilot, go to **Settings** > **Integrations**
2. Set webhook URL to: `https://yourstore.com/api/pricepilot/webhook`
3. The package automatically registers this route

### Handling Price Updates

The package automatically updates product prices. To customize behavior:

```php
<?php

namespace App\Listeners;

use PricePilot\LaravelIntegration\Events\PriceUpdateReceived;

class HandlePriceUpdate
{
    public function handle(PriceUpdateReceived $event)
    {
        $product = $event->product;
        $newPrice = $event->newPrice;
        $oldPrice = $event->oldPrice;
        
        // Custom logic before price update
        // e.g., notify admin, log change, etc.
        
        // Price is automatically updated by the package
    }
}
```

Register the listener in `EventServiceProvider`:

```php
protected $listen = [
    \PricePilot\LaravelIntegration\Events\PriceUpdateReceived::class => [
        \App\Listeners\HandlePriceUpdate::class,
    ],
];
```

## API Endpoints

The package automatically registers these endpoints:

### Get Products
```
GET /api/pricepilot/products
Authorization: Bearer {api_token}

Response:
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "1",
        "sku": "PROD-001",
        "name": "Product Name",
        "price": 99.99,
        "brand": "Brand Name",
        "model": "Model-X"
      }
    ]
  }
}
```

### Update Products
```
POST /api/pricepilot/products/update
Authorization: Bearer {api_token}
Content-Type: application/json

{
  "updates": [
    {
      "id": "1",
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
        "id": "1",
        "status": "success"
      }
    ]
  }
}
```

## Security

### API Token Security

- Store API token in `.env` file (never commit to version control)
- Rotate tokens regularly
- Use different tokens for staging and production

### Webhook Security

The package validates webhook signatures automatically. To customize:

```php
'webhook_secret' => env('PRICEPILOT_WEBHOOK_SECRET'),
```

### Rate Limiting

The package includes rate limiting:

```php
'rate_limit' => [
    'enabled' => true,
    'max_attempts' => 60,
    'decay_minutes' => 1,
],
```

## Troubleshooting

### Products Not Syncing

1. Check API token is correct in `.env`
2. Verify field mapping matches your database schema
3. Check Laravel logs: `storage/logs/laravel.log`
4. Run sync manually: `php artisan pricepilot:sync-products --verbose`

### Price Updates Not Working

1. Verify webhook URL is configured in PricePilot
2. Check webhook is accessible (not behind firewall)
3. Review webhook logs: `php artisan pricepilot:webhook-logs`
4. Test webhook: `php artisan pricepilot:test-webhook`

### Authentication Errors

1. Verify API token is valid
2. Check token hasn't expired
3. Ensure token has correct permissions
4. Regenerate token if needed

## Advanced Configuration

### Custom Product Query

Customize which products are synced:

```php
'product_query' => function ($query) {
    return $query->where('status', 'active')
                 ->where('price', '>', 0)
                 ->whereNotNull('sku');
},
```

### Custom Price Update Logic

Override default price update behavior:

```php
<?php

namespace App\Services;

use PricePilot\LaravelIntegration\Services\PriceUpdateService as BasePriceUpdateService;

class CustomPriceUpdateService extends BasePriceUpdateService
{
    public function updatePrice($product, $newPrice)
    {
        // Custom validation
        if ($newPrice < $product->cost) {
            throw new \Exception('Price below cost');
        }
        
        // Call parent method
        return parent::updatePrice($product, $newPrice);
    }
}
```

Register in `config/pricepilot.php`:

```php
'services' => [
    'price_update' => \App\Services\CustomPriceUpdateService::class,
],
```

## Testing

### Test Product Sync

```bash
php artisan pricepilot:sync-products --dry-run
```

### Test Webhook

```bash
php artisan pricepilot:test-webhook
```

### Run Package Tests

```bash
vendor/bin/phpunit vendor/pricepilot/laravel-integration/tests
```

## Support

Need help with Laravel integration?

- Check [Common Issues](../troubleshooting/common-issues)
- Review [API Documentation](https://docs.pricepilot.com/api)
- Contact support: support@pricepilot.com

## Related Documentation

- [OpenCart Setup](opencart-setup)
- [Product Setup](../products/product-setup)
- [Price Updates](../pricing/price-updates)
