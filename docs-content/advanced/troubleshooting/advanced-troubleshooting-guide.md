---
title: "Advanced Troubleshooting Guide"
description: "Comprehensive diagnostic and troubleshooting guide for scraping issues, integration problems, API errors, and advanced debugging techniques"
category: "advanced"
subcategory: null
tags: ["troubleshooting", "debugging", "diagnostics", "errors", "logs", "scraping", "integration", "api"]
author: "PricePilot Team"
lastReviewed: "2024-02-05"
relatedDocs: ["scraping-bot-protection", "api-documentation", "opencart-setup", "laravel-setup"]
---

# Advanced Troubleshooting Guide

Comprehensive diagnostic and troubleshooting guide for resolving complex issues with PricePilot. This guide covers scraping failures, integration problems, API connection errors, and advanced debugging techniques for power users and developers.

## Overview

This guide is designed for users experiencing persistent or complex issues that require deeper investigation. It provides systematic diagnostic approaches, detailed error analysis, and advanced debugging techniques.

### When to Use This Guide

Use this advanced troubleshooting guide when:

- **Standard troubleshooting hasn't resolved the issue**
- **You're experiencing persistent scraping failures**
- **Integration connections are failing repeatedly**
- **API errors are unclear or inconsistent**
- **You need to analyze system logs**
- **You're implementing custom solutions**
- **You need to debug webhook issues**

### What You'll Learn

- **Scraping Diagnostics**: Systematic approach to diagnosing scraping failures
- **Integration Troubleshooting**: Resolving OpenCart and Laravel connection issues
- **API Error Analysis**: Understanding and fixing API errors
- **Log Analysis**: Reading and interpreting system logs
- **Network Debugging**: Diagnosing connection and timeout issues
- **Performance Optimization**: Identifying and resolving performance bottlenecks
- **Advanced Debugging Tools**: Using browser dev tools and network analyzers



## Scraping Issues Diagnostic

### Systematic Diagnostic Approach

When experiencing scraping failures, follow this systematic diagnostic process:

#### Step 1: Identify the Scope

**Determine if the issue is:**

- **Single Product**: Only one product failing to scrape
- **Single Competitor**: All products from one competitor failing
- **Multiple Competitors**: Multiple or all competitors failing
- **Intermittent**: Scraping works sometimes, fails other times
- **Complete Failure**: No scraping working at all

**Diagnostic Commands:**

```bash
# Check overall scraping health
Navigate to: Dashboard → Competitors → View Status

# Check specific competitor
Navigate to: Competitors → [Competitor Name] → Scraping History

# Check specific product
Navigate to: Products → [Product Name] → Competitor Prices → View History
```

#### Step 2: Check Scraping Logs

Access detailed scraping logs to identify error patterns:

**Viewing Scraping Logs:**

1. Navigate to **Competitors** page
2. Click on the failing competitor
3. Select **Scraping Logs** tab
4. Filter by date range and error type
5. Look for patterns in error messages

**Common Log Entries:**

```
[2024-02-05 10:30:15] INFO: Starting scrape for competitor: techstore.com
[2024-02-05 10:30:16] DEBUG: Fetching URL: https://techstore.com/products/laptop-123
[2024-02-05 10:30:18] ERROR: Request timeout after 30 seconds
[2024-02-05 10:30:18] INFO: Retry attempt 1 of 3
[2024-02-05 10:30:48] ERROR: Request timeout after 30 seconds
[2024-02-05 10:30:48] INFO: Retry attempt 2 of 3
[2024-02-05 10:31:18] ERROR: Request timeout after 30 seconds
[2024-02-05 10:31:18] ERROR: Max retries exceeded, marking as failed
```

#### Step 3: Analyze Error Patterns

**Error Pattern Analysis:**

| Error Pattern | Likely Cause | Diagnostic Action |
|--------------|--------------|-------------------|
| All requests timeout | Network/firewall issue | Check network connectivity |
| 403 Forbidden | IP blocking or bot detection | Check bot protection status |
| 404 Not Found | Product URL changed | Verify product URLs |
| Parsing errors | Site structure changed | Update site profile selectors |
| CAPTCHA detected | Bot protection triggered | Review scraping frequency |
| SSL errors | Certificate issues | Check SSL configuration |
| Rate limit errors | Too many requests | Reduce scraping frequency |



### Common Scraping Issues and Solutions

#### Issue 1: Persistent Timeout Errors

**Symptoms:**
- Requests consistently timeout after 30 seconds
- Affects all or most products from a competitor
- Error message: "Request timeout after 30 seconds"

**Diagnostic Steps:**

1. **Test Direct Access:**
   ```bash
   # Test if the site is accessible
   curl -I https://competitor-site.com
   
   # Expected: HTTP/1.1 200 OK
   # If timeout: Network or firewall issue
   ```

2. **Check Response Time:**
   ```bash
   # Measure response time
   curl -w "@curl-format.txt" -o /dev/null -s https://competitor-site.com
   
   # If > 25 seconds: Site is slow, increase timeout
   ```

3. **Verify DNS Resolution:**
   ```bash
   # Check DNS resolution
   nslookup competitor-site.com
   
   # Should return valid IP address
   ```

**Solutions:**

**Solution 1: Increase Timeout**
1. Navigate to **Competitors** → [Competitor] → **Scraping Settings**
2. Increase **Request Timeout** from 30s to 60s
3. Save and retry scraping

**Solution 2: Check Firewall Rules**
- Verify PricePilot's IP addresses aren't blocked
- Contact your IT team to whitelist PricePilot IPs
- Check if outbound HTTPS (port 443) is allowed

**Solution 3: Use Proxy Rotation (Premium)**
- Enable **IP Rotation** in scraping settings
- Distribute requests across multiple IPs
- Reduces likelihood of network-level blocking

#### Issue 2: CAPTCHA Challenges on Every Request

**Symptoms:**
- 100% CAPTCHA detection rate
- All scraping attempts fail with CAPTCHA
- Error message: "CAPTCHA detected, unable to proceed"

**Diagnostic Steps:**

1. **Check Scraping Frequency:**
   - Review current frequency setting
   - Check if recently increased frequency
   - Verify last successful scrape time

2. **Review Bot Protection Metrics:**
   - Navigate to **Competitors** → [Competitor] → **Bot Protection** tab
   - Check CAPTCHA encounter rate trend
   - Review IP block status

