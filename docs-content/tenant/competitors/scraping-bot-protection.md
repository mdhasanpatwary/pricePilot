---
title: "Scraping & Bot Protection"
description: "Complete guide to competitor scraping frequency, bot protection mitigation, and site profile configuration"
category: "competitors"
subcategory: null
tags: ["scraping", "bot-protection", "captcha", "rate-limiting", "site-profiles", "ip-blocking"]
author: "PricePilot Team"
lastReviewed: "2024-02-05"
relatedDocs: ["scraping-configuration", "adding-competitors", "site-profile-examples"]
---

# Scraping & Bot Protection

## Overview

PricePilot automatically collects competitor pricing data through web scraping - the process of visiting competitor websites and extracting product prices. This guide explains how scraping works, the challenges posed by bot protection systems, and how PricePilot handles these challenges to maintain reliable price tracking.

### What You'll Learn

- **Scraping Frequency**: Understanding the 24-hour scraping schedule
- **CAPTCHA Handling**: How PricePilot detects and resolves CAPTCHA challenges
- **IP Blocking**: Proxy rotation and IP management strategies
- **Rate Limiting**: Respecting competitor site limits
- **Error Handling**: Retry logic and failure management
- **Site Profiles**: Customizing scraping settings per competitor


## Scraping Frequency

### 24-Hour Scraping Schedule

PricePilot operates on a **24-hour scraping schedule** for all competitor websites. This means each competitor site is visited once every 24 hours to collect current pricing data.

**Key Points:**
- **Frequency**: Once every 24 hours per competitor
- **Consistency**: Same time each day for predictable updates
- **Reliability**: Balanced approach for accurate data without overwhelming sites
- **Coverage**: All matched products are checked during each scraping cycle

### Why 24 Hours?

The 24-hour frequency is carefully chosen to balance several important factors:

#### 1. Data Freshness vs. Reliability

**Data Freshness**
- Provides daily updates on competitor pricing
- Captures most significant price changes
- Keeps your pricing strategy current

**Reliability**
- Reduces risk of triggering bot protection systems
- Maintains consistent access to competitor data
- Minimizes scraping failures and blocks

#### 2. Respectful Scraping

**Website Performance**
- Doesn't overwhelm competitor servers
- Respects bandwidth and server resources
- Maintains ethical scraping practices

**Bot Protection Avoidance**
- Lower frequency reduces detection risk
- Appears more like human browsing behavior
- Decreases CAPTCHA trigger likelihood

#### 3. Market Reality

**E-commerce Pricing Patterns**
- Most competitors update prices daily or less frequently
- Hourly price changes are rare in most industries
- Daily snapshots capture meaningful price movements

**Business Decision Making**
- Daily data is sufficient for strategic pricing decisions
- Allows time for thoughtful price approval reviews
- Aligns with typical business planning cycles

### Setting Realistic Expectations

> **Important**: PricePilot is designed for strategic price monitoring, not real-time price tracking. The 24-hour schedule provides reliable, actionable intelligence for informed pricing decisions.

**What to Expect:**
- ✅ Daily competitor price updates
- ✅ Consistent, reliable data collection
- ✅ Comprehensive product coverage
- ✅ Historical price trend tracking

**What NOT to Expect:**
- ❌ Real-time or hourly price updates
- ❌ Instant notification of competitor changes
- ❌ Minute-by-minute price monitoring
- ❌ Flash sale or dynamic pricing tracking

### Scraping Schedule Details

#### When Scraping Occurs

Scraping runs are scheduled based on when you add each competitor:

**Example Timeline:**
- Competitor added: February 1, 2024 at 10:00 AM
- First scrape: February 1, 2024 at 10:00 AM
- Second scrape: February 2, 2024 at 10:00 AM
- Third scrape: February 3, 2024 at 10:00 AM
- And so on...

#### Viewing Scraping Status

Check when the next scrape will occur:

1. Navigate to **Competitors** page
2. View the **Last Scraped** column
3. Check the **Next Scrape** timestamp
4. Monitor **Scraping Status** indicator

**Status Indicators:**
- 🟢 **Active**: Scraping is running normally
- 🟡 **Pending**: Scrape scheduled, waiting to run
- 🔴 **Failed**: Last scrape encountered errors
- ⏸️ **Paused**: Scraping temporarily disabled

### Customization Options

#### Per-Competitor Scheduling

While the default is 24 hours, you can adjust timing for specific competitors:

**Available Options:**
- **Standard (24 hours)**: Default, recommended for most competitors
- **Priority (12 hours)**: For critical competitors (requires premium plan)
- **Low Priority (48 hours)**: For less important competitors

**To Adjust Frequency:**
1. Go to **Competitors** page
2. Click on the competitor name
3. Select **Scraping Settings**
4. Choose **Scraping Frequency**
5. Click **Save Changes**

> **Note**: More frequent scraping increases the risk of bot protection triggers. Use higher frequencies only when necessary and monitor success rates closely.

#### Manual Scraping

Need immediate data? Trigger a manual scrape:

1. Navigate to **Competitors** page
2. Click on the competitor
3. Click **Scrape Now** button
4. Wait for scraping to complete (30-60 seconds)
5. Review updated prices

**Manual Scraping Limits:**
- Maximum 3 manual scrapes per competitor per day
- Must wait 1 hour between manual scrapes
- Does not affect scheduled scraping

### Monitoring Scraping Performance

#### Success Rate Metrics

Track scraping reliability on the Competitors dashboard:

**Success Rate Indicators:**
- **95-100%**: Excellent - No action needed
- **85-94%**: Good - Monitor for patterns
- **70-84%**: Fair - Review scraping logs
- **Below 70%**: Poor - Immediate attention required

