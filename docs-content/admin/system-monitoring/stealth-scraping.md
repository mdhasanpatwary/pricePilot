---
title: "Stealth Scraping"
description: "Stealth scraping techniques and configuration"
category: "system-monitoring"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["scraping", "stealth", "techniques"]
audience: "admin"
---

# Advanced Stealth Scraping

## Overview

PricePilot's advanced stealth scraping system provides enterprise-grade web scraping capabilities designed to bypass modern anti-bot systems while maintaining high success rates. The system includes intelligent proxy management, challenge detection, human behavior simulation, and adaptive bot-evasion strategies.

## Key Features

### 1. Enhanced Browser Fingerprinting Protection

The system uses `playwright-extra` with comprehensive stealth plugins to mask automation signatures:

- **Canvas Fingerprinting Protection**: Injects noise into canvas rendering to prevent fingerprinting
- **Audio Context Protection**: Masks audio context fingerprints with fake values
- **Font Fingerprinting Protection**: Randomizes font lists and metrics
- **WebRTC Leak Prevention**: Blocks WebRTC IP leaks through navigator.mediaDevices override
- **Timezone & Locale Randomization**: Randomizes timezone and locale from common values
- **Battery API Masking**: Returns fake battery charging status

### 2. Intelligent Proxy Management

The `ProxyManager` service provides:

- **Proxy Classification**: Automatically classifies proxies as residential, datacenter, or unknown
- **Health Monitoring**: Tracks failure counts, success counts, and response times
- **Automatic Rotation**: Prioritizes healthy proxies with better performance metrics
- **Recovery System**: Periodically checks unhealthy proxies and restores them when recovered
- **Performance Tracking**: Maintains detailed statistics per proxy

**Configuration Example**:
```typescript
import { ProxyManager } from '@/lib/services/proxy-manager';

const proxies = [
  { url: 'http://proxy1.example.com:8080', type: 'residential' },
  { url: 'http://proxy2.example.com:8080', type: 'datacenter' }
];

const proxyManager = new ProxyManager(proxies, {
  failureThreshold: 3,        // Mark unhealthy after 3 failures
  healthCheckInterval: 300000, // Check health every 5 minutes
  recoveryCheckInterval: 600000 // Check recovery every 10 minutes
});

// Get a healthy proxy
const proxy = await proxyManager.getHealthyProxy();

// Record outcomes
proxyManager.recordSuccess(proxy, 250); // 250ms response time
proxyManager.recordFailure(proxy, new Error('Connection timeout'));

// Get statistics
const stats = proxyManager.getProxyStats();
console.log(`${stats.healthyProxies}/${stats.totalProxies} proxies healthy`);
```

### 3. Advanced Challenge Detection and Handling

The `ChallengeHandler` service detects and handles various anti-bot challenges:

**Supported Systems**:
- Cloudflare (classic challenge)
- Cloudflare Turnstile
- reCAPTCHA v3
- PerimeterX
- DataDome

**Features**:
- Automatic challenge detection
- Exponential backoff waiting (2s, 4s, 8s, 16s, 30s)
- Solve rate tracking per site and challenge type
- Fallback strategy triggering when solve rates drop

**Usage Example**:
```typescript
import { ChallengeHandler } from '@/lib/services/challenge-handler';

const handler = new ChallengeHandler({
  fallbackThreshold: 0.3 // Trigger fallback if solve rate < 30%
});

// Detect challenge
const detection = await handler.detectChallenge(page);
if (detection.detected) {
  console.log(`Challenge detected: ${detection.type}`);
  
  // Wait for challenge to complete
  const result = await handler.waitForChallenge(page, 60000);
  
  // Record attempt
  handler.recordChallengeAttempt('example.com', result);
  
  // Check if fallback needed
  if (handler.shouldTriggerFallback('example.com')) {
    console.log('Triggering fallback strategy');
  }
}
```

### 4. Enhanced Human Behavior Simulation

The `HumanSimulation` service provides realistic human interaction patterns:

**Capabilities**:
- **Realistic Typing**: Character-by-character typing with 50-150ms random delays
- **Form Interaction**: Realistic form filling with pauses and focus changes
- **Mouse Movement**: Natural Bezier curve mouse movements
- **Hover Simulation**: Realistic hover behavior with natural movement
- **Random Pauses**: Weighted distribution favoring shorter pauses (100-2000ms)
- **Tab Focus**: Simulates window focus/blur events

**Usage Example**:
```typescript
import { HumanSimulation } from '@/lib/services/human-simulation';

// Type text realistically
await HumanSimulation.typeText(page, '#search-input', 'laptop');

// Fill form with realistic patterns
await HumanSimulation.fillForm(page, {
  '#name': 'John Doe',
  '#email': 'john@example.com',
  '#message': 'Hello world'
});

// Hover over element
await HumanSimulation.hoverElement(page, '.product-card');

// Random pause between actions
await HumanSimulation.randomPause(500, 1500);
```

