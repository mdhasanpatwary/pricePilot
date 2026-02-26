---
title: "Bot Protection Configuration Guide"
description: "Configuring bot protection features"
category: "security"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["bot-protection", "configuration", "security"]
audience: "admin"
relatedDocs: ["/docs/troubleshooting/bot-protection-configuration-guide.md"]
---

# Bot Protection Configuration Guide

## Overview

This guide explains how to configure the bot protection system for optimal scraping performance. Proper configuration ensures reliable price data collection while respecting competitor site policies and avoiding detection.

## Table of Contents

1. [Per-Site Configuration](#per-site-configuration)
2. [Strategy Selection](#strategy-selection)
3. [Selector Customization](#selector-customization)
4. [Proxy Setup](#proxy-setup)
5. [Rate Limiting Configuration](#rate-limiting-configuration)
6. [Advanced Settings](#advanced-settings)
7. [Best Practices](#best-practices)

---

## Per-Site Configuration

Each competitor website can have its own scraping configuration tailored to its specific characteristics and protection mechanisms.

### Configuration Options

| Setting | Description | Default | Range |
|---------|-------------|---------|-------|
| `preferredStrategy` | Primary scraping method | `http_client` | See [Strategy Selection](#strategy-selection) |
| `requiresJavaScript` | Whether site needs JS execution | `false` | `true`/`false` |
| `proxyRequired` | Whether to always use proxies | `false` | `true`/`false` |
| `baseDelayMs` | Minimum delay between requests | `2000` | 1000-10000 ms |
| `maxDelayMs` | Maximum delay after failures | `300000` | 10000-600000 ms |
| `backoffMultiplier` | Exponential backoff multiplier | `2.0` | 1.0-5.0 |
| `maxRetries` | Maximum retry attempts | `3` | 0-10 |
| `timeoutMs` | Request timeout | `30000` | 5000-120000 ms |

### Accessing Configuration

**Via Admin Dashboard**:
1. Navigate to **Admin** → **Scraping Configuration**
2. Select the competitor website
3. Click **Edit Configuration**
4. Modify settings as needed
5. Click **Test Configuration** to validate
6. Click **Save** to apply changes

**Via API**:
```bash
# Get current configuration
curl -X GET \
  https://your-domain.com/api/v1/scraping/configs/{competitorWebsiteId} \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Update configuration
curl -X PUT \
  https://your-domain.com/api/v1/scraping/configs/{competitorWebsiteId} \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "preferredStrategy": "headless_browser",
    "baseDelayMs": 3000,
    "maxRetries": 5
  }'
```


---

## Strategy Selection

The scraping strategy determines how the system fetches competitor data. Choose the right strategy based on site characteristics.

### Available Strategies

#### 1. HTTP Client (`http_client`)

**Best For**: Simple, static websites without JavaScript requirements

**Characteristics**:
- Fastest performance
- Lowest resource usage
- No JavaScript execution
- Limited to static HTML content

**When to Use**:
- Site loads price data in initial HTML
- No dynamic content loading
- Site doesn't use heavy JavaScript

**Example Sites**: Traditional e-commerce platforms, simple product pages

#### 2. HTTP with Proxy (`http_with_proxy`)

**Best For**: Sites with basic IP-based protection

**Characteristics**:
- Fast performance
- Rotates IP addresses
- No JavaScript execution
- Bypasses simple IP blocks

**When to Use**:
- Site blocks repeated requests from same IP
- HTTP client works but gets rate limited
- No JavaScript requirements

**Example Sites**: Sites with basic rate limiting

#### 3. Headless Browser (`headless_browser`)

**Best For**: JavaScript-heavy sites with dynamic content

**Characteristics**:
- Full JavaScript execution
- Handles dynamic content
- Higher resource usage
- Slower than HTTP client

**When to Use**:
- Price loads via JavaScript
- Site uses AJAX/fetch for data
- Content requires user interaction simulation
- HTTP client fails to extract data

**Example Sites**: Modern SPAs, React/Vue/Angular sites

#### 4. Headless with Proxy (`headless_with_proxy`)

**Best For**: JavaScript sites with IP protection

**Characteristics**:
- Full JavaScript execution
- IP rotation
- Highest resource usage
- Most comprehensive protection bypass

**When to Use**:
- Site requires JavaScript AND blocks IPs
- Headless browser alone gets blocked
- Maximum stealth required

**Example Sites**: Large retailers with advanced protection

#### 5. Stealth Browser (`stealth_browser`)

**Best For**: Sites with advanced bot detection

**Characteristics**:
- Full JavaScript execution
- Advanced fingerprint randomization
- Stealth plugins enabled
- Highest success rate against detection

**When to Use**:
- Site uses advanced bot detection (DataDome, PerimeterX)
- Other strategies consistently fail
- Site checks for automation indicators

**Example Sites**: Major retailers, sites with Cloudflare Bot Management


### Strategy Selection Decision Tree

```
Start
  │
  ├─ Does site require JavaScript?
  │   │
  │   ├─ NO → Does site block IPs?
  │   │   │
  │   │   ├─ NO → Use: http_client
  │   │   └─ YES → Use: http_with_proxy
  │   │
  │   └─ YES → Does site block IPs?
  │       │
  │       ├─ NO → Use: headless_browser
  │       └─ YES → Does site have advanced bot detection?
  │           │
  │           ├─ NO → Use: headless_with_proxy
  │           └─ YES → Use: stealth_browser
```

### Automatic Strategy Adaptation

The system automatically adapts strategies based on success patterns:

- **Success Rate > 80%**: Strategy is working well, no change needed
- **Success Rate 50-80%**: System may try alternative strategies
- **Success Rate < 50%**: System escalates to more advanced strategy

**Example Adaptation**:
```
Initial: http_client (fails with IP blocks)
  ↓
Retry 1: http_with_proxy (succeeds)
  ↓
After 10+ successes: preferredStrategy updated to http_with_proxy
```

### Testing Strategies

Before committing to a strategy, test it:

**Via Dashboard**:
1. Go to **Scraping Configuration**
2. Select competitor website
3. Choose strategy in dropdown
4. Click **Test Configuration**
5. Review test results
6. Save if successful

**Via API**:
```bash
curl -X POST \
  https://your-domain.com/api/v1/scraping/configs/{competitorWebsiteId}/test \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "testUrl": "https://competitor.com/product/123",
    "config": {
      "preferredStrategy": "headless_browser",
      "timeoutMs": 45000
    }
  }'
```

---

## Selector Customization

CSS selectors tell the system where to find price data on competitor pages. Customize selectors when default extraction fails.

### Default Selectors

The system tries these selectors in order:
1. `.price`
2. `.product-price`
3. `[itemprop="price"]`
4. `.sale-price`
5. `#price`

### Custom Selector Configuration

**When to Customize**:
- Default selectors don't match site structure
- Price is in unusual location
- Multiple prices exist (need specific one)
- Site structure changed

**Selector Priority**:
Selectors are tried in the order you specify. Put most specific first:

```json
{
  "priceSelectors": [
    ".product-detail__price--current",  // Most specific
    ".price-box .price",                // Fallback 1
    "[data-price]"                      // Fallback 2
  ]
}
```


### Finding the Right Selector

**Method 1: Browser DevTools**

1. Open competitor product page in browser
2. Right-click on price → **Inspect Element**
3. Note the element's class or ID
4. Test selector in console:
   ```javascript
   document.querySelector('.your-selector').textContent
   ```
5. If it returns the price, use that selector

**Method 2: Multiple Elements**

If multiple prices exist (regular, sale, member):
```json
{
  "priceSelectors": [
    ".sale-price",      // Try sale price first
    ".regular-price"    // Fall back to regular
  ]
}
```

**Method 3: Attribute Selectors**

For data attributes:
```json
{
  "priceSelectors": [
    "[data-product-price]",
    "[data-price-amount]"
  ]
}
```

### Currency Selector

Specify where to find currency information:

```json
{
  "currencySelector": ".currency-code",
  "priceSelectors": [".price-amount"]
}
```

If currency is in same element as price:
```json
{
  "currencySelector": null,
  "priceSelectors": [".price"]  // e.g., "$99.99 USD"
}
```

### Fallback Regex

When selectors fail, regex can extract prices from text:

```json
{
  "fallbackRegex": "\\$([0-9,]+\\.\\d{2})"
}
```

**Common Patterns**:
- US Dollar: `\\$([0-9,]+\\.\\d{2})`
- Euro: `€([0-9,]+\\.\\d{2})`
- Pound: `£([0-9,]+\\.\\d{2})`
- Generic: `([0-9,]+\\.\\d{2})`

### Testing Selectors

**Via Dashboard**:
1. Edit configuration
2. Add custom selectors
3. Click **Test Configuration**
4. Verify price is extracted correctly
5. Save if successful

**Via API**:
```bash
curl -X POST \
  https://your-domain.com/api/v1/scraping/configs/{competitorWebsiteId}/test \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "testUrl": "https://competitor.com/product/123",
    "config": {
      "priceSelectors": [".custom-price-class"],
      "currencySelector": ".currency"
    }
  }'
```

### Selector Best Practices

✅ **DO**:
- Use specific selectors (classes, IDs)
- Provide multiple fallback selectors
- Test selectors before saving
- Document why custom selectors are needed

❌ **DON'T**:
- Use overly generic selectors (`.price` on complex sites)
- Rely on position-based selectors (`div:nth-child(3)`)
- Use selectors that match multiple elements
- Forget to test after site updates


---

## Proxy Setup

Proxies rotate IP addresses to avoid detection and IP-based blocking.

### Adding Proxies

**Via Dashboard**:
1. Navigate to **Admin** → **Scraping Configuration** → **Proxies**
2. Click **Add Proxy**
3. Fill in proxy details:
   - Provider name
   - Host (IP or hostname)
   - Port
   - Protocol (HTTP, HTTPS, SOCKS5)
   - Username/Password (if required)
   - Region (optional)
4. Click **Save**

**Via API**:
```bash
curl -X POST \
  https://your-domain.com/api/v1/scraping/proxies \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "ProxyProvider Inc",
    "host": "proxy1.example.com",
    "port": 8080,
    "protocol": "http",
    "username": "proxyuser",
    "password": "proxypass",
    "region": "us-east"
  }'
```

### Proxy Providers

**Recommended Providers**:

1. **Bright Data (formerly Luminati)**
   - Large proxy pool
   - Residential and datacenter IPs
   - Good for e-commerce scraping
   - Higher cost

2. **Oxylabs**
   - Reliable performance
   - Good geographic coverage
   - Residential proxies
   - Medium cost

3. **Smartproxy**
   - Affordable pricing
   - Good for small-medium scale
   - Residential proxies
   - Lower cost

4. **ProxyMesh**
   - Simple setup
   - Rotating proxies
   - Good for basic needs
   - Budget-friendly

### Proxy Configuration

**Protocol Selection**:
- **HTTP**: Standard, widely supported, good for most sites
- **HTTPS**: Encrypted, better for sensitive data
- **SOCKS5**: Most flexible, supports any protocol

**Authentication**:
- Username/password authentication (most common)
- IP whitelist authentication (some providers)
- API key authentication (provider-specific)

**Region Selection**:
- Match proxy region to competitor site location
- US proxies for US sites
- EU proxies for EU sites
- Improves success rate and reduces latency

### Proxy Health Monitoring

The system automatically tracks proxy health:

**Metrics Tracked**:
- Success rate (global and per-site)
- Last success/failure timestamps
- Cooldown status
- Total requests handled

**Viewing Proxy Health**:

**Via Dashboard**:
1. Go to **Scraping Configuration** → **Proxies**
2. View health indicators:
   - 🟢 Green: Success rate > 80%
   - 🟡 Yellow: Success rate 50-80%
   - 🔴 Red: Success rate < 50%
3. Click proxy to see detailed statistics

**Via API**:
```bash
curl -X GET \
  https://your-domain.com/api/v1/scraping/proxies/{proxyId}/health \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```


### Proxy Rotation Strategy

**Automatic Rotation**:
- System selects best proxy for each request
- Based on site-specific success rates
- Avoids proxies in cooldown
- Randomizes to prevent patterns

**Cooldown Periods**:
- First failure: 5 minutes
- Second failure: 15 minutes
- Third+ failure: 60 minutes
- Success resets cooldown

**Selection Algorithm**:
1. Filter out proxies in cooldown
2. Filter out globally unavailable proxies (< 10% success rate)
3. Sort by site-specific success rate
4. Select from top performers with randomization

### Proxy Best Practices

✅ **DO**:
- Use multiple proxies (minimum 5-10)
- Mix providers for redundancy
- Monitor proxy health regularly
- Remove consistently failing proxies
- Match proxy region to target site

❌ **DON'T**:
- Use free proxies (unreliable, often blocked)
- Use single proxy for all sites
- Ignore proxy health warnings
- Overuse single proxy
- Use proxies from suspicious providers

### Troubleshooting Proxies

**Problem**: All proxies blocked for a site

**Solutions**:
1. Add more proxies from different providers
2. Increase delay between requests
3. Switch to residential proxies
4. Check if site has stricter protection
5. Consider using stealth browser strategy

**Problem**: Proxy authentication fails

**Solutions**:
1. Verify username/password are correct
2. Check if IP whitelist is configured
3. Confirm proxy is active with provider
4. Test proxy outside PricePilot

**Problem**: Slow proxy performance

**Solutions**:
1. Check proxy provider status
2. Try proxies from different regions
3. Increase timeout settings
4. Contact proxy provider support

---

## Rate Limiting Configuration

Rate limiting controls request frequency to avoid triggering anti-bot measures.

### Rate Limit Settings

**Base Delay** (`baseDelayMs`):
- Minimum time between requests to same site
- Default: 2000ms (2 seconds)
- Recommended range: 1000-5000ms

**Max Delay** (`maxDelayMs`):
- Maximum delay after repeated failures
- Default: 300000ms (5 minutes)
- Recommended range: 60000-600000ms

**Backoff Multiplier** (`backoffMultiplier`):
- How quickly delay increases after failures
- Default: 2.0 (doubles each time)
- Recommended range: 1.5-3.0

### Exponential Backoff

After failures, delay increases exponentially:

```
Failure 0: 2s
Failure 1: 4s (2s × 2.0)
Failure 2: 8s (4s × 2.0)
Failure 3: 16s (8s × 2.0)
Failure 4: 32s (16s × 2.0)
Failure 5: 64s (32s × 2.0)
Failure 6+: 300s (capped at maxDelay)
```

### Jitter Randomization

Random variation prevents predictable patterns:

```
Base delay: 2000ms
Jitter range: 20%
Actual delay: 1600-2400ms (random)
```


### Site-Specific Rate Limits

Different sites require different rate limits:

**Aggressive Sites** (strict protection):
```json
{
  "baseDelayMs": 5000,
  "maxDelayMs": 600000,
  "backoffMultiplier": 3.0
}
```

**Moderate Sites** (standard protection):
```json
{
  "baseDelayMs": 2000,
  "maxDelayMs": 300000,
  "backoffMultiplier": 2.0
}
```

**Lenient Sites** (minimal protection):
```json
{
  "baseDelayMs": 1000,
  "maxDelayMs": 60000,
  "backoffMultiplier": 1.5
}
```

### Rate Limit Best Practices

✅ **DO**:
- Start conservative (higher delays)
- Reduce delays gradually if successful
- Increase delays if rate limited
- Monitor success rates
- Respect robots.txt

❌ **DON'T**:
- Use zero or very low delays
- Ignore rate limit failures
- Scrape faster than necessary
- Use same rate limits for all sites

---

## Advanced Settings

### Timeout Configuration

**Request Timeout** (`timeoutMs`):
- Maximum time to wait for response
- Default: 30000ms (30 seconds)
- Increase for slow sites
- Decrease for fast sites

**Recommended Timeouts**:
- Fast sites: 15000ms (15 seconds)
- Average sites: 30000ms (30 seconds)
- Slow sites: 60000ms (60 seconds)
- JavaScript-heavy: 45000-90000ms

### Retry Configuration

**Max Retries** (`maxRetries`):
- Number of retry attempts after failure
- Default: 3
- Range: 0-10

**Retry Strategy**:
- Retry 1: Different proxy
- Retry 2: Increased delay
- Retry 3: Different strategy (e.g., headless browser)
- Retry 4+: Combination of above

### JavaScript Requirements

**Requires JavaScript** (`requiresJavaScript`):
- Set to `true` for sites that load prices via JavaScript
- Forces use of headless browser
- Increases resource usage
- Necessary for SPAs and dynamic sites

**How to Determine**:
1. View page source (Ctrl+U)
2. Search for price value
3. If not found in HTML → requires JavaScript
4. If found in HTML → doesn't require JavaScript

### Proxy Requirements

**Proxy Required** (`proxyRequired`):
- Set to `true` to always use proxies
- Useful for sites with strict IP monitoring
- Increases cost (proxy usage)
- Improves success rate on protected sites

**When to Enable**:
- Site blocks datacenter IPs
- Site has IP-based rate limiting
- Previous scraping attempts blocked
- Site serves different content by region


---

## Best Practices

### Initial Configuration

**Step 1: Start with Defaults**
- Use default configuration initially
- Monitor success rate for 24 hours
- Identify issues before customizing

**Step 2: Analyze Results**
- Check success rate in dashboard
- Review failed attempts
- Identify protection types detected

**Step 3: Adjust Configuration**
- If IP blocks → enable proxies
- If JavaScript errors → enable headless browser
- If rate limited → increase delays
- If parsing fails → customize selectors

**Step 4: Test Changes**
- Use test configuration feature
- Verify improvements
- Monitor for 24 hours
- Iterate as needed

### Configuration Maintenance

**Weekly Tasks**:
- Review success rates
- Check proxy health
- Update failing configurations
- Remove dead proxies

**Monthly Tasks**:
- Review all configurations
- Update selectors if sites changed
- Optimize rate limits
- Audit proxy costs

**Quarterly Tasks**:
- Evaluate proxy providers
- Review strategy effectiveness
- Update documentation
- Train team on changes

### Performance Optimization

**Optimize for Speed**:
1. Use HTTP client when possible
2. Minimize delays (while maintaining success)
3. Use datacenter proxies (faster than residential)
4. Cache configuration data

**Optimize for Success Rate**:
1. Use appropriate strategy for each site
2. Maintain healthy proxy pool
3. Implement proper delays
4. Monitor and adapt quickly

**Optimize for Cost**:
1. Use proxies only when needed
2. Prefer HTTP client over headless browser
3. Remove unused proxies
4. Batch scraping operations

### Monitoring and Alerts

**Set Up Alerts**:
- Success rate drops below 80%
- All proxies blocked
- CAPTCHA detected
- Configuration changes

**Monitor Metrics**:
- Overall success rate
- Per-site success rates
- Proxy health
- Response times
- Protection type distribution

**Review Logs**:
- Failed attempts
- Protection detections
- Configuration changes
- Alert history

### Security Considerations

**Protect Credentials**:
- Store proxy credentials securely
- Rotate credentials regularly
- Use environment variables
- Limit access to configuration

**Respect Site Policies**:
- Check robots.txt
- Honor rate limits
- Don't overwhelm sites
- Identify your scraper properly

**Legal Compliance**:
- Review terms of service
- Ensure scraping is permitted
- Respect copyright
- Follow data protection laws

### Troubleshooting Checklist

**Low Success Rate**:
- [ ] Check proxy health
- [ ] Verify selectors are correct
- [ ] Increase delays
- [ ] Try different strategy
- [ ] Check for site changes

**CAPTCHA Challenges**:
- [ ] Enable proxies
- [ ] Use stealth browser
- [ ] Increase delays
- [ ] Rotate user agents
- [ ] Consider manual entry

**Parsing Failures**:
- [ ] Verify selectors
- [ ] Check if site structure changed
- [ ] Enable JavaScript if needed
- [ ] Test with browser DevTools
- [ ] Add fallback regex

**Timeout Errors**:
- [ ] Increase timeout setting
- [ ] Check proxy performance
- [ ] Verify site is accessible
- [ ] Try different proxy
- [ ] Check network connectivity

---

## Configuration Examples

### Example 1: Simple Static Site

```json
{
  "preferredStrategy": "http_client",
  "requiresJavaScript": false,
  "proxyRequired": false,
  "baseDelayMs": 2000,
  "maxDelayMs": 60000,
  "backoffMultiplier": 2.0,
  "maxRetries": 3,
  "timeoutMs": 15000,
  "priceSelectors": [".price", ".product-price"],
  "currencySelector": null,
  "fallbackRegex": "\\$([0-9,]+\\.\\d{2})"
}
```

### Example 2: JavaScript-Heavy Site

```json
{
  "preferredStrategy": "headless_browser",
  "requiresJavaScript": true,
  "proxyRequired": false,
  "baseDelayMs": 3000,
  "maxDelayMs": 300000,
  "backoffMultiplier": 2.0,
  "maxRetries": 5,
  "timeoutMs": 45000,
  "priceSelectors": ["[data-price]", ".dynamic-price"],
  "currencySelector": ".currency-code",
  "fallbackRegex": null
}
```

### Example 3: Protected Site with IP Blocking

```json
{
  "preferredStrategy": "stealth_browser",
  "requiresJavaScript": true,
  "proxyRequired": true,
  "baseDelayMs": 5000,
  "maxDelayMs": 600000,
  "backoffMultiplier": 3.0,
  "maxRetries": 5,
  "timeoutMs": 60000,
  "priceSelectors": [".sale-price", ".regular-price"],
  "currencySelector": ".currency",
  "fallbackRegex": "\\$([0-9,]+\\.\\d{2})"
}
```

---

## Getting Help

**Documentation**:
- [API Reference](./BOT_PROTECTION_API_REFERENCE.md)
- [Troubleshooting Guide](./BOT_PROTECTION_TROUBLESHOOTING_GUIDE.md)
- [User Guide](./BOT_PROTECTION_USER_GUIDE.md)

**Support**:
- Email: support@pricepilot.com
- Documentation: https://docs.pricepilot.com
- Community Forum: https://community.pricepilot.com

**Resources**:
- CSS Selector Tutorial: https://www.w3schools.com/cssref/css_selectors.asp
- Regex Testing: https://regex101.com
- Proxy Providers: See [Proxy Setup](#proxy-setup) section
