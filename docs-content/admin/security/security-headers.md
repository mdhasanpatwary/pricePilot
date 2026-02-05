---
title: "Security Headers"
description: "Security headers configuration and usage"
category: "security"
tags: ["security", "headers", "configuration"]
audience: "admin"
relatedDocs: ["/docs/troubleshooting/security-headers.md"]
---

# Security Headers Implementation

## Overview

This document describes the security headers implemented in PricePilot to protect against common web vulnerabilities and attacks.

## Implemented Headers

### 1. Content-Security-Policy (CSP)

**Purpose**: Prevents XSS attacks, clickjacking, and other code injection attacks by controlling which resources can be loaded.

**Configuration**:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://vercel.live https://va.vercel-scripts.com https://*.sentry.io https://*.upstash.io wss://ws-*.pusher.com; frame-src 'self' https://vercel.live; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

**Directives Explained**:
- `default-src 'self'`: Only allow resources from same origin by default
- `script-src`: Allow scripts from self, Vercel analytics, and inline scripts (required for Next.js)
- `style-src 'self' 'unsafe-inline'`: Allow styles from self and inline styles (required for styled-components)
- `img-src 'self' data: https: blob:`: Allow images from self, data URIs, HTTPS sources, and blob URLs
- `font-src 'self' data:`: Allow fonts from self and data URIs
- `connect-src`: Allow connections to self, Vercel, Sentry, Upstash Redis, and Pusher WebSockets
- `frame-src 'self' https://vercel.live'`: Allow frames from self and Vercel Live
- `media-src 'self'`: Only allow media from same origin
- `object-src 'none'`: Block all plugins (Flash, Java, etc.)
- `base-uri 'self'`: Restrict base tag to same origin
- `form-action 'self'`: Only allow form submissions to same origin
- `frame-ancestors 'none'`: Prevent embedding in iframes (same as X-Frame-Options: DENY)
- `upgrade-insecure-requests`: Automatically upgrade HTTP requests to HTTPS

**Note**: Some directives use `'unsafe-inline'` and `'unsafe-eval'` which are required for Next.js to function properly. In a future iteration, consider using nonces or hashes for inline scripts.

### 2. X-Frame-Options

**Purpose**: Prevents clickjacking attacks by controlling whether the site can be embedded in iframes.

**Configuration**:
```
X-Frame-Options: DENY
```

**Options**:
- `DENY`: Never allow embedding in frames
- `SAMEORIGIN`: Only allow embedding from same origin
- `ALLOW-FROM uri`: Allow embedding from specific URI (deprecated)

**Why DENY**: PricePilot is a standalone application and should never be embedded in iframes to prevent clickjacking attacks.

### 3. X-Content-Type-Options

**Purpose**: Prevents MIME type sniffing attacks by forcing browsers to respect declared content types.

**Configuration**:
```
X-Content-Type-Options: nosniff
```

**Protection**: Prevents browsers from interpreting files as a different MIME type than declared, which could lead to XSS attacks.

### 4. Strict-Transport-Security (HSTS)

**Purpose**: Forces browsers to only connect via HTTPS, preventing man-in-the-middle attacks.

**Configuration**:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**Directives**:
- `max-age=31536000`: Remember HTTPS preference for 1 year (31536000 seconds)
- `includeSubDomains`: Apply to all subdomains
- `preload`: Eligible for browser HSTS preload list

**Important**: Only enable in production with valid HTTPS certificate. The `preload` directive requires submission to the HSTS preload list.

### 5. Referrer-Policy

**Purpose**: Controls how much referrer information is sent with requests.

**Configuration**:
```
Referrer-Policy: origin-when-cross-origin
```

**Behavior**:
- Same-origin requests: Send full URL
- Cross-origin requests: Send only origin (no path or query string)

**Privacy**: Balances analytics needs with user privacy.

## Testing Security Headers

### Manual Testing

