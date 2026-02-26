---
title: "Security Incident Prevention"
description: "Preventing and responding to security incidents"
category: "system-monitoring"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["security", "incidents", "prevention"]
audience: "admin"
---

# Security Incident Prevention Guide

## Overview

This guide documents the comprehensive security incident prevention system implemented to achieve zero security incidents post-deployment. The system provides real-time threat detection, automated response, and proactive security monitoring.

## Architecture

### Components

1. **Incident Prevention Service** (`lib/services/security/incident-prevention.ts`)
   - Real-time threat detection
   - Automated IP blocking
   - Reputation tracking
   - Incident logging

2. **Security Monitoring Service** (`lib/services/monitoring/security-monitoring.ts`)
   - Authentication failure tracking
   - Rate limit violation monitoring
   - Suspicious pattern detection
   - Security event logging

3. **Security Middleware** (`lib/middleware/security-middleware.ts`)
   - Request-level security checks
   - IP blocking enforcement
   - Threat analysis
   - Event tracking

4. **Security Dashboard** (`app/api/v1/security/dashboard/route.ts`)
   - Real-time security metrics
   - Incident visualization
   - Blocked IP management

## Features

### 1. IP Reputation System

Every IP address is assigned a reputation score (0-100):
- **100**: Perfect reputation (new IPs start here)
- **50-99**: Good reputation
- **30-49**: Medium reputation (CAPTCHA required)
- **0-29**: Poor reputation (temporary block)
- **Blocked**: Permanent block after repeated incidents

**Reputation Changes:**
- Authentication failure: -5 points
- Rate limit violation: -3 points
- Unauthorized access: -10 points
- Suspicious pattern: -15 points

### 2. Automated Blocking

**Temporary Blocks:**
- Duration: 1 hour (configurable)
- Triggered when:
  - Reputation score < 30
  - 5+ authentication failures in 5 minutes
  - 10+ rate limit violations in 5 minutes

**Permanent Blocks:**
- Triggered when:
  - 5+ security incidents
  - Repeated temporary blocks
  - Critical threat detected

### 3. Threat Detection

**Threat Levels:**
- **NONE**: Normal activity
- **LOW**: Minor suspicious activity
- **MEDIUM**: Concerning patterns detected
- **HIGH**: Serious threat detected
- **CRITICAL**: Immediate action required

**Detection Patterns:**
- **Brute Force**: 5+ auth failures in 5 minutes
- **Credential Stuffing**: 10+ different emails from same IP in 10 minutes
- **DoS Attempt**: 10+ rate limit violations in 5 minutes
- **Unauthorized Access**: Repeated 401/403 responses

### 4. Automated Response Actions

1. **LOG**: Record event for analysis
2. **WARN**: Log warning message
3. **BLOCK_TEMPORARY**: Block IP for 1 hour
4. **BLOCK_PERMANENT**: Block IP permanently
5. **NOTIFY_ADMIN**: Send notification to administrators
6. **REQUIRE_CAPTCHA**: Require CAPTCHA verification

## Configuration

### Security Policy

Default policy (configurable in `IncidentPreventionService`):

```typescript
{
  maxAuthFailures: 5,
  authFailureWindow: 5 * 60 * 1000, // 5 minutes
  maxRateLimitViolations: 10,
  rateLimitWindow: 5 * 60 * 1000, // 5 minutes
  autoBlockThreshold: 30, // reputation score
  blockDuration: 60 * 60 * 1000, // 1 hour
  permanentBlockThreshold: 5, // incidents
}
```

### Environment Variables

```bash
# Redis (required for security features)
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

## Usage

### Protecting API Routes

```typescript
import { withSecurity } from '@/lib/middleware/security-middleware';

export const GET = withSecurity(async (req: NextRequest) => {
  // Your handler code
  return NextResponse.json({ success: true });
});
```

### Tracking Security Events

```typescript
import {
  trackAuthFailure,
  trackRateLimitViolation,
  trackUnauthorizedAccess,
} from '@/lib/middleware/security-middleware';

// Track authentication failure
await trackAuthFailure(req, email);

// Track rate limit violation
await trackRateLimitViolation(req);

// Track unauthorized access
await trackUnauthorizedAccess(req);
```

### Manual IP Management

```typescript
import { incidentPreventionService } from '@/lib/services/security/incident-prevention';

// Block IP temporarily (1 hour)
await incidentPreventionService.blockIP(
  '192.168.1.1',
  60 * 60 * 1000,
  'Suspicious activity detected'
);

// Block IP permanently
await incidentPreventionService.blockIP(
  '192.168.1.1',
  0,
  'Repeated security violations'
);

// Unblock IP
await incidentPreventionService.unblockIP(
  '192.168.1.1',
  'False positive, legitimate user'
);

