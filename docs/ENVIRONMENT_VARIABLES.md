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

## Email Configuration (Future)

```env
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="your_email@example.com"
SMTP_PASSWORD="your_email_password"
SMTP_FROM="noreply@pricepilot.com"
```

SMTP configuration for email notifications. Not yet implemented.

## Webhook Configuration

```env
WEBHOOK_SECRET="your_webhook_secret"
```

Secret for validating incoming webhooks. Used for integration security.

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
  STEALTH_LEVEL: 'advanced',
  BLOCK_RATE_THRESHOLD: '0.3',
  METRICS_PERSIST_INTERVAL: '300000',
  PROXY_FAILURE_THRESHOLD: '3',
  CHALLENGE_FALLBACK_THRESHOLD: '0.3',
  LOG_LEVEL: 'info'
};
```

Missing required variables will cause the application to fail on startup with a clear error message.
