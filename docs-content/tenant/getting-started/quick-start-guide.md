---
title: "Quick Start Guide"
description: "Get up and running with PricePilot in 5 minutes - minimal steps to see your first results"
category: "getting-started"
tags: ["quick-start", "tutorial", "setup", "beginner"]
audience: "tenant"
---

# Quick Start Guide

Get PricePilot up and running in just 5 minutes! This guide covers the absolute essentials to see your first competitive price comparison.

## Prerequisites

Before you start, make sure you have:

- ✅ A PricePilot account
- ✅ An OpenCart or Laravel e-commerce store
- ✅ Admin access to your store
- ✅ At least one competitor website URL

## Step 1: Connect Your Store (2 minutes)

### For OpenCart Users

1. Download the PricePilot OpenCart module
2. Install via Extensions → Installer
3. Enable the module
4. Copy your API token from PricePilot dashboard
5. Paste the token in module settings

**Quick command:**
```bash
# Upload pricepilot-opencart.ocmod.zip via admin panel
# Navigate to: Extensions → Extensions → Modules → PricePilot
```

### For Laravel Users

1. Install via Composer:
```bash
composer require pricepilot/laravel-integration
```

2. Publish configuration:
```bash
php artisan vendor:publish --provider="PricePilot\ServiceProvider"
```

3. Add your API token to `.env`:
```env
PRICEPILOT_API_TOKEN=your_token_here
```

4. Run migration:
```bash
php artisan migrate
```

**Done!** Your store is now connected.

## Step 2: Sync Products (1 minute)

1. Go to **Products** in PricePilot dashboard
2. Click **Sync Now**
3. Wait for sync to complete (usually 10-30 seconds)

You should see your products appear in the list.

**Tip:** PricePilot syncs automatically every hour, but you can manually sync anytime.

## Step 3: Add a Competitor (1 minute)

1. Go to **Competitors** section
2. Click **Add Competitor**
3. Enter competitor details:
   - **Name**: e.g., "TechStore"
   - **Website URL**: e.g., "https://techstore.com"
   - **Category**: Select relevant category
4. Click **Save**

PricePilot will start scraping competitor prices immediately.

**Tip:** Start with just one competitor to see results quickly.

## Step 4: Wait for First Scrape (1 minute)

PricePilot is now scraping your competitor's website. This usually takes 1-2 minutes for the first scrape.

You can monitor progress in the **Competitors** section:
- 🟡 **Scraping** - In progress
- 🟢 **Complete** - Finished successfully
- 🔴 **Error** - Issue encountered

## Step 5: View Price Comparison (30 seconds)

1. Go to **Price Comparison** section
2. You'll see a table with:
   - Your products
   - Competitor prices
   - Price differences
   - Status indicators (🔴 RED = competitor lower, 🟢 GREEN = you're lower)

**That's it!** You're now tracking competitor prices.

## What's Next?

Now that you have basic tracking set up:

### Immediate Actions

1. **Review Matches** - Check that products are matched correctly
   - Go to **Product Matching**
   - Review confidence scores
   - Adjust any incorrect matches

2. **Set Price Floors** - Protect your margins
   - Go to **Products**
   - Set minimum prices for each product
   - This prevents accidental under-pricing

3. **Add More Competitors** - Get better insights
   - Add 2-3 more competitor websites
   - More data = better pricing decisions

### Learn More

- **[Product Matching Guide](/docs/products/product-matching)** - Improve match accuracy
- **[Price Update Strategies](/docs/pricing/update-strategies)** - Learn pricing strategies
- **[Price Approval Guide](/docs/pricing/price-approval-guide)** - Set up approval workflows

### Make Your First Price Update

Ready to update prices? Here's how:

1. Go to **Price Comparison**
2. Select products where competitors are lower (🔴 RED)
3. Click **Bulk Update**
4. Choose strategy:
   - **Match competitor** - Set same price
   - **Undercut by $X** - Go $X below competitor
   - **Undercut by X%** - Go X% below competitor
5. Preview changes
6. Click **Apply**

**Safety First:** Always preview changes before applying!

## Common First-Time Issues

### Products Not Syncing?

- Check API token is correct
- Verify module/package is enabled
- Check firewall isn't blocking requests
- See [Troubleshooting Guide](/docs/troubleshooting/common-issues)

### Competitor Scraping Failed?

- Verify competitor URL is correct
- Some sites have bot protection (we handle most cases)
- Try a different competitor first
- See [Scraping Configuration](/docs/competitors/scraping-configuration)

### Products Not Matching?

- Ensure SKUs are consistent
- Check brand and model fields are filled
- Use manual matching for difficult cases
- See [Product Matching](/docs/products/product-matching)

## Tips for Success

1. **Start Small** - Begin with 1 competitor and 10-20 products
2. **Review Matches** - Always verify automatic matches
3. **Set Safety Limits** - Configure minimum prices before updating
4. **Monitor Results** - Check analytics after price updates
5. **Iterate** - Adjust strategies based on results

## Need Help?

- 📖 [Full Getting Started Guide](/docs/getting-started/getting-started)
- 🔧 [Troubleshooting](/docs/troubleshooting/common-issues)
- ❓ [FAQ](/docs/troubleshooting/faq)
- 💬 Contact support via dashboard

## Summary

You've completed the quick start! You now have:

- ✅ Connected your store
- ✅ Synced your products
- ✅ Added a competitor
- ✅ Viewed price comparisons

**Time to completion:** ~5 minutes

Next, explore the full features of PricePilot to maximize your competitive advantage! 🎯