#### Scraping History

View detailed scraping history:

1. Go to **Competitors** page
2. Click on competitor name
3. Select **Scraping History** tab
4. Review past scraping attempts

**History Details:**
- Timestamp of each scrape
- Success or failure status
- Number of products updated
- Error messages (if any)
- Response time

### Optimizing for Your Business

#### High-Value Competitors

For your most important competitors:

- Use 12-hour frequency (if available)
- Enable priority scraping
- Set up failure notifications
- Monitor success rates daily

#### Standard Competitors

For typical competitors:

- Use default 24-hour frequency
- Review weekly performance
- Address issues as they arise
- Maintain consistent monitoring

#### Low-Priority Competitors

For less critical competitors:

- Consider 48-hour frequency
- Review monthly performance
- Focus resources on high-value targets
- Remove inactive competitors


## Bot Protection Challenges

Modern e-commerce websites employ sophisticated bot protection systems to prevent automated scraping. PricePilot includes advanced mitigation strategies to maintain reliable data collection while respecting website security measures.

### Common Bot Protection Systems

**CAPTCHA Challenges**
- Visual puzzles requiring human interaction
- reCAPTCHA v2 and v3
- hCaptcha and similar services
- Image recognition challenges

**IP-Based Blocking**
- Rate limiting by IP address
- Geographic IP restrictions
- Blacklisting of data center IPs
- Temporary or permanent IP bans

**Behavioral Analysis**
- Mouse movement tracking
- Keystroke pattern analysis
- Browser fingerprinting
- Session behavior monitoring

**Technical Detection**
- User-agent validation
- JavaScript execution requirements
- Cookie and session management
- HTTP header analysis

## CAPTCHA Handling

### Detection Strategies

PricePilot automatically detects CAPTCHA challenges through multiple methods:

#### 1. Visual Detection

**How It Works:**
- Analyzes page content for CAPTCHA elements
- Identifies common CAPTCHA frameworks (reCAPTCHA, hCaptcha)
- Detects CAPTCHA iframes and widgets
- Recognizes challenge pages

**Detection Indicators:**
- Presence of CAPTCHA-specific HTML elements
- reCAPTCHA or hCaptcha JavaScript libraries
- Challenge page URLs
- Specific CSS classes and IDs

#### 2. Response Analysis

**How It Works:**
- Examines HTTP response codes
- Analyzes response headers
- Checks for redirect patterns
- Identifies challenge pages

**Common Patterns:**
- 403 Forbidden with CAPTCHA page
- 429 Too Many Requests with challenge
- Redirects to verification pages
- Specific response headers

#### 3. Content Verification

**How It Works:**
- Verifies expected content is present
- Checks for price data availability
- Validates product information
- Confirms page structure

**Failure Indicators:**
- Missing price selectors
- Incomplete product data
- Unexpected page structure
- Challenge page content

### Resolution Strategies

When CAPTCHA is detected, PricePilot employs several resolution strategies:

#### Strategy 1: Automatic Retry with Delay

**Process:**
1. Detect CAPTCHA challenge
2. Wait for extended period (5-15 minutes)
3. Retry with fresh session
4. Use different user-agent if needed

**Success Rate:** 30-40% for temporary challenges

**Best For:**
- Temporary rate limiting
- Soft CAPTCHA triggers
- First-time challenges

#### Strategy 2: Session Rotation

**Process:**
1. Detect CAPTCHA challenge
2. Rotate to new session
3. Clear cookies and cache
4. Retry with clean state

**Success Rate:** 40-50% for session-based challenges

**Best For:**
- Session-based detection
- Cookie tracking
- Persistent challenges

#### Strategy 3: IP Rotation (Premium Feature)

**Process:**
1. Detect CAPTCHA challenge
2. Switch to different IP address
3. Use residential proxy network
4. Retry from new IP

**Success Rate:** 70-80% for IP-based challenges

**Best For:**
- IP-based rate limiting
- Geographic restrictions
- Persistent IP blocks

#### Strategy 4: Manual Intervention Queue

**Process:**
1. Detect persistent CAPTCHA
2. Queue for manual review
3. Notify system administrators
4. Manual CAPTCHA solving (if enabled)

**Success Rate:** 95%+ with human intervention

**Best For:**
- Complex CAPTCHA challenges
- High-value competitors
- Persistent failures

### CAPTCHA Prevention

Prevent CAPTCHA triggers before they occur:

#### 1. Respectful Scraping Patterns

**Best Practices:**
- Maintain 24-hour scraping frequency
- Add random delays between requests (2-5 seconds)
- Limit concurrent requests (1-2 per site)
- Respect robots.txt directives

**Configuration:**
```
Scraping Frequency: 24 hours
Request Delay: 3-5 seconds (random)
Concurrent Requests: 1
Respect robots.txt: Enabled
```

#### 2. Realistic Browser Behavior

**Techniques:**
- Use realistic user-agent strings
- Maintain consistent browser fingerprint
- Execute JavaScript naturally
- Handle cookies properly

**User-Agent Rotation:**
- Chrome (latest versions)
- Firefox (latest versions)
- Safari (latest versions)
- Edge (latest versions)

#### 3. Session Management

**Strategies:**
- Maintain session cookies
- Respect session timeouts
- Clear sessions periodically
- Avoid session reuse across days

#### 4. Request Patterns

**Natural Patterns:**
- Vary request timing
- Add random delays
- Mimic human browsing speed
- Avoid predictable patterns

### Monitoring CAPTCHA Encounters

Track CAPTCHA challenges in your dashboard:

#### CAPTCHA Metrics