3. **Test Manual Access:**
   - Visit competitor site in incognito browser
   - Check if CAPTCHA appears immediately
   - Note any geographic restrictions

**Solutions:**

**Solution 1: Reduce Scraping Frequency**
```
Current: 12 hours → Change to: 24 hours
Current: 24 hours → Change to: 48 hours
```

1. Navigate to **Competitors** → [Competitor] → **Scraping Settings**
2. Change **Scraping Frequency** to less frequent
3. Click **Save Changes**
4. Wait 24-48 hours before retrying

**Solution 2: Enable Advanced Bot Protection Bypass**
1. Navigate to **Competitors** → [Competitor] → **Scraping Settings**
2. Enable **Advanced Bot Protection Bypass** (Premium feature)
3. Select **Residential Proxy Network**
4. Enable **JavaScript Rendering**
5. Save and retry

**Solution 3: Temporary Pause and Resume**
1. Pause scraping for 7-14 days
2. Allow IP reputation to recover
3. Resume with conservative settings
4. Monitor success rate closely



#### Issue 3: Parsing Errors - Price Not Found

**Symptoms:**
- Scraping completes but no price data extracted
- Error message: "Price selector not found"
- Products show as "Price unavailable"

**Diagnostic Steps:**

1. **Verify Product URL:**
   - Click on competitor product link
   - Confirm page loads correctly
   - Check if price is visible on page

2. **Inspect Page Structure:**
   - Right-click on price → **Inspect Element**
   - Note the CSS selector or XPath
   - Check if selector matches site profile

3. **Test Site Profile:**
   - Navigate to **Competitors** → [Competitor] → **Site Profile**
   - Click **Test Profile**
   - Enter a sample product URL
   - Review extracted data

**Solutions:**

**Solution 1: Update Price Selector**

1. Navigate to **Competitors** → [Competitor] → **Site Profile**
2. Click **Edit Profile**
3. Update **Price Selector** section:

```css
/* Old selector (not working) */
.product-price .amount

/* New selector (inspect element to find) */
.price-box .final-price
[data-price-type="finalPrice"]
.product-info-price .price
```

4. Add **Fallback Selectors**:
```css
/* Primary */
.price-box .final-price

/* Fallback 1 */
.product-price .amount

/* Fallback 2 */
[data-price]

/* Fallback 3 */
.price
```

5. Click **Test Profile** to verify
6. Save changes

**Solution 2: Enable JavaScript Rendering**

Some sites load prices dynamically via JavaScript:

1. Navigate to **Competitors** → [Competitor] → **Site Profile**
2. Enable **JavaScript Rendering**
3. Set **Wait Time** to 2-3 seconds
4. Save and retry scraping

**Solution 3: Check for Price Variations**

Sites may show different prices based on:
- User location (geographic pricing)
- User session (personalized pricing)
- Time of day (dynamic pricing)

**Diagnostic:**
```bash
# Test from different locations
curl -H "X-Forwarded-For: 1.2.3.4" https://competitor-site.com/product

# Test with different user agents
curl -A "Mozilla/5.0..." https://competitor-site.com/product
```

#### Issue 4: Intermittent Scraping Failures

**Symptoms:**
- Scraping works sometimes, fails other times
- Success rate between 50-80%
- No consistent error pattern

**Diagnostic Steps:**

1. **Analyze Failure Timing:**
   - Check if failures occur at specific times
   - Review scraping history for patterns
   - Note any correlation with site maintenance

2. **Check Success Rate Trends:**
   - Navigate to **Competitors** → [Competitor] → **Performance**
   - Review success rate over time
   - Identify any declining trends

3. **Review Error Distribution:**
   - Group errors by type
   - Calculate percentage of each error type
   - Identify primary failure cause

**Solutions:**

**Solution 1: Implement Retry Logic**

Already enabled by default, but verify settings:

1. Navigate to **Settings** → **Scraping** → **Advanced**
2. Verify **Retry Settings**:
   ```
   Max Retries: 3
   Retry Delays: 1s, 2s, 4s (exponential backoff)
   Retry on Errors: Timeout, 5xx, Network errors
   ```

**Solution 2: Add Request Randomization**

1. Navigate to **Competitors** → [Competitor] → **Scraping Settings**
2. Enable **Request Randomization**:
   ```
   Random Delay: 3-7 seconds (instead of fixed 5s)
   Random User-Agent: Enabled
   Random Request Order: Enabled
   ```

**Solution 3: Monitor and Adjust**

Set up monitoring to track patterns:

1. Enable **Scraping Alerts**
2. Set threshold: Alert if success rate < 85%
3. Review weekly reports
4. Adjust settings based on trends



## Integration Problem Resolution

### OpenCart Integration Issues

#### Issue 1: Connection Failed - API Token Invalid

**Symptoms:**
- Error message: "Invalid API token"
- Connection test fails
- Products not syncing from OpenCart

**Diagnostic Steps:**

1. **Verify API Token:**
   ```bash
   # In OpenCart admin panel
   Navigate to: System → Users → API
   
   # Check if PricePilot API user exists
   # Verify token matches what's configured in PricePilot
   ```

2. **Test API Endpoint:**
   ```bash
   # Test API endpoint directly
   curl -X GET "https://yourstore.com/index.php?route=api/pricepilot/products" \
     -H "Authorization: Bearer YOUR_API_TOKEN"
   
   # Expected: JSON response with products
   # If 401: Token is invalid
   # If 404: Module not installed correctly
   ```

3. **Check Module Installation:**
   ```bash
   # In OpenCart admin
   Navigate to: Extensions → Installer
   
   # Verify pricepilot.ocmod.zip is installed
   # Check installation date and version
   ```

**Solutions:**

**Solution 1: Regenerate API Token**

1. In OpenCart admin, navigate to **System** → **Users** → **API**
2. Find or create **PricePilot API** user
3. Click **Generate New Token**
4. Copy the new token
5. In PricePilot dashboard:
   - Navigate to **Settings** → **Integrations**
   - Click **Edit** on OpenCart integration
   - Paste new API token
   - Click **Test Connection**
   - Save if successful

**Solution 2: Reinstall OpenCart Module**

1. Download latest module from PricePilot dashboard
2. In OpenCart admin:
   - Navigate to **Extensions** → **Installer**
   - Click **Upload** and select `pricepilot.ocmod.zip`
   - Wait for installation to complete
