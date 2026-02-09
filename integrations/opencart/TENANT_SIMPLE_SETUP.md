# 🚀 PricePilot Setup for OpenCart - 3 Minutes!

## What You Need
- OpenCart admin access
- Basic FTP access (or cPanel File Manager)

---

## Step 1: Upload ONE File (2 minutes)

### Download File
Download: `pricepilot-simple.php` (provided by PricePilot)

### Upload via FTP:
1. Connect to your server via FTP
2. Navigate to OpenCart root directory
3. Go to `api/` folder (create if doesn't exist)
4. Upload `pricepilot-simple.php`
5. Rename it to: `pricepilot.php`

**Final location:** `/api/pricepilot.php`

### Or via cPanel:
1. Login to cPanel → File Manager
2. Navigate to OpenCart root → `api/` folder
3. Upload `pricepilot-simple.php`
4. Rename to `pricepilot.php`

---

## Step 2: Enable API in OpenCart (1 minute)

1. OpenCart Admin → **System → Users → API**
2. Click **Add New** (blue + button)
3. Fill in:
   - **Username:** `pricepilot`
   - **Status:** ✅ Enabled
4. Click **Generate** button (creates API Key automatically)
5. **COPY the API Key** (long string of characters)
6. Click **Save**

### Add IP Whitelist:
1. Still in API settings, go to **IP Addresses** tab
2. Click **Add IP**
3. Enter: `0.0.0.0` (allows all IPs)
4. Click **Save**

---

## Step 3: Connect to PricePilot (30 seconds)

1. Go to **PricePilot Dashboard**
2. Click **Add Site** or **Integrations**
3. Select **OpenCart**
4. Enter:
   - **Store URL:** `https://yourstore.com`
   - **API Token:** (paste the key you copied)
5. Click **Save**
6. Click **Sync Now**

---

## ✅ Done!

Your products will now sync automatically with:
- ✅ Product images
- ✅ Brand/Manufacturer names
- ✅ Model numbers
- ✅ SKU codes
- ✅ Current prices
- ✅ Stock quantities

---

## Test Your Setup

Visit this URL in your browser (replace with your details):
```
https://yourstore.com/api/pricepilot.php?api_token=YOUR_TOKEN&action=products
```

You should see JSON response with your products!

---

## Troubleshooting

### Error: "Invalid API token"
- Check if API is enabled in OpenCart admin
- Verify you copied the correct token
- Make sure IP `0.0.0.0` is whitelisted

### Error: "File not found"
- Verify file is uploaded to `/api/pricepilot.php`
- Check file permissions (should be 644)

### No images in response
- Check if products have images in OpenCart
- Verify image paths in OpenCart admin

---

## Support

Need help? Contact PricePilot support with:
- Your store URL
- Screenshot of any error messages
- OpenCart version

---

**Total Setup Time:** 3 minutes  
**Technical Skill Required:** Basic (upload 1 file)  
**Maintenance:** None - it just works!
