# Install PricePilot on Your OpenCart Store

## Quick Start (5 Minutes)

### 1️⃣ Download the Extension

Download `pricepilot.ocmod.zip` from your PricePilot dashboard or from the link provided.

### 2️⃣ Install in OpenCart

1. Login to your OpenCart admin panel
2. Go to **Extensions → Installer**
3. Click **Upload** and select `pricepilot.ocmod.zip`
4. Go to **Extensions → Modifications** → Click **Refresh**
5. Go to **Extensions → Extensions** → Select **Modules**
6. Find **PricePilot** → Click **Install**
7. Click **Edit** to open configuration

### 3️⃣ Copy Your API Token

1. On the PricePilot configuration page, you'll see your **API Token**
2. Click the **Copy** button
3. Click **Save**

### 4️⃣ Connect to PricePilot

1. Go back to your **PricePilot Dashboard**
2. Go to **Integrations** page
3. Click **Add Site**
4. Select **OpenCart**
5. Enter your store URL (e.g., `https://yourstore.com`)
6. Paste the API Token
7. Click **Save**
8. Click **Sync Now**

### ✅ Done!

Your products will now sync automatically. You can:
- View all products in the Products page
- Compare prices with competitors
- Update prices automatically
- Track price history

## Need Help?

- 📖 Read the full [Installation Guide](INSTALLATION_GUIDE.md)
- 🐛 Check [Troubleshooting](#troubleshooting) section
- 💬 Contact support from your PricePilot dashboard

## Troubleshooting

### API Returns "Invalid Token"

1. Go to OpenCart admin → PricePilot configuration
2. Copy the token again (make sure no extra spaces)
3. Update in PricePilot dashboard

### Products Not Syncing

1. Test the API manually: `https://yourstore.com/index.php?route=api/pricepilot&api_token=YOUR_TOKEN`
2. Check if you see product data
3. If you see an error, check OpenCart error logs

### Images Not Showing

1. Verify products have images in OpenCart
2. Check the API response includes image URLs
3. Re-sync products in PricePilot

---

**Simple. Fast. Automated Price Management.**
