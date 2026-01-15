# PricePilot Laravel Integration - How It Works

## 🔄 Integration Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PricePilot Dashboard                         │
│                     (Next.js SaaS Platform)                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ User clicks "Connect Store"
                             │ Enters: URL + API Token
                             ▼
                    ┌────────────────────┐
                    │  Verify Connection │
                    │  Test /health      │
                    └────────┬───────────┘
                             │
                             │ Connection Successful
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     AUTOMATED SYNC CYCLE                            │
│                    (Every 15 Minutes)                               │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
        ┌────────────────────────────────────────────┐
        │  PricePilot sends HTTP Request:            │
        │  GET /api/pricepilot/sync                  │
        │  Header: X-PricePilot-Token: xxx           │
        └────────────┬───────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────────────┐
        │  Laravel Store (Your Application)          │
        │  ┌──────────────────────────────────────┐  │
        │  │  1. Middleware: VerifyPricePilotToken│  │
        │  │     ✓ Check X-PricePilot-Token       │  │
        │  │     ✓ Compare with .env token        │  │
        │  └──────────────┬───────────────────────┘  │
        │                 │ Authorized               │
        │                 ▼                          │
        │  ┌──────────────────────────────────────┐  │
        │  │  2. Controller: sync()               │  │
        │  │     ✓ Query products table           │  │
        │  │     ✓ Apply filters (active)         │  │
        │  │     ✓ Map columns                    │  │
        │  │     ✓ Paginate results               │  │
        │  └──────────────┬───────────────────────┘  │
        │                 │                          │
        │                 ▼                          │
        │  ┌──────────────────────────────────────┐  │
        │  │  3. Database Query                   │  │
        │  │     SELECT id, name, sku, price...   │  │
        │  │     FROM products                    │  │
        │  │     WHERE is_active = true           │  │
        │  │     LIMIT 100                        │  │
        │  └──────────────┬───────────────────────┘  │
        │                 │                          │
        │                 ▼                          │
        │  ┌──────────────────────────────────────┐  │
        │  │  4. Return JSON Response             │  │
        │  │     {                                │  │
        │  │       "data": [...products],         │  │
        │  │       "total": 500,                  │  │
        │  │       "current_page": 1              │  │
        │  │     }                                │  │
        │  └──────────────┬───────────────────────┘  │
        └─────────────────┼────────────────────────┘
                          │
                          ▼
        ┌────────────────────────────────────────────┐
        │  PricePilot Dashboard                      │
        │  ✓ Stores products in database             │
        │  ✓ Matches with competitors                │
        │  ✓ Applies pricing rules                   │
        └────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     PRICE UPDATE CYCLE                              │
│              (When Pricing Rules Trigger)                           │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
        ┌────────────────────────────────────────────┐
        │  PricePilot sends HTTP Request:            │
        │  POST /api/pricepilot/update               │
        │  Header: X-PricePilot-Token: xxx           │
        │  Body: {                                   │
        │    "product_id": "123",                    │
        │    "price": 89.99                          │
        │  }                                         │
        └────────────┬───────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────────────┐
        │  Laravel Store (Your Application)          │
        │  ┌──────────────────────────────────────┐  │
        │  │  1. Middleware: VerifyPricePilotToken│  │
        │  │     ✓ Authenticate request           │  │
        │  └──────────────┬───────────────────────┘  │
        │                 │                          │
        │                 ▼                          │
        │  ┌──────────────────────────────────────┐  │
        │  │  2. Controller: update()             │  │
        │  │     ✓ Validate input                 │  │
        │  │     ✓ Find product                   │  │
        │  │     ✓ Get old price                  │  │
        │  │     ✓ Update price                   │  │
        │  │     ✓ Log change                     │  │
        │  │     ✓ Fire event (optional)          │  │
        │  └──────────────┬───────────────────────┘  │
        │                 │                          │
        │                 ▼                          │
        │  ┌──────────────────────────────────────┐  │
        │  │  3. Database Update                  │  │
        │  │     UPDATE products                  │  │
        │  │     SET price = 89.99,               │  │
        │  │         updated_at = NOW()           │  │
        │  │     WHERE id = 123                   │  │
        │  └──────────────┬───────────────────────┘  │
        │                 │                          │
        │                 ▼                          │
        │  ┌──────────────────────────────────────┐  │
        │  │  4. Fire Laravel Event (Optional)    │  │
        │  │     ProductPriceUpdated              │  │
        │  │     - Clear cache                    │  │
        │  │     - Send notifications             │  │
        │  │     - Update related records         │  │
        │  └──────────────┬───────────────────────┘  │
        │                 │                          │
        │                 ▼                          │
        │  ┌──────────────────────────────────────┐  │
        │  │  5. Return Success Response          │  │
        │  │     {                                │  │
        │  │       "success": true,               │  │
        │  │       "old_price": 99.99,            │  │
        │  │       "new_price": 89.99             │  │
        │  │     }                                │  │
        │  └──────────────┬───────────────────────┘  │
        └─────────────────┼────────────────────────┘
                          │
                          ▼
        ┌────────────────────────────────────────────┐
        │  PricePilot Dashboard                      │
        │  ✓ Logs the update                         │
        │  ✓ Updates analytics                       │
        │  ✓ Shows in update history                 │
        └────────────────────────────────────────────┘
