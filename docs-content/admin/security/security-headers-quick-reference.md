---
title: "Security Headers Quick Reference"
description: "Quick reference for security headers"
category: "security"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["security", "headers", "reference"]
audience: "admin"
relatedDocs: ["/docs/troubleshooting/security-headers-quick-reference.md"]
---

# Security Headers Quick Reference

## Quick Overview

| Header | Status | Value | Protection |
|--------|--------|-------|------------|
| Content-Security-Policy | ✅ Enabled | See below | XSS, Injection |
| X-Frame-Options | ✅ Enabled | DENY | Clickjacking |
| X-Content-Type-Options | ✅ Enabled | nosniff | MIME Sniffing |
| Strict-Transport-Security | ✅ Enabled | max-age=31536000 | MITM Attacks |
| Referrer-Policy | ✅ Enabled | origin-when-cross-origin | Privacy |

## Content-Security-Policy (CSP)

### Current Policy
```
default-src 'self';
script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://va.vercel-scripts.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: https: blob:;
font-src 'self' data:;
connect-src 'self' https://vercel.live https://va.vercel-scripts.com https://*.sentry.io https://*.upstash.io wss://ws-*.pusher.com;
frame-src 'self' https://vercel.live;
media-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests
```

### Key Directives

| Directive | Purpose | Current Value |
|-----------|---------|---------------|
| default-src | Default policy | 'self' |
| script-src | JavaScript sources | 'self' + Vercel + inline |
| style-src | CSS sources | 'self' + inline |
| img-src | Image sources | 'self' + data + https + blob |
| connect-src | AJAX/WebSocket | 'self' + Vercel + Sentry + Upstash |
| frame-ancestors | Embedding policy | 'none' (no iframes) |
| object-src | Plugins | 'none' (blocked) |

### Adding New Domains

To allow a new external service:

1. **Scripts**: Add to `script-src`
   ```typescript
   "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://new-service.com"
   ```

2. **API Calls**: Add to `connect-src`
   ```typescript
   "connect-src 'self' https://api.new-service.com"
   ```

3. **Images**: Already allows all HTTPS images
   ```typescript
   "img-src 'self' data: https: blob:"
   ```

## X-Frame-Options

### Current Setting
```
X-Frame-Options: DENY
```

### Options
- **DENY**: Never allow embedding (current)
- **SAMEORIGIN**: Allow same-origin embedding
- **ALLOW-FROM**: Deprecated, use CSP frame-ancestors

### When to Change
Only change if you need to embed PricePilot in an iframe. Consider security implications carefully.

## X-Content-Type-Options

### Current Setting
```
X-Content-Type-Options: nosniff
```

### Purpose
Forces browsers to respect declared Content-Type headers, preventing MIME type confusion attacks.

### No Configuration Needed
This header has only one valid value: `nosniff`

## Strict-Transport-Security (HSTS)

### Current Setting
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### Directives
- **max-age=31536000**: Remember for 1 year
- **includeSubDomains**: Apply to all subdomains
- **preload**: Eligible for browser preload list

### Important Notes
- Only works over HTTPS
- Cannot be disabled for max-age duration
- Preload requires submission to hstspreload.org

### Adjusting Duration
```typescript
// 6 months
"max-age=15768000; includeSubDomains"

// 1 year (recommended)
"max-age=31536000; includeSubDomains; preload"

// 2 years (maximum)
"max-age=63072000; includeSubDomains; preload"
```

## Referrer-Policy

### Current Setting
```
Referrer-Policy: origin-when-cross-origin
```

### Options
- **no-referrer**: Never send referrer
- **origin**: Send only origin
- **origin-when-cross-origin**: Full URL for same-origin, origin for cross-origin (current)
- **strict-origin-when-cross-origin**: Like above, but only over HTTPS

### Behavior
| Request Type | Referrer Sent |
|--------------|---------------|
| Same origin | Full URL |
| Cross origin | Origin only |
| HTTPS → HTTP | None |

## Testing Commands

### Quick Test
```bash
# Test local development
curl -I http://localhost:3000

# Test production
curl -I https://your-domain.com
```

### Comprehensive Test
```bash
# Run test script
npx tsx scripts/test-security-headers.ts

# Test specific URL
TEST_URL=https://your-domain.com npx tsx scripts/test-security-headers.ts
```

### Online Scanners
```bash
# Security Headers
https://securityheaders.com/?q=your-domain.com

# Mozilla Observatory
https://observatory.mozilla.org/analyze/your-domain.com

# SSL Labs
https://www.ssllabs.com/ssltest/analyze.html?d=your-domain.com
```

## Common Issues

### CSP Violations

**Symptom**: Resources blocked, console errors
```
Refused to load the script 'https://example.com/script.js' because it violates the following Content Security Policy directive: "script-src 'self'"
```

**Solution**: Add domain to appropriate CSP directive
```typescript
"script-src 'self' https://example.com"
```

### Mixed Content

**Symptom**: HTTP resources on HTTPS page
```
Mixed Content: The page at 'https://...' was loaded over HTTPS, but requested an insecure resource 'http://...'
```

**Solution**: 
1. Change URLs to HTTPS
2. CSP `upgrade-insecure-requests` will auto-upgrade

### HSTS Not Working

**Symptom**: Browser not forcing HTTPS

**Causes**:
- Site not accessed over HTTPS
- max-age expired
- Browser cache

**Solution**:
1. Ensure HTTPS is working
2. Clear browser HSTS cache
3. Wait for max-age to take effect

## Configuration Location

All security headers are configured in:
```
next.config.ts → async headers()
```

## Environment Variables

No environment variables required for security headers. They are applied globally.

## Monitoring

### CSP Violations (Optional)
```typescript
// Add to CSP
"report-uri /api/csp-report"

// Create endpoint
// app/api/csp-report/route.ts
export async function POST(req: Request) {
  const report = await req.json();
  logger.warn('CSP Violation', { report });
  return new Response('OK', { status: 200 });
}
```

### Metrics to Track
- CSP violation rate
- Mixed content warnings
- HSTS upgrade rate
- Security scanner scores

## Compliance Checklist

- [x] Content-Security-Policy configured
- [x] X-Frame-Options set to DENY
- [x] X-Content-Type-Options set to nosniff
- [x] Strict-Transport-Security enabled (production)
- [x] Referrer-Policy configured
- [x] All headers tested
- [x] Documentation complete
- [ ] CSP violation monitoring (optional)
- [ ] Regular security scans scheduled

## Next Steps

1. **Test in Production**
   ```bash
   TEST_URL=https://your-domain.com npx tsx scripts/test-security-headers.ts
   ```

2. **Run Security Scanners**
   - https://securityheaders.com/
   - https://observatory.mozilla.org/

3. **Monitor CSP Violations**
   - Set up CSP reporting endpoint
   - Review violations weekly

4. **Regular Reviews**
   - Review headers quarterly
   - Update as needed for new services
   - Keep documentation current

## Support

For issues or questions:
1. Check browser console for CSP violations
2. Review documentation: `docs/SECURITY_HEADERS.md`
3. Test with: `scripts/test-security-headers.ts`
4. Consult: https://content-security-policy.com/

---

**Last Updated**: January 2026  
**Version**: 1.0
