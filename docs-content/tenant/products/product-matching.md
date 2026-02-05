---
title: "Product Matching Guide"
description: "Understand how PricePilot matches your products with competitor products"
category: "products"
subcategory: null
tags: ["products", "matching", "algorithm", "sku"]
author: "PricePilot Team"
lastReviewed: "2024-01-15"
relatedDocs: ["product-setup", "adding-competitors"]
---

# Product Matching Guide

Learn how PricePilot's intelligent matching engine connects your products with competitor products.

## Matching Strategies

PricePilot uses multiple strategies to match products, in priority order:

### 1. SKU Exact Match (Highest Priority)
The most reliable matching method:

```typescript
// Example: Exact SKU match
yourProduct.sku === competitorProduct.sku
// "LAPTOP-XPS-15" === "LAPTOP-XPS-15" ✓
```

**Confidence**: 100%

### 2. Brand + Model Match
Matches based on brand and model combination:

```typescript
// Example: Brand + Model match
yourProduct.brand === competitorProduct.brand &&
yourProduct.model === competitorProduct.model
// "Dell" + "XPS 15" === "Dell" + "XPS 15" ✓
```

**Confidence**: 90-95%

### 3. Fuzzy Title Match
Intelligent text matching for similar titles:

```typescript
// Example: Fuzzy match
similarity(yourProduct.name, competitorProduct.name) > 0.85
// "Dell XPS 15 Laptop" ≈ "Dell XPS-15 Notebook" ✓
```

**Confidence**: 70-85%

### 4. Manual Override
You can manually match products:

1. Go to **Products** → **Product Matching**
2. Find unmatched products
3. Click **Manual Match**
4. Select the competitor product
5. Confirm the match

**Confidence**: 100% (user-verified)

## Match Confidence Levels

Each match has a confidence score:

| Confidence | Color | Meaning |
|------------|-------|---------|
| 90-100% | 🟢 Green | High confidence - automatic match |
| 70-89% | 🟡 Yellow | Medium confidence - review recommended |
| Below 70% | 🔴 Red | Low confidence - manual review required |

## Reviewing Matches

### Automatic Matches
PricePilot automatically matches products with confidence ≥ 90%:

1. Navigate to **Products** → **Product Matching**
2. Filter by **Auto-Matched**
3. Review the matches
4. Reject incorrect matches if needed

### Suggested Matches
Review suggested matches with confidence 70-89%:

1. Navigate to **Products** → **Product Matching**
2. Filter by **Suggested Matches**
3. Review each suggestion
4. Accept or reject the match

### Unmatched Products
Handle products with no matches:

1. Navigate to **Products** → **Product Matching**
2. Filter by **Unmatched**
3. Try manual matching
4. Or mark as "No Competitor Product"

## Match Actions

### Accept a Match
Confirm a suggested match:

```typescript
// Accept match
match.status = 'accepted';
match.confidence = 100;
```

### Reject a Match
Reject an incorrect match:

```typescript
// Reject match
match.status = 'rejected';
// Product returns to unmatched pool
```

### Update a Match
Change an existing match:

1. Find the matched product
2. Click **Change Match**
3. Select new competitor product
4. Confirm the change

## Matching Best Practices

### 1. Standardize SKUs
Use consistent SKU formats across your catalog:

```typescript
// Good: Consistent format
"LAPTOP-DELL-XPS15-001"
"LAPTOP-HP-ENVY13-002"

// Bad: Inconsistent format
"laptop_dell_xps15"
"HP-ENVY-13"
```

### 2. Include Brand and Model
Always populate brand and model fields:

```typescript
product.brand = "Dell";
product.model = "XPS 15 9520";
```

### 3. Review Low Confidence Matches
Always review matches with confidence < 90%:

```typescript
if (match.confidence < 90) {
  // Manual review required
  requiresReview = true;
}
```

### 4. Regular Audits
Audit your matches monthly:
- Check for new unmatched products
- Verify existing matches are still accurate
- Update matches as product catalogs change

## Troubleshooting

### No Matches Found?

**Possible causes:**
- Competitor doesn't carry the product
- SKU/brand/model mismatch
- Product name too different

**Solutions:**
- Verify competitor has the product
- Check SKU consistency
- Try manual matching
- Update product information

### Too Many False Matches?

**Possible causes:**
- Generic product names
- Missing brand/model information
- Similar but different products

**Solutions:**
- Add brand and model information
- Use manual matching
- Reject incorrect matches
- Improve SKU consistency

### Match Disappeared?

**Possible causes:**
- Competitor product out of stock
- Competitor removed product
- Match was rejected

**Solutions:**
- Check competitor website
- Review match history
- Re-match if product returns

## Match Statistics

View matching performance:

```typescript
// Example statistics
{
  totalProducts: 1000,
  matched: 850,        // 85%
  unmatched: 150,      // 15%
  autoMatched: 750,    // 75%
  manualMatched: 100,  // 10%
  avgConfidence: 92    // 92%
}
```

## Next Steps

- Set up [Price Updates](../pricing/price-updates)
- Learn about [Update Strategies](../pricing/update-strategies)
- Review [Troubleshooting Guide](../troubleshooting/common-issues)