3. Navigate to **Extensions** → **Modifications**
4. Click **Refresh** to apply changes
5. Clear OpenCart cache:
   ```bash
   # Via admin panel
   Navigate to: Dashboard → Settings icon → Clear cache
   
   # Or via SSH
   rm -rf system/storage/cache/*
   ```

**Solution 3: Check File Permissions**

```bash
# SSH into your server
cd /path/to/opencart

# Check permissions on API files
ls -la system/library/pricepilot/

# Should be readable by web server user
# Fix permissions if needed
chmod 644 system/library/pricepilot/*.php
chown www-data:www-data system/library/pricepilot/*.php
```

#### Issue 2: Products Not Syncing from OpenCart

**Symptoms:**
- Connection successful but no products appear
- Product count shows 0
- Manual sync doesn't retrieve products

**Diagnostic Steps:**

1. **Check Product Visibility:**
   ```bash
   # In OpenCart admin
   Navigate to: Catalog → Products
   
   # Verify products exist and are enabled
   # Check if products have SKUs assigned
   ```

2. **Test API Response:**
   ```bash
   # Test products endpoint
   curl -X GET "https://yourstore.com/index.php?route=api/pricepilot/products" \
     -H "Authorization: Bearer YOUR_TOKEN"
   
   # Check response:
   # - Should return JSON array of products
   # - Verify products have required fields (id, sku, name, price)
   ```

3. **Check API Logs:**
   ```bash
   # In OpenCart, check error logs
   Navigate to: System → Maintenance → Error Logs
   
   # Look for PricePilot-related errors
   # Check for PHP errors or warnings
   ```

**Solutions:**

**Solution 1: Verify Product Requirements**

Products must meet these requirements to sync:

- **Status**: Enabled/Active
- **SKU**: Must have a SKU assigned
- **Price**: Must have a price > 0
- **Name**: Must have a product name

Fix products in OpenCart:
1. Navigate to **Catalog** → **Products**
2. Edit each product
3. Ensure all required fields are filled
4. Click **Save**

**Solution 2: Check API Filters**

The module may filter products based on criteria:

1. In OpenCart admin, navigate to **System** → **Settings**
2. Find **PricePilot** settings
3. Check **Product Filters**:
   ```
   Minimum Price: 0.01 (products below this are excluded)
   Status: Enabled only
   Stock Status: In stock only (if enabled)
   ```
4. Adjust filters if too restrictive

**Solution 3: Manual Sync Trigger**

1. In PricePilot dashboard:
   - Navigate to **Settings** → **Integrations**
   - Click on OpenCart integration
   - Click **Sync Now** button
2. Monitor sync progress
3. Check for error messages
4. Review sync log for details



#### Issue 3: Price Updates Not Applying to OpenCart

**Symptoms:**
- Price updates approved in PricePilot
- Updates show as "success" in PricePilot
- Prices unchanged in OpenCart store

**Diagnostic Steps:**

1. **Check Update Logs:**
   ```bash
   # In PricePilot
   Navigate to: Products → [Product] → Price History
   
   # Verify update was sent to OpenCart
   # Check for error messages
   ```

2. **Test Update Endpoint:**
   ```bash
   # Test price update API
   curl -X POST "https://yourstore.com/index.php?route=api/pricepilot/products/update" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "updates": [
         {
           "id": "123",
           "price": 99.99
         }
       ]
     }'
   
   # Check response for errors
   ```

3. **Verify Product in OpenCart:**
   ```bash
   # In OpenCart admin
   Navigate to: Catalog → Products → Edit Product
   
   # Check current price
   # Check price history (if available)
   ```

**Solutions:**

**Solution 1: Check OpenCart Permissions**

```bash
# SSH into server
cd /path/to/opencart

# Check write permissions on product files
ls -la system/storage/

# Ensure web server can write
chmod 755 system/storage/
chown -R www-data:www-data system/storage/
```

**Solution 2: Verify API User Permissions**

1. In OpenCart admin, navigate to **System** → **Users** → **API**
2. Edit **PricePilot API** user
3. Ensure permissions include:
   - `catalog/product` - Read products
   - `catalog/product/edit` - Update products
   - `api/pricepilot/*` - All PricePilot endpoints
4. Save changes

**Solution 3: Check for Price Override Plugins**

Some OpenCart extensions may override prices:

1. Navigate to **Extensions** → **Extensions**
2. Check for installed extensions that affect pricing:
   - Customer group pricing
   - Special offers
   - Discount modules
3. Temporarily disable to test
4. If this fixes it, configure extension to allow API updates

### Laravel Integration Issues

#### Issue 1: Composer Installation Fails

**Symptoms:**
- `composer require` command fails
- Error: "Package not found"
- Dependency conflicts

**Diagnostic Steps:**

1. **Check Composer Version:**
   ```bash
   composer --version
   
   # Should be Composer 2.x
   # If 1.x, update composer
   ```

2. **Check PHP Version:**
   ```bash
   php -v
   
   # Should be PHP 8.1 or higher
   # Check Laravel compatibility
   ```

3. **Check Composer Auth:**
   ```bash
   # If package is private
   composer config --list | grep auth
   
   # Verify authentication is configured
   ```

**Solutions:**

**Solution 1: Update Composer**

```bash
# Update Composer to latest version
composer self-update

# Clear Composer cache
composer clear-cache

# Retry installation
composer require pricepilot/laravel-integration
```

**Solution 2: Resolve Dependency Conflicts**

```bash
# Check for conflicts
composer why-not pricepilot/laravel-integration

# Update dependencies
composer update

# Try installation again
composer require pricepilot/laravel-integration
```

**Solution 3: Install Specific Version**

```bash
# If latest version has conflicts
composer require pricepilot/laravel-integration:^2.5

# Or specific version
composer require pricepilot/laravel-integration:2.5.3
```

#### Issue 2: Service Provider Not Registered

**Symptoms:**
- Package installed but not working
- Routes not registered
- Config not available

**Diagnostic Steps:**

1. **Check Package Discovery:**
   ```bash
   # Check if package is discovered
   php artisan package:discover
   
   # Should list PricePilot package
   ```

2. **Verify Service Provider:**
   ```bash
   # Check registered providers
   php artisan about
   
   # Look for PricePilot in service providers list
   ```

