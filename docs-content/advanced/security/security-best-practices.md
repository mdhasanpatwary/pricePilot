---
title: "Security Best Practices Guide"
description: "Comprehensive security guide covering API token management, data protection, encryption, role-based access control, and common security pitfalls to avoid"
category: "advanced"
subcategory: null
tags: ["security", "authentication", "encryption", "access-control", "best-practices", "api-tokens", "data-protection"]
author: "PricePilot Team"
lastReviewed: "2024-02-05"
relatedDocs: ["api-documentation", "opencart-setup", "laravel-setup", "admin-dashboard-guide"]
---

# Security Best Practices Guide

Comprehensive security guide for protecting your PricePilot integration and data. This guide covers API token management, data protection strategies, encryption best practices, role-based access control, and common security pitfalls to avoid.

## Overview

Security is paramount when integrating PricePilot with your e-commerce platform. This guide provides actionable security best practices to protect your store data, customer information, and pricing strategies from unauthorized access and potential threats.

### Why Security Matters

**Protecting Critical Assets:**
- **Pricing Data**: Your competitive pricing strategy is valuable intellectual property
- **Product Information**: Product catalogs and inventory data must remain confidential
- **API Access**: Unauthorized API access could lead to data breaches or manipulation
- **Customer Trust**: Security breaches damage reputation and customer confidence
- **Compliance**: Meet regulatory requirements (GDPR, PCI-DSS, etc.)

### What You'll Learn

- **API Token Security**: Secure generation, storage, and rotation practices
- **Data Protection**: Encryption strategies for sensitive information
- **Access Control**: Role-based permissions and least privilege principles
- **Integration Security**: Secure OpenCart and Laravel connections
- **Security Checklist**: Comprehensive security audit checklist
- **Common Pitfalls**: Security mistakes to avoid



## API Token Security

### Understanding API Tokens

API tokens are the primary authentication mechanism for PricePilot integrations. They provide secure, programmatic access to your account without exposing passwords.

**Token Types:**

| Token Type | Prefix | Use Case | Permissions |
|-----------|--------|----------|-------------|
| Live Token | `pk_live_` | Production environments | Full access to live data |
| Test Token | `pk_test_` | Development/testing | Access to test data only |
| Read-Only Token | `pk_readonly_` | Monitoring/reporting | Read-only access |
| Limited Token | `pk_limited_` | Specific operations | Restricted permissions |

### Secure Token Generation

**Best Practices for Token Creation:**

1. **Use Strong Tokens**
   - Minimum 32 characters
   - Cryptographically random
   - Include alphanumeric and special characters
   - Never use predictable patterns

2. **Generate Tokens Securely**
   ```typescript
   // Good: Cryptographically secure random generation
   import crypto from 'crypto';
   
   const generateApiToken = () => {
     const prefix = 'pk_live_';
     const randomBytes = crypto.randomBytes(32).toString('hex');
     return `${prefix}${randomBytes}`;
   };
   
   // Bad: Predictable or weak generation
   const weakToken = 'pk_live_' + Date.now(); // ❌ Predictable
   const weakToken2 = 'pk_live_' + Math.random(); // ❌ Not cryptographically secure
   ```

3. **Limit Token Scope**
   - Create tokens with minimum required permissions
   - Use read-only tokens for monitoring
   - Use limited tokens for specific operations
   - Avoid using admin tokens for routine operations



### Secure Token Storage

**Never Store Tokens in Code:**

```typescript
// ❌ BAD: Hardcoded token in source code
const apiToken = 'pk_live_abc123def456';

// ❌ BAD: Token in version control
// config.js
export const PRICEPILOT_TOKEN = 'pk_live_abc123def456';

// ✅ GOOD: Token in environment variables
const apiToken = process.env.PRICEPILOT_API_TOKEN;

// ✅ GOOD: Token from secure configuration
const apiToken = await getSecretFromVault('pricepilot-api-token');
```

**Environment Variable Best Practices:**

1. **Use .env Files (Development Only)**
   ```bash
   # .env (never commit to git!)
   PRICEPILOT_API_TOKEN=pk_live_abc123def456
   PRICEPILOT_BASE_URL=https://api.pricepilot.com
   ```

2. **Add .env to .gitignore**
   ```bash
   # .gitignore
   .env
   .env.local
   .env.*.local
   ```

3. **Use Environment-Specific Variables**
   ```bash
   # .env.development
   PRICEPILOT_API_TOKEN=pk_test_development123
   
   # .env.production (managed by hosting platform)
   PRICEPILOT_API_TOKEN=pk_live_production456
   ```

**Production Token Storage:**

