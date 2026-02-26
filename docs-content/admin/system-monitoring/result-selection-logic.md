---
title: "Result Selection Logic"
description: "Logic for selecting and prioritizing results"
category: "system-monitoring"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["logic", "selection", "algorithms"]
audience: "admin"
---

# Result Selection Logic Documentation

## Overview

When the scraper performs a search and gets multiple product results, it uses a **weighted scoring algorithm** to select the best matching product. This document explains how the selection works and how to improve it.

## Current Implementation

### Location
- **File**: `lib/services/scraper.ts`
- **Method**: `evaluateProductLink(page: Page, query?: string)`
- **Called by**: `searchAndScrape()` method after navigating to search results page

### How It Works

The algorithm evaluates all links on the search results page and assigns each a score based on multiple weighted criteria. The link with the highest score is selected as the best match.

## Scoring Criteria

### 1. Container Score (20% Weight)

**What it checks**: Whether the link is inside a product container element

**Scoring**:
- +20 points: Link is inside a product container (`.product-thumb`, `.product-box`, `.card`, `.p-item`, etc.)
- +15 points: Container has price information nearby (detects currency symbols: $, ৳, ₹, BDT, TK)

**Why it matters**: Product links are typically wrapped in specific container elements. Price presence confirms it's a product listing.

```typescript
const productContainer = a.closest(".product-thumb") || 
                        a.closest(".product-box") || 
                        a.closest(".card");

if (productContainer) {
  score += 20;
  // Check for price in container
  if (/([$\u09F3\u20B9]|BDT|TK)\s?\d+/i.test(productContainer.textContent)) {
    score += 15;
  }
}
```

### 2. Image Quality (10-25 points)

**What it checks**: Presence and quality of product images

**Scoring**:
- +10 points: Link contains an image
- +15 points: Image alt text matches the search query

**Why it matters**: Product listings almost always have images. Alt text matching indicates relevance.

```typescript
const img = a.querySelector("img");
if (img) {
  score += 10;
  if (img.alt && altTextMatchesQuery) {
    score += 15;
  }
}
```

### 3. Text Quality (±5 points)

**What it checks**: Length and quality of link text

**Scoring**:
- +5 points: Text length between 10-150 characters (ideal for product titles)
- -5 points: Text length < 5 characters (likely "Buy", "View", "More" buttons)

**Why it matters**: Product titles have a characteristic length. Very short text is usually navigation.

### 4. Query Match Score (30-40% Weight)

**What it checks**: How well the link text/URL matches the search query

**Scoring**:
- Up to 40 points: 100% of query words found in link text or URL
- Up to 30 points: Partial match (proportional to match ratio)
- -50 points: Zero query words matched and not in product container

**Why it matters**: This is the most important factor - the product should match what was searched for.

```typescript
const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
const matchCount = queryWords.filter(w => 
  lowerText.includes(w) || href.includes(w)
).length;
const matchRatio = matchCount / queryWords.length;

const boost = matchRatio === 1 ? 40 : (matchRatio * 30);
score += boost;
```

### 5. URL Structure Score (20% Weight)

**What it checks**: Whether the URL follows product page patterns

**Scoring**:
- +20 points: URL contains `/product/`, `/p/`, `/item/`, or `/details/`
- +5 points: URL has deep path structure (more than 4 segments)

**Why it matters**: Product pages typically have recognizable URL patterns.

```typescript
const isProductUrl = href.includes("/product/") || 
                    href.includes("/p/") || 
                    href.includes("/item/");
if (isProductUrl) {
  score += 20;
}
```

### 6. Brand Match Bonus (20% Weight)

**What it checks**: Whether the link contains the brand mentioned in the query

**Scoring**:
- +20 points: Brand from query is found in link text

**Why it matters**: Brand matching ensures we get the right manufacturer's product.

```typescript
// Uses TECH_BRANDS data with aliases
if (queryBrand && linkContainsBrand) {
  score += 20;
}
```

