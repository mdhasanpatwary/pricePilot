# 🚀 PricePilot OpenCart Integration - API Only (No Plugin!)

## Problem with Current Approach
- Plugin installation is too complex for tenants
- Multiple steps, file uploads, permissions
- High chance of errors
- Not SaaS-friendly

## ✅ New Approach: Use OpenCart's Built-in API

OpenCart already has a REST API! We don't need a custom plugin.

---

## For Tenants: 2-Minute Setup

### Step 1: Enable API in OpenCart

1. OpenCart Admin → **System → Users → API**
2. Click **Add New** (blue + button)
3. Fill in:
   - **Username:** `pricepilot`
   - **Status:** Enabled
4. Click **Generate** to create API Key
5. **Copy the API Key** (this is your token)
6. Click **Save**

### Step 2: Add IP to Whitelist

1. Still in API settings
2. Go to **IP Addresses** tab
3. Click **Add IP**
4. Enter: `0.0.0.0` (allow all) or your PricePilot server IP
5. Click **Save**

### Step 3: Connect to PricePilot

1. Go to **PricePilot Dashboard**
2. Add your OpenCart site
3. Paste the API Key
4. Done!

**Total Time:** 2 minutes  
**No file uploads, no plugins, no technical knowledge needed!**

---

## For PricePilot Backend: Use OpenCart REST API

### Get Products

```
GET /index.php?route=api/product&api_token=TOKEN
```

### Update Product Price

```
POST /index.php?route=api/product/edit&api_token=TOKEN
{
  "product_id": 123,
  "price": 99.99
}
```

### Get Product Details

```
GET /index.php?route=api/product/info&api_token=TOKEN&product_id=123
```

---

## Implementation in PricePilot

Update `lib/services/opencart-api.ts`:

```typescript
export class OpenCartAPI {
  private baseUrl: string;
  private apiToken: string;

  constructor(baseUrl: string, apiToken: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiToken = apiToken;
  }

  async getProducts(start = 0, limit = 100) {
    const url = `${this.baseUrl}/index.php?route=api/product&api_token=${this.apiToken}&start=${start}&limit=${limit}`;
    const response = await fetch(url);
    return response.json();
  }

  async updatePrice(productId: number, price: number) {
    const url = `${this.baseUrl}/index.php?route=api/product/edit&api_token=${this.apiToken}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: productId,
        price: price
      })
    });
    return response.json();
  }

  async getProductDetails(productId: number) {
    const url = `${this.baseUrl}/index.php?route=api/product/info&api_token=${this.apiToken}&product_id=${productId}`;
    const response = await fetch(url);
    return response.json();
  }
}
```

---

## Advantages

✅ **No plugin installation** - Uses OpenCart's built-in API  
✅ **2-minute setup** - Just enable API and copy token  
✅ **No file uploads** - Everything done in admin panel  
✅ **No technical knowledge** - Simple point-and-click  
✅ **Works on all OpenCart versions** - Standard API  
✅ **No maintenance** - No plugin updates needed  
✅ **Tenant-friendly** - Easy enough for anyone  

---

## Limitations & Solutions

### Issue: OpenCart API might not return images

**Solution:** Add a simple PHP file that tenants upload once:

**File:** `api/pricepilot.php` (single file, 50 lines)

```php
<?php
// Simple API endpoint for PricePilot
// Upload this ONE file to: /api/pricepilot.php

require_once(DIR_SYSTEM . 'startup.php');

// Get API token from request
$token = $_GET['api_token'] ?? '';

// Validate token (check against OpenCart API users)
$query = $db->query("SELECT * FROM " . DB_PREFIX . "api WHERE token = '" . $db->escape($token) . "' AND status = 1");

if (!$query->num_rows) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid API token']);
    exit;
}

// Get products with images
$products = [];
$result = $db->query("
    SELECT p.product_id, pd.name, p.model, p.sku, p.price, p.quantity, p.status, p.image,
           m.name as manufacturer
    FROM " . DB_PREFIX . "product p
    LEFT JOIN " . DB_PREFIX . "product_description pd ON p.product_id = pd.product_id
    LEFT JOIN " . DB_PREFIX . "manufacturer m ON p.manufacturer_id = m.manufacturer_id
    WHERE pd.language_id = 1
    LIMIT 1000
");

foreach ($result->rows as $row) {
    $image_url = null;
    if ($row['image']) {
        $image_url = HTTP_SERVER . 'image/' . $row['image'];
    }
    
    $products[] = [
        'product_id' => $row['product_id'],
        'name' => $row['name'],
        'model' => $row['model'],
        'sku' => $row['sku'],
        'price' => $row['price'],
        'quantity' => $row['quantity'],
        'status' => $row['status'],
        'manufacturer' => $row['manufacturer'],
        'image' => $image_url
    ];
}

header('Content-Type: application/json');
echo json_encode([
    'success' => true,
    'products' => $products,
    'total' => count($products)
]);
```

**Tenant uploads this ONE file via FTP to `/api/pricepilot.php`**

---

## Final Tenant Instructions

### Option 1: Use OpenCart Built-in API (Simplest)
1. Enable API in OpenCart admin
2. Copy API token
3. Paste in PricePilot
4. Done!

**Limitation:** Might not return images/manufacturer

### Option 2: Upload Single PHP File (Recommended)
1. Download `pricepilot.php` (50 lines)
2. Upload to `/api/pricepilot.php` via FTP
3. Enable API in OpenCart admin
4. Copy API token
5. Paste in PricePilot
6. Done!

**Benefit:** Returns images, manufacturer, all data

---

## Comparison

| Method | Setup Time | Technical Skill | Image Support | Maintenance |
|--------|-----------|----------------|---------------|-------------|
| **Current Plugin** | 15-30 min | High | ✅ | Updates needed |
| **Built-in API** | 2 min | None | ❌ | None |
| **Single File Upload** | 3 min | Basic FTP | ✅ | None |

---

## Recommendation

Use **Single File Upload** method:
- ✅ Easy for tenants (just upload 1 file)
- ✅ Returns all data including images
- ✅ No maintenance needed
- ✅ Works on all OpenCart versions
- ✅ No complex installation

This is the **SaaS-friendly** solution!