| Platform | Recommended Storage | Documentation |
|----------|-------------------|---------------|
| Vercel | Environment Variables | [Vercel Docs](https://vercel.com/docs/environment-variables) |
| Netlify | Environment Variables | [Netlify Docs](https://docs.netlify.com/environment-variables) |
| AWS | Secrets Manager | [AWS Docs](https://aws.amazon.com/secrets-manager/) |
| Heroku | Config Vars | [Heroku Docs](https://devcenter.heroku.com/articles/config-vars) |
| Docker | Secrets | [Docker Docs](https://docs.docker.com/engine/swarm/secrets/) |



### Token Rotation and Revocation

**Regular Token Rotation:**

Rotate API tokens periodically to minimize risk:

1. **Rotation Schedule**
   - **High-Security Environments**: Every 30 days
   - **Standard Environments**: Every 90 days
   - **Low-Risk Environments**: Every 180 days
   - **After Security Incidents**: Immediately

2. **Rotation Process**
   ```bash
   # Step 1: Generate new token in PricePilot dashboard
   # Navigate to: Settings → API Keys → Generate New Token
   
   # Step 2: Update environment variables
   # In production platform (e.g., Vercel)
   PRICEPILOT_API_TOKEN=pk_live_NEW_TOKEN_HERE
   
   # Step 3: Deploy with new token
   # Verify new token works
   
   # Step 4: Revoke old token
   # Navigate to: Settings → API Keys → Revoke Old Token
   ```

3. **Zero-Downtime Rotation**
   ```typescript
   // Support multiple tokens during rotation
   const primaryToken = process.env.PRICEPILOT_API_TOKEN;
   const fallbackToken = process.env.PRICEPILOT_API_TOKEN_OLD;
   
   async function callApiWithFallback(endpoint: string) {
     try {
       return await callApi(endpoint, primaryToken);
     } catch (error) {
       if (error.status === 401) {
         // Try fallback token
         return await callApi(endpoint, fallbackToken);
       }
       throw error;
     }
   }
   ```

**Immediate Revocation Scenarios:**

Revoke tokens immediately if:
- Token is accidentally committed to version control
- Token is exposed in logs or error messages
- Employee with token access leaves the company
- Suspected unauthorized access
- Security breach or compromise
- Token is shared insecurely (email, chat, etc.)

**Revocation Steps:**

1. Log in to PricePilot dashboard
2. Navigate to **Settings** → **API Keys**
3. Find the compromised token
4. Click **Revoke** button
5. Confirm revocation
6. Generate new token immediately
7. Update all integrations with new token



### Token Usage Best Practices

**1. Use HTTPS Only**

```typescript
// ✅ GOOD: HTTPS endpoint
const apiUrl = 'https://api.pricepilot.com/v1/products';

// ❌ BAD: HTTP endpoint (token exposed in plain text)
const apiUrl = 'http://api.pricepilot.com/v1/products';
```

**2. Secure Token Transmission**

```typescript
// ✅ GOOD: Token in header
const response = await fetch('https://api.pricepilot.com/v1/products', {
  headers: {
    'x-api-key': process.env.PRICEPILOT_API_TOKEN
  }
});

// ❌ BAD: Token in URL (logged in server logs)
const response = await fetch(
  `https://api.pricepilot.com/v1/products?token=${token}`
);

// ❌ BAD: Token in query string (visible in browser history)
window.location.href = `/api/sync?token=${token}`;
```

**3. Validate Token Format**

```typescript
// Validate token before use
function isValidApiToken(token: string): boolean {
  // Check format: pk_[type]_[64 hex characters]
  const tokenRegex = /^pk_(live|test|readonly|limited)_[a-f0-9]{64}$/;
  return tokenRegex.test(token);
}

// Use validation
const token = process.env.PRICEPILOT_API_TOKEN;
if (!isValidApiToken(token)) {
  throw new Error('Invalid API token format');
}
```

**4. Implement Rate Limiting**

```typescript
// Prevent token abuse with rate limiting
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each token to 100 requests per window
  keyGenerator: (req) => {
    // Rate limit by API token
    return req.headers['x-api-key'] as string;
  },
  message: 'Too many requests from this API token'
});

app.use('/api/', apiLimiter);
```

**5. Monitor Token Usage**

```typescript
// Log API token usage for security monitoring
async function callPricePilotApi(endpoint: string) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(endpoint, {
      headers: {
        'x-api-key': process.env.PRICEPILOT_API_TOKEN
      }
    });
    
    // Log successful request
    logger.info('API request successful', {
      endpoint,
      duration: Date.now() - startTime,
      status: response.status,
      tokenPrefix: process.env.PRICEPILOT_API_TOKEN?.substring(0, 15)
    });
    
    return response;
  } catch (error) {
    // Log failed request
    logger.error('API request failed', {
      endpoint,
      duration: Date.now() - startTime,
      error: error.message,
      tokenPrefix: process.env.PRICEPILOT_API_TOKEN?.substring(0, 15)
    });
    
    throw error;
  }
}
```



## Data Protection and Encryption

### Encryption at Rest

**Sensitive Data Requiring Encryption:**

| Data Type | Encryption Method | Storage Location |
|-----------|------------------|------------------|
| API Tokens | AES-256-GCM | Database (encrypted column) |
| Integration Credentials | AES-256-GCM | Secure vault |
| Customer PII | AES-256-GCM | Database (encrypted column) |
| Price History | Standard storage | Database (tenant-isolated) |
| Product Data | Standard storage | Database (tenant-isolated) |

**Implementing Encryption:**

```typescript
import crypto from 'crypto';

// Encryption configuration
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32-byte key
const ALGORITHM = 'aes-256-gcm';

// Encrypt sensitive data
function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

