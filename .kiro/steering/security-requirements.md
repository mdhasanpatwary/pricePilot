---
inclusion: always
---

# Security Requirements

## Core Security Principles

### Zero Trust Architecture
- Never trust, always verify
- Authenticate every request
- Validate all inputs
- Encrypt sensitive data
- Audit all actions

### Defense in Depth
- Multiple layers of security
- Fail securely
- Principle of least privilege
- Regular security audits

## Authentication & Authorization

### User Authentication
- Secure password hashing (bcrypt, min 10 rounds)
- Multi-factor authentication (MFA) support
- Session management with secure tokens
- Password complexity requirements
- Account lockout after failed attempts

### API Authentication
- API token-based authentication
- Token rotation and expiration
- Secure token storage (encrypted at rest)
- Rate limiting per token
- Token revocation capability

### Authorization
- Role-based access control (RBAC)
- Tenant isolation enforcement
- Resource-level permissions
- Admin vs user role separation

## Data Security

### Encryption
- **At Rest:** Encrypt sensitive data (API tokens, credentials)
- **In Transit:** HTTPS/TLS 1.3 only
- **Database:** Encrypted columns for sensitive fields
- **Backups:** Encrypted backup storage

### Sensitive Data Handling
- **NEVER store:**
  - User website admin credentials
  - User database passwords
  - Credit card information (use payment processor)
- **Always encrypt:**
  - API tokens
  - Integration credentials
  - Personal identifiable information (PII)

### Data Isolation
- Multi-tenant data separation
- Row-level security by tenantId
- No cross-tenant queries
- Separate database schemas (if needed)

## Input Validation & Sanitization

### All Inputs Must Be Validated
- API request bodies
- Query parameters
- URL parameters
- File uploads
- User-generated content

### Validation Rules
- Type checking
- Length limits
- Format validation (email, URL, etc.)
- Whitelist allowed values
- Reject unexpected fields

### Sanitization
- SQL injection prevention (use parameterized queries)
- XSS prevention (escape output)
- Command injection prevention
- Path traversal prevention
- LDAP injection prevention

## API Security

### Rate Limiting
- Per-user limits
- Per-IP limits
- Per-endpoint limits
- Exponential backoff for repeated failures

### CORS Configuration
- Whitelist allowed origins
- Restrict methods
- Limit headers
- No wildcard (*) in production

### Request Security
- Request size limits
- Timeout configurations
- CSRF protection
- Content-Type validation

## External Integration Security

### OpenCart/Laravel Integration
- **NO direct database access**
- **NO admin credential storage**
- API token authentication only
- Validate all responses
- Handle errors gracefully

### Competitor Scraping
- Respect robots.txt
- Rate limiting
- User-agent identification
- Handle CAPTCHAs appropriately
- Proxy rotation for IP protection

## Logging & Monitoring

### Security Logging
- Authentication attempts (success/failure)
- Authorization failures
- API access logs
- Price update actions
- Configuration changes
- Suspicious activity

### Log Security
- No sensitive data in logs
- Secure log storage
- Log retention policies
- Log integrity verification
- Centralized logging

### Monitoring & Alerts
- Failed login attempts
- Unusual API activity
- Rate limit violations
- Error rate spikes
- Security event notifications

## Vulnerability Prevention

### OWASP Top 10 Protection
1. **Injection:** Parameterized queries, input validation
2. **Broken Authentication:** Secure session management
3. **Sensitive Data Exposure:** Encryption, secure storage
4. **XML External Entities:** Disable XML external entities
5. **Broken Access Control:** Enforce authorization checks
6. **Security Misconfiguration:** Secure defaults, hardening
7. **XSS:** Output encoding, CSP headers
8. **Insecure Deserialization:** Validate serialized data
9. **Using Components with Known Vulnerabilities:** Regular updates
10. **Insufficient Logging:** Comprehensive audit trails

### Dependency Security
- Regular dependency updates
- Automated vulnerability scanning
- Use lock files (package-lock.json)
- Review security advisories
- Remove unused dependencies

## Secure Development Practices

### Code Review
- Security-focused code reviews
- Peer review for sensitive changes
- Automated security scanning
- Static analysis tools

### Testing
- Security test cases
- Penetration testing
- Vulnerability assessments
- Regular security audits

### Deployment
- Secure CI/CD pipeline
- Environment variable management
- Secrets management (never commit secrets)
- Secure configuration management

## Incident Response

### Preparation
- Incident response plan
- Security contact information
- Escalation procedures
- Communication templates

### Detection & Response
- Monitor security logs
- Alert on suspicious activity
- Investigate incidents promptly
- Document findings

### Recovery
- Patch vulnerabilities
- Rotate compromised credentials
- Notify affected users
- Post-incident review

## Compliance

### Data Protection
- GDPR compliance (if applicable)
- Data retention policies
- Right to deletion
- Data export capability

### Audit Trail
- Comprehensive logging
- Immutable audit logs
- Regular audit reviews
- Compliance reporting

## Security Checklist

Before deploying any feature:
- [ ] Input validation implemented
- [ ] Authentication/authorization enforced
- [ ] Sensitive data encrypted
- [ ] SQL injection prevented
- [ ] XSS prevention in place
- [ ] CSRF protection enabled
- [ ] Rate limiting configured
- [ ] Error handling secure (no info leakage)
- [ ] Logging implemented
- [ ] Security tests written
- [ ] Code reviewed for security
- [ ] Dependencies up to date