```

## 🔐 Authentication Flow

```
┌─────────────────────┐
│  Installation       │
│  php artisan        │
│  pricepilot:install │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Generate Secure Token          │
│  Str::random(64)                │
│  → 64 random characters         │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Save to .env                   │
│  PRICEPILOT_API_TOKEN=xxx       │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  User copies token              │
│  Pastes in PricePilot Dashboard │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  PricePilot stores token        │
│  Encrypted in database          │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Every API Request              │
│  X-PricePilot-Token: xxx        │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Middleware Validates           │
│  token === config('api_token')  │
└──────┬──────────────────────────┘
       │
       ├─── ✓ Match → Continue
       │
       └─── ✗ No Match → 401 Unauthorized
```

## 📊 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Laravel Database                    │
│  ┌────────────────────────────────────────────────────┐     │
│  │  products table                                    │     │
│  │  ┌──────┬──────────┬──────┬────────┬───────┬──────┤     │
│  │  │ id   │ name     │ sku  │ price  │ brand │ model│     │
│  │  ├──────┼──────────┼──────┼────────┼───────┼──────┤     │
│  │  │ 1    │ Widget A │ W001 │ 99.99  │ Acme  │ X100 │     │
│  │  │ 2    │ Widget B │ W002 │ 149.99 │ Acme  │ X200 │     │
│  │  │ 3    │ Widget C │ W003 │ 199.99 │ Acme  │ X300 │     │
│  │  └──────┴──────────┴──────┴────────┴───────┴──────┘     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ GET /api/pricepilot/sync
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              PricePilot Controller (sync)                   │
│  1. Query database with pagination                          │
│  2. Map columns to standard names                           │
│  3. Transform to JSON                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ JSON Response
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  PricePilot Database                        │
│  ┌────────────────────────────────────────────────────┐     │
│  │  products table (PricePilot's copy)                │     │
│  │  ┌──────┬──────────┬──────┬────────┬───────┬──────┤     │
│  │  │ id   │ name     │ sku  │ price  │ brand │ model│     │
│  │  ├──────┼──────────┼──────┼────────┼───────┼──────┤     │
│  │  │ 1    │ Widget A │ W001 │ 99.99  │ Acme  │ X100 │     │
│  │  │ 2    │ Widget B │ W002 │ 149.99 │ Acme  │ X200 │     │
│  │  │ 3    │ Widget C │ W003 │ 199.99 │ Acme  │ X300 │     │
│  │  └──────┴──────────┴──────┴────────┴───────┴──────┘     │
│  └────────────────────────────────────────────────────┘     │
│                                                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Pricing Engine                                    │     │
│  │  - Compares with competitors                       │     │
│  │  - Applies pricing rules                           │     │
│  │  - Calculates new price: $89.99                    │     │
│  └────────────────────┬───────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                       │
                       │ POST /api/pricepilot/update
                       │ { product_id: 1, price: 89.99 }
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              PricePilot Controller (update)                 │
│  1. Validate input                                          │
│  2. Find product (id = 1)                                   │
│  3. Get old price (99.99)                                   │
│  4. Update to new price (89.99)                             │
│  5. Log the change                                          │
│  6. Fire event                                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ UPDATE query
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Your Laravel Database                    │
│  ┌────────────────────────────────────────────────────┐     │
│  │  products table (UPDATED)                          │     │
│  │  ┌──────┬──────────┬──────┬────────┬───────┬──────┤     │
│  │  │ id   │ name     │ sku  │ price  │ brand │ model│     │
│  │  ├──────┼──────────┼──────┼────────┼───────┼──────┤     │
│  │  │ 1    │ Widget A │ W001 │ 89.99  │ Acme  │ X100 │ ← UPDATED!
│  │  │ 2    │ Widget B │ W002 │ 149.99 │ Acme  │ X200 │     │
│  │  │ 3    │ Widget C │ W003 │ 199.99 │ Acme  │ X300 │     │
│  │  └──────┴──────────┴──────┴────────┴───────┴──────┘     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Complete User Journey

```
1. Laravel Developer
   │
   ├─► Runs: composer require pricepilot/laravel-client
   │
   ├─► Runs: php artisan pricepilot:install
   │   └─► Token generated: abc123...xyz789
   │
   ├─► Copies token from terminal
   │
   └─► Goes to PricePilot Dashboard

2. PricePilot Dashboard
   │
   ├─► Clicks "Connect Store"
   │
   ├─► Selects "Laravel"
   │
   ├─► Enters:
   │   - Store URL: https://mystore.com
   │   - API Token: abc123...xyz789
   │
   ├─► Clicks "Verify & Connect"
   │   └─► Tests: GET /api/pricepilot/health
   │       └─► Success! ✓
   │
   └─► Connection established

3. Automated Sync (Every 15 min)
   │
   ├─► PricePilot → Laravel: GET /sync
   │
   ├─► Laravel returns 100 products
   │
   └─► PricePilot stores products

4. Competitor Monitoring
   │
   ├─► User adds competitor stores
   │
   ├─► PricePilot crawls competitor prices
   │
   └─► Compares with user's prices

5. Pricing Rules
   │
   ├─► User creates rule: "Undercut by $5"
   │
   ├─► Competitor price: $94.99
   │
   ├─► Rule triggers: New price = $89.99
   │
   └─► PricePilot → Laravel: POST /update

6. Price Update
   │
   ├─► Laravel validates request
   │
   ├─► Updates database
   │
   ├─► Fires event
   │
   └─► Returns success

7. Customer Sees New Price
   │
   └─► Product page shows $89.99 ✓
```

---

**This diagram shows the complete flow of data between PricePilot and your Laravel store!**