// Decrypt sensitive data
function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(ivHex, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Usage example
const apiToken = 'pk_live_abc123def456';
const encryptedToken = encrypt(apiToken);
// Store encryptedToken in database

// Later, retrieve and decrypt
const decryptedToken = decrypt(encryptedToken);
// Use decryptedToken for API calls
```

**Database-Level Encryption:**

```sql
-- PostgreSQL: Encrypt sensitive columns
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Store encrypted API token
INSERT INTO integrations (tenant_id, platform, api_token_encrypted)
VALUES (
  'tenant-123',
  'opencart',
  pgp_sym_encrypt('pk_live_abc123', 'encryption-key')
);

-- Retrieve and decrypt
SELECT 
  id,
  platform,
  pgp_sym_decrypt(api_token_encrypted::bytea, 'encryption-key') as api_token
FROM integrations
WHERE tenant_id = 'tenant-123';
```



### Encryption in Transit

**TLS/SSL Configuration:**

1. **Enforce HTTPS**
   ```typescript
   // Next.js middleware to enforce HTTPS
   import { NextResponse } from 'next/server';
   import type { NextRequest } from 'next/server';
   
   export function middleware(request: NextRequest) {
     // Redirect HTTP to HTTPS
     if (
       process.env.NODE_ENV === 'production' &&
       request.headers.get('x-forwarded-proto') !== 'https'
     ) {
       return NextResponse.redirect(
         `https://${request.headers.get('host')}${request.nextUrl.pathname}`,
         301
       );
     }
     
     return NextResponse.next();
   }
   ```

2. **Configure Security Headers**
   ```typescript
   // next.config.js
   module.exports = {
     async headers() {
       return [
         {
           source: '/:path*',
           headers: [
             {
               key: 'Strict-Transport-Security',
               value: 'max-age=31536000; includeSubDomains; preload'
             },
             {
               key: 'X-Content-Type-Options',
               value: 'nosniff'
             },
             {
               key: 'X-Frame-Options',
               value: 'DENY'
             },
             {
               key: 'X-XSS-Protection',
               value: '1; mode=block'
             },
             {
               key: 'Referrer-Policy',
               value: 'strict-origin-when-cross-origin'
             }
           ]
         }
       ];
     }
   };
   ```

3. **Verify SSL Certificates**
   ```typescript
   // Always verify SSL certificates in production
   import https from 'https';
   
   const agent = new https.Agent({
     rejectUnauthorized: true, // ✅ Verify certificates
     minVersion: 'TLSv1.2' // ✅ Require TLS 1.2+
   });
   
   // Use agent for API calls
   const response = await fetch('https://api.pricepilot.com/v1/products', {
     agent,
     headers: {
       'x-api-key': process.env.PRICEPILOT_API_TOKEN
     }
   });
   ```

### Data Sanitization

**Input Sanitization:**

```typescript
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

// Sanitize user input
function sanitizeInput(input: string, type: 'text' | 'html' | 'url' | 'email'): string {
  switch (type) {
    case 'text':
      // Remove HTML tags and special characters
      return validator.escape(input.trim());
    
    case 'html':
      // Allow safe HTML only
      return DOMPurify.sanitize(input, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
        ALLOWED_ATTR: ['href']
      });
    
    case 'url':
      // Validate and normalize URL
      if (!validator.isURL(input)) {
        throw new Error('Invalid URL');
      }
      return validator.normalizeEmail(input);
    
    case 'email':
      // Validate and normalize email
      if (!validator.isEmail(input)) {
        throw new Error('Invalid email');
      }
      return validator.normalizeEmail(input);
    
    default:
      return validator.escape(input.trim());
  }
}

// Usage
const userInput = req.body.productName;
const sanitized = sanitizeInput(userInput, 'text');
```

**SQL Injection Prevention:**

```typescript
// ✅ GOOD: Parameterized queries (Prisma)
const products = await prisma.userProduct.findMany({
  where: {
    tenantId: tenantId, // Safely parameterized
    name: {
      contains: searchTerm // Safely parameterized
    }
  }
});

// ✅ GOOD: Parameterized raw query
const products = await prisma.$queryRaw`
  SELECT * FROM user_products
  WHERE tenant_id = ${tenantId}
    AND name ILIKE ${`%${searchTerm}%`}
`;

// ❌ BAD: String concatenation (SQL injection risk)
const query = `
  SELECT * FROM user_products
  WHERE tenant_id = '${tenantId}'
    AND name ILIKE '%${searchTerm}%'
`;
```



### Secure Data Deletion

**Soft Delete vs Hard Delete:**

```typescript
// Soft delete: Mark as deleted, retain data
async function softDeleteProduct(productId: string) {
  return await prisma.userProduct.update({
    where: { id: productId },
    data: {
      status: 'deleted',
      deletedAt: new Date()
    }
  });
}

// Hard delete: Permanently remove data
async function hardDeleteProduct(productId: string) {
  // Delete related data first
  await prisma.productMatch.deleteMany({
    where: { userProductId: productId }
  });
  
  await prisma.priceHistory.deleteMany({
    where: { productId: productId }
  });
  
  // Delete product
  return await prisma.userProduct.delete({
    where: { id: productId }
  });
}

// Secure deletion with audit trail
async function secureDeleteProduct(productId: string, userId: string) {
  // Log deletion
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'DELETE_PRODUCT',
      entityType: 'product',
      entityId: productId,
      timestamp: new Date()
    }
  });
  
  // Soft delete
  return await softDeleteProduct(productId);
}
```

**Data Retention Policies:**

```typescript
// Automated data cleanup based on retention policies
async function cleanupOldData() {
  const retentionPeriods = {
    auditLogs: 365, // days
    priceHistory: 730, // days
    deletedProducts: 90, // days
    scrapingLogs: 30 // days
  };
  
  // Delete old audit logs
  await prisma.auditLog.deleteMany({
    where: {
      createdAt: {
        lt: new Date(Date.now() - retentionPeriods.auditLogs * 24 * 60 * 60 * 1000)
      }
    }
  });
  
  // Delete old price history
  await prisma.priceHistory.deleteMany({
    where: {
      recordedAt: {
        lt: new Date(Date.now() - retentionPeriods.priceHistory * 24 * 60 * 60 * 1000)
      }
    }
  });
  
  // Permanently delete soft-deleted products after retention period
  await prisma.userProduct.deleteMany({
    where: {
      status: 'deleted',
      deletedAt: {
        lt: new Date(Date.now() - retentionPeriods.deletedProducts * 24 * 60 * 60 * 1000)
      }
    }
  });
}

// Schedule cleanup job
import cron from 'node-cron';