**Available Metrics:**
- CAPTCHA encounter rate per competitor
- Resolution success rate
- Average resolution time
- Failed resolution attempts

**Viewing Metrics:**
1. Navigate to **Competitors** page
2. Click on competitor name
3. Select **Bot Protection** tab
4. Review CAPTCHA statistics

#### CAPTCHA Alerts

Set up notifications for CAPTCHA issues:

**Alert Types:**
- CAPTCHA detected (informational)
- Multiple CAPTCHA failures (warning)
- Persistent CAPTCHA blocking (critical)
- Resolution success (informational)

**Configuring Alerts:**
1. Go to **Settings** → **Notifications**
2. Enable **Bot Protection Alerts**
3. Set alert thresholds
4. Choose notification channels (email, in-app)

### Troubleshooting CAPTCHA Issues

#### High CAPTCHA Encounter Rate

**Symptoms:**
- Frequent CAPTCHA challenges (>20% of scrapes)
- Declining success rates
- Increased scraping failures

**Solutions:**
1. **Reduce Scraping Frequency**
   - Change from 24 hours to 48 hours
   - Temporarily pause scraping
   - Allow "cooldown" period

2. **Enable IP Rotation** (Premium)
   - Activate residential proxy network
   - Distribute requests across IPs
   - Reduce per-IP request rate

3. **Adjust Request Patterns**
   - Increase delays between requests
   - Reduce concurrent requests to 1
   - Add more randomization

4. **Review Site Profile**
   - Check if selectors are correct
   - Verify JavaScript rendering settings
   - Update user-agent configuration

#### Persistent CAPTCHA Blocking

**Symptoms:**
- 100% CAPTCHA rate for specific competitor
- All resolution strategies failing
- Extended blocking period (days/weeks)

**Solutions:**
1. **Contact Support**
   - Report persistent blocking
   - Request manual intervention
   - Discuss alternative approaches

2. **Temporary Pause**
   - Pause scraping for 7-14 days
   - Allow IP reputation to recover
   - Resume with conservative settings

3. **Alternative Data Sources**
   - Check if competitor has API
   - Look for official price feeds
   - Consider manual price updates

4. **Site Profile Optimization**
   - Review and update site profile
   - Test with different configurations
   - Enable advanced bypass features

## IP Blocking and Management

### Understanding IP Blocking

Websites block IP addresses to prevent automated scraping:

#### Types of IP Blocks

**1. Rate-Based Blocking**
- Too many requests from single IP
- Exceeds per-IP rate limits
- Temporary blocks (hours to days)

**2. Geographic Blocking**
- Blocks data center IP ranges
- Restricts non-residential IPs
- Permanent or long-term blocks

**3. Reputation-Based Blocking**
- Blacklisted IP addresses
- Known scraping IP ranges
- Shared hosting IP blocks

**4. Behavioral Blocking**
- Suspicious activity patterns
- Bot-like behavior detection
- Automated request patterns

### Proxy Rotation Strategy

PricePilot uses intelligent proxy rotation to avoid IP blocking:

#### How Proxy Rotation Works

**1. Residential Proxy Network**
- Real residential IP addresses
- Distributed across geographic locations
- Appears as legitimate user traffic
- High success rate for bot protection

**2. Automatic IP Switching**
- Rotates IPs between requests
- Distributes load across IP pool
- Prevents per-IP rate limiting
- Maintains session consistency

**3. Geographic Distribution**
- Matches target website geography
- Uses local IPs for regional sites
- Avoids geographic restrictions
- Improves success rates

**4. Smart Rotation Logic**
- Tracks IP success rates
- Avoids recently blocked IPs
- Prioritizes high-performing IPs
- Adapts to site-specific patterns

#### Proxy Configuration

**Standard Plan:**
- Shared proxy pool
- Automatic rotation
- Basic geographic distribution
- Standard success rates

**Premium Plan:**
- Dedicated proxy pool
- Advanced rotation algorithms
- Precise geographic targeting
- Higher success rates
- Priority IP allocation

**Enabling Proxy Rotation:**
1. Navigate to **Settings** → **Scraping**
2. Enable **Proxy Rotation**
3. Select **Geographic Regions** (if applicable)
4. Choose **Rotation Strategy**
5. Save configuration

### IP Management Best Practices

#### 1. Monitor IP Health

Track IP performance metrics:

**Key Metrics:**
- Success rate per IP
- Block rate per IP
- Average response time
- Geographic distribution

**Viewing IP Metrics:**
1. Go to **Settings** → **Scraping**
2. Select **IP Management** tab
3. Review IP pool statistics
4. Identify problematic IPs

#### 2. Rotate Proactively

Don't wait for blocks:

**Proactive Strategies:**
- Rotate IPs every 10-20 requests
- Use different IPs for different competitors
- Avoid reusing IPs within 24 hours
- Maintain diverse IP pool

#### 3. Respect Rate Limits

Even with rotation:

**Rate Limit Guidelines:**
- Maximum 1 request per 3 seconds per site
- No more than 100 requests per hour per site
- Distribute requests across time
- Add random delays

#### 4. Geographic Matching

Use appropriate IPs:

**Matching Strategy:**
- US competitors → US residential IPs
- EU competitors → EU residential IPs
- Regional sites → Local IPs
- Global sites → Diverse IP pool

### Handling IP Blocks

#### Detecting IP Blocks

**Block Indicators:**
- 403 Forbidden responses
- Connection timeouts
- CAPTCHA challenges
- Redirect to block pages

**Automatic Detection:**
- PricePilot automatically detects blocks
- Marks IPs as temporarily unavailable
- Rotates to alternative IPs
- Logs block events

#### Recovery Strategies