### 5. Adaptive Bot-Evasion Profiles

The `SiteProfileManager` provides per-domain configuration and adaptive behavior:

**Features**:
- **Rate Limiting**: Token bucket algorithm for requests-per-minute limits
- **Concurrent Request Limiting**: Controls simultaneous requests per domain
- **Adaptive Delays**: Automatically adjusts delays based on response patterns
- **Session Warmup**: Visits homepage before scraping target content
- **Referrer Chain Tracking**: Maintains realistic referrer headers

**Site Profile Configuration**:
```typescript
interface SiteProfile {
  strategy: 'light-js' | 'full-js' | 'html-only';
  waitTime: number;
  cacheTime: number;
  retryCount: number;
  
  rateLimit?: {
    requestsPerMinute: number;
    concurrentRequests: number;
  };
  
  sessionWarmup?: {
    enabled: boolean;
    visitHomepage: boolean;
    visitPaths?: string[];
  };
  
  adaptiveDelay?: {
    enabled: boolean;
    baseDelay: number;
    multiplier: number;
    maxDelay: number;
  };
  
  referrerChain?: {
    enabled: boolean;
    startUrl?: string;
  };
}
```

**Pre-configured Anti-Bot Profiles**:

The system includes default profiles for common anti-bot systems:

- **Cloudflare**: 10 req/min, 2 concurrent, 3s base delay, session warmup
- **PerimeterX**: 8 req/min, 1 concurrent, 4s base delay, multi-path warmup
- **DataDome**: 6 req/min, 1 concurrent, 5s base delay, homepage warmup

**Usage Example**:
```typescript
import { siteProfileManager } from '@/lib/config/site-profiles';

// Get profile for domain
const profile = siteProfileManager.getProfile('example.com');

// Apply anti-bot profile
siteProfileManager.applyAntiBotProfile('example.com', 'cloudflare');

// Wait for rate limit
await siteProfileManager.waitForRateLimit('example.com');

// Acquire concurrent slot
await siteProfileManager.acquireConcurrentSlot('example.com');
try {
  // Make request
} finally {
  siteProfileManager.releaseConcurrentSlot('example.com');
}

// Adjust delays based on response
if (response.status === 429) {
  siteProfileManager.increaseDelay('example.com');
} else if (response.ok) {
  siteProfileManager.decreaseDelay('example.com');
}
```

### 6. Comprehensive Metrics Tracking

The `MetricsTracker` service provides detailed performance monitoring:

**Tracked Metrics**:
- Block rate per site
- Success rate per site
- Average response time
- Proxy performance metrics
- Challenge solve rates

**Features**:
- Time-range filtering (24h, 7d)
- Automatic persistence to database
- Threshold alerting
- In-memory buffering for performance

**Usage Example**:
```typescript
import { MetricsTracker } from '@/lib/services/metrics-tracker';

const tracker = new MetricsTracker({
  blockRateThreshold: 0.3,  // Alert if block rate > 30%
  persistInterval: 300000,   // Persist every 5 minutes
  autoPersist: true
});

// Record request outcome
tracker.recordRequest('example.com', 'proxy1', {
  success: true,
  blocked: false,
  challenged: false,
  responseTime: 250,
  statusCode: 200
});

// Get metrics
const siteMetrics = await tracker.getSiteMetrics('example.com', '24h');
console.log(`Success rate: ${(siteMetrics.successRate * 100).toFixed(1)}%`);
console.log(`Block rate: ${(siteMetrics.blockRate * 100).toFixed(1)}%`);

// Check thresholds
const alerts = tracker.checkThresholds();
for (const alert of alerts) {
  console.warn(alert.message);
}
```

## Environment Variables

### Required Variables

```env
# Database connection (required for metrics persistence)
DATABASE_URL="postgresql://user:password@host:port/database"

# Proxy configuration (optional, comma-separated)
SCRAPER_PROXIES="http://proxy1:8080,http://proxy2:8080"

# Proxy authentication (optional)
PROXY_USERNAME="your_username"
PROXY_PASSWORD="your_password"
```

### Optional Configuration

```env
# Stealth level: basic, advanced, maximum (default: advanced)
STEALTH_LEVEL="advanced"

# Block rate threshold for alerts (default: 0.3)
BLOCK_RATE_THRESHOLD="0.3"

# Metrics persistence interval in ms (default: 300000 = 5 minutes)
METRICS_PERSIST_INTERVAL="300000"

# Proxy failure threshold (default: 3)
PROXY_FAILURE_THRESHOLD="3"

# Challenge solve rate threshold (default: 0.3)
CHALLENGE_FALLBACK_THRESHOLD="0.3"
```

## Integration with Scraper Service

