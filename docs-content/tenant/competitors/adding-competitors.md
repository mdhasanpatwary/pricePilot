---
title: "Adding Competitors"
description: "Learn how to add and configure competitor websites for price tracking"
category: "competitors"
subcategory: null
tags: ["competitors", "setup", "scraping", "tracking"]
author: "PricePilot Team"
lastReviewed: "2024-01-15"
relatedDocs: ["scraping-configuration", "product-matching"]
---

# Adding Competitors

Learn how to add competitor websites and configure price tracking.

## Adding a Competitor Website

### Step 1: Navigate to Competitors
1. Go to **Competitors** → **Add Competitor**
2. You'll see the competitor setup form

### Step 2: Enter Basic Information

```typescript
{
  name: "Competitor Name",
  baseUrl: "https://competitor.com",
  status: "active"
}
```

| Field | Description | Required |
|-------|-------------|----------|
| Name | Friendly name for the competitor | Yes |
| Base URL | Competitor's website URL | Yes |
| Status | Active or Inactive | Yes |

### Step 3: Configure Scraping Settings

PricePilot automatically detects most website structures, but you can customize:

- **Scraping Frequency**: How often to check prices (hourly, daily, weekly)
- **Rate Limiting**: Requests per minute (default: 10)
- **User Agent**: Browser identification (default: automatic)

### Step 4: Test Connection

Before saving, test the connection:

```bash
# PricePilot will attempt to:
1. Access the competitor website
2. Detect the site structure
3. Find product listings
4. Extract sample prices
```

If successful, you'll see a ✓ confirmation.

### Step 5: Save and Start Tracking

Click **Save Competitor** to begin tracking. PricePilot will:
- Start scraping products within 5 minutes
- Match products automatically
- Update price comparisons hourly

## Competitor Status

Competitors can have different statuses:

| Status | Description | Scraping |
|--------|-------------|----------|
| Active | Competitor is being tracked | ✓ Yes |
| Inactive | Temporarily paused | ✗ No |
| Error | Scraping issues detected | ⚠ Retry |

## Managing Competitors

### Edit Competitor Settings
1. Go to **Competitors** → **My Competitors**
2. Click on the competitor name
3. Update settings
4. Save changes

### Pause Tracking
Temporarily stop tracking a competitor:

```typescript
competitor.status = 'inactive';
// Scraping stops, but data is preserved
```

### Delete Competitor
Permanently remove a competitor:

⚠️ **Warning**: This will delete all competitor products and price history.

1. Go to **Competitors** → **My Competitors**
2. Click **Delete** next to the competitor
3. Confirm deletion

## Best Practices

### 1. Respect Rate Limits
Don't scrape too aggressively:

```typescript
// Good: Reasonable rate
rateLimit: 10 // requests per minute

// Bad: Too aggressive
rateLimit: 100 // May get blocked
```

### 2. Monitor Scraping Health
Check scraping status regularly:
- View last scrape time
- Check error logs
- Monitor success rate

### 3. Update URLs
If competitor changes their website:
1. Update the base URL
2. Test connection
3. Verify products still scrape correctly

### 4. Add Multiple Competitors
Track 3-5 key competitors for best results:

```typescript
competitors = [
  "Main Competitor",
  "Budget Alternative",
  "Premium Option",
  "Local Competitor",
  "Online Giant"
];
```

## Troubleshooting

### Competitor Not Scraping?

**Possible causes:**
- Website blocking automated access
- Invalid URL
- Website structure changed
- Rate limit exceeded

**Solutions:**
- Verify URL is accessible
- Check scraping logs
- Adjust rate limiting
- Contact support for help

### No Products Found?

**Possible causes:**
- Website uses JavaScript rendering
- Products behind login
- Unusual site structure

**Solutions:**
- Enable JavaScript rendering (if available)
- Check if products are publicly accessible
- Contact support for custom scraping

### Scraping Errors?

**Possible causes:**
- Website blocking your IP
- CAPTCHA challenges
- Website downtime

**Solutions:**
- Reduce scraping frequency
- Enable proxy rotation (premium feature)
- Wait and retry later

## Advanced Configuration

### Custom Selectors
For complex websites, specify CSS selectors:

```typescript
{
  productSelector: ".product-item",
  priceSelector: ".price-value",
  nameSelector: ".product-title",
  skuSelector: ".product-sku"
}
```

### Proxy Settings
Use proxies to avoid IP blocking:

```typescript
{
  useProxy: true,
  proxyRotation: "automatic"
}
```

## Next Steps

- Configure [Scraping Settings](scraping-configuration)
- Review [Product Matching](../products/product-matching)
- Set up [Price Updates](../pricing/price-updates)