3. **Check Config:**
   ```bash
   # Check if config is available
   php artisan tinker
   >>> config('pricepilot')
   
   # Should return array of config values
   # If null, config not loaded
   ```

**Solutions:**

**Solution 1: Clear Laravel Cache**

```bash
# Clear all caches
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

# Rebuild caches
php artisan config:cache
php artisan route:cache
```

**Solution 2: Manual Service Provider Registration**

If auto-discovery fails, register manually in `config/app.php`:

```php
'providers' => [
    // Other providers...
    
    PricePilot\LaravelIntegration\PricePilotServiceProvider::class,
],
```

**Solution 3: Republish Package Assets**

```bash
# Republish configuration
php artisan vendor:publish --provider="PricePilot\LaravelIntegration\PricePilotServiceProvider" --force

# Run migrations
php artisan migrate

# Clear and rebuild cache
php artisan config:clear
php artisan config:cache
```



#### Issue 3: API Routes Not Working

**Symptoms:**
- 404 errors on `/api/pricepilot/*` routes
- Routes not listed in `php artisan route:list`
- Connection test fails from PricePilot

**Diagnostic Steps:**

1. **List Routes:**
   ```bash
   # Check if PricePilot routes are registered
   php artisan route:list --name=pricepilot
   
   # Should show:
   # GET|HEAD  api/pricepilot/products
   # POST      api/pricepilot/products/update
   # POST      api/pricepilot/webhook
   ```

2. **Test Route Directly:**
   ```bash
   # Test health endpoint
   curl -X GET "https://yourstore.com/api/pricepilot/health" \
     -H "Authorization: Bearer YOUR_TOKEN"
   
   # Expected: {"status": "ok"}
   # If 404: Routes not registered
   ```

3. **Check Route Cache:**
   ```bash
   # Routes might be cached
   php artisan route:cache
   
   # Then list again
   php artisan route:list --name=pricepilot
   ```

**Solutions:**

**Solution 1: Clear Route Cache**

```bash
# Clear route cache
php artisan route:clear

# Rebuild route cache
php artisan route:cache

# Verify routes
php artisan route:list --name=pricepilot
```

**Solution 2: Check API Middleware**

Ensure API middleware is not blocking requests:

```php
// In app/Http/Kernel.php
protected $middlewareGroups = [
    'api' => [
        'throttle:api',
        \Illuminate\Routing\Middleware\SubstituteBindings::class,
    ],
];
```

**Solution 3: Manual Route Registration**

If routes still don't work, register manually in `routes/api.php`:

```php
<?php

use Illuminate\Support\Facades\Route;
use PricePilot\LaravelIntegration\Http\Controllers\PricePilotController;

Route::prefix('pricepilot')
    ->middleware(['api', 'pricepilot.auth'])
    ->group(function () {
        Route::get('/products', [PricePilotController::class, 'index']);
        Route::get('/products/{id}', [PricePilotController::class, 'show']);
        Route::post('/products/update', [PricePilotController::class, 'update']);
        Route::post('/webhook', [PricePilotController::class, 'webhook']);
        Route::get('/health', [PricePilotController::class, 'health']);
    });
```

## API and Connection Issue Troubleshooting

### API Authentication Errors

#### Error: 401 Unauthorized

**Error Message:**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing API token"
  }
}
```

**Diagnostic Steps:**

1. **Verify API Token:**
   ```bash
   # Check token in .env file
   cat .env | grep PRICEPILOT_API_TOKEN
   
   # Verify token format
   # Should start with: pk_live_ or pk_test_
   ```

2. **Test Token:**
   ```bash
   # Test with curl
   curl -X GET "https://api.pricepilot.com/v1/products" \
     -H "x-api-key: YOUR_TOKEN_HERE"
   
   # If 401: Token is invalid
   # If 200: Token works, check integration config
   ```

3. **Check Token Status:**
   - Log in to PricePilot dashboard
   - Navigate to **Settings** → **API Keys**
   - Verify token is active (not revoked)
   - Check token permissions

**Solutions:**

**Solution 1: Regenerate API Token**

1. In PricePilot dashboard:
   - Navigate to **Settings** → **API Keys**
   - Click **Revoke** on old token
   - Click **Generate New API Key**
   - Copy new token
2. Update in your integration:
   - OpenCart: System → Settings → PricePilot
   - Laravel: Update `.env` file
3. Test connection

**Solution 2: Check Token Format**

Ensure token is passed correctly:

```bash
# Correct header format
x-api-key: pk_live_abc123def456

# NOT:
Authorization: pk_live_abc123def456
# NOT:
api-key: pk_live_abc123def456
```

**Solution 3: Verify Environment**

```bash
# In Laravel
php artisan tinker
>>> config('pricepilot.api.token')

# Should return your token
# If null, check .env and config cache
```

#### Error: 429 Too Many Requests

**Error Message:**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later."
  },
  "retry_after": 60
}
```

**Diagnostic Steps:**

1. **Check Rate Limit Headers:**
   ```bash
   curl -I "https://api.pricepilot.com/v1/products" \
     -H "x-api-key: YOUR_TOKEN"
   
   # Look for headers:
   # X-RateLimit-Limit: 1000
   # X-RateLimit-Remaining: 0
   # X-RateLimit-Reset: 1707134400
   ```

2. **Review Request Frequency:**
   - Check how often your integration calls the API
   - Look for loops or repeated calls
   - Review cron job schedules

**Solutions:**

**Solution 1: Implement Rate Limit Handling**

```php
// Laravel example
use Illuminate\Support\Facades\Http;

$response = Http::withHeaders([
    'x-api-key' => config('pricepilot.api.token')
])->get('https://api.pricepilot.com/v1/products');

if ($response->status() === 429) {
    $retryAfter = $response->header('Retry-After');
    // Wait and retry
    sleep($retryAfter);
    $response = Http::withHeaders([
        'x-api-key' => config('pricepilot.api.token')
    ])->get('https://api.pricepilot.com/v1/products');
}
```

**Solution 2: Reduce Request Frequency**

```bash
# If using cron jobs
# Change from:
* * * * * php artisan pricepilot:sync

# To:
0 * * * * php artisan pricepilot:sync  # Hourly instead of every minute
```

**Solution 3: Implement Caching**

