# PricePilot Laravel Integration

Official Laravel package for integrating your Laravel e-commerce store with PricePilot.

---

## 📦 Installation

### 1. Install via Composer

```bash
composer require pricepilot/laravel-client
```

### 2. Publish Configuration

```bash
php artisan vendor:publish --provider="PricePilot\LaravelClient\PricePilotServiceProvider"
```

This will create `config/pricepilot.php` in your Laravel application.

### 3. Configure Environment

Add the following to your `.env` file:

```env
PRICEPILOT_API_TOKEN=your-secure-random-token-here
```

**Generate a secure token:**

```bash
# Option 1: Using OpenSSL
openssl rand -base64 32

# Option 2: Using PHP
php -r "echo bin2hex(random_bytes(32));"

# Option 3: Using Laravel Tinker
php artisan tinker
>>> Str::random(64)
```

---

## 🔧 Configuration

The package automatically registers the following routes:

- `GET /api/pricepilot/sync` - Fetch product catalog
- `POST /api/pricepilot/update` - Update product prices

All routes are protected by the `VerifyPricePilotToken` middleware.

### Customizing Routes

Edit `config/pricepilot.php`:

```php
return [
    'api_token' => env('PRICEPILOT_API_TOKEN'),
    'route_prefix' => 'api/pricepilot', // Change this to customize route prefix
];
```

---

## 🔌 Connecting to PricePilot Dashboard

1. Log in to your PricePilot dashboard
2. Navigate to **Dashboard → Integrations**
3. Click **Connect Store**
4. Select **Laravel** as your platform
5. Enter your store details:
   - **Store Base URL**: `https://yourstore.com`
   - **Secure API Token**: The same token from your `.env` file
6. Click **Verify & Connect**

---

## 🛠 Customization

### Customize Product Sync

Edit `src/Http/Controllers/PricePilotController.php`:

```php
public function sync(Request $request)
{
    // Customize the query to match your database structure
    $products = DB::table('products')
        ->select('id', 'name', 'sku', 'price', 'brand', 'model')
        ->where('active', true) // Add your conditions
        ->paginate($request->get('limit', 100));

    return response()->json($products);
}
```

### Customize Price Updates

```php
public function update(Request $request)
{
    $request->validate([
        'product_id' => 'required',
        'price' => 'required|numeric|min:0',
    ]);

    // Add your custom logic here
    // For example: log changes, trigger events, update related records

    $updated = DB::table('products')
        ->where('id', $request->product_id)
        ->update([
            'price' => $request->price,
            'updated_at' => now(),
        ]);

    if ($updated) {
        // Trigger event, clear cache, etc.
        event(new ProductPriceUpdated($request->product_id, $request->price));

        return response()->json([
            'success' => true,
            'message' => 'Price updated successfully'
        ]);
    }

    return response()->json([
        'success' => false,
        'message' => 'Product not found or update failed'
    ], 404);
}
```

---

## 🔒 Security

### Token Authentication

All requests from PricePilot include the `X-PricePilot-Token` header. The middleware automatically validates this against your configured token.

```php
// Middleware: VerifyPricePilotToken
public function handle(Request $request, Closure $next)
{
    $token = $request->header('X-PricePilot-Token');

    if (!$token || $token !== config('pricepilot.api_token')) {
        return response()->json(['error' => 'Unauthorized PricePilot request'], 401);
    }

    return $next($request);
}
```

### Best Practices

1. **Use strong tokens**: Generate tokens with at least 32 characters
2. **Keep tokens secret**: Never commit `.env` to version control
3. **Rotate tokens**: Change your token periodically
4. **Use HTTPS**: Always use SSL/TLS in production
5. **Rate limiting**: Consider adding rate limiting to the routes

---

## 📊 Database Schema

### Recommended Product Table Structure

```sql
CREATE TABLE products (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) UNIQUE,
    model VARCHAR(100),
    brand VARCHAR(100),
    price DECIMAL(10, 2) NOT NULL,
    cost DECIMAL(10, 2),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sku (sku),
    INDEX idx_model (model),
    INDEX idx_active (active)
);
```

---

## 🧪 Testing

### Test the Connection

