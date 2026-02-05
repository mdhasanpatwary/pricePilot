---
title: "Environment Variables"
description: "Environment variable configuration"
category: "system-monitoring"
tags: ["configuration", "environment", "deployment"]
audience: "admin"
relatedDocs: ["/docs/integrations/environment-variables.md"]
---

# Environment Variables

This document describes all environment variables used by PricePilot.

## Required Variables

### Database

```env
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"
```

PostgreSQL connection string. Required for all database operations.

**Format**: `postgresql://[user]:[password]@[host]:[port]/[database]?[options]`

**Example**: `postgresql://admin:secret@localhost:5432/pricepilot?sslmode=require`

### Authentication

```env
NEXTAUTH_SECRET="your_secure_random_hash"
```

Secret key for NextAuth.js session encryption. Must be a random string of at least 32 characters.

**Generate**: `openssl rand -base64 32`

```env
NEXTAUTH_URL="http://localhost:3000"
```

Base URL of your application. Used by NextAuth.js for callbacks and redirects.

**Development**: `http://localhost:3000`
**Production**: `https://yourdomain.com`

## Optional Variables

### Redis (Caching & Rate Limiting)

```env
REDIS_URL="rediss://default:password@host:port"
```

Redis connection string for caching and rate limiting. Optional but recommended for production.

**Format**: `rediss://[user]:[password]@[host]:[port]`

### Admin Access

```env
SUPER_ADMIN_LOGIN_CODE="your_secret_code"
```

Secret code for super admin access. Used for initial setup and emergency access.

**Security**: Use a strong, unique code and rotate regularly.

## Advanced Scraping Variables

### Captcha Solver Configuration

```env
CAPTCHA_SOLVER_ENABLED="false"
```

Enable or disable captcha solving integration with 2Captcha service.

**Options**:
- `true`: Enable captcha solving (requires API key)
- `false`: Disable captcha solving (default)

**Default**: `false`

**Recommendation**: Enable only if you have a 2Captcha account and need to solve captchas.

```env
CAPTCHA_SOLVER_API_KEY=""
```

API key for 2Captcha service. Required when `CAPTCHA_SOLVER_ENABLED` is `true`.

**Format**: String (your 2Captcha API key)

**Security**: Keep this key secret. Never commit to version control.

**Get API Key**: Sign up at https://2captcha.com and find your API key in the dashboard.

```env
CAPTCHA_SOLVER_TIMEOUT="120000"
```

Maximum time in milliseconds to wait for captcha solution.

**Format**: Integer (milliseconds)

**Default**: `120000` (2 minutes)

**Range**: 10000-300000 (10 seconds to 5 minutes)

**Recommendation**: 
- Simple captchas: 60000 (1 minute)
- Complex captchas: 120000-180000 (2-3 minutes)

### Retry Strategy Configuration

```env
RETRY_MAX_ATTEMPTS="3"
```

Maximum number of retry attempts for failed scraping requests.

**Format**: Integer

**Default**: `3`

**Range**: 1-10

**Recommendation**: 
- Stable sites: 2-3 attempts
- Unstable sites: 3-5 attempts

```env
RETRY_INITIAL_DELAY="1000"
```

Initial delay in milliseconds before first retry attempt.

**Format**: Integer (milliseconds)

**Default**: `1000` (1 second)

**Range**: 100-10000 (0.1 to 10 seconds)

**Recommendation**: 
- Fast sites: 500-1000ms
- Slow sites: 2000-5000ms

```env
RETRY_MAX_DELAY="30000"
```

Maximum delay in milliseconds between retry attempts (caps exponential backoff).

**Format**: Integer (milliseconds)

**Default**: `30000` (30 seconds)

**Range**: 1000-300000 (1 second to 5 minutes)

**Recommendation**: 
- Quick retries: 10000-30000ms
- Patient retries: 60000-120000ms

```env
RETRY_BACKOFF_MULTIPLIER="2"
```