```php
// Cache API responses
use Illuminate\Support\Facades\Cache;

$products = Cache::remember('pricepilot_products', 3600, function () {
    return Http::withHeaders([
        'x-api-key' => config('pricepilot.api.token')
    ])->get('https://api.pricepilot.com/v1/products')->json();
});
```



### Connection and Network Issues

#### Issue: SSL Certificate Verification Failed

**Error Message:**
```
SSL certificate problem: unable to get local issuer certificate
```

**Diagnostic Steps:**

1. **Test SSL Certificate:**
   ```bash
   # Test SSL connection
   openssl s_client -connect api.pricepilot.com:443
   
   # Should show certificate chain
   # Look for "Verify return code: 0 (ok)"
   ```

2. **Check CA Bundle:**
   ```bash
   # Check if CA bundle exists
   php -i | grep -i "openssl.cafile"
   
   # Should point to valid CA bundle file
   ```

**Solutions:**

**Solution 1: Update CA Bundle**

```bash
# Download latest CA bundle
curl -o cacert.pem https://curl.se/ca/cacert.pem

# Update PHP configuration
# In php.ini:
openssl.cafile=/path/to/cacert.pem

# Restart web server
sudo systemctl restart apache2  # or nginx
```

**Solution 2: Disable SSL Verification (Development Only)**

```php
// Laravel - ONLY for development/testing
Http::withoutVerifying()->get('https://api.pricepilot.com/v1/products');

// OpenCart - In config
define('CURL_SSL_VERIFYPEER', false);  // ONLY for development
```

> **Warning**: Never disable SSL verification in production!

**Solution 3: Use System CA Bundle**

```php
// Laravel - Use system CA bundle
Http::withOptions([
    'verify' => '/etc/ssl/certs/ca-certificates.crt'
])->get('https://api.pricepilot.com/v1/products');
```

#### Issue: Connection Timeout

**Error Message:**
```
Connection timeout after 30 seconds
```

**Diagnostic Steps:**

1. **Test Network Connectivity:**
   ```bash
   # Ping API server
   ping api.pricepilot.com
   
   # Test HTTPS connection
   curl -I https://api.pricepilot.com
   
   # Measure response time
   time curl https://api.pricepilot.com/v1/health
   ```

2. **Check Firewall Rules:**
   ```bash
   # Check if outbound HTTPS is allowed
   sudo iptables -L OUTPUT -n | grep 443
   
   # Test from server
   telnet api.pricepilot.com 443
   ```

3. **Review Server Logs:**
   ```bash
   # Check web server error logs
   tail -f /var/log/apache2/error.log
   # or
   tail -f /var/log/nginx/error.log
   ```

**Solutions:**

**Solution 1: Increase Timeout**

```php
// Laravel
Http::timeout(60)->get('https://api.pricepilot.com/v1/products');

// OpenCart - In module config
define('PRICEPILOT_TIMEOUT', 60);
```

**Solution 2: Check Firewall**

```bash
# Allow outbound HTTPS
sudo iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT

# Or configure firewall to allow PricePilot IPs
sudo iptables -A OUTPUT -d api.pricepilot.com -j ACCEPT
```

**Solution 3: Use Proxy**

If direct connection is blocked:

```php
// Laravel - Use proxy
Http::withOptions([
    'proxy' => 'http://proxy.example.com:8080'
])->get('https://api.pricepilot.com/v1/products');
```

## Advanced Debugging Techniques

### Using Browser Developer Tools

#### Debugging Scraping Issues

**Step 1: Inspect Network Requests**

1. Open competitor website in Chrome/Firefox
2. Press F12 to open Developer Tools
3. Go to **Network** tab
4. Reload the page
5. Look for:
   - Request that loads price data
   - API calls that fetch product info
   - JavaScript files that render prices

**Step 2: Analyze Page Structure**

1. Right-click on price element
2. Select **Inspect** or **Inspect Element**
3. Note the HTML structure:
   ```html
   <div class="product-price">
     <span class="amount">$1,299.99</span>
   </div>
   ```
4. Identify CSS selector: `.product-price .amount`
5. Test selector in Console:
   ```javascript
   document.querySelector('.product-price .amount').textContent
   // Should return: "$1,299.99"
   ```

**Step 3: Check for Dynamic Content**

1. In Network tab, filter by **XHR** or **Fetch**
2. Look for AJAX requests that load prices
3. Check if price is loaded after page load
4. Note any API endpoints used

**Step 4: Test JavaScript Rendering**

```javascript
// In browser console
// Check if price is in initial HTML
document.body.innerHTML.includes('1299.99')

// Wait for JavaScript to load
setTimeout(() => {
  console.log(document.querySelector('.product-price .amount').textContent);
}, 3000);
```

### Log Analysis

#### Reading PricePilot Logs

**Log Levels:**

- **DEBUG**: Detailed diagnostic information
- **INFO**: General informational messages
- **WARNING**: Warning messages for potential issues
- **ERROR**: Error messages for failures
- **CRITICAL**: Critical errors requiring immediate attention

**Common Log Patterns:**

```
# Successful scrape
[2024-02-05 10:30:15] INFO: Starting scrape for competitor: techstore.com
[2024-02-05 10:30:16] DEBUG: Fetching URL: https://techstore.com/products/laptop-123
[2024-02-05 10:30:17] DEBUG: Response status: 200
[2024-02-05 10:30:17] DEBUG: Parsing price from selector: .product-price .amount
[2024-02-05 10:30:17] INFO: Price extracted: $1,299.99
[2024-02-05 10:30:17] INFO: Scrape completed successfully

# Failed scrape with retry
[2024-02-05 10:30:15] INFO: Starting scrape for competitor: techstore.com
[2024-02-05 10:30:16] DEBUG: Fetching URL: https://techstore.com/products/laptop-123
[2024-02-05 10:30:46] ERROR: Request timeout after 30 seconds
[2024-02-05 10:30:46] INFO: Retry attempt 1 of 3
[2024-02-05 10:30:47] DEBUG: Fetching URL: https://techstore.com/products/laptop-123
[2024-02-05 10:30:49] DEBUG: Response status: 200
[2024-02-05 10:30:49] INFO: Price extracted: $1,299.99
[2024-02-05 10:30:49] INFO: Scrape completed successfully after 1 retry

# CAPTCHA detected
[2024-02-05 10:30:15] INFO: Starting scrape for competitor: techstore.com
[2024-02-05 10:30:16] DEBUG: Fetching URL: https://techstore.com/products/laptop-123
[2024-02-05 10:30:17] WARNING: CAPTCHA detected on page
[2024-02-05 10:30:17] INFO: Triggering CAPTCHA resolution strategy
[2024-02-05 10:30:17] DEBUG: Strategy: IP rotation + session reset
[2024-02-05 10:30:18] INFO: Rotating to new IP address
[2024-02-05 10:30:20] DEBUG: Fetching URL: https://techstore.com/products/laptop-123
[2024-02-05 10:30:21] DEBUG: Response status: 200
[2024-02-05 10:30:21] INFO: CAPTCHA bypassed successfully
```

