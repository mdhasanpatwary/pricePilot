---
title: "Product Setup Guide"
description: "Learn how to manage and configure your products in PricePilot"
category: "products"
subcategory: null
tags: ["products", "setup", "configuration", "sync"]
author: "PricePilot Team"
lastReviewed: "2024-01-15"
relatedDocs: ["product-matching", "quick-start"]
---

# Product Setup Guide

Learn how to effectively manage your product catalog in PricePilot.

## Product Synchronization

PricePilot automatically syncs products from your connected e-commerce platform.

### Automatic Sync
- **Frequency**: Every hour
- **What's synced**: SKU, name, brand, model, current price
- **Status**: View sync status in the Products dashboard

### Manual Sync
Trigger a manual sync anytime:

1. Navigate to **Products** → **My Products**
2. Click **Sync Now** button
3. Wait for sync to complete (usually 1-2 minutes)

## Product Fields

Each product in PricePilot contains:

| Field | Description | Required |
|-------|-------------|----------|
| SKU | Unique product identifier | Yes |
| Name | Product title | Yes |
| Brand | Manufacturer/brand name | Recommended |
| Model | Model number | Recommended |
| Current Price | Your current selling price | Yes |
| Min Price | Minimum allowed price (safety) | Optional |

## Setting Price Constraints

Protect your margins by setting price constraints:

### Minimum Price Floor
Set the lowest price you're willing to sell at:

```typescript
// Example: Set minimum price to $50
product.minPrice = 50.00;
```

This prevents PricePilot from updating prices below this threshold.

### Maximum Discount Limit
Set the maximum discount percentage:

```typescript
// Example: Never discount more than 20%
product.maxDiscount = 0.20; // 20%
```

## Product Status

Products can have different statuses:

- **Active**: Product is being tracked and can be updated
- **Inactive**: Product is not being tracked
- **Out of Stock**: Product is temporarily unavailable
- **Discontinued**: Product is no longer sold

## Best Practices

### 1. Keep SKUs Consistent
Ensure your SKUs match across your store and competitor sites for accurate matching.

### 2. Set Realistic Constraints
Set minimum prices that protect your margins while staying competitive.

### 3. Regular Reviews
Review your product catalog weekly to ensure accuracy.

### 4. Use Brand and Model
Always include brand and model information for better matching accuracy.

## Troubleshooting

### Products Not Syncing?
- Verify your API token is valid
- Check your store's API is accessible
- Review sync logs for errors

### Missing Product Information?
- Ensure products have all required fields in your store
- Check that products are published and active
- Verify product visibility settings

## Next Steps

- Learn about [Product Matching](product-matching)
- Set up [Competitor Tracking](../competitors/adding-competitors)
- Configure [Price Updates](../pricing/price-updates)