**1. Automatic IP Rotation**
- Immediately switch to new IP
- Retry request from different IP
- Mark blocked IP for cooldown
- Resume scraping without interruption

**2. IP Cooldown Period**
- Blocked IPs rest for 24-48 hours
- Allows reputation recovery
- Prevents repeated blocks
- Gradual reintroduction

**3. IP Pool Expansion**
- Add more IPs to pool (Premium)
- Increase geographic diversity
- Reduce per-IP request load
- Improve overall success rate

**4. Alternative Approaches**
- Reduce scraping frequency
- Adjust request patterns
- Enable advanced bypass features
- Contact support for assistance

## Rate Limiting

### Understanding Rate Limits

Rate limiting controls how many requests can be made within a time period:

#### Why Websites Use Rate Limiting

**Server Protection**
- Prevents server overload
- Maintains site performance
- Protects against DDoS attacks
- Ensures fair resource usage

**Bot Prevention**
- Identifies automated traffic
- Slows down scrapers
- Protects competitive data
- Maintains data integrity

**Business Protection**
- Prevents data harvesting
- Protects pricing strategies
- Maintains competitive advantage
- Controls information access

### PricePilot's Rate Limiting Respect

PricePilot is designed to respect website rate limits:

#### 1. Conservative Request Rates

**Default Settings:**
- 1 request per 3-5 seconds
- Maximum 20 requests per minute
- Maximum 100 requests per hour per site
- 24-hour scraping frequency

**Why Conservative:**
- Prevents triggering rate limits
- Maintains reliable access
- Respects website resources
- Ensures long-term sustainability

#### 2. Adaptive Rate Limiting

**How It Works:**
- Monitors response times
- Detects rate limit signals
- Automatically slows down
- Adjusts to site-specific limits

**Rate Limit Detection:**
- 429 Too Many Requests responses
- Slow response times
- Connection timeouts
- Rate limit headers

**Automatic Adjustments:**
- Increases delays between requests
- Reduces concurrent requests
- Implements exponential backoff
- Waits for rate limit reset

#### 3. Distributed Request Patterns

**Strategies:**
- Spreads requests over time
- Avoids burst patterns
- Uses random delays
- Mimics human browsing

**Time Distribution:**
```
Example 24-hour scraping cycle:
- 100 products to scrape
- 3-5 second delay between requests
- Total time: 5-8 minutes
- Spread across scraping window
```

### Configuring Rate Limiting

#### Per-Competitor Settings

Customize rate limits for specific competitors:

**Configuration Options:**
1. Navigate to **Competitors** page
2. Click on competitor name
3. Select **Scraping Settings**
4. Adjust **Rate Limiting** settings:
   - Request delay (seconds)
   - Max requests per minute
   - Max requests per hour
   - Concurrent requests

**Recommended Settings:**

**Standard Websites:**
```
Request Delay: 3-5 seconds
Max Requests/Minute: 15-20
Max Requests/Hour: 100
Concurrent Requests: 1
```

**Strict Websites:**
```
Request Delay: 5-10 seconds
Max Requests/Minute: 10
Max Requests/Hour: 50
Concurrent Requests: 1
```

**Lenient Websites:**
```
Request Delay: 2-3 seconds
Max Requests/Minute: 20-30
Max Requests/Hour: 150
Concurrent Requests: 2
```

#### Global Rate Limiting

Set default rate limits for all competitors:

1. Go to **Settings** → **Scraping**
2. Select **Global Rate Limits**
3. Configure default settings
4. Apply to all new competitors

### Monitoring Rate Limit Compliance

#### Rate Limit Metrics

Track rate limiting performance:

**Available Metrics:**
- Requests per minute (actual vs. limit)
- Requests per hour (actual vs. limit)
- Rate limit violations
- Automatic slowdown events

**Viewing Metrics:**
1. Navigate to **Competitors** page
2. Click on competitor name
3. Select **Rate Limiting** tab
4. Review compliance statistics

#### Rate Limit Alerts

Get notified of rate limit issues:

**Alert Types:**
- Rate limit exceeded (warning)
- Automatic slowdown activated (info)
- Persistent rate limiting (critical)
- Rate limit compliance restored (info)

**Setting Up Alerts:**
1. Go to **Settings** → **Notifications**
2. Enable **Rate Limit Alerts**
3. Configure alert thresholds
4. Choose notification channels

### Troubleshooting Rate Limit Issues

#### Frequent Rate Limit Errors

**Symptoms:**
- 429 responses
- Slow scraping performance
- Incomplete data collection
- Automatic slowdowns

**Solutions:**
1. **Increase Request Delays**
   - Change from 3s to 5s or higher
   - Add more randomization
   - Reduce burst patterns

2. **Reduce Concurrent Requests**
   - Set to 1 concurrent request
   - Process products sequentially
   - Avoid parallel scraping

3. **Lower Hourly Limits**
   - Reduce max requests per hour
   - Spread requests over longer period
   - Prioritize high-value products

4. **Enable Proxy Rotation**
   - Distribute requests across IPs
   - Reduce per-IP request rate
   - Improve overall throughput

## Error Handling and Retry Logic

### Scraping Error Types

PricePilot handles various scraping errors:

#### 1. Network Errors

**Common Issues:**
- Connection timeouts
- DNS resolution failures
- SSL/TLS errors
- Network unreachable

**Handling:**
- Automatic retry with exponential backoff
- Maximum 3 retry attempts
- Delays: 1s, 2s, 4s
- Logs error for monitoring

#### 2. HTTP Errors

**Common Issues:**
- 404 Not Found (product removed)
- 500 Internal Server Error
- 503 Service Unavailable
- 403 Forbidden (blocking)

