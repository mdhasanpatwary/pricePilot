---
title: "Product Matching Guide"
description: "Complete guide to understanding and managing product matching in PricePilot"
category: "products"
subcategory: null
tags: ["products", "matching", "algorithm", "sku", "confidence", "manual-override"]
author: "PricePilot Team"
lastReviewed: "2024-02-05"
relatedDocs: ["product-setup", "adding-competitors", "price-approval-guide"]
---

# Product Matching Guide

## Overview

Product matching is the foundation of accurate price comparison in PricePilot. The matching engine intelligently connects your products with equivalent products on competitor websites, enabling you to track competitive pricing and make informed pricing decisions.

### Why Product Matching Matters

- **Accurate Comparisons**: Only compare truly equivalent products
- **Competitive Intelligence**: Track the right competitor products for your catalog
- **Pricing Confidence**: Make pricing decisions based on accurate data
- **Time Savings**: Automated matching reduces manual configuration
- **Scalability**: Handle large catalogs efficiently

### How Matching Works

PricePilot uses a sophisticated multi-strategy approach to match products:

1. **Automatic Matching**: The system attempts to match products using multiple algorithms
2. **Confidence Scoring**: Each match receives a confidence score (0-100)
3. **Manual Review**: You can review and verify suggested matches
4. **Manual Override**: You can manually link products when automatic matching fails
5. **Continuous Improvement**: The system learns from your manual corrections

## Matching Types

PricePilot employs multiple matching strategies in priority order, from most reliable to least reliable. Understanding these strategies helps you optimize your product data for better automatic matching.

### 1. SKU Exact Match (Highest Priority)

SKU (Stock Keeping Unit) exact matching is the most reliable method for product matching. When your product's SKU exactly matches a competitor's product SKU, you can be confident it's the same product.

#### How It Works

```typescript
// Example: Exact SKU match
yourProduct.sku === competitorProduct.sku
// "LAPTOP-XPS-15-9520" === "LAPTOP-XPS-15-9520" ✓
```

**Confidence Score**: 100%

#### When SKU Matching Works Best

- **Manufacturer SKUs**: When both you and competitors use official manufacturer SKUs
- **Industry Standards**: Products with standardized SKU formats (electronics, books, etc.)
- **Consistent Catalogs**: When competitor websites display SKU information
- **B2B Products**: Business products often have standardized SKUs

#### Optimizing for SKU Matching

To maximize SKU matching success:

1. **Use Manufacturer SKUs**: Always use official manufacturer SKUs when available
2. **Standardize Format**: Keep SKU format consistent across your catalog
3. **Include SKU in Product Data**: Ensure SKU field is populated for all products
4. **Avoid Custom SKUs**: Don't create internal SKUs that competitors won't use

**Example of Good SKU Practice:**
```typescript
// Good: Using manufacturer SKU
product.sku = "MX-KEYS-MINI-920-010475"; // Logitech official SKU

// Bad: Using internal SKU
product.sku = "KB-001-2024"; // Your internal code
```

### 2. Brand + Model Match

When SKU matching isn't possible, PricePilot attempts to match products based on the combination of brand and model information. This method is highly reliable for products with distinct model numbers.

#### How It Works

```typescript
// Example: Brand + Model match
yourProduct.brand === competitorProduct.brand &&
yourProduct.model === competitorProduct.model

// "Dell" + "XPS 15 9520" === "Dell" + "XPS 15 9520" ✓
```

**Confidence Score**: 90-95%

#### When Brand + Model Matching Works Best

- **Electronics**: Laptops, phones, tablets with clear model numbers
- **Appliances**: Refrigerators, washers, dryers with model designations
- **Automotive Parts**: Parts with specific model compatibility
- **Branded Products**: Any product with a distinct brand and model identifier

#### Optimizing for Brand + Model Matching

To improve brand + model matching:

1. **Populate Both Fields**: Always include both brand and model in your product data
2. **Use Consistent Naming**: Match how manufacturers write brand names
3. **Include Full Model Numbers**: Don't abbreviate model numbers
4. **Avoid Variations**: Use the same format competitors use

**Example of Good Brand + Model Practice:**
```typescript
// Good: Complete and consistent
product.brand = "Apple";
product.model = "iPhone 15 Pro Max";

// Bad: Incomplete or inconsistent
product.brand = "Apple Inc.";
product.model = "15 Pro Max"; // Missing "iPhone"
```

#### Common Brand + Model Pitfalls

**Pitfall 1: Brand Name Variations**
```typescript
// These won't match even though they're the same brand
"HP" !== "Hewlett-Packard"
"LG" !== "LG Electronics"
```

**Solution**: Use the most common brand name format

**Pitfall 2: Model Number Variations**
```typescript
// These won't match even though they're the same model
"XPS-15-9520" !== "XPS 15 9520"
"iPhone15ProMax" !== "iPhone 15 Pro Max"
```

**Solution**: Use the format most commonly used by competitors

### 3. Fuzzy Title Match

When SKU and brand + model matching fail, PricePilot uses advanced fuzzy matching algorithms to compare product titles. This method uses natural language processing to find similar products even when exact data isn't available.

#### How It Works

```typescript
// Example: Fuzzy match using similarity algorithm
similarity(yourProduct.name, competitorProduct.name) > 0.85

// "Dell XPS 15 Laptop Computer" ≈ "Dell XPS-15 Notebook PC" ✓
// Similarity score: 87%
```

**Confidence Score**: 70-85% (varies based on similarity)

#### Fuzzy Matching Algorithm

The fuzzy matching algorithm considers:

- **Word Order**: Similar word sequences increase confidence
- **Common Words**: Shared important words (brand, model, key features)
- **Word Variations**: Handles synonyms (laptop/notebook, phone/smartphone)
- **Punctuation**: Ignores differences in punctuation and spacing
- **Stop Words**: Filters out common words (the, a, an, with)

