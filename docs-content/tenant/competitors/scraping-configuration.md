---
title: "Scraping Configuration"
description: "Configure and optimize competitor website scraping"
category: "competitors"
subcategory: null
tags: ["scraping", "competitors", "configuration"]
author: "PricePilot Team"
lastReviewed: "2024-01-15"
relatedDocs: ["adding-competitors", "common-issues"]
---

# Scraping Configuration

Learn how to configure and optimize competitor website scraping for accurate price tracking.

## Understanding Scraping

PricePilot automatically visits competitor websites to collect product prices. This process is called "scraping" and runs on a schedule you configure.

### How It Works

1. **Scheduled Visits**: PricePilot visits competitor websites at regular intervals
2. **Product Detection**: Identifies products on competitor pages
3. **Price Extraction**: Extracts current prices and availability
4. **Data Storage**: Saves price history for comparison

## Scraping Frequency

### Recommended Schedules

- **High Priority Competitors**: Every 6 hours
- **Medium Priority Competitors**: Every 12 hours
- **Low Priority Competitors**: Every 24 hours

### Setting Scraping Frequency

1. Go to **Competitors** page
2. Click on a competitor
3. Select **Scraping Settings**
4. Choose frequency from dropdown
5. Click **Save**

## Scraping Settings

### User-Agent Configuration

PricePilot uses realistic browser user-agents to avoid detection. You can customize this if needed:

- **Default**: Recommended for most websites
- **Mobile**: For mobile-optimized sites
- **Custom**: Specify your own user-agent string

### Rate Limiting

To avoid overwhelming competitor websites:

- **Delay Between Requests**: 2-5 seconds (default: 3 seconds)
- **Max Concurrent Requests**: 1-3 (default: 1)
- **Respect robots.txt**: Enabled by default

### Retry Configuration

If scraping fails, PricePilot automatically retries:

- **Max Retries**: 3 attempts
- **Retry Delay**: Exponential backoff (1s, 2s, 4s)
- **Timeout**: 30 seconds per request

## Handling Common Issues

### CAPTCHA Detection

If a competitor uses CAPTCHA protection:

1. **Reduce Frequency**: Lower scraping frequency to avoid triggering CAPTCHA
2. **Increase Delays**: Add longer delays between requests
3. **Contact Support**: We can configure advanced CAPTCHA handling

### Bot Protection

Some websites use bot protection services:

- **Cloudflare**: PricePilot includes Cloudflare bypass capabilities
- **Other Services**: Contact support for custom configuration
- **Manual Verification**: May require periodic manual verification

### Dynamic Content

For websites that load prices via JavaScript:

1. Enable **JavaScript Rendering** in scraping settings
2. Increase **Page Load Timeout** to 10-15 seconds
3. Configure **Wait for Selector** if needed

## Monitoring Scraping Health

### Success Rate

Monitor your scraping success rate on the Competitors page:

- **Green (>95%)**: Excellent, no action needed
- **Yellow (85-95%)**: Good, monitor for issues
- **Red (<85%)**: Needs attention, check logs

### Scraping Logs

View detailed scraping logs:

1. Go to **Competitors** page
2. Click on a competitor
3. Select **Scraping Logs** tab
4. Review recent scraping attempts

### Common Error Messages

- **"Connection timeout"**: Website is slow or unreachable
- **"CAPTCHA detected"**: Bot protection triggered
- **"Product not found"**: Product URL changed or removed
- **"Price selector failed"**: Website structure changed

## Best Practices

1. **Start Conservative**: Begin with lower frequencies and increase gradually
2. **Monitor Success Rates**: Check regularly for issues
3. **Update Product URLs**: Keep competitor product URLs current
4. **Respect Rate Limits**: Don't overwhelm competitor websites
5. **Test Configuration**: Use "Test Scrape" button before saving

## Advanced Configuration

### Custom Selectors

For websites with unique structures, you can specify custom CSS selectors:

```
Price Selector: .product-price .amount
Name Selector: h1.product-title
Availability Selector: .stock-status
```

### Proxy Configuration

For high-volume scraping or geo-restricted content:

- **Proxy Rotation**: Automatically rotate IP addresses
- **Geographic Proxies**: Access region-specific pricing
- **Residential Proxies**: Higher success rate for protected sites

Contact support to enable proxy features.

## Troubleshooting

### Scraping Stopped Working

1. Check if competitor website structure changed
2. Verify product URLs are still valid
3. Review scraping logs for error messages
4. Test with "Test Scrape" button
5. Contact support if issue persists

### Incorrect Prices

1. Verify price selector is correct
2. Check if website shows different prices for different regions
3. Ensure currency conversion is configured correctly
4. Review scraping logs for warnings

### Slow Scraping

1. Reduce concurrent requests
2. Increase timeout values
3. Disable JavaScript rendering if not needed
4. Check your internet connection

## Related Documentation

- [Adding Competitors](adding-competitors)
- [Troubleshooting Guide](../troubleshooting/common-issues)
- [Product Matching](../products/product-matching)