**Handling:**
- 404: Mark product as unavailable
- 500/503: Retry after delay
- 403: Trigger bot protection handling
- Log all HTTP errors

#### 3. Parsing Errors

**Common Issues:**
- Price selector not found
- Invalid price format
- Missing product data
- Page structure changed

**Handling:**
- Retry with alternative selectors
- Validate data format
- Log parsing failures
- Alert for persistent issues

#### 4. Bot Protection Errors

**Common Issues:**
- CAPTCHA challenges
- IP blocks
- Rate limiting
- JavaScript challenges

**Handling:**
- Trigger bot protection mitigation
- Rotate IPs if available
- Implement delays
- Queue for manual review if needed

### Retry Logic

#### Exponential Backoff Strategy

**How It Works:**
1. First attempt fails
2. Wait 1 second, retry
3. Second attempt fails
4. Wait 2 seconds, retry
5. Third attempt fails
6. Wait 4 seconds, retry
7. Mark as failed after 3 attempts

**Benefits:**
- Gives temporary issues time to resolve
- Reduces server load
- Increases success rate
- Prevents rapid repeated failures

#### Smart Retry Logic

**Adaptive Retries:**
- Different strategies for different errors
- Network errors: Quick retries
- Rate limits: Long delays
- Bot protection: IP rotation
- Parsing errors: Alternative selectors

**Retry Configuration:**
```
Network Errors:
  Max Retries: 3
  Delays: 1s, 2s, 4s
  
Rate Limit Errors:
  Max Retries: 2
  Delays: 60s, 300s
  
Bot Protection:
  Max Retries: 3
  Delays: 300s, 600s, 1800s
  Strategy: IP rotation + session reset
  
Parsing Errors:
  Max Retries: 2
  Delays: 5s, 10s
  Strategy: Alternative selectors
```

### Error Notifications

Stay informed about scraping errors:

#### Notification Types

**Immediate Alerts:**
- Persistent scraping failures (>3 consecutive)
- Complete competitor unavailability
- Critical bot protection blocking
- System-wide scraping issues

**Daily Digest:**
- Summary of scraping errors
- Success rate by competitor
- Common error patterns
- Recommended actions

**Weekly Report:**
- Comprehensive error analysis
- Trend identification
- Performance metrics
- Optimization recommendations

#### Configuring Notifications

1. Navigate to **Settings** → **Notifications**
2. Enable **Scraping Error Alerts**
3. Choose notification types:
   - Immediate alerts
   - Daily digest
   - Weekly report
4. Select delivery channels:
   - Email
   - In-app notifications
   - Webhook (API integration)
5. Save preferences

### Error Monitoring and Analysis

#### Error Dashboard

View comprehensive error metrics:

**Available Metrics:**
- Error rate by type
- Error rate by competitor
- Success rate trends
- Common error patterns

**Accessing Dashboard:**
1. Go to **Competitors** page
2. Select **Error Analysis** tab
3. Choose time range
4. Review error statistics

#### Error Logs

Detailed error logging for troubleshooting:

**Log Information:**
- Timestamp
- Competitor name
- Product URL
- Error type and message
- HTTP status code
- Retry attempts
- Resolution status

**Viewing Logs:**
1. Navigate to **Competitors** page
2. Click on competitor name
3. Select **Scraping Logs** tab
4. Filter by error type
5. Review detailed error information

#### Error Analysis

Identify patterns and optimize:

**Analysis Features:**
- Group errors by type
- Identify problematic competitors
- Track error trends over time
- Compare success rates
- Generate optimization recommendations

**Using Analysis:**
1. Review error patterns weekly
2. Identify persistent issues
3. Adjust scraping configurations
4. Optimize site profiles
5. Monitor improvement


## Site Profiles

Site profiles allow you to customize scraping settings for each competitor website. Different websites have different structures, bot protection levels, and requirements - site profiles let you optimize scraping for each one.

### What Are Site Profiles?

A site profile is a collection of configuration settings specific to a competitor website:

**Profile Components:**
- **Selectors**: CSS selectors for extracting data
- **Rate Limiting**: Request frequency and delays
- **Bot Protection**: Mitigation strategies
- **JavaScript**: Rendering requirements
- **Authentication**: Login or session handling
- **Custom Headers**: Special HTTP headers

### Why Use Site Profiles?

#### 1. Optimization

**Tailored Configuration:**
- Each website has unique structure
- Different bot protection levels
- Varying performance characteristics
- Site-specific requirements

**Benefits:**
- Higher success rates
- Faster scraping
- More reliable data
- Fewer errors

#### 2. Flexibility

**Customization Options:**
- Adjust settings per competitor
- Test different configurations
- Optimize over time
- Handle edge cases

#### 3. Maintenance

**Easy Updates:**
- Update selectors when sites change
- Adjust to new bot protection
- Modify rate limits as needed
- Document site-specific quirks

### Creating a Site Profile

#### Automatic Profile Creation

When you add a competitor, PricePilot automatically creates a basic site profile:

**Automatic Detection:**
- Analyzes website structure
- Identifies common e-commerce platforms
- Detects bot protection systems
- Configures default selectors

**Supported Platforms:**
- Shopify
- WooCommerce
- Magento
- BigCommerce
- Custom platforms

#### Manual Profile Configuration

Customize the profile for optimal results:

**Step 1: Access Site Profile**
1. Navigate to **Competitors** page
2. Click on competitor name
3. Select **Site Profile** tab
4. Click **Edit Profile**

**Step 2: Configure Selectors**

Define CSS selectors for data extraction:

