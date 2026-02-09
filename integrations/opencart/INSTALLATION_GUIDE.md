# PricePilot OpenCart Extension - Installation Guide

## 📦 Package Information

**File:** `pricepilot.ocmod.zip`  
**Version:** 2.0.0  
**Compatible with:** OpenCart 3.x  

## ✨ Features Included

✅ **Complete Auto-Installation** - No manual file uploads needed  
✅ **Image Support** - Returns full product image URLs  
✅ **Brand/Manufacturer Support** - Returns manufacturer names  
✅ **Model & SKU Support** - Complete product data  
✅ **Clean Admin Interface** - Professional configuration page  
✅ **Auto-Generated API Token** - Secure token created automatically  
✅ **Sidebar Menu** - Easy access from OpenCart admin  

## 📋 Installation Steps

### Step 1: Upload Extension

1. Login to your **OpenCart Admin Panel**
2. Go to **Extensions → Installer**
3. Click the **Upload** button
4. Select `pricepilot.ocmod.zip`
5. Wait for upload to complete (you'll see a success message)

### Step 2: Refresh Modifications

1. Go to **Extensions → Modifications**
2. Click the **Refresh** button (blue circular arrow icon in top-right)
3. Wait for the page to reload

### Step 3: Install Module

1. Go to **Extensions → Extensions**
2. From the dropdown, select **Modules**
3. Scroll down to find **PricePilot**
4. Click the **Install** button (green + icon)

### Step 4: Configure & Get API Token

1. After installation, click the **Edit** button (blue pencil icon)
2. You'll see the PricePilot configuration page with:
   - **Module Status:** Set to "Enabled"
   - **API Token:** Auto-generated secure token
   - **API Endpoint:** Your API URL
3. Click the **Copy** button next to the API Token
4. Click **Save** to save settings

### Step 5: Access PricePilot Menu

After installation, you'll see **PricePilot** in your left sidebar menu with a lightning bolt icon ⚡

## 🔗 Connect to PricePilot Dashboard

1. Go to your **PricePilot Dashboard** at http://localhost:3000
2. Login with your credentials
3. Go to **Integrations** page
4. Click **Add Site**
5. Select **OpenCart** as platform
6. Enter your store URL: `https://giftly.com.bd/`
7. Paste the API Token you copied
8. Click **Save**
9. Click **Sync Now** to import your products

## 🧪 Test the Installation

### Test API Manually

Open this URL in your browser (replace TOKEN with your actual token):

```
https://giftly.com.bd/index.php?route=api/pricepilot&api_token=YOUR_TOKEN_HERE
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
  "total": 735,
  "start": 0,
  "limit": 100
}
```

### Verify Image URLs

Check that the `image` field contains full URLs like:
- `https://giftly.com.bd/image/catalog/product.jpg`
- NOT `null` or empty

## 🔧 Troubleshooting

### Issue: Module Not Showing in Extensions List

**Solution:**
1. Go to Extensions → Modifications
2. Click Refresh
3. Clear browser cache
4. Refresh the Extensions page

### Issue: API Returns 401 Unauthorized

**Solution:**
1. Go to PricePilot configuration page
2. Copy the API token again
3. Make sure you're using the exact token (no extra spaces)
4. Update the token in PricePilot dashboard

### Issue: Images Still Showing NULL

**Solution:**
1. Check if products have images in OpenCart admin
2. Go to Catalog → Products → Edit a product
3. Verify the "Image" field has a value
4. If images exist but API returns NULL, the extension may not be properly installed
5. Try uninstalling and reinstalling the module

### Issue: "PricePilot" Text Without Styling

**Solution:**
1. Clear OpenCart cache:
   - Delete files in `system/storage/cache/`
   - Delete files in `system/storage/modification/`
2. Go to Extensions → Modifications → Click Refresh
3. Refresh your browser (Ctrl+F5 or Cmd+Shift+R)

### Issue: Menu Not Appearing in Sidebar

**Solution:**
1. Logout and login again to OpenCart admin
2. Check if module is installed (not just uploaded)
3. Go to Extensions → Modifications → Click Refresh

## 📊 What Gets Installed

The extension automatically creates these files:

```
admin/
├── controller/extension/module/pricepilot.php
├── language/en-gb/extension/module/pricepilot.php
└── view/template/extension/module/pricepilot.twig

catalog/
└── controller/api/pricepilot.php
```

## 🔐 Security Notes

- ✅ API token is auto-generated with 64 characters (256-bit security)
- ✅ Token is stored securely in OpenCart settings
- ✅ API validates token on every request
- ⚠️ Keep your API token secure - don't share it publicly
- ⚠️ Anyone with the token can read your product data and update prices

## 🗑️ Uninstallation

To remove PricePilot:

1. Go to **Extensions → Extensions → Modules**
2. Find **PricePilot**
3. Click **Uninstall** (red - icon)
4. Go to **Extensions → Modifications**
5. Find **PricePilot** modification
6. Click **Delete** (red trash icon)
7. Click **Refresh**

## 📞 Support

If you encounter any issues:

1. Check the troubleshooting section above
2. Verify OpenCart error logs: `system/storage/logs/error.log`
3. Test the API endpoint manually
4. Contact PricePilot support with:
   - OpenCart version
   - Error messages from logs
   - Screenshot of the issue

## 🎉 Success Checklist

After installation, verify:

- [ ] Module shows as "Installed" in Extensions → Modules
- [ ] PricePilot menu appears in left sidebar
- [ ] Configuration page displays properly with form fields
- [ ] API token is visible and can be copied
- [ ] API endpoint returns product data with images
- [ ] Products sync successfully in PricePilot dashboard
- [ ] Product images appear in PricePilot products page

---

**Version:** 2.0.0  
**Last Updated:** 2026-02-09  
**Compatibility:** OpenCart 3.x