Multiplier for exponential backoff calculation.

**Format**: Decimal

**Default**: `2`

**Range**: 1.1-5

**Formula**: `delay = initialDelay * (multiplier ^ attempt)`

**Recommendation**: 
- Aggressive: 1.5-2
- Conservative: 2-3

### Concurrency Configuration

```env
CONCURRENCY_MIN="1"
```

Minimum number of concurrent requests per site.

**Format**: Integer

**Default**: `1`

**Range**: 1-100

**Recommendation**: Always keep at 1 to ensure at least one request can be made.

```env
CONCURRENCY_MAX="10"
```

Maximum number of concurrent requests per site.

**Format**: Integer

**Default**: `10`

**Range**: 1-100

**Recommendation**: 
- Small sites: 3-5
- Large sites: 10-20
- Be respectful of site resources

```env
CONCURRENCY_INITIAL="3"
```

Initial number of concurrent requests per site.

**Format**: Integer

**Default**: `3`

**Range**: 1-100 (must be between CONCURRENCY_MIN and CONCURRENCY_MAX)

**Recommendation**: 
- Conservative: 2-3
- Moderate: 3-5
- Aggressive: 5-10

### Alert Thresholds Configuration

```env
ALERT_BLOCK_RATE_THRESHOLD="0.3"
```

Block rate threshold for creating critical alerts.

**Format**: Decimal between 0 and 1 (e.g., 0.3 = 30%)

**Default**: `0.3` (30%)

**Recommendation**: 
- Strict: 0.2 (20%)
- Moderate: 0.3 (30%)
- Lenient: 0.4-0.5 (40-50%)

```env
ALERT_SOLVE_RATE_THRESHOLD="0.7"
```

Minimum captcha solve rate before creating warning alerts.

**Format**: Decimal between 0 and 1 (e.g., 0.7 = 70%)

**Default**: `0.7` (70%)

**Recommendation**: 
- Strict: 0.8 (80%)
- Moderate: 0.7 (70%)
- Lenient: 0.6 (60%)

```env
ALERT_PROXY_FAILURE_THRESHOLD="0.5"
```

Proxy failure rate threshold for creating warning alerts.

**Format**: Decimal between 0 and 1 (e.g., 0.5 = 50%)

**Default**: `0.5` (50%)

**Recommendation**: 
- Strict: 0.3-0.4 (30-40%)
- Moderate: 0.5 (50%)
- Lenient: 0.6-0.7 (60-70%)

```env
ALERT_RESPONSE_TIME_THRESHOLD="5000"
```

Response time threshold in milliseconds for performance alerts.

**Format**: Integer (milliseconds)

**Default**: `5000` (5 seconds)

**Range**: 1000-60000 (1 to 60 seconds)

**Recommendation**: 
- Fast sites: 2000-3000ms
- Normal sites: 5000ms
- Slow sites: 10000ms

### Proxy Configuration

```env
SCRAPER_PROXIES="http://proxy1:8080,http://proxy2:8080,http://proxy3:8080"
```

Comma-separated list of proxy URLs for web scraping. Supports HTTP and HTTPS proxies.

**Format**: `http://[host]:[port]` or `https://[host]:[port]`

**Example**: `http://proxy1.example.com:8080,http://proxy2.example.com:8080`

**Note**: For authenticated proxies, use `PROXY_USERNAME` and `PROXY_PASSWORD` variables.

```env
PROXY_USERNAME="your_proxy_username"
```

Username for proxy authentication. Applied to all proxies in `SCRAPER_PROXIES`.

```env
PROXY_PASSWORD="your_proxy_password"
```

Password for proxy authentication. Applied to all proxies in `SCRAPER_PROXIES`.

**Security**: Store credentials securely and rotate regularly.

### Stealth Configuration

```env
STEALTH_LEVEL="advanced"
```

Browser stealth level for web scraping.