```css
/* Price Selector */
.product-price .amount
.price-box .price
[data-price]

/* Product Name Selector */
h1.product-title
.product-name
[itemprop="name"]

/* Availability Selector */
.stock-status
.availability
[data-stock]

/* Brand Selector */
.product-brand
[itemprop="brand"]

/* SKU Selector */
.product-sku
[itemprop="sku"]
```

**Step 3: Configure Rate Limiting**

Set request frequency and delays:

```
Request Delay: 3-5 seconds
Max Requests/Minute: 15
Max Requests/Hour: 100
Concurrent Requests: 1
```

**Step 4: Configure Bot Protection**

Enable mitigation strategies:

```
CAPTCHA Handling: Enabled
IP Rotation: Enabled (Premium)
Session Management: Enabled
JavaScript Rendering: Auto-detect
```

**Step 5: Test Configuration**

Verify the profile works:

1. Click **Test Profile** button
2. Enter a sample product URL
3. Review extracted data
4. Verify all fields are captured
5. Adjust selectors if needed

**Step 6: Save Profile**

Save and activate:

1. Review all settings
2. Click **Save Profile**
3. Enable profile for scraping
4. Monitor initial scraping runs

### Site Profile Settings

#### Selector Configuration

**Price Selectors:**

Define multiple selectors for price extraction:

```css
/* Primary selector */
.product-price .amount

/* Fallback selectors */
.price-box .price
[data-price]
.sale-price
```

**How It Works:**
- Tries primary selector first
- Falls back to alternatives if primary fails
- Uses first successful match
- Logs selector performance

**Selector Priority:**
1. Most specific selector
2. Most reliable selector
3. Fallback selectors
4. Generic selectors

**Name Selectors:**

Extract product names:

```css
/* Primary */
h1.product-title

/* Fallbacks */
.product-name
[itemprop="name"]
h1.title
```

**Availability Selectors:**

Detect stock status:

```css
/* In Stock Indicators */
.in-stock
[data-stock="true"]
.available

/* Out of Stock Indicators */
.out-of-stock
[data-stock="false"]
.unavailable
```

**Additional Selectors:**

Optional data extraction:

```css
/* Brand */
.product-brand
[itemprop="brand"]

/* SKU */
.product-sku
[itemprop="sku"]

/* Images */
.product-image img
[itemprop="image"]

/* Description */
.product-description
[itemprop="description"]
```

#### JavaScript Rendering

Configure JavaScript execution:

**Rendering Options:**

**1. Disabled (Fastest)**
- No JavaScript execution
- Static HTML only
- Best for simple sites
- Lowest resource usage

**2. Auto-Detect (Recommended)**
- Detects if JavaScript is needed
- Renders only when necessary
- Balances speed and compatibility
- Adapts to site requirements

**3. Always Enabled**
- Full JavaScript execution
- Handles dynamic content
- Required for SPA sites
- Higher resource usage

**Configuration:**
```
JavaScript Rendering: Auto-detect
Page Load Timeout: 10 seconds
Wait for Selector: .product-price
Wait for Network Idle: true
```

**When to Enable:**
- Prices load via JavaScript
- Dynamic content rendering
- Single Page Applications (SPA)
- AJAX-based price updates

**When to Disable:**
- Static HTML sites
- Server-side rendering
- Performance optimization
- Simple page structures

#### User-Agent Configuration

Customize browser identification:

**User-Agent Options:**

**1. Default (Recommended)**
```
Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 
(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
```

**2. Mobile**
```
Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) 
AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 
Mobile/15E148 Safari/604.1
```

**3. Custom**
```
Your custom user-agent string
```

**User-Agent Rotation:**
- Rotate between multiple user-agents
- Reduces detection patterns
- Mimics diverse user base
- Improves success rates

**Configuration:**
```
User-Agent Strategy: Rotate
User-Agent Pool:
  - Chrome (Windows)
  - Chrome (Mac)
  - Firefox (Windows)
  - Safari (Mac)
Rotation Frequency: Per request
```

#### Custom Headers

Add custom HTTP headers:

**Common Headers:**

```http
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: en-US,en;q=0.9
Accept-Encoding: gzip, deflate, br
Cache-Control: no-cache
Pragma: no-cache
```

**Referer Header:**
```http
Referer: https://www.google.com/
```

**Custom Headers:**
```http
X-Requested-With: XMLHttpRequest
X-Custom-Header: value
```

**When to Use:**
- Site requires specific headers
- Mimicking browser behavior
- API-like endpoints
- Special authentication

#### Cookie Management

Configure cookie handling:

**Cookie Options:**

**1. Accept All (Default)**
- Accepts all cookies
- Maintains sessions
- Handles authentication
- Best compatibility

**2. Essential Only**
- Only essential cookies
- Rejects tracking cookies
- Privacy-focused
- May affect functionality

**3. Custom Rules**
- Define cookie acceptance rules
- Whitelist specific cookies
- Blacklist tracking cookies
- Fine-grained control

**Session Persistence:**
```
Session Duration: 24 hours
Cookie Storage: Enabled
Session Reuse: Disabled
Clear Cookies: After each scrape
```

#### Proxy Configuration

Configure proxy usage per site:

**Proxy Options:**

**1. No Proxy**
- Direct connection
- Fastest performance
- No IP rotation
- Higher block risk

**2. Shared Proxy Pool**
- Automatic IP rotation
- Shared with other users
- Cost-effective
- Standard success rates

**3. Dedicated Proxy Pool (Premium)**
- Exclusive IP addresses
- Higher success rates
- Better performance
- Priority support

**Geographic Targeting:**
```
Proxy Region: Auto-detect
Preferred Regions:
  - United States
  - Canada
  - United Kingdom
Avoid Regions:
  - Data center IPs
```

