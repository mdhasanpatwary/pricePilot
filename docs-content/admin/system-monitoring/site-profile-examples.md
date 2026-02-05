---
title: "Site Profile Examples"
description: "Examples of site profiles for scraping"
category: "system-monitoring"
tags: ["scraping", "profiles", "configuration"]
audience: "admin"
relatedDocs: ["/docs/competitors/site-profile-examples.md"]
---

# Site Profile Configuration Examples

This document provides examples of site profile configurations for various scenarios.

## Basic Site Profile

A minimal site profile for a simple website:

```typescript
{
  strategy: 'light-js',
  selectors: {
    title: ['.product-title', 'h1'],
    price: ['.price', '.product-price'],
    stock: ['.stock-status']
  },
  waitTime: 2000,
  cacheTime: 1800,
  successRate: 0.90,
  retryCount: 2
}
```

## Site with Rate Limiting

For sites that are sensitive to request frequency:

```typescript
{
  strategy: 'full-js',
  selectors: {
    title: ['h1.product-name'],
    price: ['.special-price', '.price'],
    stock: ['.availability']
  },
  waitTime: 3000,
  cacheTime: 900,
  successRate: 0.85,
  retryCount: 3,
  
  // Rate limiting configuration
  rateLimit: {
    requestsPerMinute: 10,  // Max 10 requests per minute
    concurrentRequests: 2    // Max 2 simultaneous requests
  }
}
```

## Site with Cloudflare Protection

For sites protected by Cloudflare:

```typescript
{
  strategy: 'full-js',
  selectors: {
    title: ['.product-title'],
    price: ['.price-value'],
    stock: ['.stock-indicator']
  },
  waitTime: 5000,
  cacheTime: 1800,
  successRate: 0.80,
  retryCount: 3,
  
  // Rate limiting
  rateLimit: {
    requestsPerMinute: 10,
    concurrentRequests: 2
  },
  
  // Session warmup to appear more human
  sessionWarmup: {
    enabled: true,
    visitHomepage: true
  },
  
  // Adaptive delays that adjust based on responses
  adaptiveDelay: {
    enabled: true,
    baseDelay: 3000,
    multiplier: 1.0,
    maxDelay: 30000
  },
  
  // Realistic referrer chain
  referrerChain: {
    enabled: true
  }
}
```

## Site with PerimeterX Protection

For sites with aggressive bot detection:

```typescript
{
  strategy: 'full-js',
  selectors: {
    title: ['h1.title'],
    price: ['.price-current'],
    stock: ['.stock-info']
  },
  waitTime: 6000,
  cacheTime: 1800,
  successRate: 0.75,
  retryCount: 2,
  
  // Very conservative rate limiting
  rateLimit: {
    requestsPerMinute: 8,
    concurrentRequests: 1  // Only 1 request at a time
  },
  
  // Multi-path warmup
  sessionWarmup: {
    enabled: true,
    visitHomepage: true,
    visitPaths: ['/about', '/products']  // Visit multiple pages first
  },
  
  // Aggressive adaptive delays
  adaptiveDelay: {
    enabled: true,
    baseDelay: 4000,
    multiplier: 1.0,
    maxDelay: 40000
  },
  
  referrerChain: {
    enabled: true
  }
}
```

## Site with DataDome Protection

For sites with DataDome anti-bot:

```typescript
{
  strategy: 'full-js',
  selectors: {
    title: ['.product-name'],
    price: ['.price-tag'],
    stock: ['.availability-status']
  },
  waitTime: 7000,
  cacheTime: 1800,
  successRate: 0.70,
  retryCount: 2,
  
  // Very conservative limits
  rateLimit: {
    requestsPerMinute: 6,
    concurrentRequests: 1
  },
  
  // Always warmup
  sessionWarmup: {
    enabled: true,
    visitHomepage: true,
    visitPaths: ['/']
  },
  
  // High base delay
  adaptiveDelay: {
    enabled: true,
    baseDelay: 5000,
    multiplier: 1.0,
    maxDelay: 50000
  },
  
  referrerChain: {
    enabled: true,
    startUrl: 'https://www.google.com'  // Appear to come from search
  }
}
```

