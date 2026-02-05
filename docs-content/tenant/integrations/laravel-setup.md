---
title: "Laravel Integration Guide"
description: "Complete guide to integrating PricePilot with your Laravel e-commerce store - installation, configuration, and API setup"
category: "integrations"
subcategory: null
tags: ["laravel", "integration", "setup", "composer", "api", "configuration"]
author: "PricePilot Team"
lastReviewed: "2024-02-05"
relatedDocs: ["opencart-setup", "product-setup", "price-approval-guide"]
---

# Laravel Integration Guide

Complete guide to integrating PricePilot with your Laravel e-commerce store. This guide covers Composer installation, service provider registration, API configuration, and how the package exposes your product data for automated price management.

## Overview

PricePilot integrates seamlessly with Laravel through a Composer package that provides a complete API layer for product synchronization and price updates. The integration is designed with Laravel best practices in mind:

- **Composer Installation**: Standard Laravel package installation via Composer
- **Service Provider Auto-Discovery**: Automatic registration in Laravel 5.5+
- **API-Based Communication**: RESTful API endpoints for secure data exchange
- **Token Authentication**: Laravel Sanctum-based API authentication
- **Event-Driven Architecture**: Laravel events for price update notifications
- **Queue Support**: Background job processing for large catalogs

### How It Works

1. Install the PricePilot Laravel package via Composer
2. Publish configuration and run migrations
3. Configure API token and field mapping
4. Package automatically exposes product API endpoints
5. Connect your store to PricePilot dashboard
6. Products sync automatically every 24 hours
7. Receive price updates via webhook or API polling

### Key Features

- **Zero Configuration**: Works out of the box with sensible defaults
- **Flexible Field Mapping**: Map any product model fields to PricePilot
- **Event Hooks**: Listen to price update events for custom logic
- **Queue Integration**: Process large product syncs in background
- **Multi-Store Support**: Manage multiple Laravel stores from one dashboard
- **Rollback Support**: Automatic price history tracking for rollbacks

## Prerequisites

Before you begin, ensure you have:

- **Laravel Version**: Laravel 9.x, 10.x, or 11.x
- **PHP Version**: PHP 8.1 or higher
- **Composer**: Composer 2.x installed and configured
- **Database**: MySQL 5.7+, PostgreSQL 10+, or SQLite 3.8+
- **Admin Access**: Full access to your Laravel application
- **HTTPS**: SSL certificate installed (strongly recommended)
- **Queue Worker**: Redis, database, or other queue driver configured (optional but recommended)

### Version Compatibility

| Laravel Version | PHP Version | PricePilot Package | Status |
|----------------|-------------|-------------------|---------|
| Laravel 11.x | PHP 8.2+ | v3.0+ | ✅ Fully Supported |
| Laravel 10.x | PHP 8.1+ | v2.5+ | ✅ Fully Supported |
| Laravel 9.x | PHP 8.0+ | v2.0+ | ✅ Fully Supported |
| Laravel 8.x | PHP 7.4+ | v1.5+ | ⚠️ Limited Support |

### Required PHP Extensions

```bash
# Verify required extensions are installed
php -m | grep -E 'curl|json|openssl|pdo|mbstring'

# Expected output:
# curl
# json
# openssl
# pdo_mysql (or pdo_pgsql)
# mbstring
```

## Installation

### Step 1: Install PricePilot Package via Composer

Install the PricePilot Laravel package using Composer. This is the standard Laravel package installation method:

```bash
# Navigate to your Laravel project root
cd /path/to/your/laravel/project

# Install the package via Composer
composer require pricepilot/laravel-integration

# Expected output:
# Using version ^3.0 for pricepilot/laravel-integration
# ./composer.json has been updated
# Running composer update pricepilot/laravel-integration
# Loading composer repositories with package information
# Updating dependencies
# ...
# Package operations: 1 install, 0 updates, 0 removals
#   - Installing pricepilot/laravel-integration (3.0.0): Downloading (100%)
# ...
# Generating optimized autoload files
```

> **Note**: The package uses semantic versioning. Use `composer require pricepilot/laravel-integration:^3.0` to lock to a major version.

**For Development/Testing:**

```bash
# Install with dev dependencies
composer require pricepilot/laravel-integration --dev

# Or install a specific version
composer require pricepilot/laravel-integration:3.0.5
```

**Verify Installation:**

```bash
# Check installed version
composer show pricepilot/laravel-integration

# Expected output:
# name     : pricepilot/laravel-integration
# descrip. : PricePilot integration package for Laravel
# versions : * 3.0.0
```

### Step 2: Service Provider Registration

**Laravel 5.5+ (Auto-Discovery)**

If you're using Laravel 5.5 or higher, the service provider is automatically registered via package auto-discovery. No manual registration needed!

The package's `composer.json` includes:

```json
{
  "extra": {
    "laravel": {
      "providers": [
        "PricePilot\\LaravelIntegration\\PricePilotServiceProvider"
      ],
      "aliases": {
        "PricePilot": "PricePilot\\LaravelIntegration\\Facades\\PricePilot"
      }
    }
  }
}
```

**Laravel 5.4 and Below (Manual Registration)**

For older Laravel versions, manually register the service provider in `config/app.php`:

```php
<?php

return [
    // ...
    
    'providers' => [
        // Other Service Providers...
        
        PricePilot\LaravelIntegration\PricePilotServiceProvider::class,
    ],
    
    'aliases' => [
        // Other Aliases...
        
        'PricePilot' => PricePilot\LaravelIntegration\Facades\PricePilot::class,
    ],
];
```

**Verify Service Provider Registration:**

```bash
# List all registered service providers
php artisan about

# Or check specifically for PricePilot
php artisan about | grep -i pricepilot

# Expected output:
# PricePilot Integration ........................... 3.0.0
```

### Step 3: Publish Configuration

Publish the package configuration file to customize settings:

```bash
# Publish configuration file
php artisan vendor:publish --provider="PricePilot\LaravelIntegration\PricePilotServiceProvider"

# Expected output:
# Copied File [/vendor/pricepilot/laravel-integration/config/pricepilot.php] 
#          To [/config/pricepilot.php]
# Publishing complete.
```

This creates `config/pricepilot.php` in your Laravel application with all available configuration options.

**Publish Specific Assets:**

```bash
# Publish only config
php artisan vendor:publish --tag=pricepilot-config

# Publish only migrations
php artisan vendor:publish --tag=pricepilot-migrations

# Publish only views (if you want to customize)
php artisan vendor:publish --tag=pricepilot-views

# Publish everything
php artisan vendor:publish --tag=pricepilot
```

**Configuration File Location:**

After publishing, you'll find the configuration at:
- `config/pricepilot.php` - Main configuration
- `database/migrations/xxxx_create_pricepilot_tables.php` - Database migrations

### Step 4: Configure Environment Variables

Add PricePilot configuration to your `.env` file:

```env
# PricePilot API Configuration
PRICEPILOT_API_TOKEN=your_api_token_here
PRICEPILOT_API_URL=https://api.pricepilot.com/v1
PRICEPILOT_WEBHOOK_SECRET=your_webhook_secret_here

# Optional: Enable/disable features
PRICEPILOT_ENABLED=true
PRICEPILOT_AUTO_SYNC=true
PRICEPILOT_SYNC_FREQUENCY=hourly

# Optional: Queue configuration
PRICEPILOT_QUEUE_CONNECTION=redis
PRICEPILOT_QUEUE_NAME=pricepilot

# Optional: Debug mode
PRICEPILOT_DEBUG=false
```

> **Security Warning**: Never commit your `.env` file to version control. Add it to `.gitignore` if not already present.

**Get Your API Token:**

1. Log in to your PricePilot account at [https://app.pricepilot.com](https://app.pricepilot.com)
2. Navigate to **Settings** → **Integrations**
3. Click **Generate API Token** for Laravel
4. Copy the generated token
5. Paste it into your `.env` file as `PRICEPILOT_API_TOKEN`

**Generate Webhook Secret:**

```bash
# Generate a secure random string for webhook validation
php artisan tinker
>>> Str::random(64)
=> "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
>>> exit

# Add this to your .env as PRICEPILOT_WEBHOOK_SECRET
```

### Step 5: Run Database Migrations

The package includes migrations for tracking sync status and price history:

```bash
# Run migrations
php artisan migrate

# Expected output:
# Migrating: 2024_01_01_000000_create_pricepilot_sync_logs_table
# Migrated:  2024_01_01_000000_create_pricepilot_sync_logs_table (45.23ms)
# Migrating: 2024_01_01_000001_create_pricepilot_price_history_table
# Migrated:  2024_01_01_000001_create_pricepilot_price_history_table (38.67ms)
```

**Tables Created:**

- `pricepilot_sync_logs` - Tracks product sync history
- `pricepilot_price_history` - Stores price change history for rollbacks
- `pricepilot_webhooks` - Logs incoming webhook requests

**Rollback Migrations (if needed):**

```bash
# Rollback PricePilot migrations
php artisan migrate:rollback --step=3

# Or rollback all migrations
php artisan migrate:reset
```

### Step 6: Configure Product Model

Add the `PricePilotProduct` trait to your Product model to enable PricePilot integration:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use PricePilot\LaravelIntegration\Traits\PricePilotProduct;

class Product extends Model
{
    use HasFactory, PricePilotProduct;
    
    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'sku',
        'name',
        'price',
        'brand',
        'model',
        'status',
    ];
    
    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'price' => 'decimal:2',
        'status' => 'boolean',
    ];
    
    // Your existing model code...
}
```

**What the Trait Provides:**

The `PricePilotProduct` trait adds these methods to your model:

```php
// Sync this product to PricePilot
$product->syncToPricePilot();

// Get PricePilot sync status
$product->getPricePilotSyncStatus();

// Get price history
$product->getPriceHistory();

// Check if product is synced
$product->isSyncedToPricePilot();

// Update price from PricePilot
$product->updatePriceFromPricePilot($newPrice);
```

### Step 7: Verify Installation

Run the installation verification command:

```bash
# Verify PricePilot installation
php artisan pricepilot:verify