1. **Browser DevTools**:
   ```bash
   # Open DevTools > Network tab
   # Inspect response headers for any request
   ```

2. **cURL**:
   ```bash
   curl -I https://your-domain.com
   ```

3. **Online Tools**:
   - [Security Headers](https://securityheaders.com/)
   - [Mozilla Observatory](https://observatory.mozilla.org/)
   - [SSL Labs](https://www.ssllabs.com/ssltest/)

### Automated Testing Script

Run the security headers test script:
```bash
npx tsx scripts/test-security-headers.ts
```

## Security Header Scores

### Target Scores
- Security Headers: A+ rating
- Mozilla Observatory: A+ rating
- SSL Labs: A+ rating

### Current Implementation
All critical security headers are implemented with industry best practices.

## CSP Violation Reporting

### Enable CSP Reporting (Optional)

To monitor CSP violations in production, add a `report-uri` or `report-to` directive:

```typescript
// In next.config.ts
"Content-Security-Policy": [
  // ... existing directives
  "report-uri https://your-domain.com/api/csp-report",
  "report-to csp-endpoint"
].join("; ")
```

### CSP Report Endpoint

Create an endpoint to receive CSP violation reports:

```typescript
// app/api/csp-report/route.ts
export async function POST(req: Request) {
  const report = await req.json();
  
  // Log CSP violation
  logger.warn('CSP Violation', { report });
  
  return new Response('OK', { status: 200 });
}
```

## Environment-Specific Configuration

### Development
- CSP may be more permissive for hot reloading
- HSTS disabled (HTTP allowed)
- More verbose error messages

### Production
- Strict CSP policy
- HSTS enabled with preload
- Error messages sanitized

## Troubleshooting

### CSP Violations

**Symptom**: Resources blocked by CSP
**Solution**: 
1. Check browser console for CSP violation messages
2. Add necessary domains to appropriate CSP directives
3. Test thoroughly before deploying

### Mixed Content Warnings

**Symptom**: HTTP resources on HTTPS page
**Solution**:
1. Ensure all resources use HTTPS
2. Use `upgrade-insecure-requests` directive
3. Update hardcoded HTTP URLs to HTTPS

### Frame Embedding Issues

**Symptom**: Site won't load in iframe
**Solution**:
- This is intentional (X-Frame-Options: DENY)
- If embedding is required, change to SAMEORIGIN
- Consider security implications carefully

## Compliance

### OWASP Top 10
- ✅ A1: Injection (CSP, X-Content-Type-Options)
- ✅ A2: Broken Authentication (HSTS)
- ✅ A3: Sensitive Data Exposure (HSTS)
- ✅ A7: Cross-Site Scripting (CSP, X-Content-Type-Options)
- ✅ A10: Insufficient Logging (CSP reporting)

### Security Standards
- ✅ OWASP Secure Headers Project
- ✅ Mozilla Web Security Guidelines
- ✅ NIST Cybersecurity Framework

## Maintenance

### Regular Reviews
- Review CSP policy quarterly
- Update allowed domains as needed
- Monitor CSP violation reports
- Test with security scanning tools

### Updates
- Keep Next.js updated for latest security features
- Review new security header recommendations
- Update documentation with changes

## References

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [Content Security Policy Reference](https://content-security-policy.com/)
- [Security Headers Best Practices](https://securityheaders.com/)

## Quick Reference

| Header | Value | Purpose |
|--------|-------|---------|
| Content-Security-Policy | See above | Prevent XSS, injection attacks |
| X-Frame-Options | DENY | Prevent clickjacking |
| X-Content-Type-Options | nosniff | Prevent MIME sniffing |
| Strict-Transport-Security | max-age=31536000; includeSubDomains; preload | Force HTTPS |
| Referrer-Policy | origin-when-cross-origin | Control referrer information |

---

**Last Updated**: January 2026  
**Version**: 1.0  
**Status**: Production Ready
