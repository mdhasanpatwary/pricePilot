# MANUAL FIX - Upload These 3 Files via FTP

## Problem
The .ocmod.zip installer isn't updating the old files because the modification code only runs on specific pages.

## Solution
Upload these 3 files DIRECTLY via FTP to overwrite the old files.

## Files to Upload

### 1. Admin Controller
**Upload to:** `admin/controller/extension/module/pricepilot.php`

### 2. Admin Template  
**Upload to:** `admin/view/template/extension/module/pricepilot.twig`

### 3. API Controller (with image support)
**Upload to:** `catalog/controller/api/pricepilot.php`

## Where to Find These Files

In your PricePilot project:
```
integrations/opencart/admin/controller/extension/module/pricepilot.php
integrations/opencart/admin/view/template/extension/module/pricepilot.twig
integrations/opencart/catalog/controller/api/pricepilot.php
```

## Upload Steps

### Via FTP:
1. Connect to your server via FTP
2. Navigate to your OpenCart root directory
3. Upload each file to its location (overwrite existing)
4. Set permissions to 644:
   ```
   chmod 644 admin/controller/extension/module/pricepilot.php
   chmod 644 admin/view/template/extension/module/pricepilot.twig
   chmod 644 catalog/controller/api/pricepilot.php
   ```

### Via cPanel File Manager:
1. Login to cPanel
2. Open File Manager
3. Navigate to OpenCart directory
4. Upload each file to its location
5. Overwrite when prompted

## After Upload

1. Clear cache:
   - Delete files in `system/storage/cache/`
   - Delete files in `system/storage/modification/`

2. Refresh OpenCart admin:
   - Go to Extensions → Modifications → Click Refresh
   - Logout and login again

3. Check PricePilot page:
   - Click PricePilot in sidebar
   - You should see proper interface with buttons and styling

## Verify It Worked

The configuration page should show:
- ✅ Proper form layout with labels
- ✅ Module Status dropdown
- ✅ API Token field with Copy button
- ✅ API Endpoint field
- ✅ Blue "Save" button
- ✅ Setup instructions box

NOT just plain text like: "PricePilotStatusEnabledDisabled..."

## Test API

After upload, test the API:
```
https://giftly.com.bd/index.php?route=api/pricepilot&api_token=YOUR_TOKEN
```

Should return products with:
- ✅ `"image": "https://giftly.com.bd/image/..."`
- ✅ `"manufacturer": "Brand Name"`
- ✅ `"model": "Model-X"`
- ✅ `"sku": "SKU-123"`

## Still Not Working?

Check OpenCart error log:
```
system/storage/logs/error.log
```

Look for PHP errors related to PricePilot files.