# Expected output:
# ✓ Package installed correctly
# ✓ Service provider registered
# ✓ Configuration published
# ✓ Migrations run successfully
# ✓ Product model configured
# ✓ API token configured
# ✓ Webhook secret configured
# 
# PricePilot Laravel Integration is ready to use!
```

**Manual Verification Checklist:**

- [ ] Package appears in `composer.json`
- [ ] Configuration file exists at `config/pricepilot.php`
- [ ] Environment variables set in `.env`
- [ ] Migrations completed successfully
- [ ] Product model has `PricePilotProduct` trait
- [ ] Service provider registered (check `php artisan about`)

## Configuration

### Basic Configuration

Edit `config/pricepilot.php` to customize the integration:

```php
<?php

return [
    /*
    |--------------------------------------------------------------------------
    | PricePilot API Configuration
    |--------------------------------------------------------------------------
    |
    | Configure your PricePilot API credentials and endpoint URL.
    |
    */
    
    'enabled' => env('PRICEPILOT_ENABLED', true),
    
    'api' => [
        'token' => env('PRICEPILOT_API_TOKEN'),
        'url' => env('PRICEPILOT_API_URL', 'https://api.pricepilot.com/v1'),
        'timeout' => env('PRICEPILOT_API_TIMEOUT', 30), // seconds
        'retry_times' => env('PRICEPILOT_API_RETRY', 3),
        'retry_delay' => 1000, // milliseconds
    ],
    
    /*
    |--------------------------------------------------------------------------
    | Product Model Configuration
    |--------------------------------------------------------------------------
    |
    | Specify your Product model class and field mappings.
    |
    */
    
    'product_model' => \App\Models\Product::class,
    
    'field_mapping' => [
        'id' => 'id',                    // Required: Unique product identifier
        'sku' => 'sku',                  // Required: Stock Keeping Unit
        'name' => 'name',                // Required: Product name
        'price' => 'price',              // Required: Current price
        'brand' => 'brand',              // Optional: Brand/manufacturer
        'model' => 'model',              // Optional: Model number
        'status' => 'status',            // Optional: Active/inactive status
        'image' => 'image_url',          // Optional: Primary image URL
    ],
    
    /*
    |--------------------------------------------------------------------------
    | Sync Configuration
    |--------------------------------------------------------------------------
    |
    | Configure automatic product synchronization settings.
    |
    */
    
    'sync' => [
        'enabled' => env('PRICEPILOT_AUTO_SYNC', true),
        'frequency' => env('PRICEPILOT_SYNC_FREQUENCY', 'hourly'), // hourly, daily, manual
        'chunk_size' => 100, // Products per batch
        'filters' => [
            'status' => 'active', // Only sync active products
            'min_price' => 0.01, // Minimum price to sync
            'max_price' => null, // Maximum price (null = no limit)
        ],
    ],
    
    /*
    |--------------------------------------------------------------------------
    | Queue Configuration
    |--------------------------------------------------------------------------
    |
    | Configure queue settings for background processing.
    |
    */
    
    'queue' => [
        'connection' => env('PRICEPILOT_QUEUE_CONNECTION', 'redis'),
        'name' => env('PRICEPILOT_QUEUE_NAME', 'pricepilot'),
        'enabled' => env('PRICEPILOT_QUEUE_ENABLED', true),
    ],
    
    /*
    |--------------------------------------------------------------------------
    | Webhook Configuration
    |--------------------------------------------------------------------------
    |
    | Configure webhook endpoint and security settings.
    |
    */
    
    'webhook' => [
        'secret' => env('PRICEPILOT_WEBHOOK_SECRET'),
        'path' => '/api/pricepilot/webhook',
        'verify_signature' => true,
        'log_requests' => true,
    ],
    
    /*
    |--------------------------------------------------------------------------
    | Price Update Configuration
    |--------------------------------------------------------------------------
    |
    | Configure how price updates are handled.
    |
    */
    
    'price_updates' => [
        'auto_apply' => false, // Require manual approval by default
        'min_price' => null, // Minimum allowed price (null = no limit)
        'max_discount_percent' => null, // Maximum discount percentage
        'notify_on_update' => true, // Send notifications
        'track_history' => true, // Store price history
    ],
    
    /*
    |--------------------------------------------------------------------------
    | Logging Configuration
    |--------------------------------------------------------------------------
    |
    | Configure logging behavior for debugging and monitoring.
    |
    */
    
    'logging' => [
        'enabled' => env('PRICEPILOT_DEBUG', false),
        'channel' => env('LOG_CHANNEL', 'stack'),
        'level' => 'info', // debug, info, warning, error
    ],
    
    /*
    |--------------------------------------------------------------------------
    | Rate Limiting
    |--------------------------------------------------------------------------
    |
    | Configure rate limiting for API endpoints.
    |
    */
    
    'rate_limit' => [
        'enabled' => true,
        'max_attempts' => 60, // Requests per decay period
        'decay_minutes' => 1, // Time window
    ],
];
```

### Field Mapping Configuration

Map your Laravel product fields to PricePilot's expected format. This is crucial for proper data synchronization:

**Standard Mapping (Most Common):**

```php
'field_mapping' => [
    'id' => 'id',                    // Maps Product::id to PricePilot product ID
    'sku' => 'sku',                  // Maps Product::sku to PricePilot SKU
    'name' => 'name',                // Maps Product::name to PricePilot name
    'price' => 'price',              // Maps Product::price to PricePilot price
    'brand' => 'brand',              // Maps Product::brand to PricePilot brand
    'model' => 'model',              // Maps Product::model to PricePilot model
],
```

**Custom Field Names:**

If your database uses different column names:

```php
'field_mapping' => [
    'id' => 'id',
    'sku' => 'product_code',         // Your field is 'product_code'
    'name' => 'title',               // Your field is 'title'
    'price' => 'selling_price',      // Your field is 'selling_price'
    'brand' => 'manufacturer_name',  // Your field is 'manufacturer_name'
    'model' => 'model_number',       // Your field is 'model_number'
],
```

**Relationship Fields:**

If fields come from relationships:

```php
'field_mapping' => [
    'id' => 'id',
    'sku' => 'sku',
    'name' => 'name',
    'price' => 'price',
    'brand' => 'manufacturer.name',  // From manufacturer relationship
    'model' => 'details.model',      // From details relationship
],
```

**Accessor Methods:**

Use model accessors for computed fields:

```php
// In your Product model
public function getPricePilotBrandAttribute()
{
    return $this->manufacturer->name ?? 'Unknown';
}

