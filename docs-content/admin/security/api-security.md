---
title: "API Security"
description: "Security best practices for PricePilot API endpoints"
category: "security"
subcategory: null
tags: ["security", "api", "authentication", "authorization"]
author: "PricePilot Team"
lastReviewed: "2024-01-15"
relatedDocs: ["authentication-config", "tenant-operations"]
---

# API Security

Comprehensive guide to securing PricePilot API endpoints and preventing common vulnerabilities.

## Authentication

### API Token Authentication

All API requests require Bearer token authentication:

```typescript
// Middleware for token validation
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token required'
      }
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      }
    });
  }
}
```

### Token Generation

```typescript
import jwt from 'jsonwebtoken';

export function generateToken(user: User): string {
  return jwt.sign(
    {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role
    },
    process.env.JWT_SECRET!,
    {
      expiresIn: '24h',
      issuer: 'pricepilot',
      audience: 'pricepilot-api'
    }
  );
}
```

### Token Refresh

```typescript
export async function refreshToken(req: Request, res: Response) {
  const { refreshToken } = req.body;

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!);
    const user = await db.user.findUnique({ where: { id: decoded.userId } });

    if (!user || user.status !== 'active') {
      throw new Error('Invalid user');
    }

    const newToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token'
      }
    });
  }
}
```

## Authorization

### Role-Based Access Control (RBAC)

```typescript
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      });
    }

    next();
  };
}

// Usage
app.get('/api/v1/admin/tenants', 
  authenticateToken,
  requireRole('admin', 'superadmin'),
  getTenants
);
```

### Tenant Isolation

```typescript
export function enforceTenantIsolation(req: Request, res: Response, next: NextFunction) {
  // Extract tenant ID from authenticated user
  const userTenantId = req.user.tenantId;

  // Add tenant filter to all queries
  req.tenantId = userTenantId;

  // Override query methods to enforce tenant isolation
  const originalQuery = req.query;
  req.query = {
    ...originalQuery,
    tenantId: userTenantId
  };

  next();
}
```

### Resource-Level Permissions

```typescript
export async function canAccessResource(
  userId: string,
  resourceType: string,
  resourceId: string
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { permissions: true }
  });

  // Check if user has permission for resource type
  const hasPermission = user.permissions.some(
    p => p.resourceType === resourceType && p.action === 'read'
  );

  if (!hasPermission) {
    return false;
  }

  // Check tenant isolation
  const resource = await db[resourceType].findUnique({
    where: { id: resourceId }
  });

  return resource?.tenantId === user.tenantId;
}
```

## Input Validation

### Request Validation with Zod

```typescript
import { z } from 'zod';

const createProductSchema = z.object({
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(500),
  price: z.number().positive(),
  brand: z.string().optional(),
  model: z.string().optional()
});

export async function createProduct(req: Request, res: Response) {
  try {
    // Validate request body
    const data = createProductSchema.parse(req.body);

    // Process validated data
    const product = await db.product.create({
      data: {
        ...data,
        tenantId: req.user.tenantId
      }
    });

    res.status(201).json({
      success: true,
      data: { product }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: { fields: error.flatten().fieldErrors }
        }
      });
    }
    throw error;
  }
}
```

### SQL Injection Prevention

```typescript
// BAD: Vulnerable to SQL injection
const products = await db.$queryRaw`
  SELECT * FROM products WHERE name = '${req.query.name}'
`;

// GOOD: Use parameterized queries
const products = await db.$queryRaw`
  SELECT * FROM products WHERE name = ${req.query.name}
`;

// BEST: Use Prisma ORM
const products = await db.product.findMany({
  where: { name: req.query.name }
});
```

### XSS Prevention

```typescript
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
}

// Sanitize user input
const sanitizedName = sanitizeInput(req.body.name);
```

## Rate Limiting

### Implementation

```typescript
import rateLimit from 'express-rate-limit';

// General API rate limit
export const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // 1000 requests per hour
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  }
});

// Stricter limit for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  skipSuccessfulRequests: true
});

// Apply to routes
app.use('/api/v1', apiLimiter);
app.use('/api/v1/auth', authLimiter);
```

### Per-Tenant Rate Limiting

```typescript
export const tenantLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: async (req) => {
    const tenant = await db.tenant.findUnique({
      where: { id: req.user.tenantId }
    });
    
    // Different limits based on plan
    const limits = {
      starter: 100,
      professional: 1000,
      enterprise: 10000
    };
    
    return limits[tenant.plan] || 100;
  },
  keyGenerator: (req) => req.user.tenantId
});
```

## CORS Configuration

```typescript
import cors from 'cors';

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://app.pricepilot.com',
      'https://admin.pricepilot.com'
    ];

    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:3000');
    }

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));
```

## Security Headers

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.pricepilot.com'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
```

## API Logging

### Request Logging

```typescript
export async function logRequest(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  // Log request
  await db.requestLog.create({
    data: {
      method: req.method,
      path: req.path,
      userId: req.user?.id,
      tenantId: req.user?.tenantId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date()
    }
  });

  // Log response
  res.on('finish', async () => {
    const duration = Date.now() - startTime;
    
    await db.requestLog.update({
      where: { id: logId },
      data: {
        statusCode: res.statusCode,
        responseTime: duration
      }
    });
  });

  next();
}
```

### Sensitive Data Filtering

```typescript
const SENSITIVE_FIELDS = ['password', 'apiToken', 'secret', 'creditCard'];

export function filterSensitiveData(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const filtered = { ...obj };

  for (const key of Object.keys(filtered)) {
    if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field))) {
      filtered[key] = '[REDACTED]';
    } else if (typeof filtered[key] === 'object') {
      filtered[key] = filterSensitiveData(filtered[key]);
    }
  }

  return filtered;
}
```

## Error Handling

### Secure Error Responses

```typescript
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // Log full error details
  console.error('API Error:', {
    error: err,
    stack: err.stack,
    user: req.user,
    path: req.path
  });

  // Send sanitized error to client
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An error occurred'
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: message
    }
  });
}
```

## Security Checklist

- [ ] All endpoints require authentication
- [ ] Authorization checks implemented
- [ ] Tenant isolation enforced
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection enabled
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Security headers set
- [ ] Request logging enabled
- [ ] Sensitive data filtered from logs
- [ ] Error handling doesn't leak information
- [ ] API tokens encrypted at rest
- [ ] HTTPS enforced
- [ ] Regular security audits scheduled

## Related Documentation

- [Authentication Configuration](authentication-config)
- [Tenant Management](../tenant-management/tenant-operations)
- [Security Monitoring](../system-monitoring/health-checks)