The scraper service automatically integrates all stealth components:

```typescript
import { scrapeProduct } from '@/lib/services/scraper';

// All stealth features are automatically applied
const result = await scrapeProduct('https://example.com/product/123');

// The scraper will:
// 1. Select a healthy proxy from the pool
// 2. Create a browser with stealth plugins
// 3. Apply rate limiting and concurrent request limits
// 4. Perform session warmup if configured
// 5. Detect and wait for challenges
// 6. Simulate human behavior
// 7. Track metrics and adjust delays
// 8. Record proxy performance
```

## Best Practices

### 1. Proxy Configuration

- Use a mix of residential and datacenter proxies
- Configure at least 5-10 proxies for rotation
- Monitor proxy health statistics regularly
- Replace consistently failing proxies

### 2. Rate Limiting

- Start conservative (5-10 requests/minute)
- Monitor block rates and adjust accordingly
- Use lower limits for sites with aggressive anti-bot systems
- Respect robots.txt and terms of service

### 3. Challenge Handling

- Monitor solve rates per site
- Trigger fallback strategies when solve rates drop
- Consider manual intervention for persistent challenges
- Log challenge types for analysis

### 4. Metrics Monitoring

- Set up alerts for high block rates (>30%)
- Review metrics daily to identify issues
- Track trends over time (7-day metrics)
- Correlate block rates with proxy performance

### 5. Site Profiles

- Create custom profiles for frequently scraped sites
- Use anti-bot profiles as starting points
- Adjust delays based on observed behavior
- Enable session warmup for protected sites

## Troubleshooting

### High Block Rates

1. Check proxy health: `proxyManager.getProxyStats()`
2. Increase delays: `siteProfileManager.increaseDelay(domain)`
3. Enable session warmup in site profile
4. Apply appropriate anti-bot profile
5. Reduce concurrent requests

### Challenge Detection Issues

1. Verify challenge handler is detecting challenges
2. Check solve rates: `challengeHandler.getChallengeStats(site)`
3. Increase wait timeout if challenges are timing out
4. Consider manual CAPTCHA solving service integration

### Poor Proxy Performance

1. Review proxy metrics: `tracker.getProxyMetrics(proxy, '24h')`
2. Remove consistently failing proxies
3. Add more residential proxies
4. Check proxy authentication credentials

### Memory Issues

1. Reduce metrics buffer size
2. Increase persistence interval
3. Limit navigation history tracking
4. Clear old metrics from database

## Performance Considerations

- **Browser Pool**: Limit to 5-10 concurrent browsers to manage memory
- **Metrics Buffering**: Flush to database every 5 minutes to balance performance and data loss risk
- **Proxy Health Checks**: Run every 5-10 minutes to avoid overhead
- **Navigation History**: Keep only last 10 URLs per domain

## Troubleshooting

### High Block Rate

**Symptoms**:
- Many scraping attempts blocked
- Challenge detection rate > 50%
- Success rate < 50%

**Causes**:
- Aggressive bot protection on target site
- IP address blacklisted
- Too many requests too fast
- Suspicious behavior detected

**Solutions**:

1. **Enable Session Warmup**:
   ```typescript
   const profile = {
     sessionWarmup: true,
     warmupSteps: 3
   };
   ```
   Increases success rate by 30-50%

2. **Increase Delays**:
   ```typescript
   const profile = {
     minDelay: 3000,  // 3 seconds
     maxDelay: 5000   // 5 seconds
   };
   ```

3. **Use Residential Proxies**:
   - Higher success rate than datacenter proxies
   - More expensive but worth it for difficult sites
   - Contact support to enable residential proxy pool

4. **Reduce Scraping Frequency**:
   - Scrape less frequently (every 48 hours instead of 24)
   - Reduces detection risk
   - Spreads load over time

### Proxy Failures

**Symptoms**:
- Connection timeouts
- Proxy marked as unhealthy
- All proxies failing

**Causes**:
- Proxy server down
- Proxy credentials incorrect
- Network connectivity issues
- Proxy IP blacklisted

**Solutions**:

1. **Check Proxy Configuration**:
   ```bash
   # Test proxy manually
   curl -x http://proxy:8080 -U username:password https://example.com
   ```

2. **Verify Credentials**:
   - Check PROXY_USERNAME and PROXY_PASSWORD in .env
   - Ensure no extra spaces or special characters
   - Test with proxy provider's dashboard

3. **Monitor Proxy Health**:
   - Admin Panel → Proxy Health Dashboard
   - Check success rates and response times
   - Replace consistently failing proxies

4. **Enable Proxy Recovery**:
   ```typescript
   const proxyManager = new ProxyManager(proxies, {
     recoveryCheckInterval: 300000  // Check every 5 minutes
   });
   ```

### Challenge Detection Issues