public function getPricePilotPriceAttribute()
{
    return $this->sale_price ?? $this->regular_price;
}

// In config/pricepilot.php
'field_mapping' => [
    'id' => 'id',
    'sku' => 'sku',
    'name' => 'name',
    'price' => 'pricepilot_price',   // Uses accessor
    'brand' => 'pricepilot_brand',   // Uses accessor
    'model' => 'model',
],
```

### Product Query Customization

Customize which products are synced to PricePilot:

```php
'product_query' => function ($query) {
    return $query->where('status', 'active')
                 ->where('price', '>', 0)
                 ->whereNotNull('sku')
                 ->whereHas('category', function ($q) {
                     $q->whereIn('slug', ['electronics', 'computers']);
                 })
                 ->with(['manufacturer', 'images']);
},
```

**Common Query Patterns:**

```php
// Only sync products in specific categories
'product_query' => function ($query) {
    return $query->whereHas('categories', function ($q) {
        $q->whereIn('name', ['Electronics', 'Computers', 'Phones']);
    });
},

// Only sync products above a certain price
'product_query' => function ($query) {
    return $query->where('price', '>=', 50.00);
},

// Only sync products with inventory
'product_query' => function ($query) {
    return $query->where('stock_quantity', '>', 0);
},

// Exclude specific brands
'product_query' => function ($query) {
    return $query->whereNotIn('brand', ['Generic', 'Unknown']);
},
```

## How the Package Exposes Product Data

The PricePilot Laravel package automatically exposes your product data through secure API endpoints. Understanding how this works is essential for proper integration.

### Automatic API Route Registration

When the service provider boots, it automatically registers these API routes:

```php
// Routes registered by PricePilotServiceProvider
Route::prefix('api/pricepilot')
    ->middleware(['api', 'pricepilot.auth'])
    ->group(function () {
        // Get all products
        Route::get('/products', [PricePilotController::class, 'index']);
        
        // Get single product
        Route::get('/products/{id}', [PricePilotController::class, 'show']);
        
        // Update product prices
        Route::post('/products/update', [PricePilotController::class, 'update']);
        
        // Webhook endpoint
        Route::post('/webhook', [PricePilotWebhookController::class, 'handle']);
        
        // Health check
        Route::get('/health', [PricePilotController::class, 'health']);
    });
```

**View Registered Routes:**

```bash
# List all PricePilot routes
php artisan route:list --name=pricepilot

# Expected output:
# GET|HEAD  api/pricepilot/products .............. pricepilot.products.index
# GET|HEAD  api/pricepilot/products/{id} ........ pricepilot.products.show
# POST      api/pricepilot/products/update ...... pricepilot.products.update
# POST      api/pricepilot/webhook ............... pricepilot.webhook
# GET|HEAD  api/pricepilot/health ................ pricepilot.health
```

### Product Data Exposure

#### GET /api/pricepilot/products

Returns paginated list of products based on your configuration:

**Request:**

```http
GET /api/pricepilot/products?page=1&per_page=50
Authorization: Bearer {api_token}
Accept: application/json
```

**Response:**

```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "1",
        "sku": "LAPTOP-001",
        "name": "Dell XPS 15 Laptop",
        "price": 1299.99,
        "brand": "Dell",
        "model": "XPS-15-9520",
        "status": "active",
        "image": "https://yourstore.com/storage/products/dell-xps-15.jpg",
        "last_synced_at": "2024-02-05T10:30:00Z"
      },
      {
        "id": "2",
        "sku": "PHONE-001",
        "name": "iPhone 15 Pro",
        "price": 999.99,
        "brand": "Apple",
        "model": "A2848",
        "status": "active",
        "image": "https://yourstore.com/storage/products/iphone-15-pro.jpg",
        "last_synced_at": "2024-02-05T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 1250,
      "per_page": 50,
      "current_page": 1,
      "last_page": 25,
      "from": 1,
      "to": 50
    }
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-02-05T10:30:00Z"
  }
}
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number for pagination |
| `per_page` | integer | 50 | Items per page (max: 100) |
| `status` | string | all | Filter by status: active, inactive, all |
| `min_price` | decimal | null | Minimum price filter |
| `max_price` | decimal | null | Maximum price filter |
| `search` | string | null | Search by name or SKU |
| `brand` | string | null | Filter by brand |