**Analyzing Log Patterns:**

1. **Identify Error Frequency:**
   ```bash
   # Count errors by type
   grep "ERROR" scraping.log | cut -d':' -f4 | sort | uniq -c | sort -rn
   
   # Example output:
   # 45 Request timeout after 30 seconds
   # 23 CAPTCHA detected
   # 12 Price selector not found
   ```

2. **Track Success Rate:**
   ```bash
   # Count successful vs failed scrapes
   grep "Scrape completed successfully" scraping.log | wc -l
   grep "Scrape failed" scraping.log | wc -l
   
   # Calculate success rate
   ```

3. **Identify Time Patterns:**
   ```bash
   # Group errors by hour
   grep "ERROR" scraping.log | cut -d' ' -f1-2 | cut -d':' -f1 | sort | uniq -c
   
   # Check if errors occur at specific times
   ```



#### Laravel Application Logs

**Location:**
```bash
# Laravel logs
storage/logs/laravel.log

# View recent logs
tail -f storage/logs/laravel.log

# Search for PricePilot errors
grep "PricePilot" storage/logs/laravel.log
```

**Common Laravel Log Entries:**

```
# Successful API call
[2024-02-05 10:30:15] local.INFO: PricePilot: Syncing products
[2024-02-05 10:30:16] local.DEBUG: PricePilot: Fetching products from database
[2024-02-05 10:30:16] local.DEBUG: PricePilot: Found 150 products to sync
[2024-02-05 10:30:17] local.INFO: PricePilot: Sending products to API
[2024-02-05 10:30:18] local.INFO: PricePilot: Sync completed successfully

# API error
[2024-02-05 10:30:15] local.INFO: PricePilot: Syncing products
[2024-02-05 10:30:16] local.ERROR: PricePilot: API request failed
[2024-02-05 10:30:16] local.ERROR: HTTP 401: Unauthorized
[2024-02-05 10:30:16] local.ERROR: Invalid API token

# Database error
[2024-02-05 10:30:15] local.INFO: PricePilot: Updating product prices
[2024-02-05 10:30:16] local.ERROR: SQLSTATE[23000]: Integrity constraint violation
[2024-02-05 10:30:16] local.ERROR: Product ID 123 not found in database
```

#### OpenCart Error Logs

**Location:**
```bash
# OpenCart error logs
system/storage/logs/error.log

# View recent logs
tail -f system/storage/logs/error.log

# Search for PricePilot errors
grep -i "pricepilot" system/storage/logs/error.log
```

**Common OpenCart Log Entries:**

```
# Module initialization
2024-02-05 10:30:15 - PHP Notice: PricePilot module loaded
2024-02-05 10:30:15 - PHP Notice: API token configured

# API request
2024-02-05 10:30:16 - PHP Notice: PricePilot API request: GET /products
2024-02-05 10:30:16 - PHP Notice: Returning 150 products

# Price update
2024-02-05 10:30:17 - PHP Notice: PricePilot price update request
2024-02-05 10:30:17 - PHP Notice: Updating product ID 123: $1299.99 -> $1189.99
2024-02-05 10:30:17 - PHP Notice: Price updated successfully

# Error
2024-02-05 10:30:18 - PHP Warning: PricePilot: Invalid API token
2024-02-05 10:30:18 - PHP Warning: Authentication failed
```

### Network Traffic Analysis

#### Using cURL for Debugging

**Test API Endpoints:**

```bash
# Test with verbose output
curl -v -X GET "https://api.pricepilot.com/v1/products" \
  -H "x-api-key: YOUR_TOKEN"

# Output includes:
# * Connection details
# * SSL handshake
# * Request headers
# * Response headers
# * Response body

# Test with timing information
curl -w "@curl-format.txt" -o /dev/null -s \
  -H "x-api-key: YOUR_TOKEN" \
  "https://api.pricepilot.com/v1/products"

# Create curl-format.txt:
time_namelookup:  %{time_namelookup}\n
time_connect:  %{time_connect}\n
time_appconnect:  %{time_appconnect}\n
time_pretransfer:  %{time_pretransfer}\n
time_redirect:  %{time_redirect}\n
time_starttransfer:  %{time_starttransfer}\n
----------\n
time_total:  %{time_total}\n
```

**Test Integration Endpoints:**

```bash
# Test OpenCart products endpoint
curl -v -X GET "https://yourstore.com/index.php?route=api/pricepilot/products" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test Laravel products endpoint
curl -v -X GET "https://yourstore.com/api/pricepilot/products" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test price update
curl -v -X POST "https://yourstore.com/api/pricepilot/products/update" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {
        "id": "123",
        "price": 99.99
      }
    ]
  }'
```

#### Using tcpdump for Packet Analysis

**Capture HTTP/HTTPS Traffic:**

```bash
# Capture traffic to PricePilot API
sudo tcpdump -i any -s 0 -A 'host api.pricepilot.com' -w pricepilot.pcap

# Capture traffic on specific port
sudo tcpdump -i any -s 0 -A 'port 443' -w https-traffic.pcap

# Read captured traffic
tcpdump -r pricepilot.pcap -A

# Filter by IP
tcpdump -r pricepilot.pcap 'host 1.2.3.4'
```

**Analyze with Wireshark:**

1. Install Wireshark: `sudo apt-get install wireshark`
2. Open captured file: `wireshark pricepilot.pcap`
3. Filter HTTPS traffic: `tcp.port == 443`
4. Follow TCP stream to see full conversation
5. Look for:
   - Connection establishment
   - SSL/TLS handshake
   - HTTP requests and responses
   - Connection termination

### Database Query Analysis

#### Laravel Query Debugging

**Enable Query Logging:**