**Options**:
- `basic`: Basic stealth features (user agent, viewport)
- `advanced`: Enhanced fingerprinting protection (canvas, audio, fonts)
- `maximum`: All stealth features enabled (includes WebRTC, timezone, battery)

**Default**: `advanced`

**Recommendation**: Use `advanced` for most cases. Use `maximum` for highly protected sites.

```env
BLOCK_RATE_THRESHOLD="0.3"
```

Block rate threshold for alerting. Triggers warnings when block rate exceeds this value.

**Format**: Decimal between 0 and 1 (e.g., 0.3 = 30%)

**Default**: `0.3` (30%)

**Recommendation**: Start with 0.3 and adjust based on your requirements.

```env
METRICS_PERSIST_INTERVAL="300000"
```

Interval in milliseconds for persisting metrics to database.

**Format**: Integer (milliseconds)

**Default**: `300000` (5 minutes)

**Recommendation**: 
- Development: 60000 (1 minute) for faster feedback
- Production: 300000 (5 minutes) to balance performance and data loss risk

```env
PROXY_FAILURE_THRESHOLD="3"
```

Number of consecutive failures before marking a proxy as unhealthy.

**Format**: Integer

**Default**: `3`

**Recommendation**: 
- Reliable proxies: 3-5
- Unreliable proxies: 2-3

```env
CHALLENGE_FALLBACK_THRESHOLD="0.3"
```

Challenge solve rate threshold for triggering fallback strategies.

**Format**: Decimal between 0 and 1 (e.g., 0.3 = 30%)

**Default**: `0.3` (30%)

**Recommendation**: Lower values (0.2-0.3) trigger fallback sooner, higher values (0.4-0.5) are more tolerant.

## Email Configuration

Email notifications in PricePilot are configured through the **SystemConfig** database table, managed by the Super Admin through the admin dashboard. This approach provides centralized, secure configuration without requiring environment variables.

### Required SystemConfig Keys

The following keys must be configured in the SystemConfig table for email notifications to work:

```
NOTIFICATIONS_EMAIL_ENABLED: "true" or "false"
SMTP_HOST: "smtp.example.com"
SMTP_PORT: "587" or "465"
SMTP_USER: "your_email@example.com"
SMTP_PASS: "your_email_password"
SMTP_FROM: "PricePilot <noreply@pricepilot.com>"
```

### Configuration via Admin Dashboard

1. Log in as Super Admin
2. Navigate to Admin → System Configuration
3. Add/update the SMTP configuration keys
4. Test email sending from the dashboard

### User Preferences

Individual users can enable/disable email notifications in their account settings:
- Navigate to Dashboard → Settings
- Toggle "Email Notifications"
- This setting is stored in `User.emailNotifications` field

### Email Notification Types

1. **Pending Approval Notifications**: Sent when price changes await approval
2. **Daily Approval Summary**: Sent daily at 8 AM with approval statistics
3. **Auto-Approval Notifications**: Sent when auto-approval rules process changes

For detailed information, see [Email Notifications Guide](./EMAIL_NOTIFICATIONS.md).

### Cron Job Configuration

The daily approval summary requires a cron job configured in `vercel.json`:

```json
{
  "path": "/api/v1/cron/daily-approval-summary",
  "schedule": "0 8 * * *"
}
```

### Security Considerations

- SMTP credentials are stored encrypted in the database
- Only Super Admin can view/edit SMTP configuration
- Email sending respects user notification preferences
- Failed emails are logged but don't block operations

## Webhook Configuration

```env
WEBHOOK_SECRET="your_webhook_secret"
```

Secret for validating incoming webhooks. Used for integration security.

## Cron Job Configuration

```env
CRON_SECRET="your_secure_random_string"
```

Secret for authenticating cron job requests. Required for all scheduled tasks.

**Generate**: `openssl rand -base64 32`

**Security**: This secret is used to verify that cron job requests are legitimate and not from unauthorized sources. Keep this value secret and never commit it to version control.

**Usage**: All cron job endpoints (e.g., `/api/v1/cron/daily-approval-summary`) require this secret in the Authorization header:

```bash
curl https://yourdomain.com/api/v1/cron/daily-approval-summary \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Cron Jobs**:
- `/api/cron/global-sync` - Daily product sync (0 0 * * *)
- `/api/v1/cron/cleanup-expired-approvals` - Cleanup expired approvals (0 2 * * *)
- `/api/v1/cron/auto-approval` - Process auto-approval rules (0 * * * *)
- `/api/v1/cron/daily-approval-summary` - Send daily email summaries (0 8 * * *)

## Development Variables

```env
NODE_ENV="development"
```

Node environment. Automatically set by Next.js.

**Options**:
- `development`: Development mode with hot reload
- `production`: Production mode with optimizations
- `test`: Test mode for running tests

```env
LOG_LEVEL="info"
```

Logging level for application logs.

**Options**:
- `error`: Only errors
- `warn`: Warnings and errors
- `info`: Info, warnings, and errors (default)
- `debug`: All logs including debug information

**Default**: `info`

**Recommendation**: 
- Development: `debug`
- Production: `info` or `warn`

## Example .env File

### Minimal Configuration (Development)

```env
# Database
DATABASE_URL="postgresql://admin:password@localhost:5432/pricepilot"

# Authentication
NEXTAUTH_SECRET="your_secure_random_hash_here"
NEXTAUTH_URL="http://localhost:3000"

# Admin
SUPER_ADMIN_LOGIN_CODE="ADMIN123"

# Resilience Features (Optional - defaults will be used)
CAPTCHA_SOLVER_ENABLED="false"
RETRY_MAX_ATTEMPTS="3"
CONCURRENCY_INITIAL="3"
```

### Full Configuration (Production)

```env
# Database
DATABASE_URL="postgresql://user:password@prod-db.example.com:5432/pricepilot?sslmode=require"

# Authentication
NEXTAUTH_SECRET="your_secure_random_hash_here"
NEXTAUTH_URL="https://pricepilot.example.com"

# Redis
REDIS_URL="rediss://default:password@redis.example.com:6379"

# Admin
SUPER_ADMIN_LOGIN_CODE="your_secret_code"

# Captcha Solver
CAPTCHA_SOLVER_ENABLED="true"
CAPTCHA_SOLVER_API_KEY="your_2captcha_api_key"
CAPTCHA_SOLVER_TIMEOUT="120000"

# Retry Strategy
RETRY_MAX_ATTEMPTS="3"
RETRY_INITIAL_DELAY="1000"
RETRY_MAX_DELAY="30000"
RETRY_BACKOFF_MULTIPLIER="2"

# Concurrency
CONCURRENCY_MIN="1"
CONCURRENCY_MAX="10"
CONCURRENCY_INITIAL="3"

# Alert Thresholds
ALERT_BLOCK_RATE_THRESHOLD="0.3"
ALERT_SOLVE_RATE_THRESHOLD="0.7"
ALERT_PROXY_FAILURE_THRESHOLD="0.5"
ALERT_RESPONSE_TIME_THRESHOLD="5000"

# Proxies
SCRAPER_PROXIES="http://proxy1.example.com:8080,http://proxy2.example.com:8080"
PROXY_USERNAME="proxy_user"
PROXY_PASSWORD="proxy_pass"

# Stealth
STEALTH_LEVEL="advanced"
BLOCK_RATE_THRESHOLD="0.3"
METRICS_PERSIST_INTERVAL="300000"
PROXY_FAILURE_THRESHOLD="3"
CHALLENGE_FALLBACK_THRESHOLD="0.3"

# Logging
LOG_LEVEL="info"
```

## Security Best Practices

1. **Never commit .env files**: Add `.env` to `.gitignore`
2. **Use strong secrets**: Generate random strings for all secret values
3. **Rotate credentials**: Regularly update passwords and secrets
4. **Limit access**: Restrict who can view production environment variables
5. **Use environment-specific files**: `.env.development`, `.env.production`, `.env.test`
6. **Validate on startup**: Application validates required variables on startup
7. **Use secret management**: Consider using AWS Secrets Manager, HashiCorp Vault, or similar for production

## Troubleshooting

### Database Connection Issues

**Error**: `Error: P1001: Can't reach database server`