// Run daily at 2 AM
cron.schedule('0 2 * * *', cleanupOldData);
```



## Role-Based Access Control (RBAC)

### Understanding User Roles

**PricePilot Role Hierarchy:**

| Role | Permissions | Use Case |
|------|------------|----------|
| **Owner** | Full access, billing, user management | Account owner |
| **Admin** | All features except billing | Store managers |
| **Manager** | Product management, price updates | Operations team |
| **Viewer** | Read-only access | Analysts, stakeholders |
| **API User** | Programmatic access only | Integrations, automation |

### Implementing RBAC

**1. Define Permission Structure:**

```typescript
// Define permissions
enum Permission {
  // Product permissions
  VIEW_PRODUCTS = 'products:view',
  CREATE_PRODUCTS = 'products:create',
  UPDATE_PRODUCTS = 'products:update',
  DELETE_PRODUCTS = 'products:delete',
  
  // Price permissions
  VIEW_PRICES = 'prices:view',
  APPROVE_PRICES = 'prices:approve',
  UPDATE_PRICES = 'prices:update',
  
  // Competitor permissions
  VIEW_COMPETITORS = 'competitors:view',
  MANAGE_COMPETITORS = 'competitors:manage',
  
  // Settings permissions
  VIEW_SETTINGS = 'settings:view',
  UPDATE_SETTINGS = 'settings:update',
  MANAGE_USERS = 'users:manage',
  MANAGE_BILLING = 'billing:manage'
}

// Map roles to permissions
const rolePermissions: Record<string, Permission[]> = {
  owner: Object.values(Permission), // All permissions
  
  admin: [
    Permission.VIEW_PRODUCTS,
    Permission.CREATE_PRODUCTS,
    Permission.UPDATE_PRODUCTS,
    Permission.DELETE_PRODUCTS,
    Permission.VIEW_PRICES,
    Permission.APPROVE_PRICES,
    Permission.UPDATE_PRICES,
    Permission.VIEW_COMPETITORS,
    Permission.MANAGE_COMPETITORS,
    Permission.VIEW_SETTINGS,
    Permission.UPDATE_SETTINGS,
    Permission.MANAGE_USERS
    // No billing access
  ],
  
  manager: [
    Permission.VIEW_PRODUCTS,
    Permission.UPDATE_PRODUCTS,
    Permission.VIEW_PRICES,
    Permission.APPROVE_PRICES,
    Permission.UPDATE_PRICES,
    Permission.VIEW_COMPETITORS,
    Permission.VIEW_SETTINGS
  ],
  
  viewer: [
    Permission.VIEW_PRODUCTS,
    Permission.VIEW_PRICES,
    Permission.VIEW_COMPETITORS,
    Permission.VIEW_SETTINGS
  ],
  
  api_user: [
    Permission.VIEW_PRODUCTS,
    Permission.UPDATE_PRODUCTS,
    Permission.VIEW_PRICES,
    Permission.UPDATE_PRICES
  ]
};
```

**2. Check Permissions:**

```typescript
// Permission checking middleware
function requirePermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user; // From authentication middleware
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const userPermissions = rolePermissions[user.role] || [];
    
    if (!userPermissions.includes(permission)) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: `Missing required permission: ${permission}`
      });
    }
    
    next();
  };
}

// Usage in routes
app.post('/api/products', 
  authenticate,
  requirePermission(Permission.CREATE_PRODUCTS),
  createProduct
);

app.post('/api/prices/approve',
  authenticate,
  requirePermission(Permission.APPROVE_PRICES),
  approvePrices
);

app.delete('/api/users/:id',
  authenticate,
  requirePermission(Permission.MANAGE_USERS),
  deleteUser
);
```



**3. Tenant Isolation:**

```typescript
// Ensure users can only access their tenant's data
async function getTenantProducts(userId: string) {
  // Get user's tenant
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tenantId: true }
  });
  
  if (!user) {
    throw new Error('User not found');
  }
  
  // Only return products from user's tenant
  return await prisma.userProduct.findMany({
    where: {
      tenantId: user.tenantId // ✅ Tenant isolation enforced
    }
  });
}

// Middleware to enforce tenant isolation
async function enforceTenantIsolation(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = req.user;
  const requestedTenantId = req.params.tenantId || req.body.tenantId;
  
  // Verify user belongs to requested tenant
  if (requestedTenantId && user.tenantId !== requestedTenantId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied to this tenant'
    });
  }
  
  // Add tenant filter to request
  req.tenantId = user.tenantId;
  next();
}

// Usage
app.get('/api/products',
  authenticate,
  enforceTenantIsolation,
  getProducts
);
```

**4. Audit Logging:**

```typescript
// Log all permission-sensitive actions
async function auditLog(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: any
) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      details: JSON.stringify(details),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date()
    }
  });
}