**Example Queries:**

```bash
# Get active products only
curl "https://yourstore.com/api/pricepilot/products?status=active" \
  -H "Authorization: Bearer {token}"

# Get products in price range
curl "https://yourstore.com/api/pricepilot/products?min_price=100&max_price=500" \
  -H "Authorization: Bearer {token}"

# Search products
curl "https://yourstore.com/api/pricepilot/products?search=laptop" \
  -H "Authorization: Bearer {token}"

# Get specific brand
curl "https://yourstore.com/api/pricepilot/products?brand=Dell" \
  -H "Authorization: Bearer {token}"
```

#### GET /api/pricepilot/products/{id}

Returns a single product by ID:

**Request:**

```http
GET /api/pricepilot/products/123
Authorization: Bearer {api_token}
Accept: application/json
```

**Response:**

```json
{
  "success": true,
  "data": {
    "product": {
      "id": "123",
      "sku": "LAPTOP-001",
      "name": "Dell XPS 15 Laptop",
      "price": 1299.99,
      "brand": "Dell",
      "model": "XPS-15-9520",
      "status": "active",
      "image": "https://yourstore.com/storage/products/dell-xps-15.jpg",
      "description": "High-performance laptop with 15.6\" display",
      "category": "Laptops",
      "stock_quantity": 15,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-02-05T10:30:00Z",
      "last_synced_at": "2024-02-05T10:30:00Z"
    }
  }
}
```

#### POST /api/pricepilot/products/update

Receives price updates from PricePilot:

**Request:**

```http
POST /api/pricepilot/products/update
Authorization: Bearer {api_token}
Content-Type: application/json

{
  "updates": [
    {
      "id": "123",
      "price": 1189.99,
      "old_price": 1299.99
    },
    {
      "id": "456",
      "price": 899.99,
      "old_price": 999.99
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "updated": 2,
    "failed": 0,
    "results": [
      {
        "id": "123",
        "status": "success",
        "old_price": 1299.99,
        "new_price": 1189.99,
        "updated_at": "2024-02-05T11:00:00Z"
      },
      {
        "id": "456",
        "status": "success",
        "old_price": 999.99,
        "new_price": 899.99,
        "updated_at": "2024-02-05T11:00:00Z"
      }
    ]
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "data": {
    "updated": 1,
    "failed": 1,
    "results": [
      {
        "id": "123",
        "status": "success",
        "old_price": 1299.99,
        "new_price": 1189.99,
        "updated_at": "2024-02-05T11:00:00Z"
      },
      {
        "id": "456",
        "status": "failed",
        "error": "Price below minimum allowed price",
        "attempted_price": 50.00,
        "minimum_price": 100.00
      }
    ]
  }
}
```

### Data Transformation

The package automatically transforms your Product model data to PricePilot's format:

```php
// In PricePilotController
protected function transformProduct(Product $product): array
{
    $mapping = config('pricepilot.field_mapping');
    
    return [
        'id' => $product->{$mapping['id']},
        'sku' => $product->{$mapping['sku']},
        'name' => $product->{$mapping['name']},
        'price' => (float) $product->{$mapping['price']},
        'brand' => $product->{$mapping['brand']} ?? null,
        'model' => $product->{$mapping['model']} ?? null,
        'status' => $product->{$mapping['status']} ?? 'active',
        'image' => $this->getProductImage($product),
        'last_synced_at' => now()->toIso8601String(),
    ];
}
```

**Custom Transformation:**

Override the transformation logic if needed:

```php
// In your Product model
public function toPricePilotArray(): array
{
    return [
        'id' => $this->id,
        'sku' => $this->sku,
        'name' => $this->name,
        'price' => $this->getCurrentPrice(), // Custom method
        'brand' => $this->manufacturer->name ?? 'Unknown',
        'model' => $this->model_number,
        'status' => $this->is_active ? 'active' : 'inactive',
        'image' => $this->getFirstImageUrl(),
        'category' => $this->category->name ?? null,
        'stock' => $this->stock_quantity,
    ];
}
```

### Authentication Middleware

The package includes authentication middleware that validates API tokens:

```php
// PricePilotAuthMiddleware
public function handle($request, Closure $next)
{
    $token = $request->bearerToken();
    
    if (!$token) {
        return response()->json([
            'success' => false,
            'error' => [
                'code' => 'MISSING_TOKEN',
                'message' => 'API token is required',
            ]
        ], 401);
    }
    
    $configToken = config('pricepilot.api.token');
    
    if (!hash_equals($configToken, $token)) {
        return response()->json([
            'success' => false,
            'error' => [
                'code' => 'INVALID_TOKEN',
                'message' => 'Invalid API token',
            ]
        ], 401);
    }
    
    return $next($request);
}
```

### Rate Limiting

API endpoints are rate-limited to prevent abuse:

```php
// Applied to all PricePilot routes
Route::middleware(['throttle:pricepilot'])
    ->group(function () {
        // Routes...
    });

// In RouteServiceProvider or config
RateLimiter::for('pricepilot', function (Request $request) {
    return Limit::perMinute(60)->by($request->bearerToken());
});
```