### 7. Position Bias (1-5 points)

**What it checks**: Position of the link in the page

**Scoring**:
- Top 5 results get small boost: 5 points for 1st, 4 for 2nd, etc.

**Why it matters**: Search engines typically show most relevant results first.

## Filtering Rules

Before scoring, links are filtered out if they:

1. Have text length < 4 characters (unless URL has `product_id=`)
2. Use `javascript:` or `#` in href
3. Are navigation links (contain `sort=`, `limit=`, `page=`, `order=`)
4. Are utility links (contain `compare`, `wishlist`, `/account`, `/checkout`)

## Selection Process

```
1. Navigate to search results page
2. Wait for product elements to load
3. Perform human simulation (scroll, hover)
4. Evaluate all links on page
5. Filter out non-product links
6. Score remaining candidates
7. Sort by score (descending)
8. Return highest scoring link
9. If no candidates score > 10, return null
```

## Example Scoring

**Search Query**: "Intel Core i5 12400F"

**Candidate 1**: Link in product card
- Container: +20 (in `.product-box`)
- Price nearby: +15
- Has image: +10
- Image alt matches: +15
- Text length good: +5
- Query match: +40 (100% match)
- Product URL: +20 (`/product/intel-core-i5-12400f`)
- Brand match: +20 (Intel found)
- Position: +5 (first result)
- **Total: 150 points** ✅

**Candidate 2**: "View Details" link
- Container: +20
- No price: 0
- No image: 0
- Text too short: -5
- Query match: 0 (no words match)
- Product URL: +20
- No brand: 0
- Position: +3
- **Total: 38 points**

**Winner**: Candidate 1 (150 > 38)

## Known Limitations

### 1. Single Result Selection
- **Issue**: Only returns the top-scoring result
- **Impact**: If scoring is slightly off, wrong product is selected
- **Improvement**: Return top N candidates with confidence scores

### 2. No Confidence Threshold
- **Issue**: Returns result even with low score (> 10)
- **Impact**: May return irrelevant products
- **Improvement**: Set minimum confidence threshold (e.g., 50 points)

### 3. Static Weights
- **Issue**: Weights are hardcoded and same for all sites
- **Impact**: Different sites may need different scoring strategies
- **Improvement**: Make weights configurable per site profile

### 4. No Machine Learning
- **Issue**: Doesn't learn from past selections
- **Impact**: Can't improve over time
- **Improvement**: Track which selections led to successful scrapes

### 5. Limited Context
- **Issue**: Only looks at current page, not product details
- **Impact**: Can't verify if selected product actually matches
- **Improvement**: Quick validation check before full scrape

## Recommended Improvements

### Priority 1: Add Confidence Scoring

```typescript
interface ScoredCandidate {
  href: string;
  text: string;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
}

// Set thresholds
const HIGH_CONFIDENCE = 100;
const MEDIUM_CONFIDENCE = 50;
const MIN_THRESHOLD = 30;

if (score >= HIGH_CONFIDENCE) {
  confidence = 'high';
} else if (score >= MEDIUM_CONFIDENCE) {
  confidence = 'medium';
} else if (score >= MIN_THRESHOLD) {
  confidence = 'low';
} else {
  // Don't return this candidate
  return;
}
```

### Priority 2: Return Multiple Candidates

```typescript
// Instead of returning single URL
return candidates.length > 0 ? candidates[0].href : null;

// Return top 3 with scores
return candidates.slice(0, 3).map(c => ({
  url: c.href,
  score: c.score,
  confidence: calculateConfidence(c.score),
  reasons: c.reasons
}));
```

### Priority 3: Site-Specific Weights

```typescript
// In site-profiles.ts
interface SiteProfile {
  // ... existing fields
  resultSelection?: {
    weights: {
      container: number;      // default: 20
      queryMatch: number;     // default: 40
      urlStructure: number;   // default: 20
      brandMatch: number;     // default: 20
      imageQuality: number;   // default: 10
    };
    minScore: number;         // default: 10
    confidenceThreshold: number; // default: 50
  };
}
```