// Usage in sensitive operations
async function approvePriceUpdate(updateId: string, userId: string) {
  // Perform action
  const update = await prisma.priceUpdate.update({
    where: { id: updateId },
    data: { status: 'approved', approvedBy: userId }
  });
  
  // Log action
  await auditLog(
    userId,
    'APPROVE_PRICE_UPDATE',
    'price_update',
    updateId,
    { oldPrice: update.oldPrice, newPrice: update.newPrice }
  );
  
  return update;
}
```

### Principle of Least Privilege

**Best Practices:**

1. **Grant Minimum Required Permissions**
   - Start with viewer role
   - Add permissions as needed
   - Regularly review and remove unused permissions

2. **Use Time-Limited Access**
   ```typescript
   // Grant temporary elevated access
   async function grantTemporaryAccess(
     userId: string,
     permission: Permission,
     durationMinutes: number
   ) {
     const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
     
     await prisma.temporaryPermission.create({
       data: {
         userId,
         permission,
         expiresAt
       }
     });
   }
   
   // Check temporary permissions
   async function hasPermission(userId: string, permission: Permission): Promise<boolean> {
     // Check role-based permissions
     const user = await prisma.user.findUnique({ where: { id: userId } });
     const rolePerms = rolePermissions[user.role] || [];
     
     if (rolePerms.includes(permission)) {
       return true;
     }
     
     // Check temporary permissions
     const tempPerm = await prisma.temporaryPermission.findFirst({
       where: {
         userId,
         permission,
         expiresAt: { gt: new Date() }
       }
     });
     
     return !!tempPerm;
   }
   ```

3. **Separate Production and Development Access**
   - Use different accounts for production and development
   - Limit production access to essential personnel
   - Use test tokens for development

4. **Regular Access Reviews**
   ```typescript
   // Generate access review report
   async function generateAccessReview(tenantId: string) {
     const users = await prisma.user.findMany({
       where: { tenantId },
       include: {
         auditLogs: {
           where: {
             createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
           },
           orderBy: { createdAt: 'desc' },
           take: 1
         }
       }
     });
     
     return users.map(user => ({
       email: user.email,
       role: user.role,
       lastActive: user.auditLogs[0]?.createdAt || null,
       permissions: rolePermissions[user.role]
     }));
   }
   ```



## Security Checklist

### Pre-Deployment Security Checklist

Use this checklist before deploying PricePilot to production:

#### Authentication & Authorization

- [ ] API tokens are stored in environment variables, not code
- [ ] `.env` files are added to `.gitignore`
- [ ] Production uses different tokens than development
- [ ] Token rotation schedule is established
- [ ] Role-based access control is implemented
- [ ] Tenant isolation is enforced in all queries
- [ ] Session management is secure (httpOnly, secure, sameSite cookies)
- [ ] Password policies are enforced (if applicable)

#### Data Protection

- [ ] Sensitive data is encrypted at rest (API tokens, credentials)
- [ ] All connections use HTTPS/TLS
- [ ] SSL certificate verification is enabled
- [ ] Security headers are configured (HSTS, CSP, X-Frame-Options)
- [ ] Input validation is implemented on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (output encoding, CSP)
- [ ] CSRF protection is enabled

#### API Security

- [ ] Rate limiting is configured
- [ ] API authentication is required on all endpoints
- [ ] API tokens are validated on every request
- [ ] Error messages don't leak sensitive information
- [ ] CORS is properly configured (no wildcard in production)
- [ ] Request size limits are enforced
- [ ] Timeout configurations are set

#### Integration Security

- [ ] OpenCart/Laravel integration uses API tokens only
- [ ] No database credentials are stored
- [ ] Integration endpoints are authenticated
- [ ] Webhook signatures are verified (if applicable)
- [ ] Integration logs don't contain sensitive data

#### Monitoring & Logging

- [ ] Security events are logged (failed logins, permission denials)
- [ ] Logs don't contain sensitive data (passwords, tokens)
- [ ] Log retention policies are configured
- [ ] Alerting is set up for security events
- [ ] Audit trail is maintained for sensitive operations

#### Infrastructure

- [ ] Database backups are encrypted
- [ ] Backup retention policy is defined
- [ ] Disaster recovery plan is documented
- [ ] Dependencies are up to date
- [ ] Security patches are applied
- [ ] Firewall rules are configured
- [ ] Unnecessary services are disabled



### Ongoing Security Checklist

Perform these security checks regularly:

#### Daily

- [ ] Review security alerts and notifications
- [ ] Monitor failed authentication attempts
- [ ] Check for unusual API activity
- [ ] Review error logs for security issues

#### Weekly

- [ ] Review audit logs for suspicious activity
- [ ] Check API token usage patterns
- [ ] Monitor rate limit violations
- [ ] Review user access and permissions

#### Monthly

- [ ] Update dependencies and security patches
- [ ] Review and rotate API tokens (if scheduled)
- [ ] Audit user accounts and remove inactive users
- [ ] Review and update firewall rules
- [ ] Check SSL certificate expiration
- [ ] Review data retention and cleanup

#### Quarterly

- [ ] Conduct security audit
- [ ] Review and update security policies
- [ ] Test disaster recovery procedures
- [ ] Review third-party integrations
- [ ] Conduct penetration testing (if applicable)
- [ ] Update security documentation

#### Annually

- [ ] Comprehensive security assessment
- [ ] Review and update incident response plan
- [ ] Security training for team members
- [ ] Compliance audit (GDPR, PCI-DSS, etc.)
- [ ] Review and update encryption keys



## Common Security Pitfalls

### Pitfall 1: Hardcoded Credentials

**The Problem:**

```typescript
// ❌ CRITICAL SECURITY ISSUE
const config = {
  apiToken: 'pk_live_abc123def456',
  databaseUrl: 'postgresql://user:password@localhost:5432/db',
  encryptionKey: 'my-secret-key-123'
};
```

**Why It's Dangerous:**
- Credentials exposed in version control
- Visible to anyone with code access
- Difficult to rotate without code changes
- Can't use different credentials per environment

**The Solution:**

```typescript
// ✅ SECURE: Use environment variables
const config = {
  apiToken: process.env.PRICEPILOT_API_TOKEN,
  databaseUrl: process.env.DATABASE_URL,
  encryptionKey: process.env.ENCRYPTION_KEY
};

// Validate required environment variables
const requiredEnvVars = [
  'PRICEPILOT_API_TOKEN',
  'DATABASE_URL',
  'ENCRYPTION_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
```

### Pitfall 2: Insufficient Input Validation

**The Problem:**

```typescript
// ❌ NO INPUT VALIDATION
app.post('/api/products', async (req, res) => {
  const { name, price, sku } = req.body;
  
  // Directly use user input
  const product = await prisma.userProduct.create({
    data: { name, price, sku }
  });
  
  res.json(product);
});
```

**Why It's Dangerous:**
- SQL injection risk
- XSS vulnerabilities
- Data corruption
- Application crashes

**The Solution:**

```typescript
// ✅ SECURE: Validate and sanitize input
import { z } from 'zod';

const productSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  price: z.number().positive().finite(),
  sku: z.string().regex(/^[A-Z0-9-]+$/).max(50)
});

