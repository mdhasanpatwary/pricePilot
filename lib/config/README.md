# Configuration Module

This directory contains configuration management for the PricePilot application.

## Resilience Configuration

The `resilience-config.ts` module provides validated configuration for advanced scraping resilience features.

### Usage

```typescript
import { getResilienceConfig } from '@/lib/config/resilience-config';

// Get the configuration (singleton)
const config = getResilienceConfig();

// Access captcha solver settings
if (config.captchaSolver.enabled) {
  console.log('Captcha solving is enabled');
  console.log('Timeout:', config.captchaSolver.timeout);
}

// Access retry strategy settings
console.log('Max retry attempts:', config.retryStrategy.maxAttempts);
console.log('Initial delay:', config.retryStrategy.initialDelay);
console.log('Max delay:', config.retryStrategy.maxDelay);

// Access concurrency settings
console.log('Min concurrency:', config.concurrency.min);
console.log('Max concurrency:', config.concurrency.max);
console.log('Initial concurrency:', config.concurrency.initial);

// Access alert thresholds
console.log('Block rate threshold:', config.alertThresholds.blockRateThreshold);
console.log('Solve rate threshold:', config.alertThresholds.solveRateThreshold);
```

### Configuration Validation

The module automatically validates all configuration values on first access:

- **Type validation**: Ensures values are correct types (number, boolean, string)
- **Range validation**: Enforces min/max bounds for numeric values
- **Logical validation**: Ensures relationships between values are valid (e.g., max >= min)
- **Default values**: Provides sensible defaults for all optional values
- **Warning logs**: Logs warnings for invalid values and uses defaults

### Environment Variables

See `docs/ENVIRONMENT_VARIABLES.md` for complete documentation of all environment variables.

#### Captcha Solver

- `CAPTCHA_SOLVER_ENABLED`: Enable/disable captcha solving (default: false)
- `CAPTCHA_SOLVER_API_KEY`: 2Captcha API key (required if enabled)
- `CAPTCHA_SOLVER_TIMEOUT`: Max wait time for solution in ms (default: 120000)

#### Retry Strategy

- `RETRY_MAX_ATTEMPTS`: Max retry attempts (default: 3, range: 1-10)
- `RETRY_INITIAL_DELAY`: Initial delay in ms (default: 1000, range: 100-10000)
- `RETRY_MAX_DELAY`: Max delay in ms (default: 30000, range: 1000-300000)
- `RETRY_BACKOFF_MULTIPLIER`: Backoff multiplier (default: 2, range: 1.1-5)

#### Concurrency

- `CONCURRENCY_MIN`: Min concurrent requests (default: 1, range: 1-100)
- `CONCURRENCY_MAX`: Max concurrent requests (default: 10, range: 1-100)
- `CONCURRENCY_INITIAL`: Initial concurrent requests (default: 3, range: 1-100)

#### Alert Thresholds

- `ALERT_BLOCK_RATE_THRESHOLD`: Block rate alert threshold (default: 0.3, range: 0-1)
- `ALERT_SOLVE_RATE_THRESHOLD`: Solve rate alert threshold (default: 0.7, range: 0-1)
- `ALERT_PROXY_FAILURE_THRESHOLD`: Proxy failure alert threshold (default: 0.5, range: 0-1)
- `ALERT_RESPONSE_TIME_THRESHOLD`: Response time alert threshold in ms (default: 5000, range: 1000-60000)

### Startup Logging

The configuration is automatically logged on first access:

```
=== Advanced Scraping Resilience Configuration ===
Captcha Solver: { enabled: false, apiKeySet: false, timeout: '120000ms' }
Retry Strategy: { maxAttempts: 3, initialDelay: '1000ms', maxDelay: '30000ms', backoffMultiplier: 2 }
Concurrency: { min: 1, max: 10, initial: 3 }
Alert Thresholds: { blockRate: '30%', solveRate: '70%', proxyFailure: '50%', responseTime: '5000ms' }
==================================================
```

### Testing

For testing purposes, you can reset the configuration singleton:

```typescript
import { resetResilienceConfig } from '@/lib/config/resilience-config';

// Reset configuration (useful in test cleanup)
resetResilienceConfig();
```

## System Configuration

The `config.ts` module provides database-backed system configuration via the `SystemConfigService`.

See the main `lib/config.ts` file for usage details.