```php
// In your code or AppServiceProvider
use Illuminate\Support\Facades\DB;

DB::listen(function ($query) {
    Log::info('Query: ' . $query->sql);
    Log::info('Bindings: ' . json_encode($query->bindings));
    Log::info('Time: ' . $query->time . 'ms');
});
```

**Use Laravel Debugbar:**

```bash
# Install Laravel Debugbar
composer require barryvdh/laravel-debugbar --dev

# Publish config
php artisan vendor:publish --provider="Barryvdh\Debugbar\ServiceProvider"

# Enable in .env
DEBUGBAR_ENABLED=true
```

**Analyze Slow Queries:**

```php
// Log slow queries (> 1000ms)
DB::listen(function ($query) {
    if ($query->time > 1000) {
        Log::warning('Slow query detected', [
            'sql' => $query->sql,
            'time' => $query->time,
            'bindings' => $query->bindings
        ]);
    }
});
```

#### OpenCart Database Debugging

**Enable MySQL Query Log:**

```sql
-- Enable general query log
SET GLOBAL general_log = 'ON';
SET GLOBAL general_log_file = '/var/log/mysql/query.log';

-- Run your operations

-- Disable when done
SET GLOBAL general_log = 'OFF';
```

**Analyze Query Log:**

```bash
# View recent queries
tail -f /var/log/mysql/query.log

# Search for PricePilot queries
grep -i "pricepilot" /var/log/mysql/query.log

# Count queries by type
grep "SELECT" /var/log/mysql/query.log | wc -l
grep "UPDATE" /var/log/mysql/query.log | wc -l
```

## Performance Troubleshooting

### Identifying Performance Bottlenecks

#### Slow Product Sync

**Symptoms:**
- Product sync takes > 5 minutes
- Timeout errors during sync
- High server load during sync

**Diagnostic Steps:**

1. **Check Product Count:**
   ```bash
   # How many products are being synced?
   # In Laravel
   php artisan tinker
   >>> App\Models\Product::count()
   
   # In OpenCart admin
   Navigate to: Catalog → Products
   # Check total count
   ```

2. **Profile Sync Performance:**
   ```php
   // Laravel - Add timing
   $start = microtime(true);
   
   // Sync code here
   
   $duration = microtime(true) - $start;
   Log::info("Sync completed in {$duration} seconds");
   ```

3. **Check Database Performance:**
   ```sql
   -- Check for missing indexes
   SHOW INDEX FROM products;
   
   -- Check table size
   SELECT 
     table_name,
     round(((data_length + index_length) / 1024 / 1024), 2) as size_mb
   FROM information_schema.TABLES
   WHERE table_schema = 'your_database'
   AND table_name = 'products';
   ```

**Solutions:**

**Solution 1: Enable Chunking**

```php
// Laravel - Process in chunks
Product::chunk(100, function ($products) {
    // Process 100 products at a time
    foreach ($products as $product) {
        $product->syncToPricePilot();
    }
});
```

**Solution 2: Use Queue Workers**

```bash
# Laravel - Queue sync jobs
php artisan queue:work --queue=pricepilot

# In code
dispatch(new SyncProductsToPricePilot())->onQueue('pricepilot');
```

**Solution 3: Add Database Indexes**

```sql
-- Add indexes for common queries
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_updated_at ON products(updated_at);
```



### Memory Issues

#### PHP Memory Limit Exceeded

**Error Message:**
```
Fatal error: Allowed memory size of 134217728 bytes exhausted
```

**Diagnostic Steps:**

1. **Check Current Memory Limit:**
   ```bash
   php -i | grep memory_limit
   
   # Output: memory_limit => 128M => 128M
   ```

2. **Monitor Memory Usage:**
   ```php
   // Add to your code
   Log::info('Memory usage: ' . memory_get_usage(true) / 1024 / 1024 . ' MB');
   Log::info('Peak memory: ' . memory_get_peak_usage(true) / 1024 / 1024 . ' MB');
   ```

**Solutions:**

**Solution 1: Increase PHP Memory Limit**

```bash
# In php.ini
memory_limit = 256M

# Or in Laravel .env
PHP_MEMORY_LIMIT=256M

# Or in code (temporary)
ini_set('memory_limit', '256M');

# Restart web server
sudo systemctl restart apache2
```

**Solution 2: Optimize Query Loading**

```php
// Laravel - Use lazy loading
Product::lazy()->each(function ($product) {
    $product->syncToPricePilot();
});

// Or use cursor
foreach (Product::cursor() as $product) {
    $product->syncToPricePilot();
}
```

**Solution 3: Clear Memory Between Batches**

```php
// Laravel - Clear memory
Product::chunk(100, function ($products) {
    foreach ($products as $product) {
        $product->syncToPricePilot();
    }
    
    // Clear memory
    unset($products);
    gc_collect_cycles();
});
```

## Webhook Troubleshooting

### Webhook Not Receiving Events

**Symptoms:**
- Price updates approved but not applied
- No webhook logs in system
- Events not triggering in your application

**Diagnostic Steps:**

1. **Verify Webhook URL:**
   ```bash
   # In PricePilot dashboard
   Navigate to: Settings → Integrations → Webhooks
   
   # Verify URL is correct:
   # Laravel: https://yourstore.com/api/pricepilot/webhook
   # OpenCart: https://yourstore.com/index.php?route=api/pricepilot/webhook
   ```

2. **Test Webhook Endpoint:**
   ```bash
   # Test if endpoint is accessible
   curl -X POST "https://yourstore.com/api/pricepilot/webhook" \
     -H "Content-Type: application/json" \
     -H "X-PricePilot-Signature: test" \
     -d '{"event":"test","data":{}}'
   
   # Should return 200 or 401 (not 404)
   ```

3. **Check Webhook Logs:**
   ```bash
   # Laravel
   tail -f storage/logs/laravel.log | grep -i webhook
   
   # OpenCart
   tail -f system/storage/logs/error.log | grep -i webhook
   ```

**Solutions:**

**Solution 1: Verify Webhook Secret**

```bash
# Laravel - Check .env
cat .env | grep PRICEPILOT_WEBHOOK_SECRET

# Should match secret in PricePilot dashboard
# If different, update and restart
```

**Solution 2: Disable CSRF Protection**

```php
// Laravel - In app/Http/Middleware/VerifyCsrfToken.php
protected $except = [
    'api/pricepilot/webhook',
];
```

