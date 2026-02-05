---
title: "XSS Prevention Quick Reference"
description: "Quick reference guide for preventing cross-site scripting attacks"
category: "getting-started"
tags: ["security", "xss", "quick-reference"]
audience: "tenant"
---

# XSS Prevention Quick Reference

## Quick Function Selector

| Content Type | Function to Use | Example |
|--------------|----------------|---------|
| Plain text (user names, titles) | `escapeHtml()` | `<h1>{escapeHtml(userName)}</h1>` |
| User comments with basic formatting | `sanitizeHtml()` | `<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(comment) }} />` |
| Product descriptions (rich content) | `sanitizeProductDescription()` | `sanitizeProductDescription(product.description)` |
| System notifications | `sanitizeNotification()` | `sanitizeNotification(notification.message)` |
| Extract plain text from HTML | `stripHtml()` | `const preview = stripHtml(htmlContent)` |
| User-provided URLs | `sanitizeUrl()` | `<a href={sanitizeUrl(userUrl)}>Link</a>` |
| API responses (JSON) | `sanitizeJsonData()` | `sanitizeJsonData(externalApiResponse)` |

## Import Statement

```typescript
import {
  sanitizeHtml,
  escapeHtml,
  sanitizeProductDescription,
  sanitizeNotification,
  stripHtml,
  sanitizeUrl,
  sanitizeJsonData,
} from '@/lib/utils/sanitize';
```

## Common Patterns

### React Component with User Content
```typescript
export function UserComment({ comment }) {
  return (
    <div>
      <h3>{escapeHtml(comment.author)}</h3>
      <div dangerouslySetInnerHTML={{ 
        __html: sanitizeHtml(comment.content) 
      }} />
    </div>
  );
}
```

### Product Display
```typescript
export function ProductCard({ product }) {
  return (
    <div>
      <h2>{escapeHtml(product.name)}</h2>
      <div dangerouslySetInnerHTML={{ 
        __html: sanitizeProductDescription(product.description) 
      }} />
      <a href={sanitizeUrl(product.url)}>View Product</a>
    </div>
  );
}
```

### API Response Handler
```typescript
export async function GET(req: NextRequest) {
  const data = await fetchFromExternalSource();
  const sanitized = sanitizeJsonData(data);
  return NextResponse.json(sanitized);
}
```

### Notification Display
```typescript
export function NotificationItem({ notification }) {
  return (
    <div>
      <strong>{escapeHtml(notification.title)}</strong>
      <p dangerouslySetInnerHTML={{ 
        __html: sanitizeNotification(notification.message) 
      }} />
    </div>
  );
}
```

## Allowed Tags by Function

### sanitizeHtml()
`b`, `i`, `em`, `strong`, `a`, `p`, `br`, `ul`, `ol`, `li`, `span`, `div`

### sanitizeProductDescription()
All from `sanitizeHtml()` plus:
`h1`, `h2`, `h3`, `h4`, `h5`, `h6`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `img`

### sanitizeNotification()
`b`, `i`, `em`, `strong`, `br`

### stripHtml()
None (removes all HTML)

## Testing

### Run Verification
```bash
npx tsx scripts/verify-xss-prevention.ts
```

### Test with XSS Payload
```typescript
const payload = '<script>alert("XSS")</script>';
const safe = sanitizeHtml(payload);
console.log(safe); // Should be empty or safe
```

## Common Mistakes to Avoid

❌ **DON'T**: Use `dangerouslySetInnerHTML` without sanitization
```typescript
// DANGEROUS!
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

✅ **DO**: Always sanitize first
```typescript
// SAFE
<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(userInput) }} />
```

❌ **DON'T**: Trust external data
```typescript
// DANGEROUS!
const data = await fetch(externalApi);
return <div>{data.content}</div>;
```

✅ **DO**: Sanitize external data
```typescript
// SAFE
const data = await fetch(externalApi);
const safe = sanitizeJsonData(data);
return <div>{escapeHtml(safe.content)}</div>;
```

## When in Doubt

1. **Plain text?** → Use `escapeHtml()`
2. **Need formatting?** → Use `sanitizeHtml()`
3. **Product content?** → Use `sanitizeProductDescription()`
4. **Notification?** → Use `sanitizeNotification()`
5. **URL?** → Use `sanitizeUrl()`
6. **JSON data?** → Use `sanitizeJsonData()`

## Emergency XSS Response

If XSS vulnerability is discovered:

1. **Identify** the vulnerable component
2. **Apply** appropriate sanitization function
3. **Test** with XSS payloads
4. **Deploy** immediately
5. **Review** similar code patterns
6. **Document** the fix

## Support

- **Documentation**: `docs/XSS_PREVENTION_GUIDE.md`
- **Verification**: `scripts/verify-xss-prevention.ts`
- **Implementation**: `lib/utils/sanitize.ts`

---

**Remember**: When in doubt, sanitize! It's better to be safe than sorry.
