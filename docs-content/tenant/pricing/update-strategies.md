---
title: "Price Update Strategies"
description: "Learn about different pricing strategies and how to apply them"
category: "pricing"
subcategory: null
tags: ["pricing", "strategies", "updates"]
author: "PricePilot Team"
lastReviewed: "2024-01-15"
relatedDocs: ["price-updates", "product-matching"]
---

# Price Update Strategies

Choose the right pricing strategy to stay competitive while maintaining profitability.

## Available Strategies

### 1. Fixed Undercut

Undercut competitor prices by a fixed dollar amount.

**Example:**
- Competitor price: $500
- Fixed undercut: $50
- Your new price: $450

**Best For:**
- High-value products
- Consistent margins
- Simple pricing rules

**Configuration:**
```
Strategy: Fixed Undercut
Amount: $50
```

### 2. Percentage Undercut

Undercut competitor prices by a percentage.

**Example:**
- Competitor price: $500
- Percentage undercut: 10%
- Your new price: $450

**Best For:**
- Variable product values
- Maintaining margin ratios
- Scalable pricing

**Configuration:**
```
Strategy: Percentage Undercut
Percentage: 10%
```

### 3. Match Competitor Price

Set your price equal to the competitor's price.

**Example:**
- Competitor price: $500
- Your new price: $500

**Best For:**
- Competitive parity
- Brand positioning
- Market testing

**Configuration:**
```
Strategy: Match Price
```

### 4. Custom Formula

Create custom pricing rules based on multiple factors.

**Example:**
```
IF competitor_price < $100 THEN
  my_price = competitor_price - $5
ELSE IF competitor_price < $500 THEN
  my_price = competitor_price * 0.95
ELSE
  my_price = competitor_price - $50
END IF
```

**Best For:**
- Complex pricing needs
- Multiple price tiers
- Advanced users

## Safety Constraints

### Minimum Price Floor

Prevent prices from dropping below your cost:

```
Minimum Price: $400
```

If calculated price would be $380, it stays at $400.

### Maximum Discount Limit

Cap the maximum discount you'll offer:

```
Maximum Discount: 20%
```

If calculated discount would be 25%, it's limited to 20%.

### Price Change Limits

Limit how much prices can change in a single update:

```
Max Price Increase: 10%
Max Price Decrease: 15%
```

## Strategy Selection Guide

### Consider These Factors

1. **Product Category**: Electronics vs clothing vs services
2. **Profit Margins**: High margin vs low margin products
3. **Competition Level**: Many competitors vs few competitors
4. **Brand Positioning**: Premium vs value vs budget
5. **Market Conditions**: Stable vs volatile pricing

### Decision Matrix

| Product Type | Margin | Competition | Recommended Strategy |
|--------------|--------|-------------|---------------------|
| Electronics | Low | High | Fixed Undercut ($10-$50) |
| Clothing | Medium | Medium | Percentage Undercut (5-10%) |
| Luxury | High | Low | Match Price or Premium |
| Commodities | Low | High | Percentage Undercut (2-5%) |

## Applying Strategies

### Single Product Update

1. Go to **Price Comparison** page
2. Select a product
3. Click **Update Price**
4. Choose strategy and settings
5. Review preview
6. Click **Apply**

### Bulk Update

1. Go to **Price Comparison** page
2. Filter products (e.g., "RED" status only)
3. Select multiple products
4. Click **Bulk Update**
5. Choose strategy for all selected
6. Review summary
7. Click **Apply to All**

### Automated Rules

Set up automatic price updates:

1. Go to **Settings** > **Pricing Rules**
2. Click **Create Rule**
3. Define conditions (e.g., "When competitor price drops")
4. Choose strategy
5. Set safety constraints
6. Enable rule

## Strategy Examples

### Example 1: Aggressive Competition

**Goal**: Win on price for commodity products

**Strategy:**
- Percentage Undercut: 5%
- Minimum Price: Cost + 10%
- Update Frequency: Every 6 hours
- Apply to: RED status products only

### Example 2: Maintain Margins

**Goal**: Stay competitive while protecting margins

**Strategy:**
- Fixed Undercut: $25
- Minimum Price: Cost + 25%
- Maximum Discount: 15%
- Update Frequency: Daily
- Apply to: All products

### Example 3: Premium Positioning

**Goal**: Position as premium alternative

**Strategy:**
- Match Price or +5%
- Minimum Price: Competitor price
- Update Frequency: Weekly
- Apply to: High-end products only

## Monitoring Strategy Performance

### Key Metrics

- **Conversion Rate**: Are lower prices driving more sales?
- **Profit Margin**: Are you maintaining target margins?
- **Competitive Position**: How often are you the lowest price?
- **Revenue Impact**: Overall revenue trend

### Adjusting Strategies

Review performance monthly and adjust:

1. **If sales are down**: Consider more aggressive undercut
2. **If margins are squeezed**: Increase minimum price floor
3. **If losing market share**: Reduce undercut amount
4. **If highly profitable**: Test premium positioning

## Best Practices

1. **Start Conservative**: Begin with smaller undercuts and adjust
2. **Set Safety Constraints**: Always use minimum price floors
3. **Monitor Closely**: Review results weekly for first month
4. **Test Different Strategies**: A/B test on product segments
5. **Consider Seasonality**: Adjust strategies for peak seasons
6. **Review Competitor Behavior**: Watch for price wars
7. **Protect Brand Value**: Don't undervalue premium products

## Advanced Techniques

### Dynamic Pricing

Adjust strategies based on:
- Time of day
- Day of week
- Inventory levels
- Competitor stock status
- Historical sales data

### Competitive Intelligence

Use PricePilot data to:
- Identify competitor pricing patterns
- Predict competitor price changes
- Optimize timing of price updates
- Segment competitors by aggressiveness

### Multi-Competitor Strategy

When tracking multiple competitors:
- **Match Lowest**: Always match the lowest competitor
- **Average Price**: Price based on competitor average
- **Selective Matching**: Match only specific competitors
- **Tiered Response**: Different strategies per competitor

## Related Documentation

- [Price Updates](price-updates)
- [Product Matching](../products/product-matching)
- [Competitor Tracking](../competitors/adding-competitors)