#### When Fuzzy Matching Works Best

- **Descriptive Titles**: Products with detailed, descriptive names
- **Unique Products**: Products with distinctive features in the title
- **Consistent Terminology**: When you and competitors use similar language
- **No SKU/Model Data**: When structured data isn't available

#### Fuzzy Matching Examples

**High Confidence Match (85%):**
```typescript
Your Product: "Samsung 65-Inch 4K Smart TV with HDR"
Competitor: "Samsung 65\" 4K UHD Smart Television HDR"
// High similarity: same brand, size, key features
```

**Medium Confidence Match (75%):**
```typescript
Your Product: "Wireless Bluetooth Headphones - Noise Cancelling"
Competitor: "Bluetooth Wireless Headset with Active Noise Cancellation"
// Medium similarity: same product type, similar features, different wording
```

**Low Confidence Match (65%):**
```typescript
Your Product: "Men's Running Shoes - Size 10"
Competitor: "Athletic Sneakers for Men"
// Low similarity: generic terms, missing specific details
```

#### Limitations of Fuzzy Matching

Fuzzy matching can produce false positives when:

- **Generic Titles**: "Laptop Computer" matches many different laptops
- **Similar Products**: Different models from the same brand
- **Missing Details**: Titles lack specific identifying information
- **Different Variants**: Same product but different colors, sizes, or configurations

**Always review fuzzy matches** with confidence scores below 85%.

### 4. Manual Override

When automatic matching fails or produces incorrect results, you can manually link your products to competitor products. Manual matching gives you complete control and produces the highest confidence matches.

#### How Manual Matching Works

Manual matching allows you to:

1. **Create New Matches**: Link products that automatic matching missed
2. **Override Automatic Matches**: Replace incorrect automatic matches
3. **Verify Uncertain Matches**: Confirm suggested matches with low confidence
4. **Handle Edge Cases**: Match products with unusual characteristics

**Confidence Score**: 100% (user-verified)

#### When to Use Manual Matching

Use manual matching when:

- **No Automatic Match Found**: The system couldn't find a match automatically
- **Incorrect Automatic Match**: The system matched the wrong product
- **Low Confidence Match**: Automatic match has confidence below 80%
- **Variant Products**: Matching specific variants (colors, sizes, configurations)
- **New Products**: Recently added products not yet in competitor catalogs
- **Custom Products**: Unique or customized products

#### Manual Matching Process

**Step 1: Access Product Matching Dashboard**

Navigate to: **Products → Product Matching**

**Step 2: Find Unmatched Products**

Filter the product list:
- Status: "Unmatched" or "Low Confidence"
- Sort by: Priority, date added, or product value

**Step 3: Search for Competitor Product**

For each unmatched product:
1. Click **Manual Match** button
2. Search competitor products by:
   - Product name
   - SKU
   - Brand and model
   - URL (if you know the competitor product page)

**Step 4: Review and Confirm**

Before confirming the match:
- **Compare Product Details**: Verify it's the exact same product
- **Check Specifications**: Ensure specs match (size, color, model, etc.)
- **Review Images**: Visual confirmation helps prevent errors
- **Verify Price Range**: Ensure prices are in a reasonable range

**Step 5: Create the Match**

1. Select the correct competitor product
2. Add optional notes explaining the match
3. Click **Confirm Match**
4. The match is created with 100% confidence

#### Manual Matching Best Practices

**Do's:**

- **Verify Carefully**: Double-check you're matching the exact same product
- **Add Notes**: Document why you made the match for future reference
- **Check Variants**: Ensure you're matching the same variant (color, size, etc.)
- **Review Regularly**: Periodically audit your manual matches
- **Use Product URLs**: When possible, reference the competitor product URL

**Don'ts:**

- **Don't Match Similar Products**: Only match identical products
- **Don't Rush**: Take time to verify each match
- **Don't Match Different Variants**: Different colors/sizes are different products
- **Don't Ignore Specifications**: Specs must match exactly
- **Don't Match Bundles**: Don't match single products to bundles

#### Manual Matching via API

Developers can create manual matches programmatically:

```bash
POST /api/v1/product-matches/manual
Content-Type: application/json
Authorization: Bearer YOUR_API_TOKEN

{
  "userProductId": "prod_123",
  "competitorProductId": "comp_prod_456",
  "notes": "Manually matched - same product, different SKU format"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "matchId": "match_789",
    "userProductId": "prod_123",
    "competitorProductId": "comp_prod_456",
    "matchType": "manual",
    "confidence": 100,
    "status": "active",
    "createdBy": "user_001",
    "createdAt": "2024-02-05T10:00:00Z"
  }
}
```

## Confidence Scoring System

Every product match in PricePilot receives a confidence score from 0 to 100, indicating how certain the system is that the match is correct. Understanding confidence scores helps you prioritize which matches to review and trust.

### Confidence Score Ranges

| Score Range | Confidence Level | Color Indicator | Meaning | Action Required |
|-------------|------------------|-----------------|---------|-----------------|
| 95-100 | Excellent | 🟢 Dark Green | Exact match (SKU or manual) | No review needed |
| 90-94 | Very High | 🟢 Green | Brand + Model match | Minimal review |
| 85-89 | High | 🟡 Light Green | Strong fuzzy match | Quick review recommended |
| 75-84 | Medium | 🟡 Yellow | Moderate fuzzy match | Review recommended |
| 70-74 | Low | 🟠 Orange | Weak fuzzy match | Review required |
| Below 70 | Very Low | 🔴 Red | Uncertain match | Manual verification required |

### How Confidence Scores Are Calculated

#### SKU Exact Match: 100

```typescript
if (yourProduct.sku === competitorProduct.sku) {
  confidence = 100;
  matchType = "sku_exact";
}
```

Perfect match - no ambiguity.

#### Brand + Model Match: 90-95

