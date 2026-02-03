# Scraper.ts Bug Report - Task 18.1 & 18.2

**Date**: February 1, 2026
**File**: lib/services/scraper.ts (3073 lines)
**Status**: Complete Review

## Critical Bugs Found

### 1. **Incorrect Selector Syntax in evaluateProductLink** (Line ~2900)
**Severity**: HIGH
**Location**: `evaluateProductLink` method
**Issue**: Invalid selector syntax in hover element call
```typescript
// BUGGY CODE:
await HumanSimulation.hoverElement(page, `${selector}: nth - child(${randomIndex + 1})`);
```
**Problem**: Spaces in `:nth-child()` selector will cause selector to fail
**Fix**: Remove spaces from pseudo-class selector
```typescript
await HumanSimulation.hoverElement(page, `${selector}:nth-child(${randomIndex + 1})`);
```

### 2. **Incorrect jQuery-style Selector Usage** (Line ~2950)
**Severity**: HIGH
**Location**: `searchAndScrape` method - product link hover
**Issue**: Using jQuery-style selector with Playwright
```typescript
// BUGGY CODE:
const linkElement = await page.$(`a[href = "${productLink}"]`);
await HumanSimulation.hoverElement(page, `a[href = "${productLink}"]`);
```
**Problem**: Spaces around `=` in attribute selector are invalid in CSS
**Fix**: Remove spaces from attribute selector
```typescript
const linkElement = await page.$(`a[href="${productLink}"]`);
await HumanSimulation.hoverElement(page, `a[href="${productLink}"]`);
```

### 3. **Potential Memory Leak in evaluateProductLink** (Line ~2950)
**Severity**: MEDIUM
**Location**: `evaluateProductLink` method - product selector loop
**Issue**: Incorrect array length check
```typescript
// BUGGY CODE:
const elements = await page.$(selector);
if (elements.length > 0) {
```
**Problem**: `page.$()` returns a single ElementHandle or null, not an array. Should use `page.$$()` for multiple elements
**Fix**: Use `page.$$()` to get array of elements
```typescript
const elements = await page.$$(selector);
if (elements && elements.length > 0) {
```

### 4. **Missing Error Handling for Retry After Header** (Line ~891)
**Severity**: MEDIUM
**Location**: `_scrapeProductPageInternal` method
**Issue**: Incomplete retry-after header parsing
```typescript
// INCOMPLETE CODE:
const retryAfterHeader = response?.headers()['retry-after'];
const retryAfter = re
```
**Problem**: Code is truncated/incomplete - variable `re` is undefined
**Fix**: Complete the retry-after parsing logic
```typescript
const retryAfterHeader = response?.headers()['retry-after'];
const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
```

## Medium Priority Bugs

### 5. **Inconsistent Error Wrapping**
**Severity**: MEDIUM
**Location**: Multiple locations throughout file
**Issue**: Some errors are wrapped in `ExternalServiceError`, others are not
**Recommendation**: Standardize error wrapping across all methods

### 6. **Race Condition in Concurrency Limiter**
**Severity**: MEDIUM
**Location**: `_scrapeProductPageInternal` and `_scrapeProductPageInternalWithTracking`
**Issue**: If context acquisition fails, concurrent slot is released but may not be acquired yet
**Fix**: Ensure slot is only released if it was successfully acquired

### 7. **Potential Null Reference in Security Analysis**
**Severity**: LOW
**Location**: `analyzeSecurity` method
**Issue**: Response headers extraction has fallback but could still fail
**Current**: Has try-catch but logs no error
**Recommendation**: Add error logging for debugging

## Edge Cases to Test

### 8. **Empty Search Query Handling**
**Location**: `searchAndScrape` method
**Test**: What happens if query is empty string or only whitespace?
**Current**: `sanitizeQuery` returns empty string, but search URL may be malformed
**Recommendation**: Add validation before building search URL

### 9. **Proxy Rotation Edge Case**
**Location**: `getNextProxy` method
**Test**: What happens when all proxies are unhealthy?
**Current**: Returns empty string and null config
**Recommendation**: Add fallback to direct connection with warning

### 10. **Challenge Handler Timeout**
**Location**: `_scrapeProductPageInternal` line ~950
**Test**: What happens if challenge takes longer than 60 seconds?
**Current**: Throws error and marks as blocked
**Recommendation**: Consider configurable timeout per site profile

## Performance Issues

### 11. **Excessive Human Simulation Delays**
**Location**: Multiple locations with `HumanSimulation.randomPause()`
**Issue**: Total delay can exceed 5-10 seconds per page
**Impact**: Slow scraping performance
**Recommendation**: Make delays configurable per site profile

### 12. **Redundant Security Checks**
**Location**: `searchAndScrape` method
**Issue**: Security check is performed twice (before and after challenge wait)
**Recommendation**: Consolidate into single check with retry logic

## Code Quality Issues

### 13. **Magic Numbers**
**Location**: Throughout file (timeouts, delays, retry counts)
**Issue**: Hard-coded values like `8000`, `60000`, `3` for max attempts
**Recommendation**: Extract to constants or configuration

### 14. **Long Method Length**
**Location**: `_scrapeProductPageInternal` and `_scrapeProductPageInternalWithTracking`
**Issue**: Methods exceed 400 lines each
**Recommendation**: Extract sub-methods for extraction strategies

### 15. **Duplicate Code**
**Location**: Extraction logic repeated in both internal methods
**Issue**: Same extraction code in two places
**Recommendation**: Extract to shared private method

## Documentation Issues

### 16. **Missing JSDoc Comments**
**Location**: Several private methods
**Issue**: Methods like `sanitizeQuery`, `parseSpecifications` lack documentation
**Recommendation**: Add JSDoc comments for all methods

### 17. **Outdated Comments**
**Location**: Line ~878 mentions "2784 lines" but file is now 3073 lines
**Issue**: Comment references outdated line count
**Recommendation**: Update or remove line count references

## Summary

**Total Bugs Found**: 17
- Critical: 4
- Medium: 8
- Low: 5

**Immediate Action Required**:
1. Fix selector syntax bugs (#1, #2, #3)
2. Complete retry-after parsing (#4)
3. Add validation for empty queries (#8)
4. Test proxy rotation edge case (#9)

**Next Steps**:
1. Implement fixes for critical bugs
2. Add unit tests for edge cases
3. Refactor long methods
4. Extract magic numbers to configuration