app.post('/api/products', async (req, res) => {
  try {
    // Validate input
    const validated = productSchema.parse(req.body);
    
    // Use validated data
    const product = await prisma.userProduct.create({
      data: validated
    });
    
    res.json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    throw error;
  }
});
```

### Pitfall 3: Exposing Sensitive Data in Logs

**The Problem:**

```typescript
// ❌ LOGGING SENSITIVE DATA
logger.info('API request', {
  endpoint: '/api/products',
  apiToken: req.headers['x-api-key'], // ❌ Token in logs
  body: req.body, // ❌ May contain sensitive data
  user: req.user // ❌ May contain email, password hash
});

console.log('Database query:', {
  query: 'SELECT * FROM users',
  params: { email: 'user@example.com', password: 'secret123' } // ❌ Password in logs
});
```

**Why It's Dangerous:**
- Credentials exposed in log files
- Logs may be stored insecurely
- Logs may be accessible to unauthorized users
- Compliance violations (GDPR, PCI-DSS)

**The Solution:**

```typescript
// ✅ SECURE: Redact sensitive data
function sanitizeForLogging(data: any): any {
  const sensitiveKeys = [
    'password',
    'apiToken',
    'api_token',
    'x-api-key',
    'authorization',
    'secret',
    'encryptionKey'
  ];
  
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sanitized = { ...data };
  
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeForLogging(sanitized[key]);
    }
  }
  
  return sanitized;
}

// Usage
logger.info('API request', sanitizeForLogging({
  endpoint: '/api/products',
  apiToken: req.headers['x-api-key'], // Will be redacted
  body: req.body,
  user: { id: req.user.id, email: req.user.email } // Only log non-sensitive fields
}));
```



### Pitfall 4: Missing Rate Limiting

**The Problem:**

```typescript
// ❌ NO RATE LIMITING
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  // Vulnerable to brute force attacks
  const user = await authenticateUser(email, password);
  
  if (user) {
    res.json({ token: generateToken(user) });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});
```

**Why It's Dangerous:**
- Brute force attacks
- Denial of service (DoS)
- Resource exhaustion
- API abuse

**The Solution:**

```typescript
// ✅ SECURE: Implement rate limiting
import rateLimit from 'express-rate-limit';

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Strict rate limiter for authentication
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per window
  skipSuccessfulRequests: true, // Don't count successful logins
  message: 'Too many login attempts, please try again later'
});

// Apply rate limiters
app.use('/api/', apiLimiter);
app.post('/api/login', authLimiter, async (req, res) => {
  // Login logic
});
```

### Pitfall 5: Weak CORS Configuration

**The Problem:**

```typescript
// ❌ INSECURE CORS CONFIGURATION
app.use(cors({
  origin: '*', // ❌ Allows any origin
  credentials: true // ❌ Dangerous with wildcard origin
}));
```

**Why It's Dangerous:**
- Cross-site request forgery (CSRF)
- Data theft from authenticated users
- Unauthorized API access
- Session hijacking

**The Solution:**

```typescript
// ✅ SECURE: Restrictive CORS configuration
const allowedOrigins = [
  'https://yourdomain.com',
  'https://www.yourdomain.com',
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  maxAge: 86400 // 24 hours
}));
```

### Pitfall 6: Insufficient Error Handling

**The Problem:**

```typescript
// ❌ EXPOSING INTERNAL ERRORS
app.post('/api/products', async (req, res) => {
  try {
    const product = await createProduct(req.body);
    res.json(product);
  } catch (error) {
    // ❌ Exposes internal error details
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      query: error.query // ❌ May expose database structure
    });
  }
});
```

**Why It's Dangerous:**
- Exposes internal system details
- Reveals database structure
- Helps attackers understand vulnerabilities
- Information disclosure

**The Solution:**

```typescript
// ✅ SECURE: Generic error messages
app.post('/api/products', async (req, res) => {
  try {
    const product = await createProduct(req.body);
    res.json(product);
  } catch (error) {
    // Log detailed error internally
    logger.error('Product creation failed', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    // Return generic error to client
    res.status(500).json({
      error: 'An error occurred while creating the product',
      requestId: req.id // For support reference
    });
  }
});

// Centralized error handler
app.use((error, req, res, next) => {
  // Log error with context
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });
  
  // Determine error type and response
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details
    });
  }
  
  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }
  
  // Generic error for everything else
  res.status(500).json({
    error: 'An unexpected error occurred',
    requestId: req.id
  });
});
```



### Pitfall 7: Insecure Session Management

**The Problem:**

```typescript
// ❌ INSECURE SESSION CONFIGURATION
app.use(session({
  secret: 'keyboard cat', // ❌ Weak secret
  resave: true,
  saveUninitialized: true,
  cookie: {
    secure: false, // ❌ Not HTTPS-only
    httpOnly: false, // ❌ Accessible via JavaScript
    sameSite: 'none' // ❌ Vulnerable to CSRF
  }
}));
```

**Why It's Dangerous:**
- Session hijacking
- Cross-site scripting (XSS) attacks
- Cross-site request forgery (CSRF)
- Man-in-the-middle attacks

**The Solution:**

```typescript
// ✅ SECURE: Proper session configuration
app.use(session({
  secret: process.env.SESSION_SECRET, // Strong, random secret
  resave: false,
  saveUninitialized: false,
  name: 'sessionId', // Don't use default name
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Not accessible via JavaScript
    sameSite: 'strict', // CSRF protection
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    domain: process.env.COOKIE_DOMAIN
  },
  store: new RedisStore({
    client: redisClient,
    prefix: 'sess:'
  })
}));

