---
title: "Authentication Configuration"
description: "Configure and manage authentication and authorization in PricePilot"
category: "security"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
subcategory: null
tags: ["security", "authentication", "authorization", "tokens"]
relatedDocs: ["api-security", "tenant-operations"]
---

# Authentication Configuration

Comprehensive guide to configuring authentication and authorization in PricePilot.

## Authentication Methods

### NextAuth.js Configuration

PricePilot uses NextAuth.js for authentication:

```typescript
// app/api/auth/[...nextauth]/route.ts
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Validate credentials
        // Return user object or null
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.tenantId = user.tenantId;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.tenantId = token.tenantId;
      session.user.role = token.role;
      return session;
    }
  }
};
```

### API Token Authentication

For API access:

```typescript
// Middleware for API token validation
export async function validateApiToken(token: string) {
  const apiToken = await prisma.apiToken.findUnique({
    where: { token },
    include: { tenant: true }
  });
  
  if (!apiToken || apiToken.status !== 'active') {
    throw new Error('Invalid or inactive token');
  }
  
  if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
    throw new Error('Token expired');
  }
  
  return apiToken;
}
```

## User Roles

### Role Definitions

```typescript
enum UserRole {
  ADMIN = 'admin',           // System administrator
  TENANT_ADMIN = 'tenant_admin', // Tenant administrator
  USER = 'user'              // Regular user
}
```

### Role Permissions

```typescript
const permissions = {
  admin: [
    'system:read',
    'system:write',
    'tenants:manage',
    'users:manage',
    'all:access'
  ],
  tenant_admin: [
    'tenant:read',
    'tenant:write',
    'users:manage',
    'products:manage',
    'competitors:manage'
  ],
  user: [
    'tenant:read',
    'products:read',
    'products:update',
    'competitors:read'
  ]
};
```

## Authorization Middleware

### Route Protection

```typescript
// Protect admin routes
export function requireAdmin(handler: NextApiHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    return handler(req, res);
  };
}

// Protect tenant routes
export function requireTenant(handler: NextApiHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session || !session.user.tenantId) {
      return res.status(403).json({ error: 'Tenant access required' });
    }
    
    return handler(req, res);
  };
}
```

## Password Policies

### Password Requirements

```typescript
const passwordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommon: true,
  preventReuse: 5 // Last 5 passwords
};

function validatePassword(password: string): boolean {
  if (password.length < passwordPolicy.minLength) return false;
  if (passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) return false;
  if (passwordPolicy.requireLowercase && !/[a-z]/.test(password)) return false;
  if (passwordPolicy.requireNumbers && !/[0-9]/.test(password)) return false;
  if (passwordPolicy.requireSpecialChars && !/[!@#$%^&*]/.test(password)) return false;
  
  return true;
}
```

### Password Hashing

```typescript
import bcrypt from 'bcrypt';

// Hash password
async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

// Verify password
async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}
```

## Session Management

### Session Configuration

```typescript
const sessionConfig = {
  strategy: 'jwt',
  maxAge: 30 * 24 * 60 * 60, // 30 days
  updateAge: 24 * 60 * 60,   // Update every 24 hours
  
  // Cookie settings
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60
  }
};
```

### Session Invalidation

```typescript
// Invalidate all user sessions
async function invalidateUserSessions(userId: string) {
  await prisma.session.deleteMany({
    where: { userId }
  });
}

// Invalidate tenant sessions
async function invalidateTenantSessions(tenantId: string) {
  await prisma.session.deleteMany({
    where: {
      user: { tenantId }
    }
  });
}
```

## Multi-Factor Authentication (MFA)

### MFA Setup

```typescript
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

// Generate MFA secret
async function generateMFASecret(userId: string) {
  const secret = speakeasy.generateSecret({
    name: `PricePilot (${userId})`,
    length: 32
  });
  
  // Store secret
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaSecret: secret.base32,
      mfaEnabled: false // Enable after verification
    }
  });
  
  // Generate QR code
  const qrCode = await QRCode.toDataURL(secret.otpauth_url);
  
  return { secret: secret.base32, qrCode };
}

// Verify MFA token
function verifyMFAToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2 // Allow 2 time steps
  });
}
```

## API Token Management

### Token Generation

```typescript
import crypto from 'crypto';

async function generateApiToken(
  tenantId: string,
  name: string,
  expiresIn?: number
): Promise<string> {
  const token = `pp_${crypto.randomBytes(32).toString('hex')}`;
  
  await prisma.apiToken.create({
    data: {
      token,
      name,
      tenantId,
      status: 'active',
      expiresAt: expiresIn 
        ? new Date(Date.now() + expiresIn)
        : null
    }
  });
  
  return token;
}
```

### Token Rotation

```typescript
async function rotateApiToken(oldToken: string): Promise<string> {
  const existing = await prisma.apiToken.findUnique({
    where: { token: oldToken }
  });
  
  if (!existing) throw new Error('Token not found');
  
  // Generate new token
  const newToken = await generateApiToken(
    existing.tenantId,
    existing.name,
    existing.expiresAt 
      ? existing.expiresAt.getTime() - Date.now()
      : undefined
  );
  
  // Deactivate old token
  await prisma.apiToken.update({
    where: { token: oldToken },
    data: { status: 'revoked' }
  });
  
  return newToken;
}
```

## Security Best Practices

1. **Use HTTPS**: Always use HTTPS in production
2. **Secure Cookies**: Set secure, httpOnly, sameSite flags
3. **Token Encryption**: Encrypt API tokens at rest
4. **Rate Limiting**: Implement rate limiting on auth endpoints
5. **Audit Logging**: Log all authentication events
6. **Regular Rotation**: Rotate tokens regularly
7. **MFA**: Require MFA for admin accounts

## Troubleshooting

### Authentication Failures

```typescript
// Log authentication attempts
await prisma.auditLog.create({
  data: {
    action: 'login_failed',
    userId: null,
    details: {
      email,
      reason: 'Invalid credentials',
      ipAddress: req.ip
    }
  }
});
```

### Session Issues

```bash
# Clear all sessions
npx prisma db execute --stdin <<< "DELETE FROM sessions;"

# Clear expired sessions
npx prisma db execute --stdin <<< "DELETE FROM sessions WHERE expires < NOW();"
```

## Next Steps

- Configure [API Security](api-security)
- Review [Security Headers](security-headers)
- Set up [Monitoring](../system-monitoring/health-checks)
