# OpenCart Plugin Update Guide

## Problem Identified

The OpenCart API at **https://giftly.com.bd/** is returning:
- ❌ `image: NULL` for all 735 products
- ❌ `manufacturer: N/A` (no brand data)
- ❌ `model: N/A` (no model data)  
- ❌ `sku: N/A` (no SKU data)

**Root Cause:** The OpenCart plugin on your live site is either:
1. Not installed
2. Outdated version (missing image/brand/model support)
3. Not properly configured

## Solution: Upload Updated Plugin Files

### Files to Upload

Upload these files from your PricePilot project to your OpenCart installation:

```
integrations/opencart/
├── catalog/
│   ├── controller/
│   │   └── api/
│   │       └── pricepilot.php          ← Upload this
│   └── model/
│       └── extension/
│           └── pricepilot/
│               ├── ProductService.php   ← Upload this
│               └── PriceService.php     ← Upload this
```

### Upload Instructions

#### Option 1: FTP/SFTP Upload

1. Connect to your server via FTP/SFTP
2. Navigate to your OpenCart root directory (where `index.php` is located)
3. Upload the files maintaining the directory structure:
   ```
   /catalog/controller/api/pricepilot.php
   /catalog/model/extension/pricepilot/ProductService.php
   /catalog/model/extension/pricepilot/PriceService.php
   ```

#### Option 2: cPanel File Manager

1. Login to cPanel
2. Open File Manager
3. Navigate to your OpenCart directory
4. Create directories if they don't exist:
   - `catalog/controller/api/`
   - `catalog/model/extension/pricepilot/`
5. Upload the files to their respective locations

#### Option 3: SSH/Terminal

```bash
# Navigate to your OpenCart directory
cd /path/to/opencart

# Create directories if needed
mkdir -p catalog/controller/api
mkdir -p catalog/model/extension/pricepilot

# Upload files (use scp or copy from your local machine)
# Then set proper permissions
chmod 644 catalog/controller/api/pricepilot.php
chmod 644 catalog/model/extension/pricepilot/ProductService.php
chmod 644 catalog/model/extension/pricepilot/PriceService.php
```

### Verify Plugin Installation

After uploading, test the API manually:

```bash
# Replace YOUR_TOKEN with your actual API token
curl "https://giftly.com.bd/index.php?route=api/pricepilot&api_token=YOUR_TOKEN"
```

**Expected Response (after fix):**
```json
{
  "success": true,
  "products": [
    {
      "product_id": "22043",
      "name": "AMD Ryzen 5 5600 Processor",
      "sku": "AMD-R5-5600",
      "model": "Ryzen 5 5600",
      "manufacturer": "AMD",
      "price": "14800.0000",
      "image": "https://giftly.com.bd/image/catalog/processor/amd/ryzen-5-5600.jpg",
      "quantity": 10,
      "status": 1
    }
  ]
}
```

## After Plugin Update

### Step 1: Re-sync Your Products

1. Login to PricePilot: http://localhost:3000
2. Go to **Integrations** page
3. Find your site: **https://giftly.com.bd/**
4. Click **Sync Now** button
5. Wait for sync to complete (735 products)

### Step 2: Verify Images

1. Go to **Products** page
2. Check that product images are now visible
3. Verify brand and model data is populated

## What the Updated Plugin Does

The updated plugin includes:

### 1. Image URL Generation
```php
private function getImageUrl($imagePath) {
    if (!$imagePath) {
        return null;
    }
    
    $storeUrl = $this->config->get('config_url');
    if (!$storeUrl) {
        $storeUrl = HTTP_SERVER;
    }
    
    $storeUrl = rtrim($storeUrl, '/') . '/';
    return $storeUrl . 'image/' . $imagePath;
}
```

**Example:**
- Database: `catalog/monitor/HP-M22f-22-Inch-FHD-IPS-Monitor.jpg`
- API Returns: `https://giftly.com.bd/image/catalog/monitor/HP-M22f-22-Inch-FHD-IPS-Monitor.jpg`

### 2. Brand/Manufacturer Support
```php
'manufacturer' => $row['manufacturer'] ?? '',
'manufacturer_id' => (int)($row['manufacturer_id'] ?? 0),
```

### 3. Model Support
```php
'model' => $row['model'] ?? '',
```

### 4. SKU Support
```php
'sku' => $row['sku'] ?? '',
```

### 5. Category Support
```php
'category' => '', // First category name
'categories' => [] // All categories with IDs
```

### 6. Special Price Support
```php
'special' => $specialPriceData['price'],
'special_start' => $specialPriceData['date_start'],
'special_end' => $specialPriceData['date_end'],
```

## Troubleshooting

### Issue: Still Getting NULL Images

**Check 1: Verify files are uploaded**
```bash
ls -la catalog/controller/api/pricepilot.php
ls -la catalog/model/extension/pricepilot/ProductService.php
```

**Check 2: Clear OpenCart cache**
- Delete files in `system/storage/cache/`
- Or use OpenCart admin: Extensions → Modifications → Refresh

**Check 3: Check file permissions**
```bash
chmod 644 catalog/controller/api/pricepilot.php
chmod 644 catalog/model/extension/pricepilot/*.php
```

**Check 4: Verify database has images**
Run this SQL query in your OpenCart database:
```sql
SELECT product_id, name, image 
FROM oc_product 
WHERE image IS NOT NULL AND image != '' 
LIMIT 10;
```

### Issue: API Returns Error

**Check OpenCart error logs:**
- `system/storage/logs/error.log`

**Common errors:**
- **Class not found:** Files not uploaded correctly
- **Permission denied:** File permissions issue (use 644)
- **Invalid token:** API token mismatch

## Current Status

✅ **PricePilot Code:** Ready (sync logic correctly maps images)  
✅ **Plugin Files:** Ready (in `integrations/opencart/`)  
❌ **Live Site:** Plugin not installed/outdated  

**Next Action:** Upload the 3 plugin files to your live OpenCart site.

## Need Help?

If you encounter issues:
1. Check OpenCart error logs
2. Verify file permissions
3. Test API manually with curl
4. Check database for image data
5. Clear OpenCart cache

---

**Important:** After uploading the plugin, you MUST re-sync your products in PricePilot to populate the images.
