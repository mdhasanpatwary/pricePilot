---
title: "XSS Prevention Guide"
description: "Comprehensive guide to preventing cross-site scripting attacks"
category: "competitors"
tags: ["security", "xss", "guide"]
audience: "tenant"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
---

# XSS Prevention Guide

## Overview

This guide documents the XSS (Cross-Site Scripting) prevention utilities implemented in PricePilot. These utilities provide comprehensive protection against XSS attacks while preserving legitimate HTML formatting where needed.

## Implementation

**Location**: `lib/utils/sanitize.ts`

**Dependencies**: 
- `isomorphic-dompurify` - Industry-standard HTML sanitization library

## Available Functions

### 1. sanitizeHtml(dirty: string): string

**Purpose**: Sanitizes HTML content with a strict whitelist of safe tags and attributes.

**Allowed Tags**: `b`, `i`, `em`, `strong`, `a`, `p`, `br`, `ul`, `ol`, `li`, `span`, `div`

**Allowed Attributes**: `href`, `target`, `rel`, `class`

**Use Cases**:
- User-generated content in comments
- Rich text editor output
- General HTML content from untrusted sources

**Example**:
```typescript
import { sanitizeHtml } from '@/lib/utils/sanitize';

const userInput = '<script>alert("XSS")</script><p>Safe content</p>';
const safe = sanitizeHtml(userInput);
// Returns: '<p>Safe content</p>'
```

### 2. escapeHtml(text: string): string

**Purpose**: Escapes HTML special characters to prevent XSS attacks.

**Escaped Characters**: `&`, `<`, `>`, `"`, `'`, `/`

**Use Cases**:
- Displaying user input as plain text
- Preventing HTML injection in text fields
- Safe rendering of untrusted strings

**Example**:
```typescript
import { escapeHtml } from '@/lib/utils/sanitize';

const userInput = '<script>alert("XSS")</script>';
const safe = escapeHtml(userInput);
// Returns: '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
```

### 3. sanitizeProductDescription(dirty: string): string

**Purpose**: Sanitizes product descriptions with a more permissive set of tags suitable for e-commerce content.

**Additional Allowed Tags**: `h1`, `h2`, `h3`, `h4`, `h5`, `h6`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `img`

**Additional Allowed Attributes**: `src`, `alt`, `width`, `height`, `title`

**Use Cases**:
- Product descriptions from competitor scraping
- User-provided product details
- Rich product content

**Example**:
```typescript
import { sanitizeProductDescription } from '@/lib/utils/sanitize';

const description = '<h2>Features</h2><ul><li>Feature 1</li></ul><script>alert("XSS")</script>';
const safe = sanitizeProductDescription(description);
// Returns: '<h2>Features</h2><ul><li>Feature 1</li></ul>'
```

### 4. sanitizeNotification(dirty: string): string

**Purpose**: Sanitizes notification content with minimal formatting.

**Allowed Tags**: `b`, `i`, `em`, `strong`, `br`

**Allowed Attributes**: None

**Use Cases**:
- System notifications
- Alert messages
- User notifications

**Example**:
```typescript
import { sanitizeNotification } from '@/lib/utils/sanitize';

const notification = 'Price updated for <b>Product Name</b><script>alert("XSS")</script>';
const safe = sanitizeNotification(notification);
// Returns: 'Price updated for <b>Product Name</b>'
```

### 5. stripHtml(html: string): string

**Purpose**: Removes all HTML tags, leaving only plain text.

**Use Cases**:
- Extracting plain text from HTML
- Search indexing
- Preview text generation

**Example**:
```typescript
import { stripHtml } from '@/lib/utils/sanitize';

const html = '<p>Hello <b>World</b></p>';
const text = stripHtml(html);
// Returns: 'Hello World'
```

### 6. sanitizeUrl(url: string): string

**Purpose**: Sanitizes URLs to prevent javascript: and data: protocol attacks.

**Blocked Protocols**: `javascript:`, `data:`, `vbscript:`, `file:`

**Allowed Protocols**: `http:`, `https:`, `mailto:`, relative URLs

**Use Cases**:
- User-provided links
- External URLs
- Competitor product URLs

**Example**:
```typescript
import { sanitizeUrl } from '@/lib/utils/sanitize';

const dangerousUrl = 'javascript:alert("XSS")';
const safe1 = sanitizeUrl(dangerousUrl);
// Returns: ''

const safeUrl = 'https://example.com';
const safe2 = sanitizeUrl(safeUrl);
// Returns: 'https://example.com'
```

### 7. sanitizeJsonData<T>(data: T): T

**Purpose**: Recursively sanitizes JSON data by escaping HTML in string values.

**Use Cases**:
- API responses before rendering
- User-provided JSON data
- Configuration data from external sources

**Example**:
```typescript
import { sanitizeJsonData } from '@/lib/utils/sanitize';

const data = {
  name: '<script>alert("XSS")</script>Product',
  description: 'Safe text',
  nested: { value: '<b>Bold</b>' }
};
const safe = sanitizeJsonData(data);
// All string values are HTML-escaped
```

## Usage Guidelines

### When to Use Each Function