```bash
# Test sync endpoint
curl -X GET https://yourstore.com/api/pricepilot/sync \
  -H "X-PricePilot-Token: your-token-here"

# Test update endpoint
curl -X POST https://yourstore.com/api/pricepilot/update \
  -H "X-PricePilot-Token: your-token-here" \
  -H "Content-Type: application/json" \
  -d '{"product_id": "123", "price": 99.99}'
```

### Expected Responses

**Sync Response:**
```json
{
  "data": [
    {
      "id": "123",
      "name": "Product Name",
      "sku": "SKU-001",
      "price": 99.99,
      "brand": "Brand Name",
      "model": "Model-X"
    }
  ],
  "current_page": 1,
  "per_page": 100,
  "total": 500
}
```

**Update Response:**
```json
{
  "success": true,
  "message": "Price updated in Laravel store"
}
```

---

## 🐛 Troubleshooting

### Common Issues

**Issue: "Unauthorized PricePilot request" error**

**Solution:**
- Verify `PRICEPILOT_API_TOKEN` is set in `.env`
- Ensure the token matches exactly in PricePilot dashboard
- Clear config cache: `php artisan config:clear`

**Issue: Routes not found (404)**

**Solution:**
- Run `php artisan route:list` to verify routes are registered
- Check if the service provider is loaded
- Clear route cache: `php artisan route:clear`

**Issue: Products not syncing**

**Solution:**
- Verify your database table name and columns
- Check if products exist in database
- Review the `sync()` method query
- Check Laravel logs: `storage/logs/laravel.log`

**Issue: Price updates not working**

**Solution:**
- Verify the product ID exists
- Check database permissions
- Review validation rules
- Check for database triggers or observers that might interfere

---

## 📚 API Reference

### GET /api/pricepilot/sync

Fetches product catalog from your store.

**Headers:**
```
X-PricePilot-Token: your-token-here
```

**Query Parameters:**
- `limit` (optional): Number of products per page (default: 100)
- `page` (optional): Page number (default: 1)

**Response:** Paginated product list

---

### POST /api/pricepilot/update

Updates a product price.

**Headers:**
```
X-PricePilot-Token: your-token-here
Content-Type: application/json
```

**Body:**
```json
{
  "product_id": "123",
  "price": 99.99
}
```

**Response:**
```json
{
  "success": true,
  "message": "Price updated in Laravel store"
}
```

---

## 🔄 Advanced Usage

### Using Eloquent Models

If you prefer using Eloquent instead of Query Builder:

```php
use App\Models\Product;

public function sync(Request $request)
{
    $products = Product::select('id', 'name', 'sku', 'price', 'brand', 'model')
        ->where('active', true)
        ->paginate($request->get('limit', 100));

    return response()->json($products);
}

public function update(Request $request)
{
    $request->validate([
        'product_id' => 'required',
        'price' => 'required|numeric|min:0',
    ]);

    $product = Product::find($request->product_id);

    if (!$product) {
        return response()->json([
            'success' => false,
            'message' => 'Product not found'
        ], 404);
    }

    $product->price = $request->price;
    $product->save();

    return response()->json([
        'success' => true,
        'message' => 'Price updated successfully'
    ]);
}
```

### Adding Price History Logging

```php
public function update(Request $request)
{
    $product = Product::find($request->product_id);

    // Log price change
    PriceHistory::create([
        'product_id' => $product->id,
        'old_price' => $product->price,
        'new_price' => $request->price,
        'updated_by' => 'pricepilot',
        'updated_at' => now(),
    ]);

    $product->price = $request->price;
    $product->save();

    return response()->json(['success' => true]);
}
```

### Adding Webhooks

Notify PricePilot when prices change manually:

```php
// In your Product model or observer
protected static function booted()
{
    static::updated(function ($product) {
        if ($product->isDirty('price')) {
            Http::withHeaders([
                'X-PricePilot-Token' => config('pricepilot.api_token')
            ])->post('https://pricepilot.com/api/webhooks/price-changed', [
                'product_id' => $product->id,
                'old_price' => $product->getOriginal('price'),
                'new_price' => $product->price,
            ]);
        }
    });
}
```

---

## 📞 Support

- **Documentation**: [PricePilot Docs](https://docs.pricepilot.com)
- **Email**: support@pricepilot.com
- **Issues**: [GitHub Issues](https://github.com/pricepilot/laravel-client/issues)

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🤝 Contributing

Contributions are welcome! Please submit pull requests or open issues on GitHub.

---

**Built with ❤️ by the PricePilot Team**