**Symptoms**:
- Challenges not being detected
- Scraper hangs on challenge pages
- False positive challenge detection

**Causes**:
- New challenge type not recognized
- Challenge detection timeout too short
- Page structure changed

**Solutions**:

1. **Increase Challenge Timeout**:
   ```typescript
   const result = await handler.waitForChallenge(page, 120000); // 2 minutes
   ```

2. **Update Challenge Selectors**:
   - Check if site updated their challenge page
   - Update selectors in ChallengeHandler
   - Contact support for assistance

3. **Enable Debug Logging**:
   ```typescript
   const handler = new ChallengeHandler({
     debug: true  // Logs all detection attempts
   });
   ```

4. **Manual Verification**:
   - Visit site manually with same proxy
   - Check if challenge appears
   - Note challenge type and behavior

### Memory Leaks

**Symptoms**:
- Memory usage grows over time
- Application crashes after extended use
- Slow performance after many scrapes

**Causes**:
- Browser contexts not closed
- Page objects not disposed
- Event listeners not removed
- Large data structures retained

**Solutions**:

1. **Ensure Proper Cleanup**:
   ```typescript
   try {
     const page = await context.newPage();
     // ... scraping logic
   } finally {
     await page.close();
     await context.close();
   }
   ```

2. **Limit Concurrent Browsers**:
   ```typescript
   const MAX_CONCURRENT = 5;  // Limit to 5 concurrent browsers
   ```

3. **Monitor Memory Usage**:
   - Admin Panel → System Health Monitor
   - Check memory trends over time
   - Restart workers if memory exceeds threshold

4. **Use Browser Pool**:
   ```typescript
   const pool = new BrowserPool({
     maxSize: 10,
     idleTimeout: 300000  // Close idle browsers after 5 minutes
   });
   ```

### Slow Scraping Performance

**Symptoms**:
- Scraping takes much longer than expected
- Response times > 10 seconds
- Timeouts frequently

**Causes**:
- Slow proxy servers
- Network latency
- Target site slow to respond
- Too many concurrent requests

**Solutions**:

1. **Optimize Proxy Selection**:
   ```typescript
   // Use fastest proxies first
   const proxy = await proxyManager.getHealthyProxy('fastest');
   ```

2. **Adjust Timeouts**:
   ```typescript
   const page = await context.newPage();
   page.setDefaultTimeout(30000);  // 30 seconds
   page.setDefaultNavigationTimeout(60000);  // 60 seconds
   ```

3. **Reduce Concurrent Requests**:
   ```typescript
   const MAX_CONCURRENT = 3;  // Reduce from 5 to 3
   ```

4. **Use Faster Proxies**:
   - Check proxy response times in dashboard
   - Replace slow proxies (> 2s response time)
   - Consider premium proxy providers

### Data Extraction Failures

**Symptoms**:
- Products not being extracted
- Missing product data (price, name, etc.)
- Extraction returns empty results

**Causes**:
- Website structure changed
- Selectors outdated
- JavaScript rendering required
- Data in different format

**Solutions**:

1. **Update Selectors**:
   - Inspect target website HTML
   - Update selectors in scraper configuration
   - Test with browser dev tools

2. **Wait for Content**:
   ```typescript
   await page.waitForSelector('.product-price', { timeout: 10000 });
   await page.waitForLoadState('networkidle');
   ```

3. **Handle Dynamic Content**:
   ```typescript
   // Wait for JavaScript to render
   await page.waitForFunction(() => {
     return document.querySelectorAll('.product').length > 0;
   });
   ```

4. **Debug Extraction**:
   ```typescript
   // Take screenshot for debugging
   await page.screenshot({ path: 'debug.png' });
   
   // Log page content
   const html = await page.content();
   console.log(html);
   ```

### Getting Help

If you're still experiencing issues:

1. **Check System Status**:
   - Admin Panel → System Health Monitor
   - Look for system-wide issues

2. **Review Logs**:
   - Admin Panel → Scraping Metrics
   - Filter by site and time range
   - Look for error patterns

3. **Contact Support**:
   - Email: support@pricepilot.com
   - Include: Site URL, error messages, screenshots
   - Provide: Proxy configuration, scraping frequency

4. **Community Forum**:
   - Search for similar issues
   - Post detailed problem description
   - Share configuration (without credentials)

## Security Considerations

- Store proxy credentials securely in environment variables
- Use HTTPS proxies when possible
- Rotate proxies regularly
- Monitor for proxy compromise (unusual patterns)
- Respect website terms of service and robots.txt

## Future Enhancements

- CAPTCHA solving service integration
- Machine learning for adaptive behavior
- Distributed scraping across multiple servers
- Real-time proxy marketplace integration
- Advanced fingerprint randomization
- Browser profile persistence and rotation

---

*Last Updated: February 1, 2026*  
*Version: 1.5*