// Check if IP is blocked
const isBlocked = await incidentPreventionService.isBlocked('192.168.1.1');

// Get IP reputation
const reputation = await incidentPreventionService.getIPReputation('192.168.1.1');
```

## Monitoring

### Security Dashboard

Access the security dashboard at `/admin/security` (admin only).

**Metrics Displayed:**
- Total incidents (24h, 7d, 30d)
- Incidents by threat level
- Blocked IPs count
- Average reputation score
- Recent incidents
- Recent security events

### API Endpoints

**Get Security Dashboard Data:**
```
GET /api/v1/security/dashboard?timeWindow=86400000
```

**Block IP Address:**
```
POST /api/v1/security/blocked-ips
{
  "ipAddress": "192.168.1.1",
  "duration": 3600000,
  "reason": "Suspicious activity"
}
```

**Unblock IP Address:**
```
DELETE /api/v1/security/blocked-ips
{
  "ipAddress": "192.168.1.1",
  "reason": "False positive"
}
```

### Logs

Security events are logged with structured data:

```json
{
  "level": "warn",
  "message": "Security incident detected",
  "ipAddress": "192.168.1.1",
  "threatLevel": "high",
  "incidentType": "brute_force",
  "actions": ["block_temporary", "notify_admin"],
  "timestamp": "2026-01-28T10:30:00Z"
}
```

## Incident Response

### Automated Response Flow

1. **Event Occurs** (auth failure, rate limit, etc.)
2. **Security Monitoring** records event
3. **Threat Analysis** evaluates risk level
4. **Reputation Update** adjusts IP score
5. **Automated Actions** executed based on threat level
6. **Incident Logging** records details
7. **Admin Notification** sent if critical

### Manual Response

For incidents requiring manual intervention:

1. **Review Incident** in security dashboard
2. **Analyze Context** (IP, user agent, patterns)
3. **Check Reputation** history
4. **Take Action**:
   - Unblock if false positive
   - Extend block if needed
   - Permanent block if malicious
5. **Document Decision** in incident notes

## Best Practices

### 1. Regular Monitoring

- Check security dashboard daily
- Review incident reports weekly
- Analyze trends monthly

### 2. Tuning Thresholds

- Monitor false positive rate
- Adjust thresholds if needed
- Document changes

### 3. Incident Investigation

- Always investigate critical incidents
- Document findings
- Update detection rules if needed

### 4. Whitelist Management

- Maintain whitelist of trusted IPs
- Document whitelist entries
- Review whitelist quarterly

### 5. Testing

- Test security controls regularly
- Simulate attacks in staging
- Verify automated responses

## Metrics & KPIs

### Security Metrics

- **Incident Rate**: Total incidents per day
- **Block Rate**: Blocked requests / total requests
- **False Positive Rate**: Unblocked IPs / total blocks
- **Response Time**: Time from detection to action
- **Resolution Time**: Time from incident to resolution

### Success Criteria

- ✅ Zero successful security breaches
- ✅ < 1% false positive rate
- ✅ < 1 minute response time
- ✅ < 1 hour resolution time for critical incidents
- ✅ 100% incident logging

## Troubleshooting

### High False Positive Rate

**Symptoms:**
- Legitimate users being blocked
- Many unblock requests

**Solutions:**
- Increase reputation thresholds
- Reduce reputation penalties
- Add trusted IPs to whitelist
- Review detection patterns

### Missed Threats

**Symptoms:**
- Security incidents not detected
- Attacks succeeding

**Solutions:**
- Lower detection thresholds
- Add new detection patterns
- Increase monitoring frequency
- Review logs for patterns

### Performance Issues

**Symptoms:**
- Slow request processing
- High Redis latency

**Solutions:**
- Optimize Redis queries
- Add caching layers
- Scale Redis instance
- Review data retention policies

## Data Retention

- **Security Events**: 7 days in Redis
- **Incidents**: 90 days in Redis
- **Blocked IPs**: Until unblocked or TTL expires
- **Reputation Scores**: 30 days

## Compliance

This security system helps meet compliance requirements:

- **GDPR**: IP addresses are pseudonymous data, properly secured
- **SOC 2**: Comprehensive logging and monitoring
- **ISO 27001**: Incident detection and response
- **PCI DSS**: Security monitoring and access control

## Support

For security incidents or questions:

1. Check this documentation
2. Review security dashboard
3. Check application logs
4. Contact security team

## Changelog

### Version 1.0 (2026-01-28)
- Initial implementation
- IP reputation system
- Automated blocking
- Threat detection
- Security dashboard
- Admin notifications

---

**Last Updated**: January 28, 2026  
**Version**: 1.0  
**Status**: Production Ready
