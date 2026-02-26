---
title: "SKU Generation Strategy"
description: "Strategies for generating and managing product SKUs"
category: "products"
tags: ["sku", "products", "strategy"]
audience: "tenant"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
---

# Smart SKU Generation Strategy

## Problem Statement

Many e-commerce stores don't populate the SKU field in their product database, making it difficult to:
- Match products accurately between user store and competitors
- Track products reliably across syncs
- Implement SKU-based pricing rules

## Solution: Intelligent SKU Generation

When the integrated website database has no SKU, our SaaS system automatically generates a smart SKU using a multi-tier fallback strategy.

## SKU Generation Strategy

The system attempts the following strategies in priority order:

### 1. Use Existing SKU (Priority 1)
```typescript
if (product.sku && product.sku.trim()) {
  return product.sku.trim();
}
```
**When**: Source system has SKU populated  
**Example**: `"NIKE-AM-270"` → `"NIKE-AM-270"`

### 2. Use Model Field (Priority 2)
```typescript
if (product.model && product.model.trim()) {
  return product.model.trim();
}
```
**When**: OpenCart/Laravel has model field populated  
**Example**: Model `"G502 Hero"` → `"G502 Hero"`  
**Why**: Model is commonly used as a product identifier in e-commerce

### 3. Generate from Brand + Model (Priority 3)
```typescript
if (brand && model) {
  return `${sanitize(brand)}-${sanitize(model)}`;
}
```
**When**: Both brand and model are available  
**Example**: Brand `"Logitech"` + Model `"G502 Hero"` → `"LOGITECH-G502HERO"`  
**Why**: Creates a meaningful, human-readable SKU

### 4. Generate from Product ID (Priority 4)
```typescript
if (productId) {
  return `PROD-${productId}`;
}
```
**When**: Product has an ID but no other identifiers  
**Example**: Product ID `"123"` → `"PROD-123"`  
**Why**: Guaranteed unique, stable across syncs

### 5. Generate from Title Hash (Priority 5 - Last Resort)
```typescript
const words = title.split(/\s+/).slice(0, 3);
const sanitized = words.map(w => sanitize(w)).join('-');
const hash = simpleHash(title).toString(36).substring(0, 6);
return `${sanitized}-${hash}`.toUpperCase();
```
**When**: Only title is available  
**Example**: Title `"Wireless Gaming Mouse Pro"` → `"WIRELESS-GAMING-MOUSE-A3F2E1"`  
**Why**: Creates a semi-readable SKU with hash for uniqueness

## SKU Sanitization

All generated SKUs are sanitized to ensure consistency:

```typescript
function sanitizeSKU(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9-]/g, '')  // Remove special characters
    .replace(/^-+|-+$/g, '')         // Remove leading/trailing hyphens
    .substring(0, 20)                // Limit length
    .toUpperCase();                  // Uppercase for consistency
}
```

**Rules**:
- Only alphanumeric characters and hyphens
- Maximum 20 characters
- Uppercase for consistency
- No leading/trailing hyphens

## Benefits

### 1. **Automatic Product Matching**
- Products can be matched even without SKU in source system
- Reduces manual matching work
- Improves accuracy of price comparisons

### 2. **Stable Product Tracking**
- Generated SKUs remain consistent across syncs
- Product history is maintained
- Price tracking works reliably

### 3. **Better User Experience**
- No "N/A" or null SKUs in UI
- Products are identifiable
- Easier to understand product relationships

### 4. **Flexible Integration**
- Works with any e-commerce platform
- Handles missing data gracefully
- No configuration required

## Implementation Details

### Location
`lib/services/sync.ts` - `SyncService.generateSmartSKU()`

### Applied To
- OpenCart product sync
- Laravel product sync
- All future platform integrations

### Database Impact
- SKU is stored in `Product.sku` field
- Nullable field (can still be null if no data available)
- Indexed for fast lookups

## Examples

### Example 1: OpenCart with Model
```json
{
  "product_id": "42",
  "name": "Wireless Gaming Mouse",
  "model": "G502-HERO",
  "manufacturer": "Logitech",
  "sku": ""
}
```
**Generated SKU**: `"G502-HERO"` (Strategy 2: Use Model)

### Example 2: Laravel with Brand + Model
```json
{
  "id": "15",
  "name": "MacBook Pro 16 inch",
  "brand": "Apple",
  "model": "MBP16-2024",
  "sku": null
}
```
**Generated SKU**: `"APPLE-MBP162024"` (Strategy 3: Brand + Model)

### Example 3: Generic Product
```json
{
  "id": "99",
  "name": "USB-C Cable 2m",
  "sku": null
}
```
**Generated SKU**: `"PROD-99"` (Strategy 4: Product ID)

### Example 4: Title Only
```json
{
  "name": "Premium Wireless Headphones with Noise Cancellation",
  "sku": null
}
```
**Generated SKU**: `"PREMIUM-WIRELESS-HEADPHONES-7A3B9F"` (Strategy 5: Title Hash)

## Best Practices

### For Users
1. **Populate SKU in your store** - This is always the best option
2. **Use Model field** - If SKU isn't available, populate Model
3. **Consistent naming** - Use consistent product names for better matching

### For Developers
1. **Don't override existing SKUs** - Always check if SKU exists first
2. **Log SKU generation** - Track which strategy was used
3. **Test edge cases** - Empty strings, special characters, very long titles

## Monitoring

### Metrics to Track
- Percentage of products with original SKU vs generated
- Which generation strategy is most commonly used
- SKU collision rate (if any)

### Logging
```typescript
console.log(`[SKU Generation] Strategy used: ${strategy}`);
console.log(`[SKU Generation] Original: ${original} → Generated: ${generated}`);
```

## Future Enhancements

### Potential Improvements
1. **ML-based SKU extraction** - Extract SKU from product title using patterns
2. **Competitor SKU matching** - Use competitor SKUs when available
3. **User-defined patterns** - Allow users to define SKU generation rules
4. **SKU validation** - Check for duplicates and suggest alternatives

### Platform-Specific Strategies
- **Shopify**: Use variant SKU or product handle
- **WooCommerce**: Use product slug
- **Magento**: Use product attribute code

## Troubleshooting

### Issue: Duplicate SKUs
**Cause**: Multiple products with same model or title  
**Solution**: System falls back to Product ID strategy

### Issue: SKU too long
**Cause**: Very long model names or titles  
**Solution**: Sanitization limits to 20 characters

### Issue: Special characters in SKU
**Cause**: Source data contains special characters  
**Solution**: Sanitization removes all non-alphanumeric except hyphens

## Related Documentation
- [Product Matching Logic](./RESULT_SELECTION_LOGIC.md)
- [Sync Service](./ARCHITECTURE.md#sync-service)
- [Database Schema](../prisma/schema.prisma)