```typescript
if (yourProduct.brand === competitorProduct.brand &&
    yourProduct.model === competitorProduct.model) {
  
  // Base confidence: 90
  confidence = 90;
  
  // Bonus points for additional matching fields
  if (yourProduct.sku && competitorProduct.sku) {
    confidence += 2; // SKUs present but don't match
  }
  
  if (titleSimilarity > 0.8) {
    confidence += 3; // Titles also similar
  }
  
  matchType = "brand_model";
}
```

Very reliable - brand and model combination is usually unique.

#### Fuzzy Title Match: 70-89

```typescript
const titleSimilarity = calculateSimilarity(
  yourProduct.name,
  competitorProduct.name
);

if (titleSimilarity >= 0.70) {
  // Base confidence from similarity score
  confidence = Math.round(titleSimilarity * 100);
  
  // Bonus for matching brand
  if (yourProduct.brand === competitorProduct.brand) {
    confidence += 5;
  }
  
  // Bonus for matching key features
  if (hasMatchingFeatures(yourProduct, competitorProduct)) {
    confidence += 3;
  }
  
  // Cap at 89 for fuzzy matches
  confidence = Math.min(confidence, 89);
  
  matchType = "fuzzy_title";
}
```

Variable reliability - depends on title similarity and additional factors.

#### Manual Override: 100

```typescript
if (matchCreatedManually) {
  confidence = 100;
  matchType = "manual";
}
```

User-verified - highest confidence.

### Confidence Score Factors

Several factors influence confidence scores:

#### Positive Factors (Increase Confidence)

- **Exact SKU Match**: +100 (perfect match)
- **Brand Match**: +5 points
- **Model Match**: +5 points
- **High Title Similarity**: +0 to +15 points
- **Matching Key Features**: +3 points
- **Matching Price Range**: +2 points
- **Same Product Category**: +2 points

#### Negative Factors (Decrease Confidence)

- **Different Brands**: -10 points
- **Very Different Prices**: -5 points (suggests different products)
- **Different Categories**: -5 points
- **Missing Critical Data**: -3 points
- **Generic Titles**: -5 points (increases false positive risk)

### Interpreting Confidence Scores

#### Excellent Confidence (95-100)

**What It Means:**
- Exact match found (SKU or manual verification)
- No ambiguity about product identity
- Safe to use for automated price comparisons

**Recommended Action:**
- No review needed
- Trust these matches for automated pricing rules
- Use for bulk operations

**Example:**
```typescript
{
  matchId: "match_001",
  confidence: 100,
  matchType: "sku_exact",
  yourProduct: {
    sku: "LAPTOP-XPS-15-9520",
    name: "Dell XPS 15 Laptop"
  },
  competitorProduct: {
    sku: "LAPTOP-XPS-15-9520",
    name: "Dell XPS 15 9520"
  }
}
```

#### Very High Confidence (90-94)

**What It Means:**
- Brand and model match perfectly
- Very likely the same product
- Minor differences in title or SKU format

**Recommended Action:**
- Quick spot-check recommended
- Generally safe for automated pricing
- Review periodically (monthly)

**Example:**
```typescript
{
  matchId: "match_002",
  confidence: 92,
  matchType: "brand_model",
  yourProduct: {
    brand: "Apple",
    model: "iPhone 15 Pro Max",
    name: "Apple iPhone 15 Pro Max 256GB"
  },
  competitorProduct: {
    brand: "Apple",
    model: "iPhone 15 Pro Max",
    name: "iPhone 15 Pro Max - 256GB"
  }
}
```

#### High Confidence (85-89)

**What It Means:**
- Strong fuzzy title match
- Likely the same product
- Some minor differences in description

**Recommended Action:**
- Quick review recommended
- Verify it's the same product
- Check for variant differences (color, size)
- Safe for pricing after verification

**Example:**
```typescript
{
  matchId: "match_003",
  confidence: 87,
  matchType: "fuzzy_title",
  yourProduct: {
    name: "Samsung 65-Inch 4K Smart TV"
  },
  competitorProduct: {
    name: "Samsung 65\" 4K UHD Smart Television"
  }
}
```

#### Medium Confidence (75-84)

**What It Means:**
- Moderate similarity detected
- Could be the same product
- Requires verification before use

**Recommended Action:**
- Review required before using for pricing
- Verify product specifications match
- Check images if available
- Confirm it's not a similar but different product

**Example:**
```typescript
{
  matchId: "match_004",
  confidence: 78,
  matchType: "fuzzy_title",
  yourProduct: {
    name: "Wireless Bluetooth Headphones - Black"
  },
  competitorProduct: {
    name: "Bluetooth Wireless Headset - Noise Cancelling"
  }
}
```

#### Low Confidence (70-74)

**What It Means:**
- Weak similarity detected
- May or may not be the same product
- High risk of false positive

**Recommended Action:**
- Manual verification required
- Do not use for automated pricing
- Accept only if you can confirm it's the same product
- Consider rejecting and manual matching instead

#### Very Low Confidence (Below 70)

**What It Means:**
- Very weak or no similarity
- Likely not the same product
- System is uncertain

**Recommended Action:**
- Reject the match
- Use manual matching if you know the correct competitor product
- Mark as "No Competitor Product" if competitor doesn't carry it

### Using Confidence Scores in Your Workflow

#### Filtering by Confidence

Use confidence filters to prioritize your review:

**High Priority Review (70-89):**
```typescript
// Review medium to high confidence matches first
GET /api/v1/product-matches?minConfidence=70&maxConfidence=89&status=pending
```

**Low Priority Review (90-94):**
```typescript
// Spot-check very high confidence matches
GET /api/v1/product-matches?minConfidence=90&maxConfidence=94&status=active
```

**Auto-Accept (95-100):**
```typescript
// Automatically accept excellent matches
GET /api/v1/product-matches?minConfidence=95&status=pending
```