## E-commerce Site (Fast Updates)

For sites where prices change frequently:

```typescript
{
  strategy: 'light-js',
  selectors: {
    title: ['.product-title'],
    price: ['.current-price'],
    stock: ['.in-stock']
  },
  waitTime: 2000,
  cacheTime: 300,  // Only 5 minutes cache
  successRate: 0.95,
  retryCount: 2,
  
  rateLimit: {
    requestsPerMinute: 20,  // Higher rate for fast updates
    concurrentRequests: 5
  }
}
```

## Static Content Site

For sites with rarely changing content:

```typescript
{
  strategy: 'html-only',  // No JavaScript needed
  selectors: {
    title: ['h1.title'],
    price: ['.price'],
    stock: ['.stock']
  },
  waitTime: 1000,
  cacheTime: 7200,  // 2 hours cache
  successRate: 0.98,
  retryCount: 1,
  
  rateLimit: {
    requestsPerMinute: 30,
    concurrentRequests: 10
  }
}
```

## Programmatic Configuration

### Using ConfigurationManager

```typescript
import { configurationManager } from '@/lib/services/config-manager';

// Add a new site profile
configurationManager.updateSiteProfile('example.com', {
  strategy: 'full-js',
  waitTime: 3000,
  cacheTime: 1800,
  successRate: 0.85,
  retryCount: 3,
  rateLimit: {
    requestsPerMinute: 10,
    concurrentRequests: 2
  }
});

// Apply anti-bot profile
configurationManager.applyAntiBotProfile('protected-site.com', 'cloudflare');

// Get current profile
const profile = configurationManager.getSiteProfile('example.com');
console.log(profile);
```

### Using SiteProfileManager

```typescript
import { siteProfileManager } from '@/lib/config/site-profiles';

// Get profile (creates default if not exists)
const profile = siteProfileManager.getProfile('example.com');

// Update profile
siteProfileManager.updateProfile('example.com', {
  rateLimit: {
    requestsPerMinute: 15,
    concurrentRequests: 3
  }
});

// Apply anti-bot profile
siteProfileManager.applyAntiBotProfile('example.com', 'cloudflare');

// Use adaptive delays
const delay = siteProfileManager.getAdaptiveDelay('example.com');
await new Promise(resolve => setTimeout(resolve, delay));

// Adjust delays based on response
if (response.status === 429) {
  siteProfileManager.increaseDelay('example.com');
} else if (response.ok) {
  siteProfileManager.decreaseDelay('example.com');
}
```

## Dynamic Profile Adjustment

### Responding to Block Rates

```typescript
import { metricsTracker } from '@/lib/services/metrics-tracker';
import { siteProfileManager } from '@/lib/config/site-profiles';

// Check metrics
const metrics = await metricsTracker.getSiteMetrics('example.com', '24h');

if (metrics.blockRate > 0.3) {
  // High block rate - make profile more conservative
  siteProfileManager.updateProfile('example.com', {
    rateLimit: {
      requestsPerMinute: 5,  // Reduce rate
      concurrentRequests: 1
    },
    adaptiveDelay: {
      enabled: true,
      baseDelay: 5000,  // Increase delay
      multiplier: 1.5,
      maxDelay: 60000
    }
  });
  
  console.log('Profile adjusted due to high block rate');
}
```

### Responding to Challenge Solve Rates

```typescript
import { challengeHandler } from '@/lib/services/challenge-handler';
import { siteProfileManager } from '@/lib/config/site-profiles';

// Check challenge stats
const stats = challengeHandler.getChallengeStats('example.com');

for (const stat of stats) {
  if (stat.solveRate < 0.5) {
    // Low solve rate - enable session warmup
    siteProfileManager.updateProfile('example.com', {
      sessionWarmup: {
        enabled: true,
        visitHomepage: true,
        visitPaths: ['/about', '/products']
      }
    });
    
    console.log(`Enabled session warmup due to low ${stat.challengeType} solve rate`);
  }
}
```