### Site Profile Templates

Use pre-configured templates for common platforms:

#### Shopify Template

Optimized for Shopify stores:

```yaml
Platform: Shopify
Selectors:
  Price: .product-price .money
  Name: h1.product-title
  Availability: .product-form__inventory
  SKU: .product-sku
JavaScript: Auto-detect
Rate Limiting:
  Delay: 3-5 seconds
  Max/Hour: 100
Bot Protection: Standard
```

#### WooCommerce Template

Optimized for WooCommerce:

```yaml
Platform: WooCommerce
Selectors:
  Price: .woocommerce-Price-amount
  Name: .product_title
  Availability: .stock
  SKU: .sku
JavaScript: Disabled
Rate Limiting:
  Delay: 2-4 seconds
  Max/Hour: 150
Bot Protection: Minimal
```

#### Magento Template

Optimized for Magento:

```yaml
Platform: Magento
Selectors:
  Price: .price-box .price
  Name: .page-title
  Availability: .stock.available
  SKU: .product.attribute.sku
JavaScript: Enabled
Rate Limiting:
  Delay: 4-6 seconds
  Max/Hour: 80
Bot Protection: Strict
```

#### Custom Platform Template

For custom or unknown platforms:

```yaml
Platform: Custom
Selectors:
  Price: [data-price], .price, .amount
  Name: h1, .product-name, [itemprop="name"]
  Availability: .stock, .availability, [data-stock]
  SKU: .sku, [itemprop="sku"]
JavaScript: Auto-detect
Rate Limiting:
  Delay: 3-5 seconds
  Max/Hour: 100
Bot Protection: Standard
```

### Testing Site Profiles

#### Test Scrape Feature

Test your site profile before deploying:

**Step 1: Access Test Tool**
1. Navigate to competitor's site profile
2. Click **Test Profile** button
3. Enter test product URL

**Step 2: Run Test**
1. Click **Run Test Scrape**
2. Wait for results (10-30 seconds)
3. Review extracted data

**Step 3: Verify Results**

Check extracted data:

```json
{
  "success": true,
  "data": {
    "price": 99.99,
    "name": "Example Product",
    "availability": "In Stock",
    "sku": "PROD-001",
    "brand": "Brand Name"
  },
  "selectors": {
    "price": ".product-price .amount (success)",
    "name": "h1.product-title (success)",
    "availability": ".stock-status (success)",
    "sku": ".product-sku (success)"
  },
  "performance": {
    "responseTime": 1.2,
    "renderTime": 0.8,
    "totalTime": 2.0
  }
}
```

**Step 4: Adjust if Needed**

If data extraction fails:

1. Review selector results
2. Inspect website HTML
3. Update selectors
4. Test again
5. Repeat until successful

#### Validation Checks

Automatic validation during testing:

**Data Validation:**
- ✅ Price is numeric
- ✅ Price is positive
- ✅ Name is not empty
- ✅ Availability is valid status
- ✅ SKU format is correct

**Selector Validation:**
- ✅ Selectors return results
- ✅ Multiple products handled correctly
- ✅ Fallback selectors work
- ✅ No JavaScript errors

**Performance Validation:**
- ✅ Response time < 5 seconds
- ✅ No timeouts
- ✅ No rate limit errors
- ✅ No bot protection triggers

### Managing Site Profiles

#### Profile Versioning

Track profile changes over time:

**Version History:**
- Automatic versioning on save
- Track selector changes
- Monitor performance changes
- Rollback to previous versions

**Viewing History:**
1. Open site profile
2. Click **Version History**
3. Review past versions
4. Compare changes
5. Restore previous version if needed

#### Profile Cloning

Reuse profiles for similar sites:

**Cloning Process:**
1. Open source site profile
2. Click **Clone Profile**
3. Enter new competitor name
4. Adjust settings as needed
5. Save cloned profile

**Use Cases:**
- Multiple stores on same platform
- Similar website structures
- Testing variations
- Backup configurations

#### Profile Sharing

Share profiles with team members:

**Sharing Options:**
- Export profile as JSON
- Import profile from JSON
- Share via profile library
- Team profile templates

**Export Profile:**
```json
{
  "name": "Example Competitor Profile",
  "platform": "Shopify",
  "selectors": {
    "price": ".product-price .amount",
    "name": "h1.product-title",
    "availability": ".stock-status"
  },
  "rateLimiting": {
    "delay": 3,
    "maxPerHour": 100
  },
  "botProtection": {
    "captchaHandling": true,
    "ipRotation": true
  }
}
```

### Troubleshooting Site Profiles

#### Common Issues

**Issue 1: No Price Extracted**

**Symptoms:**
- Price field is empty
- Scraping succeeds but no price data
- Price shows as $0.00

**Solutions:**
1. Inspect website HTML
2. Verify price selector
3. Check if JavaScript rendering needed
4. Test with alternative selectors
5. Enable JavaScript if prices load dynamically

**Issue 2: Wrong Price Extracted**

**Symptoms:**
- Incorrect price value
- Old price instead of current price
- Sale price vs. regular price confusion

**Solutions:**
1. Review selector specificity
2. Check for multiple price elements
3. Prioritize sale price selector
4. Exclude crossed-out prices
5. Validate price format

**Issue 3: Scraping Fails Consistently**

**Symptoms:**
- 100% failure rate
- Timeouts or errors
- Bot protection triggered

**Solutions:**
1. Increase request delays
2. Enable IP rotation
3. Adjust rate limiting
4. Enable JavaScript rendering
5. Review bot protection settings
6. Test with different user-agents

**Issue 4: Slow Scraping Performance**

**Symptoms:**
- Long scraping times
- Timeouts
- Incomplete data collection