#### Confidence-Based Automation

Configure different behaviors based on confidence:

```typescript
// Example automation rules
const automationRules = {
  autoAccept: {
    minConfidence: 95,
    action: "accept_automatically"
  },
  requireReview: {
    minConfidence: 70,
    maxConfidence: 94,
    action: "flag_for_review"
  },
  autoReject: {
    maxConfidence: 69,
    action: "reject_automatically"
  }
};
```

### Improving Confidence Scores

To get higher confidence scores across your catalog:

1. **Populate SKU Fields**: Always include manufacturer SKUs
2. **Add Brand and Model**: Complete these fields for all products
3. **Use Descriptive Titles**: Include key identifying information
4. **Standardize Naming**: Use consistent formats across your catalog
5. **Include Specifications**: Add detailed product specifications
6. **Regular Data Cleanup**: Keep product data accurate and up-to-date

## Match Review Process

Reviewing and managing product matches is essential for maintaining accurate price comparisons. PricePilot provides comprehensive tools for reviewing automatic matches, accepting suggestions, and managing your match quality.

### Accessing the Match Review Dashboard

Navigate to: **Products → Product Matching**

The dashboard displays all your product matches organized by status:

- **Active Matches**: Currently active and being used for price comparison
- **Pending Matches**: Suggested matches awaiting your review
- **Rejected Matches**: Matches you've rejected as incorrect
- **Unmatched Products**: Products with no matches found

### Understanding Match Statuses

#### Active Matches

**Status**: `active`

Matches that are currently being used for price comparison:

- Confidence ≥ 90% (auto-accepted)
- Manually created matches
- Reviewed and accepted suggested matches

**What Happens:**
- Competitor prices are tracked
- Price comparisons are calculated
- Pricing rules can trigger based on these matches
- Included in reports and analytics

#### Pending Matches

**Status**: `pending`

Suggested matches awaiting your review:

- Confidence 70-89% (requires review)
- Recently discovered matches
- Matches flagged for verification

**What Happens:**
- Not used for price comparison yet
- Awaiting your accept/reject decision
- Displayed in review queue
- Can be bulk processed

#### Rejected Matches

**Status**: `rejected`

Matches you've determined are incorrect:

- Manually rejected by you
- Confidence below threshold (if auto-reject enabled)
- Identified as false positives

**What Happens:**
- Not used for price comparison
- Removed from active matching
- Kept in history for audit
- Won't be suggested again

#### Unmatched Products

**Status**: `unmatched`

Products with no matches found:

- No automatic match discovered
- All suggested matches rejected
- New products not yet matched
- Products unique to your catalog

**What Happens:**
- No price comparison available
- Displayed in unmatched queue
- Available for manual matching
- Periodically re-evaluated

### Reviewing Automatic Matches

#### High Confidence Matches (90-100)

These matches are automatically accepted but should be spot-checked periodically:

**Monthly Audit Process:**

1. Filter matches by confidence: 90-100
2. Sort by date created (newest first)
3. Review 10-20 random matches
4. Verify products are correctly matched
5. Reject any incorrect matches found

**What to Check:**
- Product names match
- Specifications are identical
- Images show the same product (if available)
- Prices are in reasonable range

**Red Flags:**
- Prices vastly different (>50% difference)
- Different product categories
- Different brands
- Obviously different products

#### Medium Confidence Matches (70-89)

These matches require your review before being used:

**Review Process:**

1. Navigate to **Pending Matches**
2. Filter by confidence: 70-89
3. Review each match individually
4. Accept correct matches
5. Reject incorrect matches

**Detailed Review Steps:**

**Step 1: Compare Product Information**

Side-by-side comparison of:
- Product names
- Brand and model
- SKU (if available)
- Key specifications
- Product category

**Step 2: Visual Verification**

If product images are available:
- Compare product images
- Check for visual differences
- Verify it's the exact same product
- Look for variant differences (color, size)

**Step 3: Price Sanity Check**

Compare prices:
- Are prices in a reasonable range?
- Vast price differences suggest different products
- Consider market positioning differences

**Step 4: Make Decision**

Based on your review:
- **Accept**: If you're confident it's the same product
- **Reject**: If it's clearly a different product
- **Research**: If uncertain, check competitor website directly

### Accepting Matches

When you've verified a match is correct:

**Via Dashboard:**

1. Find the match in your review queue
2. Click the **Accept** button
3. The match status changes to `active`
4. The match is now used for price comparison

**Via API:**

```bash
POST /api/v1/product-matches/accept
Content-Type: application/json
Authorization: Bearer YOUR_API_TOKEN

{
  "matchId": "match_123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "matchId": "match_123",
    "status": "active",
    "confidence": 100,
    "acceptedBy": "user_001",
    "acceptedAt": "2024-02-05T10:00:00Z"
  }
}
```

**What Happens After Accepting:**

1. Match confidence is set to 100 (user-verified)
2. Match status changes to `active`
3. Competitor price tracking begins
4. Match is included in price comparisons
5. Pricing rules can now trigger for this product
6. Match appears in active matches list

### Rejecting Matches

When you've determined a match is incorrect:

**Via Dashboard:**

1. Find the incorrect match
2. Click the **Reject** button
3. Optionally add a rejection reason
4. Confirm the rejection

**Via API:**

```bash
POST /api/v1/product-matches/reject
Content-Type: application/json
Authorization: Bearer YOUR_API_TOKEN

{
  "matchId": "match_123",
  "reason": "Different product variant - competitor has 256GB, we have 512GB"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "matchId": "match_123",
    "status": "rejected",
    "rejectedBy": "user_001",
    "rejectedAt": "2024-02-05T10:00:00Z",
    "reason": "Different product variant - competitor has 256GB, we have 512GB"
  }
}
```

**What Happens After Rejecting:**