### Priority 4: Add Validation Step

```typescript
async selectBestProduct(candidates: ScoredCandidate[]): Promise<string | null> {
  for (const candidate of candidates) {
    // Quick validation: check if page has price
    const isValid = await this.quickValidate(candidate.url);
    if (isValid) {
      logger.info(`Selected: ${candidate.url} (score: ${candidate.score})`);
      return candidate.url;
    }
  }
  return null;
}

private async quickValidate(url: string): Promise<boolean> {
  // Make HEAD request or quick page check
  // Verify it's actually a product page
  return true; // or false
}
```

### Priority 5: Add Telemetry

```typescript
// Track selection success rate
interface SelectionMetrics {
  query: string;
  selectedUrl: string;
  score: number;
  scrapedSuccessfully: boolean;
  hadPrice: boolean;
  timestamp: Date;
}

// After scraping
await this.recordSelectionMetrics({
  query,
  selectedUrl,
  score,
  scrapedSuccessfully: result !== null,
  hadPrice: result?.price > 0
});
```

## Testing the Logic

### Manual Testing

```typescript
// In scripts/test-result-selection.ts
const scraper = new ScraperService();
await scraper.init();

const testCases = [
  { query: "Intel Core i5 12400F", site: "https://startech.com.bd" },
  { query: "RTX 4060 Ti", site: "https://ryans.com" },
  { query: "Samsung 980 Pro 1TB", site: "https://techlandbd.com" }
];

for (const test of testCases) {
  const result = await scraper.searchAndScrape(test.site, test.query);
  console.log(`Query: ${test.query}`);
  console.log(`Selected: ${result?.url}`);
  console.log(`Price: ${result?.price}`);
  console.log('---');
}
```

### Automated Testing

Add unit tests for the scoring algorithm:

```typescript
// __tests__/lib/services/result-selection.test.ts
describe('Result Selection Logic', () => {
  it('should prefer links with high query match', () => {
    // Test scoring logic
  });

  it('should filter out navigation links', () => {
    // Test filtering
  });

  it('should give bonus for brand match', () => {
    // Test brand matching
  });
});
```

## Debugging

To debug selection issues, add logging:

```typescript
// Log all candidates with scores
candidates.forEach((c, i) => {
  logger.debug(`Candidate ${i + 1}:`, {
    url: c.href,
    text: c.text.substring(0, 50),
    score: c.score,
    reasons: c.reasons
  });
});

// Log selected result
logger.info(`Selected best match:`, {
  url: candidates[0].href,
  score: candidates[0].score,
  reasons: candidates[0].reasons
});
```

## Configuration

Current configuration is in `lib/services/scraper.ts`. To make it configurable:

1. Move scoring weights to `lib/config/site-profiles.ts`
2. Add per-site overrides
3. Add environment variables for global defaults

```bash
# .env
RESULT_SELECTION_MIN_SCORE=30
RESULT_SELECTION_CONFIDENCE_THRESHOLD=50
RESULT_SELECTION_RETURN_TOP_N=3
```

## Related Files

- `lib/services/scraper.ts` - Main implementation
- `lib/config/site-profiles.ts` - Site-specific configurations
- `lib/data/brands.ts` - Brand matching data
- `docs/STEALTH_SCRAPING.md` - Overall scraping strategy

## Summary

The result selection logic uses a sophisticated weighted scoring system to identify the most relevant product from search results. While it works well in most cases, there are opportunities to improve confidence scoring, add validation, and make it more adaptive to different sites.

**Key Strengths**:
- Multi-factor scoring (not just text match)
- Brand-aware matching
- Price detection
- Position-aware

**Key Weaknesses**:
- No confidence thresholds
- Static weights
- Single result only
- No learning mechanism

**Next Steps**:
1. Add confidence scoring and thresholds
2. Return multiple candidates
3. Add quick validation step
4. Implement telemetry for continuous improvement
