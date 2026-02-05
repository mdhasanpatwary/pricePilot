---
title: "Bot Protection Troubleshooting Guide"
description: "Troubleshooting bot protection issues"
category: "security"
tags: ["bot-protection", "troubleshooting", "security"]
audience: "admin"
relatedDocs: ["/docs/troubleshooting/bot-protection-troubleshooting-guide.md"]
---

# Bot Protection Troubleshooting Guide

## Overview

This guide helps you diagnose and resolve common scraping issues. Use this when competitor price data isn't being collected successfully.

## Table of Contents

1. [Common Scraping Failures](#common-scraping-failures)
2. [Protection Type Meanings](#protection-type-meanings)
3. [Resolution Steps](#resolution-steps)
4. [Log Analysis](#log-analysis)
5. [Quick Reference](#quick-reference)

---

## Common Scraping Failures

### Symptom: No Price Data Collected

**Possible Causes**:
- Site structure changed
- Incorrect CSS selectors
- JavaScript required but not enabled
- Bot protection blocking requests

**Diagnosis Steps**:
1. Check scrape attempt logs
2. Review protection type detected
3. Verify selectors are correct
4. Test configuration

**Resolution**:
See specific protection type sections below

---

### Symptom: Intermittent Failures

**Possible Causes**:
- Rate limiting
- Proxy issues
- Site performance problems
- Network connectivity

**Diagnosis Steps**:
1. Check success rate trend
2. Review failure pattern (time-based?)
3. Check proxy health
4. Review rate limit settings

**Resolution**:
1. Increase delays between requests
2. Add more proxies
3. Enable proxy rotation
4. Monitor during different times

---

### Symptom: All Requests Failing

**Possible Causes**:
- All proxies blocked
- Site completely blocking automated access
- Configuration error
- Site is down

**Diagnosis Steps**:
1. Check if site is accessible manually
2. Review all proxy health
3. Check for CAPTCHA on site
4. Verify configuration is valid

**Resolution**:
1. Add new proxies from different providers
2. Switch to stealth browser strategy
3. Increase delays significantly
4. Consider manual price entry temporarily


---

## Protection Type Meanings

### IP Block

**What It Means**:
The competitor site is blocking requests from your IP address(es).

**Indicators**:
- HTTP 403 (Forbidden) status code
- HTTP 429 (Too Many Requests) status code
- Error messages like "Access Denied" or "IP Blocked"
- Consistent failures from same IP

**Why It Happens**:
- Too many requests from same IP
- IP is on blocklist
- Datacenter IP detected
- Geographic restrictions

**Resolution Steps**:

1. **Enable Proxy Rotation**:
   ```json
   {
     "proxyRequired": true,
     "preferredStrategy": "http_with_proxy"
   }
   ```

2. **Add More Proxies**:
   - Add 5-10 proxies minimum
   - Use residential proxies (better than datacenter)
   - Distribute across different providers

3. **Increase Delays**:
   ```json
   {
     "baseDelayMs": 5000,
     "maxDelayMs": 600000
   }
   ```

4. **Monitor Results**:
   - Check success rate after 24 hours
   - Verify proxies are being used
   - Adjust if needed

---

### Rate Limit

**What It Means**:
You're sending requests too quickly for the site's rate limits.

**Indicators**:
- HTTP 429 status code
- "Rate limit exceeded" messages
- "Too many requests" errors
- Failures increase with request frequency

**Why It Happens**:
- Requests too frequent
- Site has strict rate limits
- Multiple products scraped simultaneously
- Insufficient delays

**Resolution Steps**:

1. **Increase Base Delay**:
   ```json
   {
     "baseDelayMs": 5000
   }
   ```

2. **Increase Backoff Multiplier**:
   ```json
   {
     "backoffMultiplier": 3.0
   }
   ```

3. **Reduce Concurrent Requests**:
   - Scrape products sequentially
   - Distribute scraping over longer time
   - Avoid peak hours

4. **Enable Proxy Rotation**:
   - Distribute requests across IPs
   - Reduces per-IP rate limit impact

---

### CAPTCHA Challenge

**What It Means**:
The site is presenting a CAPTCHA challenge to verify you're human.

**Indicators**:
- Keywords: "captcha", "recaptcha", "hcaptcha"
- Challenge forms in HTML
- Redirect to verification page
- Consistent failures with CAPTCHA detection

**Why It Happens**:
- Site detected automated access
- Suspicious behavior patterns
- High request volume
- Known bot signatures

**Resolution Steps**:

1. **Use Stealth Browser**:
   ```json
   {
     "preferredStrategy": "stealth_browser"
   }
   ```

2. **Enable Proxies**:
   ```json
   {
     "proxyRequired": true
   }
   ```

3. **Increase Delays Significantly**:
   ```json
   {
     "baseDelayMs": 10000,
     "maxDelayMs": 600000
   }
   ```

4. **Rotate User Agents**:
   - System does this automatically
   - Verify in logs

5. **Consider Manual Entry**:
   - Use manual price entry feature
   - Temporary solution while investigating

**Note**: CAPTCHA challenges are difficult to bypass automatically. If persistent, consider:
- Reducing scraping frequency
- Using manual price entry
- Contacting competitor for API access


---

### Fake Data

**What It Means**:
The site is serving fake or placeholder prices to automated scrapers.

**Indicators**:
- Prices like $0.00, $999999.99
- Prices without decimal places
- Unrealistic price values
- Prices that don't match manual checks

**Why It Happens**:
- Site detects automation
- Serves different content to bots
- Honeypot technique
- A/B testing gone wrong

**Resolution Steps**:

1. **Switch to Headless Browser**:
   ```json
   {
     "preferredStrategy": "headless_browser",
     "requiresJavaScript": true
   }
   ```

2. **Enable Stealth Mode**:
   ```json
   {
     "preferredStrategy": "stealth_browser"
   }
   ```

3. **Use Residential Proxies**:
   - More likely to receive real content
   - Less likely to be detected

4. **Verify Selectors**:
   - Ensure extracting correct price element
   - Check if site has multiple price displays
   - Test selectors manually

5. **Check for JavaScript Loading**:
   - Price might load via JavaScript
   - Enable JavaScript execution
   - Increase wait time

---

### Redirect Block

**What It Means**:
The site is redirecting your requests to error pages or different domains.

**Indicators**:
- 3xx status codes (301, 302, 307)
- Redirects to different domain
- Redirects to error/blocked pages
- Final URL differs from requested URL

**Why It Happens**:
- Geographic restrictions
- Bot detection
- Site maintenance
- Access control

**Resolution Steps**:

1. **Use Proxies from Correct Region**:
   ```json
   {
     "proxyRequired": true
   }
   ```
   - Add proxies from site's region
   - US site → US proxies
   - EU site → EU proxies

2. **Check Redirect Chain**:
   - Review logs for redirect URLs
   - Identify redirect reason
   - Adjust strategy accordingly

3. **Enable Stealth Browser**:
   ```json
   {
     "preferredStrategy": "stealth_browser"
   }
   ```

4. **Verify URL is Correct**:
   - Check product URL is still valid
   - Site might have changed URL structure
   - Update URLs if needed

---

### Delayed Response

**What It Means**:
The site is taking too long to respond, causing timeouts.

**Indicators**:
- Timeout errors
- Response times > 30 seconds
- Incomplete responses
- Connection timeouts

**Why It Happens**:
- Site is slow
- Network issues
- Proxy performance problems
- Site deliberately delaying bots

**Resolution Steps**:

1. **Increase Timeout**:
   ```json
   {
     "timeoutMs": 60000
   }
   ```

2. **Check Proxy Performance**:
   - Review proxy health
   - Try different proxies
   - Test proxy speed outside PricePilot

3. **Verify Site Performance**:
   - Check site manually
   - Test during different times
   - Site might be slow during peak hours

4. **Use Faster Strategy**:
   - If using headless browser, try HTTP client
   - Reduce unnecessary waits

---

### Empty Response

**What It Means**:
The site is returning empty or minimal content.

**Indicators**:
- Very small response size
- Missing expected content
- Blank pages
- No HTML structure

**Why It Happens**:
- JavaScript required but not executed
- Content loads dynamically
- Bot detection serving empty page
- Network issues

**Resolution Steps**:

1. **Enable JavaScript**:
   ```json
   {
     "preferredStrategy": "headless_browser",
     "requiresJavaScript": true
   }
   ```

2. **Add Wait Conditions**:
   - Wait for content to load
   - Increase timeout
   - Wait for specific selectors

3. **Check Selectors**:
   - Verify selectors match site structure
   - Test with browser DevTools
   - Update if site changed

4. **Use Stealth Browser**:
   ```json
   {
     "preferredStrategy": "stealth_browser"
   }
   ```


---

## Resolution Steps

### Step-by-Step Troubleshooting Process

#### Step 1: Identify the Problem

1. **Check Dashboard**:
   - Navigate to **Admin** → **Scraping Monitor**
   - Identify sites with low success rates
   - Note protection types detected

2. **Review Recent Failures**:
   - Click on problematic site
   - View recent scrape attempts
   - Identify patterns

3. **Check Alerts**:
   - Review any alerts triggered
   - Note alert types and frequency

#### Step 2: Analyze Logs

1. **Access Scrape Attempt Logs**:
   ```
   Admin → Scraping Monitor → Logs
   ```

2. **Filter by Site and Date**:
   - Select competitor website
   - Set date range (last 24 hours)
   - Filter by failed attempts

3. **Review Log Details**:
   - Status codes
   - Protection types
   - Response samples
   - Screenshots (if available)

4. **Look for Patterns**:
   - Same error repeatedly?
   - Specific time of day?
   - Specific proxy?
   - Specific strategy?

#### Step 3: Apply Fixes

Based on protection type detected, apply appropriate fixes:

**For IP Blocks**:
```bash
# Via API
curl -X PUT \
  https://your-domain.com/api/v1/scraping/configs/{competitorWebsiteId} \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "proxyRequired": true,
    "preferredStrategy": "http_with_proxy"
  }'
```

**For Rate Limits**:
```bash
curl -X PUT \
  https://your-domain.com/api/v1/scraping/configs/{competitorWebsiteId} \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "baseDelayMs": 5000,
    "backoffMultiplier": 3.0
  }'
```

**For CAPTCHA**:
```bash
curl -X PUT \
  https://your-domain.com/api/v1/scraping/configs/{competitorWebsiteId} \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "preferredStrategy": "stealth_browser",
    "proxyRequired": true,
    "baseDelayMs": 10000
  }'
```

**For Parsing Failures**:
```bash
curl -X PUT \
  https://your-domain.com/api/v1/scraping/configs/{competitorWebsiteId} \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "priceSelectors": [".new-selector", ".fallback-selector"],
    "requiresJavaScript": true
  }'
```

#### Step 4: Test Configuration

1. **Use Test Feature**:
   ```
   Admin → Scraping Configuration → Select Site → Test Configuration
   ```

2. **Verify Results**:
   - Price extracted correctly?
   - No protection detected?
   - Reasonable response time?

3. **Save if Successful**:
   - Click **Save Configuration**
   - Monitor for 24 hours

#### Step 5: Monitor Results

1. **Check Success Rate**:
   - After 24 hours, review success rate
   - Should improve significantly

2. **Review New Failures**:
   - Any new protection types?
   - Different errors?

3. **Iterate if Needed**:
   - Apply additional fixes
   - Test again
   - Monitor continuously


---

## Log Analysis

### Understanding Scrape Attempt Logs

**Log Entry Structure**:
```json
{
  "id": "uuid",
  "url": "https://competitor.com/product/123",
  "strategy": "http_with_proxy",
  "proxyId": "uuid",
  "success": false,
  "protectionDetected": true,
  "protectionType": "ip_block",
  "statusCode": 403,
  "responseTime": 1850,
  "responseSample": "<!DOCTYPE html>...",
  "errorMessage": "Access denied",
  "attemptNumber": 2,
  "createdAt": "2024-01-15T14:45:00Z"
}
```

### Key Fields to Analyze

**Status Code**:
- `200-299`: Success (but check if price extracted)
- `403`: Forbidden (likely IP block)
- `429`: Too many requests (rate limit)
- `500-599`: Server error (site issue)
- `Timeout`: Request took too long

**Protection Type**:
- Indicates what protection was detected
- See [Protection Type Meanings](#protection-type-meanings)
- Use to determine resolution strategy

**Response Time**:
- Normal: < 5000ms
- Slow: 5000-15000ms
- Very slow: > 15000ms
- Timeout: > configured timeout

**Attempt Number**:
- Shows which retry attempt this was
- Higher numbers indicate persistent issues
- Review earlier attempts for patterns

**Strategy Used**:
- Shows which scraping method was used
- Compare success rates across strategies
- Identify which strategies work best

### Log Analysis Patterns

**Pattern 1: Consistent Failures with Same Status Code**

Example:
```
Attempt 1: 403 - ip_block
Attempt 2: 403 - ip_block
Attempt 3: 403 - ip_block
```

**Diagnosis**: IP blocking

**Solution**: Enable proxies, increase delays

---

**Pattern 2: Intermittent Failures**

Example:
```
Attempt 1: 200 - success
Attempt 2: 429 - rate_limit
Attempt 3: 200 - success
Attempt 4: 429 - rate_limit
```

**Diagnosis**: Rate limiting

**Solution**: Increase delays, reduce frequency

---

**Pattern 3: Escalating Protection**

Example:
```
Attempt 1: 200 - success (fake data)
Attempt 2: 403 - ip_block
Attempt 3: CAPTCHA detected
```

**Diagnosis**: Site is escalating protection

**Solution**: Use stealth browser, residential proxies, longer delays

---

**Pattern 4: Parsing Failures**

Example:
```
Attempt 1: 200 - success (no price extracted)
Attempt 2: 200 - success (no price extracted)
Attempt 3: 200 - success (no price extracted)
```

**Diagnosis**: Selector issue or JavaScript required

**Solution**: Update selectors, enable JavaScript

### Using Response Samples

**Viewing Response Samples**:
1. Go to scrape attempt details
2. View response sample (first 1KB)
3. Look for clues:
   - Error messages
   - CAPTCHA forms
   - Redirect notices
   - Missing content

**Common Patterns in Responses**:

**IP Block**:
```html
<h1>Access Denied</h1>
<p>Your IP address has been blocked</p>
```

**CAPTCHA**:
```html
<div class="g-recaptcha" data-sitekey="..."></div>
```

**Rate Limit**:
```html
<h1>429 Too Many Requests</h1>
<p>Please slow down</p>
```

**JavaScript Required**:
```html
<div id="price-container">
  <!-- Price loads via JavaScript -->
</div>
```

### Using Screenshots

**When Available**:
- Headless browser attempts capture screenshots
- Stored for 7 days
- Accessible via logs

**What to Look For**:
- CAPTCHA challenges
- Error pages
- Blank pages (JavaScript issue)
- Correct page loaded but wrong selector

**Accessing Screenshots**:
```
Admin → Scraping Monitor → Logs → View Attempt → Screenshot
```

Or via API:
```bash
curl -X GET \
  https://your-domain.com/api/v1/scraping/attempts/{attemptId}/screenshot \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  --output screenshot.png
```


---

## Quick Reference

### Troubleshooting Flowchart

```
Start: Scraping Failure
  │
  ├─ Check Protection Type
  │
  ├─ IP Block?
  │   └─ Enable proxies + increase delays
  │
  ├─ Rate Limit?
  │   └─ Increase delays + reduce frequency
  │
  ├─ CAPTCHA?
  │   └─ Stealth browser + proxies + long delays
  │
  ├─ Fake Data?
  │   └─ Headless browser + verify selectors
  │
  ├─ Redirect?
  │   └─ Regional proxies + verify URL
  │
  ├─ Timeout?
  │   └─ Increase timeout + check proxy speed
  │
  ├─ Empty Response?
  │   └─ Enable JavaScript + verify selectors
  │
  └─ Parsing Failure?
      └─ Update selectors + test manually
```

### Quick Fixes by Protection Type

| Protection Type | Quick Fix | Configuration Change |
|----------------|-----------|---------------------|
| IP Block | Enable proxies | `proxyRequired: true` |
| Rate Limit | Increase delays | `baseDelayMs: 5000` |
| CAPTCHA | Stealth browser | `preferredStrategy: "stealth_browser"` |
| Fake Data | Headless browser | `requiresJavaScript: true` |
| Redirect | Regional proxies | Add proxies from correct region |
| Timeout | Increase timeout | `timeoutMs: 60000` |
| Empty Response | Enable JavaScript | `requiresJavaScript: true` |
| Parsing Failure | Update selectors | Customize `priceSelectors` |

### Common Error Messages

| Error Message | Meaning | Solution |
|--------------|---------|----------|
| "Access Denied" | IP blocked | Enable proxies |
| "Too Many Requests" | Rate limited | Increase delays |
| "CAPTCHA required" | CAPTCHA challenge | Stealth browser + proxies |
| "Connection timeout" | Request too slow | Increase timeout |
| "Price not found" | Selector issue | Update selectors |
| "Invalid response" | Parsing error | Check response sample |
| "Proxy authentication failed" | Proxy credentials wrong | Verify proxy settings |
| "All proxies blocked" | No available proxies | Add more proxies |

### Success Rate Interpretation

| Success Rate | Status | Action Required |
|-------------|--------|-----------------|
| 90-100% | 🟢 Healthy | Monitor regularly |
| 80-89% | 🟡 Good | Minor optimization |
| 50-79% | 🟠 Degraded | Investigate and fix |
| 20-49% | 🔴 Poor | Urgent action needed |
| 0-19% | ⛔ Critical | Immediate intervention |

### Configuration Templates

**Conservative (High Success)**:
```json
{
  "preferredStrategy": "stealth_browser",
  "proxyRequired": true,
  "baseDelayMs": 10000,
  "maxDelayMs": 600000,
  "backoffMultiplier": 3.0,
  "maxRetries": 5,
  "timeoutMs": 60000
}
```

**Balanced (Good Performance)**:
```json
{
  "preferredStrategy": "headless_browser",
  "proxyRequired": true,
  "baseDelayMs": 3000,
  "maxDelayMs": 300000,
  "backoffMultiplier": 2.0,
  "maxRetries": 3,
  "timeoutMs": 30000
}
```

**Aggressive (Fast but Risky)**:
```json
{
  "preferredStrategy": "http_client",
  "proxyRequired": false,
  "baseDelayMs": 1000,
  "maxDelayMs": 60000,
  "backoffMultiplier": 1.5,
  "maxRetries": 2,
  "timeoutMs": 15000
}
```

### Diagnostic Commands

**Check Site Metrics**:
```bash
curl -X GET \
  "https://your-domain.com/api/v1/scraping/metrics/sites/{competitorWebsiteId}?timeWindow=last_24_hours" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

**View Recent Failures**:
```bash
curl -X GET \
  "https://your-domain.com/api/v1/scraping/attempts?competitorWebsiteId={id}&success=false&limit=10" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

**Check Proxy Health**:
```bash
curl -X GET \
  "https://your-domain.com/api/v1/scraping/proxies/{proxyId}/health" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

**Test Configuration**:
```bash
curl -X POST \
  "https://your-domain.com/api/v1/scraping/configs/{competitorWebsiteId}/test" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "testUrl": "https://competitor.com/product/123",
    "config": { /* your config */ }
  }'
```

---

## When to Escalate

### Contact Support If:

- Success rate < 20% for > 48 hours despite fixes
- All proxies consistently blocked
- CAPTCHA challenges persist after all mitigations
- Site appears to have new protection mechanism
- Configuration changes have no effect
- Suspected bug in scraping system

### Information to Provide:

1. **Competitor Website Details**:
   - Website name and URL
   - Example product URL
   - Current success rate

2. **Configuration**:
   - Current scraping configuration
   - Changes attempted
   - Test results

3. **Logs**:
   - Recent scrape attempt IDs
   - Protection types detected
   - Error messages

4. **Timeline**:
   - When did issues start?
   - What changed?
   - Troubleshooting steps taken

### Support Channels:

- **Email**: support@pricepilot.com
- **Priority Support**: priority@pricepilot.com (for critical issues)
- **Documentation**: https://docs.pricepilot.com
- **Community Forum**: https://community.pricepilot.com

---

## Additional Resources

- [Configuration Guide](./BOT_PROTECTION_CONFIGURATION_GUIDE.md)
- [API Reference](./BOT_PROTECTION_API_REFERENCE.md)
- [User Guide](./BOT_PROTECTION_USER_GUIDE.md)
- [Stealth Scraping Best Practices](./STEALTH_SCRAPING.md)
