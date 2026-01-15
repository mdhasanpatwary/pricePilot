# PricePilot Laravel Package - Structure Overview

## 📦 Package Structure

```
pricepilot/laravel-client/
├── .env.example                    # Example environment configuration
├── .gitignore                      # Git ignore rules
├── CHANGELOG.md                    # Version history and changes
├── composer.json                   # Composer package definition
├── LICENSE                         # MIT License
├── QUICKSTART.md                   # Quick start guide (5-minute setup)
├── README.md                       # Complete documentation
│
├── config/
│   └── pricepilot.php             # Configuration file with all options
│
├── routes/
│   └── api.php                    # API route definitions
│
└── src/
    ├── Console/
    │   └── InstallCommand.php     # php artisan pricepilot:install
    │
    ├── Http/
    │   ├── Controllers/
    │   │   └── PricePilotController.php  # Main API controller
    │   │
    │   └── Middleware/
    │       └── VerifyPricePilotToken.php # Authentication middleware
    │
    └── PricePilotServiceProvider.php     # Laravel service provider
```

## 🎯 Key Features

### 1. **Easy Installation**
- Single command setup: `php artisan pricepilot:install`
- Automatic token generation
- Auto-discovery via Laravel package discovery

### 2. **Flexible Configuration**
- Customizable table names
- Column mapping for any database schema
- Active product filtering
- Logging and event toggles

### 3. **Secure Authentication**
- Token-based API authentication
- Request logging for security monitoring
- Environment-based configuration

### 4. **Comprehensive API**
- **Health Check**: `GET /api/pricepilot/health`
- **Product Sync**: `GET /api/pricepilot/sync`
- **Price Update**: `POST /api/pricepilot/update`

### 5. **Developer-Friendly**
- Detailed error messages
- Comprehensive logging
- Laravel event support
- Full documentation

## 🔌 API Endpoints

### Health Check
```http
GET /api/pricepilot/health
X-PricePilot-Token: your-token
```

**Response:**
```json
{
  "status": "ok",
  "message": "PricePilot integration is working",
  "products_count": 150,
  "version": "1.0.0"
}
```

### Sync Products
```http
GET /api/pricepilot/sync?limit=100&page=1
X-PricePilot-Token: your-token
```

**Response:**
```json
{
  "data": [
    {
      "id": "1",
      "name": "Product Name",
      "sku": "SKU-001",
      "price": 99.99,
      "brand": "Brand",
      "model": "Model-X"
    }
  ],
  "current_page": 1,
  "per_page": 100,
  "total": 500,
  "last_page": 5
}
```

### Update Price
```http
POST /api/pricepilot/update
X-PricePilot-Token: your-token
Content-Type: application/json

{
  "product_id": "123",
  "price": 89.99
}
```

**Response:**
```json
{
  "success": true,
  "message": "Price updated successfully",
  "product_id": "123",
  "old_price": 99.99,
  "new_price": 89.99
}
```

## ⚙️ Configuration Options

All configuration is in `config/pricepilot.php`:

| Option | Environment Variable | Default | Description |
|--------|---------------------|---------|-------------|
| `api_token` | `PRICEPILOT_API_TOKEN` | `null` | **Required** - API authentication token |
| `route_prefix` | `PRICEPILOT_ROUTE_PREFIX` | `api/pricepilot` | API route prefix |
| `products_table` | `PRICEPILOT_PRODUCTS_TABLE` | `products` | Products table name |
| `column_mapping.id` | `PRICEPILOT_COL_ID` | `id` | ID column name |
| `column_mapping.name` | `PRICEPILOT_COL_NAME` | `name` | Name column name |
| `column_mapping.sku` | `PRICEPILOT_COL_SKU` | `sku` | SKU column name |
| `column_mapping.price` | `PRICEPILOT_COL_PRICE` | `price` | Price column name |
| `column_mapping.brand` | `PRICEPILOT_COL_BRAND` | `brand` | Brand column name |
| `column_mapping.model` | `PRICEPILOT_COL_MODEL` | `model` | Model column name |
| `active_column` | `PRICEPILOT_ACTIVE_COLUMN` | `null` | Filter by active column |
| `enable_logging` | `PRICEPILOT_ENABLE_LOGGING` | `true` | Enable detailed logging |
| `fire_events` | `PRICEPILOT_FIRE_EVENTS` | `true` | Fire Laravel events |

## 🔐 Security Features

- ✅ Token-based authentication on all endpoints
- ✅ Request logging with IP and user agent
- ✅ Environment-based configuration (no hardcoded secrets)
- ✅ Validation on all inputs
- ✅ Error messages don't leak sensitive info in production
- ✅ Middleware protection on all routes

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Complete documentation with examples |
| `QUICKSTART.md` | 5-minute setup guide |
| `CHANGELOG.md` | Version history and changes |
| `.env.example` | Example environment configuration |
| `LICENSE` | MIT License |

## 🚀 Quick Start

```bash
# 1. Install package
composer require pricepilot/laravel-client

# 2. Run installation
php artisan pricepilot:install

# 3. Copy the generated token

# 4. Connect in PricePilot dashboard
# - Go to Dashboard → Integrations
# - Select Laravel
# - Enter your store URL and token
# - Click "Verify & Connect"

# 5. Test the connection
curl -X GET https://yourstore.com/api/pricepilot/health \
  -H "X-PricePilot-Token: your-token"
```

## 🎨 Customization Examples

### Custom Table Name
```env
PRICEPILOT_PRODUCTS_TABLE=my_products
```

### Custom Column Names
```env
PRICEPILOT_COL_ID=product_id
PRICEPILOT_COL_NAME=product_name
PRICEPILOT_COL_PRICE=selling_price
```

### Filter Active Products Only
```env
PRICEPILOT_ACTIVE_COLUMN=is_active
```

### Disable Logging
```env
PRICEPILOT_ENABLE_LOGGING=false
```

## 🔄 Laravel Events

When a price is updated, the package can fire a Laravel event:

```php
// App\Events\ProductPriceUpdated
event(new ProductPriceUpdated($productId, $oldPrice, $newPrice));
```

Listen to this event to trigger additional actions:

```php
// App\Listeners\ClearProductCache
public function handle(ProductPriceUpdated $event)
{
    Cache::forget("product.{$event->productId}");
    // Your custom logic here
}
```

## 📊 Logging

All operations are logged when `enable_logging` is true:

```
[2026-01-15 12:00:00] local.INFO: PricePilot: Authenticated request {"path":"api/pricepilot/sync","method":"GET"}
[2026-01-15 12:00:01] local.INFO: PricePilot: Synced products {"count":100,"page":1,"total":500}
[2026-01-15 12:05:00] local.INFO: PricePilot: Price updated {"product_id":"123","old_price":99.99,"new_price":89.99}
```

## 🐛 Troubleshooting

See `QUICKSTART.md` for common issues and solutions.

## 📞 Support

- **Documentation**: [Full README](README.md)
- **Quick Start**: [5-minute guide](QUICKSTART.md)
- **Email**: support@pricepilot.com
- **Dashboard**: http://localhost:3000

---

**Version**: 1.0.0
**License**: MIT
**Built with ❤️ by the PricePilot Team**
