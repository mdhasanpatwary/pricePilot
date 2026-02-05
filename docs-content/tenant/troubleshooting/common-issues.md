---
title: "Common Issues and Solutions"
description: "Troubleshooting guide for common PricePilot issues"
category: "troubleshooting"
subcategory: null
tags: ["troubleshooting", "issues", "solutions", "help"]
author: "PricePilot Team"
lastReviewed: "2024-01-15"
relatedDocs: ["faq", "opencart-setup", "laravel-setup"]
---

# Common Issues and Solutions

Quick solutions to common PricePilot issues.

## Connection Issues

### Store Connection Failed

**Symptoms:**
- "Connection failed" error
- Products not syncing
- API timeout errors

**Solutions:**

1. **Verify API Token**
```bash
# Check token is correct
# Regenerate if needed
```

2. **Check Store URL**
```typescript
// Ensure URL is correct and accessible
storeUrl: "https://yourstore.com" // ✓ Correct
storeUrl: "http://yourstore.com"  // ✗ Use HTTPS
storeUrl: "yourstore.com"         // ✗ Missing protocol
```

3. **Test Store Accessibility**
```bash
# Verify store is online
curl -I https://yourstore.com/api/pricepilot/products
```

4. **Check Firewall Rules**
- Whitelist PricePilot IP addresses
- Allow outbound HTTPS connections
- Verify no rate limiting blocking requests

### Competitor Scraping Failed

**Symptoms:**
- "Scraping failed" error
- No competitor products found
- Stale competitor data

**Solutions:**

1. **Verify Competitor URL**
```typescript
// Check URL is accessible
baseUrl: "https://competitor.com" // ✓ Correct
baseUrl: "competitor.com"         // ✗ Missing protocol
```

2. **Check Rate Limiting**
```typescript
// Reduce scraping frequency
rateLimit: 5 // requests per minute (conservative)
```

3. **Review Scraping Logs**
- Go to **Competitors** → **Scraping Logs**
- Check for error messages
- Look for patterns in failures

4. **Enable Proxy (Premium)**
```typescript
{
  useProxy: true,
  proxyRotation: "automatic"
}
```

## Product Issues

### Products Not Syncing

**Symptoms:**
- Product count is 0
- Products missing from list
- Sync stuck at "In Progress"

**Solutions:**

1. **Trigger Manual Sync**
```bash
# Go to Products → My Products
# Click "Sync Now"
# Wait 2-3 minutes
```

2. **Check Product Status in Store**
- Ensure products are published
- Verify products are active
- Check products have required fields (SKU, name, price)

3. **Review Sync Logs**
```typescript
// Check for errors
{
  status: "failed",
  error: "Product missing required field: sku",
  productId: "123"
}
```

4. **Verify API Permissions**
- Ensure API token has product read permissions
- Check token hasn't expired
- Regenerate token if needed

### Product Matching Issues

**Symptoms:**
- No matches found
- Too many false matches
- Low confidence scores

**Solutions:**

1. **Improve Product Data**
```typescript
// Add missing fields
{
  sku: "PROD-001",      // ✓ Required
  brand: "Dell",        // ✓ Recommended
  model: "XPS 15",      // ✓ Recommended
  name: "Dell XPS 15"   // ✓ Required
}
```

2. **Use Manual Matching**
- Go to **Products** → **Product Matching**
- Find unmatched products
- Click **Manual Match**
- Select correct competitor product

3. **Standardize SKUs**
```typescript
// Use consistent format
"LAPTOP-DELL-XPS15"  // ✓ Consistent
"laptop_dell_xps15"  // ✗ Inconsistent
```

4. **Review Match Confidence**
```typescript
// Accept high confidence matches
if (match.confidence >= 90) {
  acceptMatch();
}

// Review medium confidence
if (match.confidence >= 70 && match.confidence < 90) {
  reviewMatch();
}

// Reject low confidence
if (match.confidence < 70) {
  rejectMatch();
}
```

## Price Update Issues

### Price Update Failed

**Symptoms:**
- "Update failed" error
- Prices not changing in store
- Update stuck at "Pending"

**Solutions:**

1. **Check Safety Constraints**
```typescript
// Verify constraints aren't blocking update
{
  newPrice: 250,
  minPrice: 300,  // ✗ Blocking update
  // Solution: Adjust minPrice or increase newPrice
}
```

2. **Verify Product Exists**
- Ensure product still exists in store
- Check product ID is correct
- Verify product is active

3. **Check API Connection**
```bash
# Test store API
curl -X POST https://yourstore.com/api/pricepilot/products/update \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"updates":[{"id":"123","price":99.99}]}'
```

4. **Review Update Logs**
- Go to **Pricing** → **Update History**
- Check error messages
- Look for patterns

### Wrong Price Applied

**Symptoms:**
- Price different than expected
- Calculation seems incorrect
- Unexpected price changes