1. Match status changes to `rejected`
2. Match is removed from active matches
3. Price comparison stops for this match
4. Product returns to unmatched queue
5. Match won't be suggested again
6. You can create a manual match if needed

### Bulk Match Review

When dealing with many pending matches, use bulk operations:

#### Bulk Accept

Accept multiple matches at once:

**Via Dashboard:**

1. Navigate to **Pending Matches**
2. Filter to show matches you want to accept
3. Select matches using checkboxes
4. Click **Accept Selected (X)**
5. Review the confirmation dialog
6. Click **Confirm** to accept all

**Via API:**

```bash
POST /api/v1/product-matches/bulk-accept
Content-Type: application/json
Authorization: Bearer YOUR_API_TOKEN

{
  "matchIds": [
    "match_001",
    "match_002",
    "match_003"
  ]
}
```

**Best Practices for Bulk Accept:**

- Only bulk accept matches with confidence ≥ 85%
- Review a sample before bulk accepting
- Use filters to group similar matches
- Accept by category or brand for consistency
- Verify a few matches after bulk operation

#### Bulk Reject

Reject multiple incorrect matches:

**Via Dashboard:**

1. Filter to show matches you want to reject
2. Select matches using checkboxes
3. Click **Reject Selected (X)**
4. Optionally add a rejection reason
5. Confirm the rejection

**Via API:**

```bash
POST /api/v1/product-matches/bulk-reject
Content-Type: application/json
Authorization: Bearer YOUR_API_TOKEN

{
  "matchIds": [
    "match_004",
    "match_005"
  ],
  "reason": "Generic titles causing false matches"
}
```

### Updating Existing Matches

Sometimes you need to change an existing match:

#### Change a Match

Replace an incorrect match with the correct competitor product:

**Via Dashboard:**

1. Find the active match you want to change
2. Click **Change Match**
3. Search for the correct competitor product
4. Select the new competitor product
5. Confirm the change

**Via API:**

```bash
PUT /api/v1/product-matches/update
Content-Type: application/json
Authorization: Bearer YOUR_API_TOKEN

{
  "matchId": "match_123",
  "newCompetitorProductId": "comp_prod_789",
  "reason": "Correcting to match exact variant"
}
```

**What Happens:**

1. Old match is marked as `replaced`
2. New match is created with confidence 100
3. Price tracking switches to new competitor product
4. Historical data is preserved
5. Audit log records the change

#### Delete a Match

Remove a match entirely:

**Via Dashboard:**

1. Find the match you want to delete
2. Click **Delete Match**
3. Confirm the deletion

**Via API:**

```bash
DELETE /api/v1/product-matches/match_123
Authorization: Bearer YOUR_API_TOKEN
```

**When to Delete:**

- Competitor no longer carries the product
- Product discontinued on both sides
- Match was created in error
- Cleaning up old matches

### Match Review Best Practices

#### Establish a Review Schedule

**Daily Review (Recommended):**
- Review new pending matches (5-10 minutes)
- Accept high-confidence matches quickly
- Flag complex matches for deeper review

**Weekly Deep Dive:**
- Review all pending matches
- Audit sample of active matches
- Address unmatched products
- Clean up rejected matches

**Monthly Audit:**
- Comprehensive review of all active matches
- Verify match quality
- Update matches as needed
- Analyze match statistics

#### Prioritize Your Review

Focus on high-impact matches first:

**Priority 1: High-Value Products**
- Products with highest revenue
- Best-selling products
- Strategic products

**Priority 2: Expiring Matches**
- Pending matches about to expire
- Matches flagged for review
- Recently changed competitor products

**Priority 3: Low-Confidence Matches**
- Matches with confidence 70-79
- Fuzzy matches needing verification
- Matches with price anomalies

**Priority 4: Routine Maintenance**
- Spot-checking active matches
- Reviewing rejected matches
- Addressing unmatched products

#### Use Filters Effectively

Leverage filters to streamline your review:

**By Confidence:**
```
- 95-100: Spot-check only
- 85-94: Quick review
- 75-84: Detailed review
- 70-74: Careful verification
```

**By Status:**
```
- Pending: Requires action
- Active: Periodic audit
- Rejected: Review for patterns
- Unmatched: Manual matching needed
```

**By Date:**
```
- Newest first: Stay current
- Oldest first: Clear backlog
- Expiring soon: Prevent loss
```

**By Product Category:**
```
- Review by category for consistency
- Apply category-specific knowledge
- Batch similar products together
```

### Match Quality Metrics

Monitor these metrics to assess match quality:

#### Overall Match Rate

```typescript
matchRate = (matchedProducts / totalProducts) * 100
// Target: > 80%
```

#### Average Confidence Score

```typescript
avgConfidence = sum(allConfidenceScores) / totalMatches
// Target: > 90
```

#### Manual Match Percentage

```typescript
manualMatchRate = (manualMatches / totalMatches) * 100
// Target: < 20%
```

#### Rejection Rate

```typescript
rejectionRate = (rejectedMatches / totalSuggestedMatches) * 100
// Target: < 10%
```

#### Review Backlog

```typescript
backlog = pendingMatches
// Target: < 50 or < 5% of total products
```

### Troubleshooting Match Review

#### Too Many Pending Matches?

**Solutions:**
1. Use bulk operations to clear backlog
2. Increase auto-accept confidence threshold
3. Improve product data quality
4. Schedule dedicated review time
5. Consider hiring additional reviewers

#### High Rejection Rate?

**Possible Causes:**
- Poor product data quality
- Generic product titles
- Missing SKU/brand/model data
- Competitor catalog very different

**Solutions:**
1. Improve product data completeness
2. Add SKUs to all products
3. Populate brand and model fields
4. Use more descriptive product titles
5. Adjust matching algorithm thresholds

#### Matches Keep Breaking?