// Session validation middleware
function validateSession(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  
  // Check session age
  const sessionAge = Date.now() - req.session.createdAt;
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  if (sessionAge > maxAge) {
    req.session.destroy();
    return res.status(401).json({ error: 'Session expired' });
  }
  
  next();
}
```

### Pitfall 8: Not Validating Redirects

**The Problem:**

```typescript
// ❌ OPEN REDIRECT VULNERABILITY
app.get('/redirect', (req, res) => {
  const redirectUrl = req.query.url;
  
  // ❌ Redirects to any URL
  res.redirect(redirectUrl);
});

// Attacker can use: /redirect?url=https://malicious-site.com
```

**Why It's Dangerous:**
- Phishing attacks
- Malware distribution
- Credential theft
- Reputation damage

**The Solution:**

```typescript
// ✅ SECURE: Validate redirect URLs
const allowedRedirectDomains = [
  'yourdomain.com',
  'www.yourdomain.com',
  'app.yourdomain.com'
];

function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTPS
    if (parsed.protocol !== 'https:') {
      return false;
    }
    
    // Check if domain is allowed
    return allowedRedirectDomains.some(domain => 
      parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

app.get('/redirect', (req, res) => {
  const redirectUrl = req.query.url as string;
  
  if (!redirectUrl || !isValidRedirectUrl(redirectUrl)) {
    return res.status(400).json({
      error: 'Invalid redirect URL'
    });
  }
  
  res.redirect(redirectUrl);
});
```



## Security Incident Response

### Incident Response Plan

**1. Detection and Identification**

When a security incident is detected:

```typescript
// Automated security event detection
async function detectSecurityIncident(event: SecurityEvent) {
  const incidents = [
    {
      type: 'MULTIPLE_FAILED_LOGINS',
      threshold: 10,
      window: 5 * 60 * 1000 // 5 minutes
    },
    {
      type: 'UNUSUAL_API_ACTIVITY',
      threshold: 1000,
      window: 60 * 60 * 1000 // 1 hour
    },
    {
      type: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      threshold: 1,
      window: 0 // Immediate
    }
  ];
  
  for (const incident of incidents) {
    const count = await countRecentEvents(event.type, incident.window);
    
    if (count >= incident.threshold) {
      await triggerIncidentResponse(incident.type, event);
    }
  }
}

// Trigger incident response
async function triggerIncidentResponse(type: string, event: SecurityEvent) {
  // 1. Log incident
  await logger.critical('Security incident detected', {
    type,
    event,
    timestamp: new Date()
  });
  
  // 2. Alert security team
  await sendSecurityAlert({
    type,
    severity: 'CRITICAL',
    details: event
  });
  
  // 3. Take immediate action
  switch (type) {
    case 'MULTIPLE_FAILED_LOGINS':
      await lockAccount(event.userId);
      break;
    case 'UNAUTHORIZED_ACCESS_ATTEMPT':
      await blockIpAddress(event.ipAddress);
      break;
    case 'UNUSUAL_API_ACTIVITY':
      await revokeApiToken(event.apiToken);
      break;
  }
}
```

**2. Containment**

Immediate actions to contain the incident:

- **Lock affected accounts**
- **Revoke compromised API tokens**
- **Block malicious IP addresses**
- **Disable affected integrations**
- **Enable additional logging**
- **Preserve evidence**

**3. Investigation**

Investigate the incident:

```typescript
// Generate incident report
async function generateIncidentReport(incidentId: string) {
  const incident = await prisma.securityIncident.findUnique({
    where: { id: incidentId },
    include: {
      events: true,
      affectedUsers: true,
      affectedResources: true
    }
  });
  
  return {
    incidentId: incident.id,
    type: incident.type,
    detectedAt: incident.detectedAt,
    severity: incident.severity,
    affectedUsers: incident.affectedUsers.length,
    affectedResources: incident.affectedResources.length,
    timeline: incident.events.map(e => ({
      timestamp: e.timestamp,
      action: e.action,
      details: e.details
    })),
    rootCause: incident.rootCause,
    recommendations: incident.recommendations
  };
}
```

**4. Recovery**

Steps to recover from the incident:

- **Reset compromised credentials**
- **Restore from clean backups if needed**
- **Apply security patches**
- **Update security configurations**
- **Re-enable services gradually**
- **Monitor for recurring issues**

**5. Post-Incident Review**

After resolving the incident:

- **Document lessons learned**
- **Update security policies**
- **Improve detection mechanisms**
- **Conduct security training**
- **Implement preventive measures**



## Compliance and Regulations

### GDPR Compliance

**Data Protection Requirements:**

1. **Right to Access**
   ```typescript
   // Export user data
   async function exportUserData(userId: string) {
     const user = await prisma.user.findUnique({
       where: { id: userId },
       include: {
         products: true,
         priceUpdates: true,
         auditLogs: true
       }
     });
     
     return {
       personalData: {
         email: user.email,
         name: user.name,
         createdAt: user.createdAt
       },
       products: user.products,
       priceUpdates: user.priceUpdates,
       auditLogs: user.auditLogs
     };
   }
   ```

2. **Right to Deletion**
   ```typescript
   // Delete user data (GDPR right to be forgotten)
   async function deleteUserData(userId: string) {
     // Anonymize audit logs (retain for compliance)
     await prisma.auditLog.updateMany({
       where: { userId },
       data: {
         userId: 'DELETED_USER',
         details: 'User data deleted per GDPR request'
       }
     });
     
     // Delete user products
     await prisma.userProduct.deleteMany({
       where: { userId }
     });
     
     // Delete user account
     await prisma.user.delete({
       where: { id: userId }
     });
   }
   ```

3. **Data Minimization**
   - Only collect necessary data
   - Don't store sensitive data unnecessarily
   - Implement data retention policies
   - Regularly purge old data

4. **Consent Management**
   ```typescript
   // Track user consent
   interface UserConsent {
     userId: string;
     dataProcessing: boolean;
     marketing: boolean;
     analytics: boolean;
     consentedAt: Date;
   }
   
   async function updateConsent(userId: string, consent: Partial<UserConsent>) {
     await prisma.userConsent.upsert({
       where: { userId },
       update: {
         ...consent,
         updatedAt: new Date()
       },
       create: {
         userId,
         ...consent,
         consentedAt: new Date()
       }
     });
   }
   ```

### PCI-DSS Compliance

**If handling payment data:**

1. **Never Store Sensitive Card Data**
   - Don't store CVV/CVC
   - Don't store full PAN (Primary Account Number)
   - Use payment processor tokens instead

2. **Use PCI-Compliant Payment Processors**
   - Stripe
   - PayPal
   - Square
   - Braintree

3. **Secure Payment Forms**
   ```typescript
   // Use payment processor's hosted forms
   // Never handle card data directly
   
   // ✅ GOOD: Stripe Elements
   <StripeElements>
     <CardElement />
   </StripeElements>
   
   // ❌ BAD: Custom card input
   <input type="text" name="cardNumber" />
   ```

### SOC 2 Compliance

**Security Controls:**

1. **Access Controls**
   - Multi-factor authentication
   - Role-based access control
   - Regular access reviews
   - Least privilege principle

2. **Monitoring and Logging**
   - Comprehensive audit trails
   - Security event monitoring
   - Log retention policies
   - Incident response procedures

3. **Data Protection**
   - Encryption at rest and in transit
   - Secure key management
   - Data backup and recovery
   - Secure data disposal

4. **Vendor Management**
   - Third-party security assessments
   - Vendor access controls
   - Regular vendor reviews
   - Contractual security requirements



## Additional Resources

### Security Tools and Libraries

**Authentication & Authorization:**
- [NextAuth.js](https://next-auth.js.org/) - Authentication for Next.js
- [Passport.js](http://www.passportjs.org/) - Authentication middleware
- [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) - JWT implementation
- [bcrypt](https://github.com/kelektiv/node.bcrypt.js) - Password hashing

**Input Validation:**
- [Zod](https://zod.dev/) - TypeScript-first schema validation
- [Joi](https://joi.dev/) - Object schema validation
- [validator.js](https://github.com/validatorjs/validator.js) - String validators
- [DOMPurify](https://github.com/cure53/DOMPurify) - XSS sanitizer

**Security Headers:**
- [Helmet](https://helmetjs.github.io/) - Security headers middleware
- [csurf](https://github.com/expressjs/csurf) - CSRF protection
- [cors](https://github.com/expressjs/cors) - CORS middleware

**Rate Limiting:**
- [express-rate-limit](https://github.com/nfriedly/express-rate-limit) - Rate limiting middleware
- [rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible) - Advanced rate limiting

**Encryption:**
- [crypto](https://nodejs.org/api/crypto.html) - Node.js crypto module
- [bcrypt](https://github.com/kelektiv/node.bcrypt.js) - Password hashing
- [argon2](https://github.com/ranisalt/node-argon2) - Modern password hashing

**Security Scanning:**
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit) - Vulnerability scanning
- [Snyk](https://snyk.io/) - Dependency vulnerability scanning
- [OWASP ZAP](https://www.zaproxy.org/) - Web application security scanner
- [SonarQube](https://www.sonarqube.org/) - Code quality and security

### Security Best Practices Resources

**OWASP (Open Web Application Security Project):**
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)

**Security Guidelines:**
- [CWE Top 25](https://cwe.mitre.org/top25/) - Most dangerous software weaknesses
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [SANS Security Resources](https://www.sans.org/security-resources/)

**Compliance Resources:**
- [GDPR Official Text](https://gdpr-info.eu/)
- [PCI Security Standards](https://www.pcisecuritystandards.org/)
- [SOC 2 Compliance Guide](https://www.aicpa.org/interestareas/frc/assuranceadvisoryservices/aicpasoc2report)

### Getting Help

**Security Issues:**

If you discover a security vulnerability in PricePilot:

1. **Do NOT** create a public GitHub issue
2. **Do NOT** disclose the vulnerability publicly
3. **Email** security@pricepilot.com with details
4. **Include** steps to reproduce the vulnerability
5. **Wait** for acknowledgment before public disclosure

**Security Questions:**

For security-related questions:
- Email: security@pricepilot.com
- Documentation: https://docs.pricepilot.com/security
- Support: https://support.pricepilot.com

### Next Steps

After implementing these security best practices:

1. **Review** the [Security Checklist](#security-checklist) regularly
2. **Monitor** security alerts and audit logs
3. **Update** dependencies and apply security patches
4. **Train** team members on security best practices
5. **Test** security controls periodically
6. **Document** security procedures and policies

**Related Documentation:**
- [API Documentation](../api-documentation) - Secure API integration
- [OpenCart Setup](../opencart-setup) - Secure OpenCart integration
- [Laravel Setup](../laravel-setup) - Secure Laravel integration
- [Admin Dashboard Guide](../admin-dashboard-guide) - Admin security features
- [Advanced Troubleshooting](../advanced-troubleshooting-guide) - Security issue troubleshooting

---

**Last Updated:** February 5, 2024

**Security is an ongoing process, not a one-time task. Stay vigilant, keep learning, and prioritize security in every decision.**
