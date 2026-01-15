<?php

return [
    /*
    |--------------------------------------------------------------------------
    | PricePilot API Token
    |--------------------------------------------------------------------------
    |
    | This token is used to authorize requests from the PricePilot SaaS
    | dashboard. Keep this token secret and never commit it to version control.
    |
    | Generate a secure token using:
    | - php artisan key:generate
    | - openssl rand -base64 32
    | - Str::random(64)
    |
    */
    'api_token' => env('PRICEPILOT_API_TOKEN'),

    /*
    |--------------------------------------------------------------------------
    | Route Prefix
    |--------------------------------------------------------------------------
    |
    | The route prefix used for the PricePilot API endpoints.
    | Default: api/pricepilot
    |
    | Endpoints will be available at:
    | - GET  /api/pricepilot/health
    | - GET  /api/pricepilot/sync
    | - POST /api/pricepilot/update
    |
    */
    'route_prefix' => env('PRICEPILOT_ROUTE_PREFIX', 'api/pricepilot'),

    /*
    |--------------------------------------------------------------------------
    | Products Table
    |--------------------------------------------------------------------------
    |
    | The name of your products table in the database.
    | Default: products
    |
    */
    'products_table' => env('PRICEPILOT_PRODUCTS_TABLE', 'products'),

    /*
    |--------------------------------------------------------------------------
    | Column Mapping
    |--------------------------------------------------------------------------
    |
    | Map your database columns to PricePilot's expected field names.
    | This allows you to use custom column names in your database.
    |
    | Standard fields:
    | - id: Product unique identifier
    | - name: Product name/title
    | - sku: Stock Keeping Unit
    | - price: Current price
    | - brand: Product brand
    | - model: Product model number
    |
    */
    'column_mapping' => [
        'id' => env('PRICEPILOT_COL_ID', 'id'),
        'name' => env('PRICEPILOT_COL_NAME', 'name'),
        'sku' => env('PRICEPILOT_COL_SKU', 'sku'),
        'price' => env('PRICEPILOT_COL_PRICE', 'price'),
        'brand' => env('PRICEPILOT_COL_BRAND', 'brand'),
        'model' => env('PRICEPILOT_COL_MODEL', 'model'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Active Column Filter
    |--------------------------------------------------------------------------
    |
    | If you want to sync only active/published products, specify the column
    | name here. The query will filter for records where this column is true.
    |
    | Set to null to sync all products.
    |
    */
    'active_column' => env('PRICEPILOT_ACTIVE_COLUMN', null),

    /*
    |--------------------------------------------------------------------------
    | Enable Logging
    |--------------------------------------------------------------------------
    |
    | Enable detailed logging for sync and update operations.
    | Logs will be written to your Laravel log file.
    |
    */
    'enable_logging' => env('PRICEPILOT_ENABLE_LOGGING', true),

    /*
    |--------------------------------------------------------------------------
    | Fire Events
    |--------------------------------------------------------------------------
    |
    | Enable firing Laravel events when prices are updated.
    | You can listen to these events to trigger additional actions.
    |
    | Event: App\Events\ProductPriceUpdated
    |
    */
    'fire_events' => env('PRICEPILOT_FIRE_EVENTS', true),
];