**Solution**: 
- Verify `DATABASE_URL` is correct
- Check database server is running
- Verify network connectivity
- Check firewall rules

### Authentication Issues

**Error**: `[next-auth][error][JWT_SESSION_ERROR]`

**Solution**:
- Verify `NEXTAUTH_SECRET` is set and at least 32 characters
- Regenerate secret if compromised
- Clear browser cookies and try again

### Proxy Connection Issues

**Error**: `Proxy connection failed`

**Solution**:
- Verify proxy URLs in `SCRAPER_PROXIES` are correct
- Check proxy authentication credentials
- Test proxy connectivity manually
- Review proxy health metrics

### Redis Connection Issues

**Error**: `Redis connection failed`

**Solution**:
- Verify `REDIS_URL` is correct
- Check Redis server is running
- Verify authentication credentials
- Application will work without Redis but with reduced performance

## Environment Variable Validation

The application validates environment variables on startup:

```typescript
// Required variables
const required = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL'
];

// Optional variables with defaults
const optional = {
  // Captcha Solver
  CAPTCHA_SOLVER_ENABLED: 'false',
  CAPTCHA_SOLVER_API_KEY: '',
  CAPTCHA_SOLVER_TIMEOUT: '120000',
  
  // Retry Strategy
  RETRY_MAX_ATTEMPTS: '3',
  RETRY_INITIAL_DELAY: '1000',
  RETRY_MAX_DELAY: '30000',
  RETRY_BACKOFF_MULTIPLIER: '2',
  
  // Concurrency
  CONCURRENCY_MIN: '1',
  CONCURRENCY_MAX: '10',
  CONCURRENCY_INITIAL: '3',
  
  // Alert Thresholds
  ALERT_BLOCK_RATE_THRESHOLD: '0.3',
  ALERT_SOLVE_RATE_THRESHOLD: '0.7',
  ALERT_PROXY_FAILURE_THRESHOLD: '0.5',
  ALERT_RESPONSE_TIME_THRESHOLD: '5000',
  
  // Legacy Stealth
  STEALTH_LEVEL: 'advanced',
  BLOCK_RATE_THRESHOLD: '0.3',
  METRICS_PERSIST_INTERVAL: '300000',
  PROXY_FAILURE_THRESHOLD: '3',
  CHALLENGE_FALLBACK_THRESHOLD: '0.3',
  LOG_LEVEL: 'info'
};
```

Missing required variables will cause the application to fail on startup with a clear error message.

### Configuration Validation Rules

The resilience configuration module (`lib/config/resilience-config.ts`) validates all values:

1. **Type Validation**: Ensures numbers are valid, booleans are true/false
2. **Range Validation**: Enforces min/max bounds for numeric values
3. **Logical Validation**: Ensures max > min, initial is between min and max
4. **Warning Logs**: Logs warnings for invalid values and uses defaults
5. **Startup Logging**: Logs complete configuration on application startup

**Example Validation**:
- `CONCURRENCY_MAX` must be >= `CONCURRENCY_MIN`
- `CONCURRENCY_INITIAL` must be between `CONCURRENCY_MIN` and `CONCURRENCY_MAX`
- `RETRY_MAX_DELAY` must be >= `RETRY_INITIAL_DELAY`
- Alert thresholds must be between 0 and 1
- Timeouts must be positive integers

**Access Configuration**:
```typescript
import { getResilienceConfig } from '@/lib/config/resilience-config';

const config = getResilienceConfig();
console.log(config.retryStrategy.maxAttempts); // 3
console.log(config.concurrency.initial); // 3
console.log(config.alertThresholds.blockRateThreshold); // 0.3
```