**Possible Causes:**
- Competitor changed product URLs
- Competitor discontinued products
- Competitor updated product information
- Scraping errors

**Solutions:**
1. Check scraping logs for errors
2. Verify competitor products still exist
3. Update matches to new competitor products
4. Enable notifications for broken matches

## Match Management Best Practices

Effective product matching is crucial for accurate price intelligence. Follow these best practices to maintain high-quality matches and maximize the value of PricePilot.

### Data Quality Best Practices

#### 1. Standardize SKUs

Use consistent SKU formats across your entire catalog:

**Good SKU Practices:**
```typescript
// Consistent format with clear structure
"LAPTOP-DELL-XPS15-001"
"LAPTOP-HP-ENVY13-002"
"PHONE-APPLE-IP15PM-003"

// Include manufacturer SKU when available
"MX-KEYS-MINI-920-010475" // Logitech official SKU
"SM-S918UZKAXAA" // Samsung official SKU
```

**Bad SKU Practices:**
```typescript
// Inconsistent formats
"laptop_dell_xps15"
"HP-ENVY-13"
"phone-003"

// Internal codes that competitors won't use
"INV-2024-001"
"PROD-KB-001"
```

**Benefits:**
- 100% confidence matches
- Automatic matching without review
- Reduced manual matching effort
- Scalable across large catalogs

#### 2. Complete Brand and Model Fields

Always populate both brand and model for every product:

**Good Practice:**
```typescript
product.brand = "Dell";
product.model = "XPS 15 9520";
product.name = "Dell XPS 15 Laptop - 9520 Model";
```

**Bad Practice:**
```typescript
product.brand = ""; // Empty
product.model = ""; // Empty
product.name = "Laptop Computer"; // Generic
```

**Benefits:**
- Enables brand + model matching (90-95% confidence)
- Reduces false positives
- Improves fuzzy matching accuracy
- Better product organization

#### 3. Use Descriptive Product Titles

Include key identifying information in product titles:

**Good Titles:**
```typescript
"Samsung 65-Inch 4K Smart TV - Model UN65TU8000"
"Apple iPhone 15 Pro Max 256GB - Natural Titanium"
"Sony WH-1000XM5 Wireless Noise-Cancelling Headphones - Black"
```

**Bad Titles:**
```typescript
"TV" // Too generic
"Phone" // No identifying information
"Headphones - Black" // Missing brand and model
```

**Include in Titles:**
- Brand name
- Model number
- Key specifications (size, capacity, color)
- Product type
- Distinguishing features

#### 4. Maintain Data Consistency

Keep product information consistent with industry standards:

**Brand Name Consistency:**
```typescript
// Choose one format and stick with it
"HP" (not "Hewlett-Packard" or "HP Inc.")
"LG" (not "LG Electronics")
"Samsung" (not "Samsung Electronics")
```

**Model Number Consistency:**
```typescript
// Match the format competitors use
"iPhone 15 Pro Max" (not "iPhone15ProMax" or "15 Pro Max")
"XPS 15 9520" (not "XPS-15-9520" or "XPS15 9520")
```

#### 5. Regular Data Audits

Schedule regular reviews of your product data:

**Weekly:**
- Check new products for complete data
- Verify SKUs are populated
- Ensure brand/model fields are filled

**Monthly:**
- Audit product titles for consistency
- Update discontinued products
- Clean up duplicate entries
- Verify data accuracy

**Quarterly:**
- Comprehensive data quality review
- Standardize naming conventions
- Update product categories
- Align with industry standards

### Matching Strategy Best Practices

#### 1. Review Low-Confidence Matches

Always review matches with confidence < 90%:

**Review Process:**
```typescript
if (match.confidence < 90) {
  // Requires manual review
  requiresReview = true;
  
  // Check these factors:
  - Compare product specifications
  - Verify images match (if available)
  - Check price reasonableness
  - Confirm same product variant
}
```

**Don't Auto-Accept:**
- Matches with confidence 70-89
- Fuzzy matches without verification
- Matches with price anomalies
- Generic product matches

#### 2. Verify Variant Matches

Ensure you're matching the exact same variant:

**Check These Variant Factors:**
- **Color**: "Black" vs "White" vs "Silver"
- **Size**: "Small" vs "Medium" vs "Large"
- **Capacity**: "128GB" vs "256GB" vs "512GB"
- **Configuration**: "Base Model" vs "Pro" vs "Max"
- **Bundle Status**: "Single Item" vs "Bundle Pack"

**Example:**
```typescript
// These are DIFFERENT products - don't match
yourProduct: "iPhone 15 Pro Max 256GB - Black"
competitorProduct: "iPhone 15 Pro Max 512GB - Black"
// Different storage capacity = different product
```

#### 3. Handle Bundles Carefully

Don't match single products to bundles:

**Incorrect Match:**
```typescript
yourProduct: "Wireless Mouse"
competitorProduct: "Wireless Mouse + Keyboard Bundle"
// Don't match - different products
```

**Correct Approach:**
- Match single items to single items
- Match bundles to identical bundles
- Create separate products for bundle variations

#### 4. Monitor Match Quality

Track match quality metrics:

**Key Metrics:**
```typescript
{
  totalProducts: 1000,
  matchedProducts: 850,      // 85% match rate
  unmatchedProducts: 150,    // 15% unmatched
  
  matchTypes: {
    skuExact: 400,           // 40% SKU matches
    brandModel: 300,         // 30% brand+model
    fuzzyTitle: 150,         // 15% fuzzy
    manual: 100              // 10% manual
  },
  
  avgConfidence: 92,         // Average 92%
  
  qualityMetrics: {
    highConfidence: 750,     // 75% high confidence (≥90)
    mediumConfidence: 100,   // 10% medium (70-89)
    needsReview: 50          // 5% needs review
  }
}
```