**Solutions:**

1. **Use Rollback**
```typescript
// Immediately rollback incorrect update
rollback(updateId);
```

2. **Verify Strategy Settings**
```typescript
// Check strategy was correct
{
  strategy: "percentage",
  value: 0.05,  // 5% - verify this is what you wanted
  competitorPrice: 100,
  expectedNewPrice: 95  // 100 * 0.95
}
```

3. **Check Competitor Data**
- Verify competitor price is current
- Refresh competitor data
- Check scraping timestamp

4. **Preview Before Confirming**
- Always use preview feature
- Verify calculations
- Check all products before bulk update

## Performance Issues

### Slow Dashboard Loading

**Symptoms:**
- Dashboard takes >5 seconds to load
- Timeouts on large product lists
- Slow search results

**Solutions:**

1. **Use Pagination**
```typescript
// Load products in pages
{
  page: 1,
  limit: 20  // Don't load all products at once
}
```

2. **Apply Filters**
```typescript
// Filter to reduce data
{
  status: "active",
  category: "electronics"
}
```

3. **Clear Browser Cache**
```bash
# Clear cache and reload
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)
```

4. **Check Network Connection**
- Verify internet speed
- Check for network issues
- Try different browser

### Slow Price Updates

**Symptoms:**
- Updates take >1 minute
- Bulk updates timeout
- "Processing" status for extended time

**Solutions:**

1. **Reduce Batch Size**
```typescript
// Update in smaller batches
batchSize: 50  // Instead of 500
```

2. **Check Store Performance**
- Verify store API is responsive
- Check store server load
- Contact hosting provider if needed

3. **Schedule Updates**
```typescript
// Schedule during off-peak hours
scheduleUpdate({
  time: "02:00",  // 2 AM
  timezone: "UTC"
});
```

## Authentication Issues

### Login Failed

**Symptoms:**
- "Invalid credentials" error
- Account locked
- Password reset not working

**Solutions:**

1. **Reset Password**
- Click "Forgot Password"
- Check email for reset link
- Create new strong password

2. **Check Account Status**
- Verify account is active
- Check subscription status
- Contact support if suspended

3. **Clear Cookies**
```bash
# Clear browser cookies
# Try incognito/private mode
```

### API Token Invalid

**Symptoms:**
- "Invalid token" error
- "Token expired" message
- Authentication failures

**Solutions:**

1. **Regenerate Token**
- Go to **Settings** → **Integrations**
- Click **Regenerate Token**
- Update token in your store

2. **Check Token Format**
```typescript
// Correct format
"Bearer pp_live_1234567890abcdef"

// Incorrect formats
"pp_live_1234567890abcdef"  // Missing "Bearer"
"Bearer: pp_live_..."       // Extra colon
```

3. **Verify Token Permissions**
- Ensure token has required permissions
- Check token scope
- Regenerate with correct permissions

## Data Issues

### Missing Product Information

**Symptoms:**
- Products missing brand/model
- Empty SKU fields
- Incomplete product data

**Solutions:**

1. **Update Source Data**
- Add missing fields in your store
- Ensure all required fields populated
- Trigger resync

2. **Manual Data Entry**
- Edit product in PricePilot
- Add missing information
- Save changes

3. **Bulk Import**
```csv
# Use CSV import for bulk updates
sku,brand,model,name
PROD-001,Dell,XPS 15,Dell XPS 15 Laptop
```

### Incorrect Price History

**Symptoms:**
- Price history shows wrong values
- Missing price records
- Duplicate entries

**Solutions:**

1. **Verify Data Source**
- Check store price history
- Compare with competitor data
- Look for sync issues

2. **Manual Correction**
- Contact support for data correction
- Provide correct price history
- Request database update

## Getting More Help

### Before Contacting Support

Gather this information:

```typescript
{
  issue: "Description of the problem",
  stepsToReproduce: [
    "Step 1",
    "Step 2",
    "Step 3"
  ],
  expectedBehavior: "What should happen",
  actualBehavior: "What actually happens",
  errorMessages: "Any error messages",
  screenshots: "Screenshots if applicable",
  environment: {
    platform: "OpenCart 4.0",
    browser: "Chrome 120",
    timestamp: "2024-01-15T10:30:00Z"
  }
}
```

### Contact Options

- **Email**: support@pricepilot.com
- **Live Chat**: Available in dashboard
- **Documentation**: Check [FAQ](faq)
- **Community**: Join our user forum

### Response Times

| Priority | Response Time |
|----------|---------------|
| Critical | 1 hour |
| High | 4 hours |
| Medium | 24 hours |
| Low | 48 hours |

## Next Steps

- Review [FAQ](faq) for quick answers
- Check [OpenCart Setup](../integrations/opencart-setup) guide
- Read [Laravel Setup](../integrations/laravel-setup) guide
- Contact support for personalized help
