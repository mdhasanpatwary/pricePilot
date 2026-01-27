# OpenCart Image, Brand, and Model Fix - Summary

## Problem

When syncing products from your OpenCart store (giftly.com.bd), the following fields were showing as `null`:
- `image` - Product images
- `brand` - Product brand/manufacturer
- `model` - Product model
- `category` - Product category

Example of the issue:
```json
{
  "id": "330e4c5b-87eb-4242-8d0c-90a86d2b8264",
  "sku": "N/A",
  "title": "SanDisk Extreme PRO 32GB...",
  "image": null,  // ❌ Should show image URL
  "brand": "Generic",  // ❌ Should show "Sandisk"
  "model": "N/A",  // ❌ Should show "Extreme PRO"
  "category": "Uncategorized"  // ❌ Should show actual category
}
```

## Root Cause

The OpenCart API controller (`catalog/controller/api/pricepilot.php`) was only returning basic product information:
- product_id
- name
- model (field exists but wasn't being used)
- sku
- price
- quantity
- status

It was **NOT** returning:
- manufacturer (brand)
- image URL
- category
- special price

## Solution

### 1. Updated OpenCart API Controller

Modified `integrations/opencart/catalog/controller/api/pricepilot.php` to:

**Load additional models:**
```php
$this->load->model('catalog/product');
$this->load->model('catalog/category');
$this->load->model('catalog/manufacturer');
```

**Extract manufacturer (brand):**
```php
$manufacturer = '';
if (!empty($result['manufacturer_id'])) {
    $manufacturer_info = $this->model_catalog_manufacturer->getManufacturer($result['manufacturer_id']);
    if ($manufacturer_info) {
        $manufacturer = $manufacturer_info['name'];
    }
}
```

**Extract product image:**
```php
$image = '';
if (!empty($result['image'])) {
    $image = $this->config->get('config_url') . 'image/' . $result['image'];
}
```

**Extract category:**
```php
$category = '';
$categories = $this->model_catalog_product->getCategories($result['product_id']);
if (!empty($categories)) {
    $category_info = $this->model_catalog_category->getCategory($categories[0]['category_id']);
    if ($category_info) {
        $category = $category_info['name'];
    }
}
```

**Extract special price:**
```php
$special = $this->model_catalog_product->getProductSpecial($result['product_id']);
```

**Return complete product data:**
```php
$json['products'][] = array(
    'product_id'   => $result['product_id'],
    'name'         => $result['name'],
    'model'        => $result['model'],
    'sku'          => $result['sku'],
    'price'        => $result['price'],
    'special'      => $special ? $special : null,
    'quantity'     => $result['quantity'],
    'status'       => $result['status'],
    'manufacturer' => $manufacturer,  // ✅ NEW
    'image'        => $image,         // ✅ NEW
    'category'     => $category       // ✅ NEW
);
```

### 2. Enhanced Scraper Service

Also added OpenCart-specific selectors to the scraper for direct page scraping:

**Added site profile for giftly.com.bd:**
```typescript
'giftly.com.bd': {
  strategy: 'light-js',
  selectors: {
    title: ['h1', '.product-title', '#content h1'],
    price: ['#price-special', '.price-new', 'h2', '.product-price'],
    image: ['.product-image img', '#image', '.thumbnail img', '.image img'],
    stock: ['.stock-status', '#product .availability']
  },
  waitTime: 2000,
  cacheTime: 1800,
  successRate: 0.92,
  retryCount: 2
}
```

**Enhanced selector extraction to find brand and model:**
```typescript
// Extract from OpenCart's product info list
const extractFromProductInfo = () => {
  const listItems = document.querySelectorAll('.list-unstyled li, .product-info li, ul li');
  let brand = "";
  let model = "";
  
  listItems.forEach(li => {
    const text = li.textContent || "";
    if (text.toLowerCase().includes('brand:')) {
      brand = text.split(':')[1].trim();
    }
    if (text.toLowerCase().includes('model:')) {
      model = text.split(':')[1].trim();
    }
  });
  
  return { brand, model };
};
```

### 3. Sync Service Already Configured

The sync service was already correctly mapping these fields:
```typescript
return validProducts.map((p) => ({
  external_id: p.product_id?.toString() || p.id?.toString() || "",
  sku: p.sku || null,
  title: p.name || p.title || "Unknown Product",
  category: p.category || null,
  price: parseFloat((p.price || p.special || "0").toString()),
  brand: p.manufacturer || null,  // ✅ Maps manufacturer to brand
  model: p.model || null,          // ✅ Maps model
  in_stock: (p.quantity ?? 0) > 0,
  image: p.image || undefined,     // ✅ Maps image
  url: `${site.baseUrl}/index.php?route=product/product&product_id=${p.product_id}`
}));
```

## Files Changed

1. **integrations/opencart/catalog/controller/api/pricepilot.php**
   - Added manufacturer extraction
   - Added image URL generation
   - Added category extraction
   - Added special price extraction

2. **lib/config/site-profiles.ts**
   - Added giftly.com.bd site profile
   - Added OpenCart-specific selectors

3. **lib/services/scraper.ts**
   - Enhanced brand/model extraction from product info lists
   - Added OpenCart image selectors

## New Package Versions

Created updated extension packages:
- `public/downloads/pricepilot-opencart-v1.1.0.zip`
- `public/downloads/pricepilot-opencart-v1.1.0.ocmod.zip`

## Next Steps

1. **Update your OpenCart store** with the new API controller file
2. **Clear OpenCart cache**
3. **Re-sync your products** from the PricePilot dashboard
4. **Verify** that images, brands, models, and categories now appear correctly

## Expected Result

After updating and re-syncing, your products should look like:
```json
{
  "id": "330e4c5b-87eb-4242-8d0c-90a86d2b8264",
  "sku": "SDSDXX0-032G-GN4IN",
  "title": "SanDisk Extreme PRO 32GB 100mbps SDHC UHS-I Memory Card",
  "image": "https://giftly.com.bd/image/cache/catalog/sandisk-extreme-pro-32gb.jpg",
  "brand": "Sandisk",
  "model": "Extreme PRO",
  "category": "Memory Cards",
  "yourPrice": 1540,
  "compPrice": null,
  "inStock": true
}
```

## Testing

You can test the updated API directly:
```bash
curl "https://giftly.com.bd/index.php?route=api/pricepilot&api_token=YOUR_TOKEN&limit=1"
```

The response should now include `manufacturer`, `image`, and `category` fields.