**Rate Limit Headers:**

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1707134400
```

### Webhook Handling

The package receives webhooks from PricePilot for real-time updates:

```php
// POST /api/pricepilot/webhook
{
  "event": "price.update.approved",
  "data": {
    "product_id": "123",
    "old_price": 1299.99,
    "new_price": 1189.99,
    "approved_by": "user@example.com",
    "approved_at": "2024-02-05T11:00:00Z"
  },
  "signature": "sha256=abc123..."
}
```

**Webhook Verification:**

```php
// PricePilotWebhookController
protected function verifySignature(Request $request): bool
{
    $signature = $request->header('X-PricePilot-Signature');
    $payload = $request->getContent();
    $secret = config('pricepilot.webhook.secret');
    
    $expectedSignature = 'sha256=' . hash_hmac('sha256', $payload, $secret);
    
    return hash_equals($expectedSignature, $signature);
}
```

## Usage

### Manual Product Sync

Sync products to PricePilot manually using Artisan commands:

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

## Laravel-Specific Troubleshooting

This section covers common issues specific to Laravel integration and their solutions.

### Composer Installation Issues

#### Package Not Found Error

**Symptoms:**
```bash
composer require pricepilot/laravel-integration
# Error: Could not find package pricepilot/laravel-integration
```

**Solutions:**

1. **Update Composer:**
```bash
composer self-update
composer clear-cache
composer require pricepilot/laravel-integration
```

2. **Check Packagist:**
```bash
# Verify package exists on Packagist
composer show pricepilot/laravel-integration --all
```

3. **Add Repository Manually (if private package):**
```json
// composer.json
{
  "repositories": [
    {
      "type": "vcs",
      "url": "https://github.com/pricepilot/laravel-integration"
    }
  ]
}
```

#### Version Conflict Error

**Symptoms:**
```bash
# Error: Your requirements could not be resolved to an installable set of packages
```

**Solutions:**

1. **Check Laravel Version Compatibility:**
```bash
# Check your Laravel version
php artisan --version

# Install compatible version
composer require pricepilot/laravel-integration:^2.0  # For Laravel 9
composer require pricepilot/laravel-integration:^3.0  # For Laravel 10+
```

2. **Update Dependencies:**
```bash
composer update --with-all-dependencies
```

3. **Check PHP Version:**
```bash
php -v  # Should be 8.1+ for Laravel 10+
```

### Service Provider Issues

#### Service Provider Not Registered

**Symptoms:**
- Commands not available
- Routes not registered
- Configuration not loading

**Solutions:**

1. **Clear Application Cache:**
```bash
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear
```

2. **Verify Auto-Discovery:**
```bash
# Check if package is discovered
php artisan package:discover

# Expected output should include:
# Discovered Package: pricepilot/laravel-integration
```

3. **Manual Registration (if auto-discovery fails):**
```php
// config/app.php
'providers' => [
    // ...
    PricePilot\LaravelIntegration\PricePilotServiceProvider::class,
],
```

4. **Check Composer Autoload:**
```bash
composer dump-autoload
```

#### Configuration Not Publishing

**Symptoms:**
```bash
php artisan vendor:publish --provider="PricePilot\LaravelIntegration\PricePilotServiceProvider"
# Error: Unable to locate publishable resources
```

**Solutions:**

1. **Use Tag Instead:**
```bash
php artisan vendor:publish --tag=pricepilot-config
```

2. **Manually Copy Configuration:**
```bash
cp vendor/pricepilot/laravel-integration/config/pricepilot.php config/pricepilot.php
```

3. **Check File Permissions:**
```bash
chmod 755 config/
chmod 644 config/pricepilot.php
```

### Migration Issues

#### Migration Failed Error

**Symptoms:**
```bash
php artisan migrate
# Error: SQLSTATE[42S01]: Base table or view already exists
```

**Solutions:**

1. **Check Existing Tables:**
```bash
php artisan tinker
>>> Schema::hasTable('pricepilot_sync_logs')
=> true  // Table already exists
```

2. **Rollback and Re-run:**
```bash
php artisan migrate:rollback --step=1
php artisan migrate
```

3. **Fresh Migration (Development Only):**
```bash
php artisan migrate:fresh  # WARNING: Drops all tables!
```

#### Foreign Key Constraint Error

**Symptoms:**
```bash
# Error: Cannot add foreign key constraint
```

**Solutions:**

1. **Check Database Engine:**
```sql
-- Ensure using InnoDB
SHOW TABLE STATUS WHERE Name = 'products';
```

2. **Verify Referenced Table Exists:**
```bash
php artisan tinker
>>> Schema::hasTable('products')
=> true
```

3. **Disable Foreign Key Checks (Temporary):**
```php
// In migration
Schema::disableForeignKeyConstraints();
// Your migration code
Schema::enableForeignKeyConstraints();
```

### API Endpoint Issues

#### 404 Not Found on API Routes

**Symptoms:**
```bash
curl https://yourstore.com/api/pricepilot/products
# 404 Not Found
```

**Solutions:**

1. **Clear Route Cache:**
```bash
php artisan route:clear
php artisan route:cache
```

2. **Verify Routes Are Registered:**
```bash
php artisan route:list | grep pricepilot
```

3. **Check API Prefix:**
```php
// In RouteServiceProvider or config
Route::prefix('api')
    ->middleware('api')
    ->group(base_path('routes/api.php'));