| Function | Use Case | Example |
|----------|----------|---------|
| `sanitizeHtml` | General user content with basic formatting | Comments, descriptions |
| `escapeHtml` | Plain text that should not contain HTML | User names, titles |
| `sanitizeProductDescription` | Rich product content | Scraped product descriptions |
| `sanitizeNotification` | System messages with minimal formatting | Notifications, alerts |
| `stripHtml` | Extract plain text | Search, previews |
| `sanitizeUrl` | User-provided URLs | Links, redirects |
| `sanitizeJsonData` | API responses | External data |

### Best Practices

1. **Always sanitize user input** before rendering in the browser
2. **Choose the most restrictive function** that meets your needs
3. **Sanitize at the point of output**, not just input
4. **Test with common XSS payloads** to verify protection
5. **Document why specific tags are allowed** in your use case

### Common XSS Attack Vectors (All Prevented)

✅ Script injection: `<script>alert('XSS')</script>`
✅ Event handlers: `<img src="x" onerror="alert('XSS')">`
✅ JavaScript URLs: `<a href="javascript:alert('XSS')">Click</a>`
✅ Data URLs: `<a href="data:text/html,<script>alert('XSS')</script>">Click</a>`
✅ Style injection: `<div style="background:url('javascript:alert(1)')">Text</div>`
✅ SVG injection: `<svg onload="alert('XSS')">`
✅ Form injection: `<form action="javascript:alert('XSS')"><input type="submit"></form>`

## Integration Examples

### React Component

```typescript
import { sanitizeHtml } from '@/lib/utils/sanitize';

export function ProductDetail({ product }: { product: Product }) {
  return (
    <div>
      <h1>{escapeHtml(product.title)}</h1>
      <div 
        dangerouslySetInnerHTML={{ 
          __html: sanitizeProductDescription(product.description) 
        }} 
      />
    </div>
  );
}
```

### API Route

```typescript
import { sanitizeJsonData } from '@/lib/utils/sanitize';

export async function GET(req: NextRequest) {
  const products = await fetchProductsFromExternalSource();
  
  // Sanitize before sending to client
  const sanitized = sanitizeJsonData(products);
  
  return NextResponse.json(sanitized);
}
```

### Notification Service

```typescript
import { sanitizeNotification } from '@/lib/utils/sanitize';

export class NotificationService {
  static async create(data: NotificationData) {
    await prisma.notification.create({
      data: {
        ...data,
        message: sanitizeNotification(data.message),
        title: escapeHtml(data.title),
      }
    });
  }
}
```

## Testing

### Verification Script

Run the verification script to test all sanitization functions:

```bash
npx tsx scripts/verify-xss-prevention.ts
```

### Manual Testing

Test with common XSS payloads:

```typescript
const payloads = [
  '<script>alert("XSS")</script>',
  '<img src="x" onerror="alert(\'XSS\')">',
  '<a href="javascript:alert(\'XSS\')">Click</a>',
  '<svg onload="alert(\'XSS\')">',
  '<iframe src="javascript:alert(\'XSS\')">',
];

payloads.forEach(payload => {
  const safe = sanitizeHtml(payload);
  console.log(`Input: ${payload}`);
  console.log(`Output: ${safe}`);
  console.log(`Safe: ${!safe.includes('script') && !safe.includes('javascript')}`);
});
```

## Security Considerations

### Defense in Depth

XSS prevention is implemented at multiple layers:

1. **Input Validation**: Validate data format and type
2. **Sanitization**: Remove dangerous content (this module)
3. **Output Encoding**: Escape HTML entities
4. **Content Security Policy**: Browser-level protection
5. **HTTP Headers**: X-XSS-Protection, X-Content-Type-Options

### Limitations

- **Not a silver bullet**: Always combine with other security measures
- **Context matters**: Choose the right function for your use case
- **Regular updates**: Keep DOMPurify updated for new attack vectors
- **Server-side only**: Client-side sanitization can be bypassed

### Compliance

This implementation helps meet:

- **OWASP Top 10**: Protection against A7 - Cross-Site Scripting (XSS)
- **PCI DSS**: Requirement 6.5.7 - Cross-site scripting
- **GDPR**: Data protection by design and default

## Maintenance

### Updating Allowed Tags

To add new allowed tags, update the configuration in `lib/utils/sanitize.ts`:

```typescript
const ALLOWED_TAGS = [
  'b', 'i', 'em', 'strong', 'a', 'p', 'br',
  // Add new tags here
  'code', 'pre',
];
```

### Monitoring

Monitor for XSS attempts in logs:

```typescript
import { logger } from '@/lib/logger';

export function sanitizeHtml(dirty: string): string {
  const clean = DOMPurify.sanitize(dirty, config);
  
  if (dirty !== clean) {
    logger.warn('XSS attempt detected and sanitized', {
      original: dirty.substring(0, 100),
      sanitized: clean.substring(0, 100),
    });
  }
  
  return clean;
}
```

## References

- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

## Support

For questions or issues related to XSS prevention:

1. Review this documentation
2. Check the verification script output
3. Test with common XSS payloads
4. Consult the OWASP XSS Prevention Cheat Sheet
5. Contact the security team

---

**Last Updated**: January 2026  
**Version**: 1.0  
**Status**: Production Ready