## Profile Selection Strategy

### Automatic Profile Selection

```typescript
function selectProfile(domain: string, metrics: ScrapingMetrics): Partial<SiteProfile> {
  // Start conservative
  let profile: Partial<SiteProfile> = {
    rateLimit: {
      requestsPerMinute: 10,
      concurrentRequests: 2
    }
  };
  
  // Adjust based on success rate
  if (metrics.successRate > 0.95) {
    // High success - can be more aggressive
    profile.rateLimit = {
      requestsPerMinute: 20,
      concurrentRequests: 5
    };
  } else if (metrics.successRate < 0.70) {
    // Low success - be more conservative
    profile.rateLimit = {
      requestsPerMinute: 5,
      concurrentRequests: 1
    };
    profile.sessionWarmup = {
      enabled: true,
      visitHomepage: true
    };
  }
  
  // Adjust based on block rate
  if (metrics.blockRate > 0.3) {
    profile.adaptiveDelay = {
      enabled: true,
      baseDelay: 5000,
      multiplier: 1.5,
      maxDelay: 60000
    };
  }
  
  return profile;
}

// Apply automatic profile
const metrics = await metricsTracker.getSiteMetrics('example.com', '24h');
const profile = selectProfile('example.com', metrics);
siteProfileManager.updateProfile('example.com', profile);
```

## Testing Profiles

### Profile Testing Script

```typescript
async function testProfile(domain: string, profile: Partial<SiteProfile>) {
  // Apply test profile
  siteProfileManager.updateProfile(domain, profile);
  
  // Make test requests
  const results = [];
  for (let i = 0; i < 10; i++) {
    try {
      const result = await scrapeProduct(`https://${domain}/test-product`);
      results.push({ success: true, result });
    } catch (error) {
      results.push({ success: false, error });
    }
  }
  
  // Analyze results
  const successCount = results.filter(r => r.success).length;
  const successRate = successCount / results.length;
  
  console.log(`Profile test for ${domain}:`);
  console.log(`Success rate: ${(successRate * 100).toFixed(1)}%`);
  
  // Get metrics
  const metrics = await metricsTracker.getSiteMetrics(domain, '24h');
  console.log(`Block rate: ${(metrics.blockRate * 100).toFixed(1)}%`);
  
  return { successRate, blockRate: metrics.blockRate };
}

// Test different profiles
const profiles = [
  { name: 'Conservative', config: { rateLimit: { requestsPerMinute: 5, concurrentRequests: 1 } } },
  { name: 'Moderate', config: { rateLimit: { requestsPerMinute: 10, concurrentRequests: 2 } } },
  { name: 'Aggressive', config: { rateLimit: { requestsPerMinute: 20, concurrentRequests: 5 } } }
];

for (const profile of profiles) {
  console.log(`\nTesting ${profile.name} profile...`);
  const results = await testProfile('example.com', profile.config);
  console.log(results);
}
```

## Best Practices

1. **Start Conservative**: Begin with low request rates and increase gradually
2. **Monitor Metrics**: Regularly check block rates and success rates
3. **Adjust Dynamically**: Use adaptive delays and respond to 429 errors
4. **Use Session Warmup**: Enable for protected sites
5. **Test Profiles**: Test new profiles with small batches first
6. **Document Changes**: Keep track of profile changes and their effects
7. **Respect Limits**: Honor robots.txt and terms of service
8. **Rotate Proxies**: Use multiple proxies with rate-limited sites
9. **Cache Aggressively**: Use appropriate cache times to reduce requests
10. **Handle Failures**: Implement proper retry logic with exponential backoff
