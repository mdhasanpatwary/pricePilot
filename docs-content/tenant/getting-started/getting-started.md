---
title: "Getting Started with PricePilot"
description: "Complete introduction to PricePilot - learn the basics and get started with competitive price intelligence"
category: "getting-started"
tags: ["getting-started", "introduction", "basics", "tutorial"]
audience: "tenant"
---

# Getting Started with PricePilot

Welcome to PricePilot! This guide will help you understand the basics and get started with competitive price intelligence for your e-commerce store.

## What is PricePilot?

PricePilot is a multi-tenant SaaS platform that helps e-commerce merchants:

- **Track competitor prices** automatically
- **Match products** across different stores
- **Update prices** strategically to stay competitive
- **Monitor performance** with comprehensive analytics

## Key Concepts

### Products

Your products are the items you sell in your store. PricePilot syncs with your e-commerce platform (OpenCart or Laravel) to automatically import your product catalog.

**Key Product Information:**
- SKU (Stock Keeping Unit)
- Product name
- Brand and model
- Current price
- Minimum price (safety constraint)

### Competitors

Competitors are other online stores selling similar products. You can add competitor websites to track their prices.

**Competitor Tracking:**
- Add competitor URLs
- Automatic price scraping every 24 hours
- Historical price data
- Price change alerts

### Product Matching

Product matching connects your products with competitor products. PricePilot uses multiple strategies:

1. **SKU Match** - Exact SKU matching (highest confidence)
2. **Brand + Model Match** - Matching by brand and model number
3. **Fuzzy Title Match** - Intelligent title comparison
4. **Manual Override** - You can manually match products

### Price Updates

Once products are matched, you can update your prices based on competitor data:

- **Fixed Undercut** - Set your price $X below competitor
- **Percentage Undercut** - Set your price X% below competitor
- **Safety Constraints** - Minimum price floors to protect margins
- **Bulk Updates** - Update multiple products at once

## Your First Steps

### 1. Connect Your Store

First, integrate PricePilot with your e-commerce platform:

- **OpenCart**: Install the PricePilot module
- **Laravel**: Install the PricePilot package

See [OpenCart Setup](/docs/integrations/opencart-setup) or [Laravel Setup](/docs/integrations/laravel-setup) for detailed instructions.

### 2. Sync Your Products

After connecting your store, PricePilot will automatically sync your product catalog. You can:

- View all synced products
- Check sync status
- Manually trigger re-sync if needed

### 3. Add Competitors

Add competitor websites you want to track:

1. Go to the Competitors section
2. Click "Add Competitor"
3. Enter the competitor's website URL
4. Configure scraping settings

Competitor prices are automatically scraped every 24 hours to keep your data fresh.

See [Adding Competitors](/docs/competitors/adding-competitors) for more details.

### 4. Match Products

Review and confirm product matches:

- PricePilot suggests matches automatically
- Review match confidence scores
- Accept, reject, or manually adjust matches
- Higher confidence = more accurate matching

See [Product Matching](/docs/products/product-matching) for more information.

### 5. Monitor Prices

Once products are matched, you can:

- View price comparisons in a table
- See which products are priced higher/lower than competitors
- Track price history over time
- Set up price alerts

### 6. Update Prices

When you're ready to update prices:

1. Select products to update
2. Choose your pricing strategy
3. Preview changes
4. Apply updates
5. Monitor results

See [Price Updates](/docs/pricing/price-updates) for detailed guidance.

## Understanding the Dashboard

Your PricePilot dashboard shows:

- **Overview** - Key metrics and recent activity
- **Products** - Your product catalog and sync status
- **Competitors** - Competitor websites and scraping status
- **Price Comparison** - Side-by-side price comparison table
- **Updates** - Price update history and pending changes
- **Analytics** - Performance metrics and insights

## Safety Features

PricePilot includes several safety features:

- **Minimum Price Floors** - Prevent prices from going too low
- **Maximum Discount Limits** - Cap how much you can discount
- **Preview Before Apply** - Review all changes before applying
- **Rollback Capability** - Undo price changes if needed
- **Audit Trail** - Complete history of all price changes

## Getting Help

If you need assistance:

- Check the [Troubleshooting Guide](/docs/troubleshooting/common-issues)
- Review the [FAQ](/docs/troubleshooting/faq)
- Contact support through the dashboard
- Join our community forum

## Next Steps

Now that you understand the basics:

1. Follow the [Quick Start Guide](/docs/getting-started/quick-start) for a 5-minute setup
2. Learn about [Product Setup](/docs/products/product-setup)
3. Explore [Price Approval Workflows](/docs/pricing/price-approval-guide)
4. Set up [Integration with your platform](/docs/integrations/opencart-setup)

Welcome to PricePilot - let's make your pricing competitive! 🚀