**Target Metrics:**
- Match rate: > 80%
- Average confidence: > 90
- High confidence matches: > 70%
- Manual matches: < 20%
- Unmatched products: < 20%

#### 5. Establish Review Workflows

Create systematic review processes:

**New Product Workflow:**
1. Product added to catalog
2. Automatic matching attempted
3. If confidence ≥ 90: Auto-accept
4. If confidence 70-89: Queue for review
5. If confidence < 70: Flag for manual matching
6. Review within 24 hours

**Ongoing Maintenance Workflow:**
1. Daily: Review new pending matches
2. Weekly: Audit active matches sample
3. Monthly: Comprehensive match quality review
4. Quarterly: Data quality improvement initiative

### Scaling Best Practices

#### For Small Catalogs (< 100 Products)

**Approach:**
- Review every match manually
- Focus on perfect accuracy
- Build high-quality match foundation
- Document matching decisions

**Time Investment:**
- Initial setup: 2-4 hours
- Ongoing maintenance: 30 minutes/week

#### For Medium Catalogs (100-1,000 Products)

**Approach:**
- Auto-accept high confidence matches (≥95)
- Review medium confidence matches (70-94)
- Use bulk operations for similar products
- Establish category-based workflows

**Time Investment:**
- Initial setup: 1-2 days
- Ongoing maintenance: 1-2 hours/week

#### For Large Catalogs (1,000-10,000 Products)

**Approach:**
- Prioritize high-value products
- Auto-accept matches ≥90 confidence
- Bulk review by category
- Focus on data quality improvement
- Use API for automation

**Time Investment:**
- Initial setup: 1-2 weeks
- Ongoing maintenance: 3-5 hours/week

#### For Enterprise Catalogs (> 10,000 Products)

**Approach:**
- Segment catalog by priority
- Automate high-confidence matches
- Dedicate team members to matching
- Implement advanced data quality processes
- Use API extensively for automation
- Consider ML-assisted matching

**Time Investment:**
- Initial setup: 1-2 months
- Ongoing maintenance: Dedicated team

### Automation Best Practices

#### Auto-Accept Thresholds

Configure automatic acceptance based on confidence:

```typescript
const autoAcceptConfig = {
  skuExact: {
    autoAccept: true,
    minConfidence: 100
  },
  brandModel: {
    autoAccept: true,
    minConfidence: 95
  },
  fuzzyTitle: {
    autoAccept: false, // Always review
    minConfidence: 90
  },
  manual: {
    autoAccept: true,
    minConfidence: 100
  }
};
```

#### Automated Workflows

Use API to automate matching workflows:

**Auto-Accept High Confidence:**
```bash
# Daily cron job to auto-accept high confidence matches
POST /api/v1/product-matches/auto-accept
Content-Type: application/json
Authorization: Bearer YOUR_API_TOKEN

{
  "minConfidence": 95,
  "matchTypes": ["sku_exact", "brand_model"]
}
```

**Auto-Reject Low Confidence:**
```bash
# Weekly cleanup of very low confidence matches
POST /api/v1/product-matches/auto-reject
Content-Type: application/json
Authorization: Bearer YOUR_API_TOKEN

{
  "maxConfidence": 65,
  "reason": "Confidence too low for reliable matching"
}
```

### Collaboration Best Practices

#### Team-Based Matching

For teams managing product matching:

**Define Roles:**
- **Matchers**: Review and accept/reject matches
- **Data Quality**: Maintain product data accuracy
- **Auditors**: Verify match quality
- **Administrators**: Configure matching rules

**Establish Communication:**
- Document matching decisions
- Share insights about competitor catalogs
- Discuss edge cases as a team
- Create internal matching guidelines

**Use Notes Effectively:**
```typescript
// Add notes when creating manual matches
{
  matchId: "match_123",
  notes: "Manually matched - competitor uses different SKU format but confirmed same product via image comparison"
}
```

#### Knowledge Sharing

Build institutional knowledge:

**Document Decisions:**
- Why certain matches were accepted
- Why others were rejected
- Patterns in competitor catalogs
- Category-specific matching rules

**Create Guidelines:**
- Internal matching standards
- Category-specific rules
- Variant handling procedures
- Edge case resolution

### Common Pitfalls to Avoid

#### Pitfall 1: Matching Different Variants

**Problem:**
```typescript
// These look similar but are different products
yourProduct: "iPhone 15 Pro 128GB"
competitorProduct: "iPhone 15 Pro 256GB"
// Different storage = different product
```

**Solution:** Always verify variant details match exactly

#### Pitfall 2: Trusting Low Confidence Matches

**Problem:**
```typescript
// Auto-accepting matches with confidence < 85%
if (match.confidence >= 70) {
  autoAccept(); // Risky!
}
```

**Solution:** Always review matches with confidence < 90%

#### Pitfall 3: Ignoring Price Anomalies

**Problem:**
```typescript
// Vastly different prices suggest different products
yourProduct.price = 999.99
competitorProduct.price = 99.99
// 10x price difference is a red flag
```

**Solution:** Investigate matches with large price differences

#### Pitfall 4: Generic Product Titles

**Problem:**
```typescript
// Generic titles cause false matches
product.name = "Laptop Computer"
// Matches hundreds of different laptops
```

**Solution:** Use specific, descriptive product titles

#### Pitfall 5: Neglecting Data Maintenance

**Problem:**
- Outdated product information
- Missing SKUs
- Inconsistent naming
- Discontinued products not removed

**Solution:** Regular data audits and cleanup

### Advanced Matching Techniques

#### Category-Specific Matching

Tailor matching strategies by product category:

**Electronics:**
- Prioritize SKU and model matching
- Verify specifications match
- Check for variant differences

**Apparel:**
- Match by brand, style number, and size
- Verify color matches
- Check for seasonal variations

**Books:**
- Match by ISBN (perfect match)
- Verify edition matches
- Check format (hardcover vs paperback)

