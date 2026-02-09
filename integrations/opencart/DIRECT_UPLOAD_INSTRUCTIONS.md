# ✅ DIRECT UPLOAD METHOD - This Will Work!

## Problem
The `.ocmod.zip` installer isn't updating files properly because of OpenCart modification system limitations.

## Solution
Use **pricepilot-direct-upload.zip** - Extract directly to your OpenCart root directory.

---

## 📦 Package Information

**File:** `pricepilot-direct-upload.zip`  
**Location:** `integrations/opencart/pricepilot-direct-upload.zip`  
**Size:** ~50 KB  
**Method:** Direct file replacement (not .ocmod)

---

## 🚀 Installation Steps

### Step 1: Download Package

Get `pricepilot-direct-upload.zip` from:
```
integrations/opencart/pricepilot-direct-upload.zip
```

### Step 2: Choose Your Method

#### **METHOD A: Via cPanel File Manager (Easiest)**

1. Login to **cPanel**
2. Open **File Manager**
3. Navigate to your **OpenCart root directory** (where `index.php` is)
4. Click **Upload** button
5. Upload `pricepilot-direct-upload.zip`
6. Right-click the uploaded zip → **Extract**
7. Confirm extraction (it will overwrite 4 files)
8. Delete the zip file after extraction

#### **METHOD B: Via FTP (Recommended)**

1. **Extract** `pricepilot-direct-upload.zip` on your computer
2. You'll see these folders:
   ```
   admin/
   catalog/
   ```
3. Connect to your server via **FTP** (FileZilla, etc.)
4. Navigate to **OpenCart root directory**
5. **Upload** the `admin/` and `catalog/` folders
6. **Overwrite** existing files when prompted

#### **METHOD C: Via SSH (Advanced)**

```bash
# Upload the zip to your server first, then:
cd /path/to/opencart
unzip -o pricepilot-direct-upload.zip
rm pricepilot-direct-upload.zip
chmod 644 admin/controller/extension/module/pricepilot.php
chmod 644 admin/view/template/extension/module/pricepilot.twig
chmod 644 catalog/controller/api/pricepilot.php
```

### Step 3: Clear Cache

Delete all files in these directories:
- `system/storage/cache/`
- `system/storage/modification/`

### Step 4: Verify Installation

1. **Logout** from OpenCart admin
2. **Login** again
3. Click **PricePilot** in the left sidebar
4. You should now see:
   - ✅ Proper form layout with styling
   - ✅ Module Status dropdown
   - ✅ API Token field with **Copy** button
   - ✅ API Endpoint display
   - ✅ Blue **Save** button
   - ✅ Setup instructions box

**NOT** just plain text like: `PricePilotStatusEnabledDisabled...`

---

## 🧪 Test the API

After installation, test your API:

```bash
curl "https://giftly.com.bd/index.php?route=api/pricepilot&api_token=YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "products": [
    {
      "product_id": "123",
      "name": "Product Name",
      "model": "Model-X",
      "sku": "SKU-123",
      "price": "99.9900",
      "quantity": 10,
      "status": 1,
      "manufacturer": "Brand Name",
      "manufacturer_id": 5,
      "image": "https://giftly.com.bd/image/catalog/product.jpg"
    }
  ],
  "total": 735
}
```

**Check for:**
- ✅ `"image"` has full URL (not `null`)
- ✅ `"manufacturer"` has brand name (not empty)
- ✅ `"model"` has model data
- ✅ `"sku"` has SKU data

---

## 📁 Files Included

This package contains 4 files:

1. **admin/controller/extension/module/pricepilot.php** (43 KB)
   - Full admin controller with dashboard, activity log, webhooks
   - 1003 lines of code

2. **admin/view/template/extension/module/pricepilot.twig** (8 KB)
   - Professional admin interface with proper styling
   - Copy token button, form fields, instructions

3. **admin/language/en-gb/extension/module/pricepilot.php** (1 KB)
   - Language strings for admin interface

4. **catalog/controller/api/pricepilot.php** (20 KB)
   - API endpoint with **IMAGE SUPPORT**
   - Returns full image URLs, manufacturer, model, SKU
   - Handles product listing and price updates

---

## ✅ What This Fixes

### Before (Old Version):
- ❌ Plain text interface: `PricePilotStatusEnabledDisabled...`
- ❌ No styling or buttons
- ❌ API returns `image: NULL`
- ❌ No manufacturer/brand data
- ❌ No model or SKU data

### After (New Version):
- ✅ Professional admin interface with proper styling
- ✅ Copy token button works
- ✅ API returns full image URLs
- ✅ API returns manufacturer names
- ✅ API returns model and SKU data
- ✅ All features working

---

## 🔧 Troubleshooting

### Issue: Still seeing plain text interface

**Solution:**
1. Verify files were uploaded to correct location
2. Check file permissions (should be 644)
3. Clear browser cache (Ctrl+F5 or Cmd+Shift+R)
4. Clear OpenCart cache again
5. Logout and login to admin

### Issue: API still returns NULL images

**Solution:**
1. Verify `catalog/controller/api/pricepilot.php` was uploaded
2. Check file size: should be ~20 KB (not 2 KB)
3. Test API endpoint directly in browser
4. Check OpenCart error log: `system/storage/logs/error.log`

### Issue: Permission denied errors

**Solution:**
```bash
chmod 644 admin/controller/extension/module/pricepilot.php
chmod 644 admin/view/template/extension/module/pricepilot.twig
chmod 644 catalog/controller/api/pricepilot.php
```

### Issue: Files not found

**Solution:**
- Make sure you extracted to OpenCart **root directory**
- The root directory contains `index.php`, `admin/`, `catalog/` folders
- Don't extract to a subdirectory

---

## 🎯 Next Steps

After successful installation:

1. **Copy API Token** from PricePilot admin page
2. **Go to PricePilot Dashboard** (http://localhost:3000)
3. **Add your site** in Integrations page
4. **Paste the token**
5. **Click Sync Now**
6. **Verify products** appear with images

---

## 📞 Support

If you still have issues after following these steps:

1. Check OpenCart error log: `system/storage/logs/error.log`
2. Verify file sizes match:
   - `pricepilot.php` (admin controller): ~43 KB
   - `pricepilot.php` (API): ~20 KB
   - `pricepilot.twig`: ~8 KB
3. Test API endpoint manually in browser
4. Take screenshot of the issue

---

**This method WILL work because it directly replaces the files, bypassing the OpenCart modification system entirely.**
