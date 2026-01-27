# Quick Fix: Get Images, Brand & Model Working

## The Problem
Your products show `null` for image, brand, and model because your OpenCart API wasn't sending this data.

## The Solution (2 Minutes)

### Step 1: Update OpenCart File
1. Copy this file from your PricePilot server:
   ```
   integrations/opencart/catalog/controller/api/pricepilot.php
   ```

2. Upload it to your OpenCart store at:
   ```
   catalog/controller/api/pricepilot.php
   ```
   (Replace the existing file)

### Step 2: Clear Cache
In your OpenCart admin:
- Go to: Dashboard → Click the blue refresh/cache button (top right)

OR delete cache files:
```bash
rm -rf system/storage/cache/*
```

### Step 3: Re-sync Products
In PricePilot dashboard:
1. Go to: Dashboard → Connections
2. Find "giftly.com.bd"
3. Click "Sync Now"
4. Wait for completion

## Verify It Works

Test your API:
```bash
curl "https://giftly.com.bd/index.php?route=api/pricepilot&api_token=YOUR_TOKEN&limit=1"
```

You should see:
```json
{
  "products": [
    {
      "manufacturer": "Sandisk",     ← Brand now appears!
      "image": "https://...",         ← Image URL now appears!
      "category": "Memory Cards",     ← Category now appears!
      "model": "Extreme PRO"          ← Model now appears!
    }
  ]
}
```

## What Changed?

The updated API controller now:
- ✅ Fetches manufacturer (brand) from database
- ✅ Generates full image URLs
- ✅ Retrieves category names
- ✅ Includes special prices

## Still Not Working?

Check these:
1. **File uploaded correctly?** Verify path: `catalog/controller/api/pricepilot.php`
2. **Cache cleared?** Try deleting `system/storage/cache/*`
3. **Products have data?** In OpenCart admin, check if products have:
   - Manufacturer set
   - Model filled in
   - Image uploaded
4. **Permissions?** File should be readable (chmod 644)

## Need Help?

Check the detailed guides:
- `OPENCART_UPDATE_GUIDE.md` - Full update instructions
- `OPENCART_IMAGE_BRAND_FIX.md` - Technical details of the fix