```

4. **Verify .htaccess (Apache):**
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteRule ^(.*)$ public/$1 [L]
</IfModule>
```

#### 401 Unauthorized Error

**Symptoms:**
```bash
curl https://yourstore.com/api/pricepilot/products \
  -H "Authorization: Bearer token"
# 401 Unauthorized
```

**Solutions:**

1. **Verify Token in .env:**
```bash
# Check token is set
php artisan tinker
>>> config('pricepilot.api.token')
=> "pp_live_..."
```

2. **Clear Config Cache:**
```bash
php artisan config:clear
```

3. **Check Token Format:**
```bash
# Token should start with pp_live_ or pp_test_
echo $PRICEPILOT_API_TOKEN
```

4. **Test with Correct Header:**
```bash
curl https://yourstore.com/api/pricepilot/products \
  -H "Authorization: Bearer pp_live_your_actual_token_here" \
  -H "Accept: application/json"
```

#### 500 Internal Server Error

**Symptoms:**
```bash
curl https://yourstore.com/api/pricepilot/products
# 500 Internal Server Error
```

**Solutions:**

1. **Check Laravel Logs:**
```bash
tail -f storage/logs/laravel.log
```

2. **Enable Debug Mode (Development Only):**
```env
# .env
APP_DEBUG=true
```

3. **Common Causes:**
```php
// Missing field in field_mapping
'field_mapping' => [
    'id' => 'id',
    'sku' => 'sku',
    'name' => 'name',
    'price' => 'price',  // Make sure this field exists in your products table
],

// Product model not found
'product_model' => \App\Models\Product::class,  // Verify this class exists

// Database connection issue
DB::connection()->getPdo();  // Test database connection
```

### Product Sync Issues

#### No Products Syncing

**Symptoms:**
- Sync completes but 0 products synced
- Empty product list in PricePilot

**Solutions:**

1. **Check Product Query:**
```bash
php artisan tinker
>>> $query = config('pricepilot.product_query');
>>> $products = $query(App\Models\Product::query())->get();
>>> $products->count()
=> 0  // No products match the query
```

2. **Verify Product Data:**
```bash
php artisan tinker
>>> App\Models\Product::where('status', 'active')->count()
=> 1250  // Products exist

>>> App\Models\Product::whereNotNull('sku')->count()
=> 1248  // 2 products missing SKU

>>> App\Models\Product::where('price', '>', 0)->count()
=> 1245  // 5 products have zero price
```

3. **Test Field Mapping:**
```bash
php artisan tinker
>>> $product = App\Models\Product::first();
>>> $mapping = config('pricepilot.field_mapping');
>>> $product->{$mapping['sku']}
=> "LAPTOP-001"  // SKU field works

>>> $product->{$mapping['price']}
=> 1299.99  // Price field works
```

4. **Run Sync with Verbose Output:**
```bash
php artisan pricepilot:sync-products --verbose
```

#### Sync Timeout Error

**Symptoms:**
```bash
php artisan pricepilot:sync-products
# Error: Maximum execution time exceeded
```

**Solutions:**

1. **Increase PHP Timeout:**
```php
// config/pricepilot.php
'api' => [
    'timeout' => 120,  // Increase from 30 to 120 seconds
],
```

2. **Use Queue for Large Syncs:**
```bash
# Enable queue processing
php artisan queue:work

# Sync will run in background
php artisan pricepilot:sync-products --queue
```

3. **Reduce Chunk Size:**
```php
// config/pricepilot.php
'sync' => [
    'chunk_size' => 50,  // Reduce from 100 to 50
],
```

4. **Increase PHP max_execution_time:**
```ini
; php.ini
max_execution_time = 300
```

#### Duplicate Product Error

**Symptoms:**
```bash
# Error: Duplicate SKU detected
```

**Solutions:**

1. **Find Duplicate SKUs:**
```sql
SELECT sku, COUNT(*) as count
FROM products
GROUP BY sku
HAVING count > 1;
```

2. **Fix Duplicates:**
```php
// Option 1: Add unique constraint
Schema::table('products', function (Blueprint $table) {
    $table->unique('sku');
});

// Option 2: Filter in product query
'product_query' => function ($query) {
    return $query->whereNotNull('sku')
                 ->groupBy('sku');
},
```

### Queue Issues

#### Jobs Not Processing

**Symptoms:**
- Sync jobs queued but never execute
- Queue worker not running

**Solutions:**

1. **Start Queue Worker:**
```bash
# Start worker
php artisan queue:work

# Or use supervisor for production
php artisan queue:work --daemon
```

2. **Check Queue Configuration:**
```env
# .env
QUEUE_CONNECTION=redis  # or database, sync
PRICEPILOT_QUEUE_CONNECTION=redis
```

3. **Verify Queue Driver:**
```bash
php artisan tinker
>>> config('queue.default')
=> "redis"

>>> Redis::ping()
=> "PONG"  // Redis is working
```

