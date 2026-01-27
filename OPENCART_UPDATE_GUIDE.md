# OpenCart Extension Update Guide

## What's New in v1.1.0

The updated OpenCart extension now returns additional product data:
- ✅ **Brand/Manufacturer** - Product brand information
- ✅ **Image** - Full product image URL
- ✅ **Category** - Product category name
- ✅ **Special Price** - Discounted price if available

## How to Update Your OpenCart Store

### Option 1: Manual File Update (Recommended for Quick Fix)

1. **Download the updated file** from your server:
   - File location: `integrations/opencart/catalog/controller/api/pricepilot.php`

2. **Upload to your OpenCart store**:
   - Path: `catalog/controller/api/pricepilot.php`
   - Replace the existing file

3. **Clear OpenCart cache**:
   - Go to: Dashboard → Settings → Click the gear icon → Refresh button
   - Or delete files in: `system/storage/cache/`

### Option 2: Reinstall Extension (Full Update)

1. **Uninstall current extension**:
   - Go to: Extensions → Extensions → Modules
   - Find "PricePilot"
   - Click Uninstall (red button)

2. **Download new version**:
   - Download: `public/downloads/pricepilot-opencart-v1.1.0.ocmod.zip`

3. **Install new version**:
   - Go to: Extensions → Installer
   - Upload the new zip file
   - Go to: Extensions → Extensions → Modules
   - Find "PricePilot" and click Install (green button)
   - Click Edit and verify your API token

## Verify the Update

After updating, test the API endpoint:

```bash
curl "https://giftly.com.bd/index.php?route=api/pricepilot&api_token=YOUR_TOKEN&limit=1"
```

You should now see these additional fields in the response:
```json
{
  "products": [
    {
      "product_id": "21952",
      "name": "SanDisk Extreme PRO 32GB...",
      "model": "Extreme PRO",
      "manufacturer": "Sandisk",
      "image": "https://giftly.com.bd/image/...",
      "category": "Memory Cards",
      "price": "1540",
      "special": null,
      "quantity": 10,
      "status": "1"
    }
  ]
}
```

## Re-sync Your Products

After updating the OpenCart extension:

1. Go to your PricePilot dashboard
2. Navigate to: Dashboard → Connections
3. Find your "giftly.com.bd" connection
4. Click the "Sync Now" button
5. Wait for sync to complete

Your products should now have:
- ✅ Brand information
- ✅ Model information  
- ✅ Product images
- ✅ Category information

## Troubleshooting

### Images still showing as null?

Check your OpenCart image settings:
- Go to: System → Settings → Edit Store
- Verify "Store URL" is set correctly
- Images should be accessible at: `https://giftly.com.bd/image/...`

### Brand/Model still empty?

Make sure your products have:
- Manufacturer set (Catalog → Products → Edit → Data tab → Manufacturer)
- Model field filled (Catalog → Products → Edit → Data tab → Model)

### API returns error?

- Verify the file was uploaded to the correct path
- Check file permissions (should be 644)
- Clear OpenCart cache
- Check error logs: `system/storage/logs/error.log`