**Generic Products:**
- Rely more on manual matching
- Use detailed descriptions
- Verify specifications carefully

#### Competitor-Specific Strategies

Different competitors may require different approaches:

**Competitor A: Good Data Quality**
- High auto-match rate expected
- Trust SKU matches
- Quick review process

**Competitor B: Poor Data Quality**
- Lower auto-match rate
- More manual matching needed
- Careful verification required

**Competitor C: Different Catalog**
- Many unmatched products expected
- Focus on overlap products
- Don't force matches

## Troubleshooting

### No Matches Found?

**Possible Causes:**
- Competitor doesn't carry the product
- SKU/brand/model mismatch
- Product name too different
- Missing product data

**Solutions:**
1. Verify competitor has the product
2. Check SKU consistency
3. Populate brand and model fields
4. Improve product title
5. Try manual matching
6. Mark as "No Competitor Product" if appropriate

### Too Many False Matches?

**Possible Causes:**
- Generic product names
- Missing brand/model information
- Similar but different products
- Low-quality product data

**Solutions:**
1. Add brand and model information
2. Use more specific product titles
3. Include distinguishing features
4. Reject incorrect matches
5. Improve SKU consistency
6. Review fuzzy matching thresholds

### Match Disappeared?

**Possible Causes:**
- Competitor product out of stock
- Competitor removed product
- Match was rejected
- Scraping error

**Solutions:**
1. Check competitor website directly
2. Review match history
3. Check scraping logs
4. Re-match if product returns
5. Update to new competitor product if replaced

### Matches Keep Breaking?

**Possible Causes:**
- Competitor changes product URLs frequently
- Competitor updates product information
- Scraping issues
- Product discontinued

**Solutions:**
1. Enable match change notifications
2. Check scraping logs for errors
3. Verify competitor products still exist
4. Update matches to new products
5. Consider more stable competitors

### Low Match Rate?

**Possible Causes:**
- Poor product data quality
- Unique product catalog
- Competitors carry different products
- Missing SKU/brand/model data

**Solutions:**
1. Improve product data completeness
2. Add SKUs to all products
3. Populate brand and model fields
4. Use descriptive product titles
5. Focus on products competitors carry
6. Consider adding more competitors

## Match Statistics

View matching performance in your dashboard:

```typescript
// Example statistics
{
  overview: {
    totalProducts: 1000,
    matchedProducts: 850,        // 85%
    unmatchedProducts: 150,      // 15%
    avgConfidence: 92            // 92%
  },
  
  byMatchType: {
    skuExact: 400,               // 40%
    brandModel: 300,             // 30%
    fuzzyTitle: 150,             // 15%
    manual: 100                  // 10%
  },
  
  byConfidence: {
    excellent: 700,              // 70% (95-100)
    veryHigh: 100,              // 10% (90-94)
    high: 50,                   // 5% (85-89)
    medium: 50,                 // 5% (75-84)
    low: 0                      // 0% (70-74)
  },
  
  byStatus: {
    active: 850,                // 85%
    pending: 50,                // 5%
    rejected: 100,              // 10%
    unmatched: 150              // 15%
  },
  
  qualityMetrics: {
    matchRate: 85,              // 85% of products matched
    autoMatchRate: 75,          // 75% auto-matched
    manualMatchRate: 10,        // 10% manually matched
    rejectionRate: 8,           // 8% of suggestions rejected
    avgReviewTime: 45           // 45 seconds per review
  }
}
```

## API Reference

### List Product Matches

```bash
GET /api/v1/product-matches?status=active&page=1&limit=50
Authorization: Bearer YOUR_API_TOKEN
```

**Query Parameters:**
- `status`: Filter by status (active, pending, rejected, unmatched)
- `minConfidence`: Minimum confidence score (0-100)
- `maxConfidence`: Maximum confidence score (0-100)
- `matchType`: Filter by match type (sku_exact, brand_model, fuzzy_title, manual)
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 20, max: 100)

### Create Manual Match

```bash
POST /api/v1/product-matches/manual
Content-Type: application/json
Authorization: Bearer YOUR_API_TOKEN

{
  "userProductId": "prod_123",
  "competitorProductId": "comp_prod_456",
  "notes": "Manually matched - verified via product specifications"
}
```

### Accept Match

```bash
POST /api/v1/product-matches/accept
Content-Type: application/json
Authorization: Bearer YOUR_API_TOKEN

{
  "matchId": "match_123"
}
```

### Reject Match

```bash
POST /api/v1/product-matches/reject
Content-Type: application/json
Authorization: Bearer YOUR_API_TOKEN

{
  "matchId": "match_123",
  "reason": "Different product variant"
}
```

### Bulk Operations

```bash
POST /api/v1/product-matches/bulk-accept
Content-Type: application/json
Authorization: Bearer YOUR_API_TOKEN

{
  "matchIds": ["match_001", "match_002", "match_003"]
}
```

## Next Steps

- Set up [Price Approval Workflow](/docs/pricing/price-approval-guide)
- Learn about [Price Update Strategies](/docs/pricing/update-strategies)
- Configure [Auto-Approval Rules](/docs/pricing/auto-approval-rules)
- Review [Scraping & Bot Protection](/docs/competitors/scraping-bot-protection)
- Check [Troubleshooting Guide](/docs/troubleshooting/common-issues)

## Support

Need help with product matching?

- **Documentation**: Browse our [complete documentation](/docs)
- **API Reference**: Check the [API documentation](/docs/pricing/api-documentation-index)
- **Support**: Contact our support team through your dashboard
- **Community**: Join our community forum for tips and best practices

---

**Last Updated**: February 5, 2024  
**Related Documentation**: [Product Setup](/docs/products/product-setup), [Price Approval Guide](/docs/pricing/price-approval-guide), [Auto-Approval Rules](/docs/pricing/auto-approval-rules)