4. **Check Failed Jobs:**
```bash
php artisan queue:failed
php artisan queue:retry all
```

#### Redis Connection Error

**Symptoms:**
```bash
# Error: Connection refused [tcp://127.0.0.1:6379]
```

**Solutions:**

1. **Check Redis is Running:**
```bash
redis-cli ping
# Should return: PONG
```

2. **Start Redis:**
```bash
# macOS
brew services start redis

# Linux
sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 redis
```

3. **Use Database Queue Instead:**
```env
# .env
QUEUE_CONNECTION=database
PRICEPILOT_QUEUE_CONNECTION=database
```

```bash
php artisan queue:table
php artisan migrate
```

### Webhook Issues

#### Webhook Not Receiving Requests

**Symptoms:**
- PricePilot sends webhooks but Laravel doesn't receive them
- No webhook logs

**Solutions:**

1. **Verify Webhook URL:**
```bash
# Test webhook endpoint
curl -X POST https://yourstore.com/api/pricepilot/webhook \
  -H "Content-Type: application/json" \
  -H "X-PricePilot-Signature: test" \
  -d '{"event":"test","data":{}}'
```

2. **Check CSRF Protection:**
```php
// app/Http/Middleware/VerifyCsrfToken.php
protected $except = [
    'api/pricepilot/webhook',  // Exclude webhook from CSRF
];
```

3. **Verify Firewall Rules:**
```bash
# Allow PricePilot IPs
# Add to your firewall configuration
52.1.2.3
52.4.5.6
52.7.8.9
```

4. **Check Webhook Logs:**
```bash
tail -f storage/logs/laravel.log | grep webhook
```

#### Webhook Signature Verification Failed

**Symptoms:**
```bash
# Error: Invalid webhook signature
```

**Solutions:**

1. **Verify Webhook Secret:**
```bash
php artisan tinker
>>> config('pricepilot.webhook.secret')
=> "your_webhook_secret"
```

2. **Check Secret Matches PricePilot:**
- Log in to PricePilot dashboard
- Go to Settings → Integrations
- Verify webhook secret matches your .env

3. **Disable Verification (Testing Only):**
```php
// config/pricepilot.php
'webhook' => [
    'verify_signature' => false,  // Only for testing!
],
```

### Performance Issues

#### Slow API Responses

**Symptoms:**
- API endpoints take 5+ seconds to respond
- Timeout errors

**Solutions:**

1. **Enable Query Caching:**
```php
// In PricePilotController
protected function getProducts()
{
    return Cache::remember('pricepilot.products', 3600, function () {
        return Product::with(['manufacturer', 'images'])
                     ->where('status', 'active')
                     ->get();
    });
}
```

2. **Optimize Database Queries:**
```php
// Add indexes
Schema::table('products', function (Blueprint $table) {
    $table->index('sku');
    $table->index('status');
    $table->index(['status', 'price']);
});
```

3. **Use Eager Loading:**
```php
'product_query' => function ($query) {
    return $query->with(['manufacturer', 'category', 'images']);
},
```

4. **Enable Response Caching:**
```bash
composer require spatie/laravel-responsecache

php artisan responsecache:clear
```

#### High Memory Usage

**Symptoms:**
```bash
# Error: Allowed memory size exhausted
```

**Solutions:**

1. **Use Chunking:**
```php
// In sync command
Product::chunk(100, function ($products) {
    foreach ($products as $product) {
        $this->syncProduct($product);
    }
});
```

2. **Increase PHP Memory:**
```ini
; php.ini
memory_limit = 512M
```

3. **Use Cursor for Large Datasets:**
```php
foreach (Product::cursor() as $product) {
    $this->syncProduct($product);
}
```

### Common Laravel Errors

#### Class Not Found

**Symptoms:**
```bash
# Error: Class 'PricePilot\LaravelIntegration\...' not found
```

**Solutions:**
```bash
composer dump-autoload
php artisan clear-compiled
php artisan config:clear
```

#### Method Not Found

**Symptoms:**
```bash
# Error: Method syncToPricePilot does not exist
```

**Solutions:**
```php
// Verify trait is added to Product model
use PricePilot\LaravelIntegration\Traits\PricePilotProduct;

class Product extends Model
{
    use PricePilotProduct;  // Make sure this is present
}
```

#### Environment Variable Not Loading

**Symptoms:**
```bash
php artisan tinker
>>> env('PRICEPILOT_API_TOKEN')
=> null
```

**Solutions:**
```bash
# Clear config cache
php artisan config:clear

# Verify .env file exists
ls -la .env

# Check .env syntax (no spaces around =)
PRICEPILOT_API_TOKEN=your_token  # Correct
PRICEPILOT_API_TOKEN = your_token  # Wrong!
```

### Getting Help

If you're still experiencing issues:

1. **Enable Debug Mode:**
```env
APP_DEBUG=true
PRICEPILOT_DEBUG=true
```

2. **Check Logs:**
```bash
tail -f storage/logs/laravel.log
```

3. **Run Diagnostics:**
```bash
php artisan pricepilot:diagnose
```

4. **Contact Support:**
- Email: support@pricepilot.com
- Include: Laravel version, PHP version, error logs
- Attach: `php artisan about` output

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