**Solutions:**
1. Disable JavaScript if not needed
2. Reduce page load timeout
3. Optimize selectors
4. Remove unnecessary data extraction
5. Increase concurrent requests (carefully)

#### Debugging Tools

**Selector Inspector:**

Test selectors in browser:

1. Open competitor website
2. Open browser DevTools (F12)
3. Use Console to test selectors:

```javascript
// Test price selector
document.querySelector('.product-price .amount')

// Test multiple selectors
document.querySelectorAll('.product-price .amount')

// Test with jQuery (if available)
$('.product-price .amount').text()
```

**Network Inspector:**

Analyze network requests:

1. Open browser DevTools
2. Go to Network tab
3. Load product page
4. Review:
   - Request timing
   - Response codes
   - Headers
   - Cookies
   - JavaScript files

**Performance Profiler:**

Measure scraping performance:

1. Open site profile
2. Click **Performance Test**
3. Run multiple test scrapes
4. Review metrics:
   - Average response time
   - Success rate
   - Error patterns
   - Bottlenecks

### Best Practices

#### 1. Start with Templates

Use platform templates as starting point:

**Benefits:**
- Pre-configured settings
- Proven selectors
- Optimized performance
- Faster setup

**Process:**
1. Identify competitor platform
2. Select matching template
3. Customize as needed
4. Test thoroughly

#### 2. Test Thoroughly

Always test before deploying:

**Testing Checklist:**
- ✅ Test with multiple products
- ✅ Verify all data fields
- ✅ Check edge cases (out of stock, sale prices)
- ✅ Test performance
- ✅ Monitor for errors

#### 3. Monitor Performance

Track profile performance over time:

**Key Metrics:**
- Success rate
- Average response time
- Error rate
- Data completeness

**Review Schedule:**
- Daily: Check success rates
- Weekly: Review error patterns
- Monthly: Optimize configurations

#### 4. Keep Profiles Updated

Maintain profiles as sites change:

**Maintenance Tasks:**
- Update selectors when sites redesign
- Adjust rate limits based on performance
- Optimize bot protection settings
- Remove obsolete configurations

**Update Triggers:**
- Scraping failures increase
- Website redesign detected
- New bot protection implemented
- Performance degradation

#### 5. Document Custom Settings

Document site-specific quirks:

**Documentation Items:**
- Why custom settings were needed
- Known issues and workarounds
- Optimal configuration values
- Contact information for support

**Example Documentation:**
```
Competitor: Example Store
Platform: Custom Magento
Notes:
- Requires JavaScript rendering for prices
- Rate limit: Max 50 requests/hour
- CAPTCHA triggers above 100 requests/day
- Best scraping time: 2-6 AM EST
- Contact: support@example.com for API access
```

## Related Documentation

- [Scraping Configuration](/docs/competitors/scraping-configuration) - Basic scraping setup
- [Adding Competitors](/docs/competitors/adding-competitors) - How to add competitors
- [Site Profile Examples](/docs/competitors/site-profile-examples) - Example configurations
- [Common Issues](/docs/troubleshooting/common-issues) - Troubleshooting guide

## Support

Need help with scraping or bot protection?

- **Documentation**: Browse our [complete documentation](/docs)
- **Site Profile Help**: Contact support for custom profile configuration
- **Bot Protection Issues**: Report persistent blocking for assistance
- **Community**: Join our community forum for tips and best practices

## Frequently Asked Questions

**Q: Can I scrape competitors more frequently than 24 hours?**

A: Yes, premium plans support 12-hour and 6-hour scraping frequencies. However, more frequent scraping increases the risk of bot protection triggers. We recommend starting with 24 hours and only increasing frequency if needed.

**Q: What happens if a competitor blocks PricePilot?**

A: PricePilot automatically detects blocks and implements mitigation strategies including IP rotation, session management, and CAPTCHA handling. Persistent blocks are escalated to our support team for manual intervention.

**Q: How do I know if my site profile is working correctly?**

A: Use the Test Profile feature to verify data extraction. Monitor success rates on the Competitors dashboard. Success rates above 95% indicate a well-configured profile.

**Q: Can PricePilot handle CAPTCHA challenges?**

A: Yes, PricePilot includes automatic CAPTCHA detection and resolution strategies. For persistent CAPTCHA challenges, premium plans include advanced CAPTCHA solving capabilities.

**Q: What if a competitor's website structure changes?**

A: You'll need to update the site profile selectors. PricePilot will alert you when scraping failures increase, indicating a potential site change. Use the Test Profile feature to identify and fix selector issues.

**Q: Is web scraping legal?**

A: Web scraping for competitive intelligence is generally legal when done responsibly. PricePilot respects robots.txt, implements rate limiting, and follows ethical scraping practices. However, always review your local laws and competitor terms of service.

**Q: How does PricePilot avoid being detected as a bot?**

A: PricePilot uses multiple strategies including realistic user-agents, IP rotation, natural request patterns, JavaScript rendering, session management, and respectful rate limiting to appear as legitimate traffic.

**Q: Can I scrape competitors that require login?**

A: Currently, PricePilot focuses on publicly accessible product pages. Scraping behind authentication is not supported in the standard plan. Contact support for custom solutions.

**Q: What should I do if scraping is too slow?**

A: Review your site profile settings. Disable JavaScript rendering if not needed, optimize selectors, reduce data extraction to essential fields only, and ensure rate limiting isn't too conservative.

**Q: How do I report a competitor that can't be scraped?**

A: Contact support with the competitor URL and any error messages. Our team will analyze the site and create a custom site profile if possible. Some sites with extreme bot protection may not be scrapable.