**Solution 3: Check Firewall Rules**

```bash
# Ensure PricePilot IPs can reach your server
# Add to firewall whitelist:
# 52.1.2.3 (example IP)
# 54.2.3.4 (example IP)

sudo iptables -A INPUT -s 52.1.2.3 -j ACCEPT
sudo iptables -A INPUT -s 54.2.3.4 -j ACCEPT
```

### Webhook Signature Verification Failed

**Error Message:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_SIGNATURE",
    "message": "Webhook signature verification failed"
  }
}
```

**Diagnostic Steps:**

1. **Check Signature Header:**
   ```bash
   # Webhook should include header:
   X-PricePilot-Signature: sha256=abc123...
   ```

2. **Verify Secret:**
   ```bash
   # Check configured secret
   # Laravel
   php artisan tinker
   >>> config('pricepilot.webhook.secret')
   
   # Should match PricePilot dashboard
   ```

3. **Test Signature Calculation:**
   ```php
   // Laravel - Test signature
   $payload = '{"event":"test","data":{}}';
   $secret = config('pricepilot.webhook.secret');
   $signature = 'sha256=' . hash_hmac('sha256', $payload, $secret);
   
   Log::info('Calculated signature: ' . $signature);
   ```

**Solutions:**

**Solution 1: Update Webhook Secret**

1. In PricePilot dashboard:
   - Navigate to **Settings** → **Integrations** → **Webhooks**
   - Click **Regenerate Secret**
   - Copy new secret
2. Update in your application:
   - Laravel: Update `.env` file
   - OpenCart: Update in admin settings
3. Restart application

**Solution 2: Disable Signature Verification (Testing Only)**

```php
// Laravel - In config/pricepilot.php
'webhook' => [
    'verify_signature' => false,  // ONLY for testing
],
```

> **Warning**: Never disable signature verification in production!

**Solution 3: Debug Signature Mismatch**

```php
// Laravel - Add detailed logging
$receivedSignature = $request->header('X-PricePilot-Signature');
$payload = $request->getContent();
$secret = config('pricepilot.webhook.secret');
$expectedSignature = 'sha256=' . hash_hmac('sha256', $payload, $secret);

Log::debug('Webhook signature debug', [
    'received' => $receivedSignature,
    'expected' => $expectedSignature,
    'payload_length' => strlen($payload),
    'secret_length' => strlen($secret),
]);
```

## Getting Additional Help

### Collecting Diagnostic Information

When contacting support, provide this information:

**System Information:**

```bash
# Laravel
php artisan about

# PHP version
php -v

# Laravel version
php artisan --version

# Installed packages
composer show | grep pricepilot
```

**Error Logs:**

```bash
# Last 100 lines of relevant logs
tail -n 100 storage/logs/laravel.log > diagnostic-logs.txt

# Or OpenCart
tail -n 100 system/storage/logs/error.log > diagnostic-logs.txt
```

**Configuration:**

```bash
# Laravel - Export config (remove sensitive data)
php artisan tinker
>>> config('pricepilot')

# Sanitize output (remove API tokens)
```

**Network Test Results:**

```bash
# Test API connectivity
curl -v https://api.pricepilot.com/v1/health > network-test.txt 2>&1

# Test integration endpoint
curl -v https://yourstore.com/api/pricepilot/health >> network-test.txt 2>&1
```

### Support Channels

**Email Support:**
- Email: support@pricepilot.com
- Include: Diagnostic information, error logs, steps to reproduce

**Live Chat:**
- Available in PricePilot dashboard
- Click chat icon in bottom right
- Business hours: Mon-Fri 9am-5pm EST

**Community Forum:**
- URL: https://community.pricepilot.com
- Search existing topics
- Post new questions with details

**Documentation:**
- Main docs: https://docs.pricepilot.com
- API reference: https://docs.pricepilot.com/api
- Integration guides: https://docs.pricepilot.com/integrations

### Emergency Troubleshooting Checklist

When everything is broken, try these steps in order:

1. **Clear All Caches:**
   ```bash
   # Laravel
   php artisan cache:clear
   php artisan config:clear
   php artisan route:clear
   php artisan view:clear
   
   # OpenCart
   # Admin → Dashboard → Clear cache button
   ```

2. **Restart Services:**
   ```bash
   # Web server
   sudo systemctl restart apache2  # or nginx
   
   # Queue workers (if using)
   php artisan queue:restart
   
   # Database (if needed)
   sudo systemctl restart mysql
   ```

3. **Verify Credentials:**
   - Check API tokens are correct
   - Verify webhook secrets match
   - Confirm integration URLs are correct

4. **Test Basic Connectivity:**
   ```bash
   # Can you reach PricePilot API?
   curl https://api.pricepilot.com/v1/health
   
   # Can PricePilot reach your server?
   # Check webhook logs
   ```

5. **Review Recent Changes:**
   - What changed before the issue started?
   - New code deployments?
   - Configuration changes?
   - Server updates?

6. **Check System Resources:**
   ```bash
   # Disk space
   df -h
   
   # Memory usage
   free -m
   
   # CPU usage
   top
   ```

7. **Enable Debug Mode:**
   ```bash
   # Laravel - In .env
   APP_DEBUG=true
   LOG_LEVEL=debug
   
   # OpenCart - In config.php
   define('DEBUG', true);
   ```

8. **Contact Support:**
   - If still stuck, contact support with diagnostic info
   - Include all error messages and logs
   - Describe steps to reproduce

## Conclusion

This advanced troubleshooting guide covers the most common complex issues you may encounter with PricePilot. Remember:

- **Systematic Approach**: Follow diagnostic steps methodically
- **Check Logs**: Logs contain valuable diagnostic information
- **Test Incrementally**: Make one change at a time
- **Document Changes**: Keep track of what you've tried
- **Ask for Help**: Don't hesitate to contact support

For additional assistance, refer to:
- [Scraping & Bot Protection Guide](../competitors/scraping-bot-protection.md)
- [API Documentation](../integrations/api-documentation.md)
- [OpenCart Integration Guide](../integrations/opencart-setup.md)
- [Laravel Integration Guide](../integrations/laravel-setup.md)

---

**Last Updated**: February 5, 2024  
**Version**: 1.0  
**Feedback**: If you found this guide helpful or have suggestions for improvement, please [contact us](mailto:docs@pricepilot.com).
