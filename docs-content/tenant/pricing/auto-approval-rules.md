---
title: "Auto-Approval Rules"
description: "Configure automated price change approvals with safety constraints and rule-based logic"
category: "pricing"
subcategory: null
tags: ["pricing", "automation", "rules", "auto-approval", "safety"]
author: "PricePilot Team"
lastReviewed: "2024-02-05"
relatedDocs: ["price-approval-guide", "update-strategies", "bulk-approval-optimization"]
---

# Auto-Approval Rules

## Overview

Auto-Approval Rules allow you to automate the price approval process for changes that meet specific criteria. Instead of manually reviewing every price change, you can configure rules that automatically approve changes you trust, while still maintaining safety constraints to protect your business.

### Why Use Auto-Approval Rules?

- **Save Time**: Eliminate manual review for routine price changes
- **Stay Competitive**: React to market changes faster with automated approvals
- **Maintain Control**: Set precise criteria for which changes get auto-approved
- **Safety First**: Built-in constraints prevent unwanted price changes
- **Focus on What Matters**: Spend your time reviewing complex or high-risk changes

### How Auto-Approval Works

The auto-approval process follows these steps:

**1. Price Change Generated**
- PricePilot analyzes competitor prices during the 24-hour sync cycle
- A recommended price change is calculated based on your pricing rules
- The change enters the approval workflow

**2. Rule Evaluation**
- The system evaluates all active auto-approval rules
- Rules are checked in priority order (highest priority first)
- Each rule's criteria are tested against the price change

**3. Automatic Decision**
- If a rule matches and all safety constraints pass, the change is auto-approved
- If no rules match, the change goes to manual review
- If safety constraints fail, the change goes to manual review

**4. Change Applied**
- Auto-approved changes are immediately pushed to your store
- All actions are logged for audit purposes
- You receive notifications about auto-approved changes

### When to Use Auto-Approval

Auto-approval is ideal for:

- **Small Price Adjustments**: Changes under a certain percentage threshold
- **Trusted Product Categories**: Categories where you're confident in your pricing strategy
- **Competitive Matching**: Automatically matching competitor prices within limits
- **High-Volume Products**: Fast-moving items where speed matters
- **Established Patterns**: Scenarios you've manually approved many times

### When to Use Manual Review

Manual review is better for:

- **Large Price Changes**: Significant increases or decreases
- **New Products**: Items without established pricing history
- **Strategic Products**: High-margin or flagship items
- **Volatile Markets**: When competitor prices fluctuate rapidly
- **Complex Scenarios**: Changes requiring business judgment

## Rule Creation

### Accessing Auto-Approval Rules

Navigate to the Auto-Approval Rules configuration:

**Dashboard → Settings → Pricing Rules → Auto-Approval**

The configuration page displays all your auto-approval rules and allows you to create new ones.

### Creating Your First Rule

Follow these steps to create an auto-approval rule:

#### Step 1: Name Your Rule

Give your rule a descriptive name that explains its purpose:

- **Good**: "Auto-approve small decreases in Electronics"
- **Good**: "Match competitor prices for Best Sellers"
- **Avoid**: "Rule 1" or "Test Rule"

#### Step 2: Define Criteria

Set the conditions that must be met for auto-approval:

**Change Direction**
- Price Decreases Only
- Price Increases Only
- Both Increases and Decreases

**Percentage Threshold**
- Maximum percentage change (e.g., 5%, 10%)
- Minimum percentage change (optional)

**Dollar Amount Threshold**
- Maximum dollar change (e.g., $10, $50)
- Minimum dollar change (optional)

**Product Filters**
- Specific categories
- Specific brands
- Specific products
- Price range (e.g., products $50-$500)

**Triggering Rules**
- Specific pricing rules that generated the change
- Rule types (undercut, match, margin-based)

#### Step 3: Set Safety Constraints

Configure safety limits to protect your business:

**Minimum Price Floor**
- Never drop below this price
- Can be absolute ($50) or percentage of cost (120% of cost)
- Prevents selling at a loss

**Maximum Discount Limit**
- Maximum percentage discount from original price
- Prevents excessive price drops
- Protects brand positioning

**Maximum Price Ceiling** (Optional)
- Never exceed this price
- Prevents pricing out of market
- Useful for price increase rules

**Margin Protection**
- Minimum profit margin percentage
- Ensures profitability
- Calculated from cost data

#### Step 4: Set Priority

Assign a priority level to your rule:

- **Priority 1-10**: Higher numbers = higher priority
- Rules are evaluated in priority order
- First matching rule wins
- Use priority to create rule hierarchies

#### Step 5: Enable and Save

- Toggle the rule to "Active"
- Save your configuration
- The rule takes effect immediately

### Common Rule Configurations

Here are examples of commonly used auto-approval rules:

#### Example 1: Small Competitive Decreases

**Use Case**: Automatically match small competitor price drops

**Configuration:**
```
Name: Auto-approve small competitive decreases
Direction: Price Decreases Only
Max Percentage Change: 5%
Max Dollar Change: $20
Product Filter: All products
Triggering Rules: Any undercut or match rule
Safety Constraints:
  - Minimum Price Floor: 110% of cost
  - Maximum Discount: 30% from original price
Priority: 5
Status: Active
```

**Result**: Automatically approves price decreases up to 5% or $20, ensuring you stay competitive while maintaining profitability.

#### Example 2: High-Volume Product Matching

**Use Case**: Keep best-selling products competitive automatically

**Configuration:**
```
Name: Auto-match prices for best sellers
Direction: Both Increases and Decreases
Max Percentage Change: 10%
Max Dollar Change: $50
Product Filter: Category = "Best Sellers"
Triggering Rules: Match competitor price rules
Safety Constraints:
  - Minimum Price Floor: $25
  - Maximum Discount: 40%
  - Minimum Margin: 15%
Priority: 8
Status: Active
```

**Result**: Automatically matches competitor prices for your best-selling products within defined limits.

#### Example 3: Electronics Category Automation

**Use Case**: Automate pricing for electronics where margins are thin

**Configuration:**
```
Name: Electronics auto-pricing
Direction: Price Decreases Only
Max Percentage Change: 3%
Max Dollar Change: $30
Product Filter: Category = "Electronics"
Triggering Rules: Undercut by $5 rule
Safety Constraints:
  - Minimum Price Floor: 105% of cost
  - Maximum Discount: 25%
Priority: 6
Status: Active
```

**Result**: Automatically approves small decreases in electronics to stay competitive in a price-sensitive category.

#### Example 4: Inventory Clearance Automation

**Use Case**: Automatically approve aggressive discounts for overstocked items

**Configuration:**
```
Name: Clearance item auto-approval
Direction: Price Decreases Only
Max Percentage Change: 30%
Max Dollar Change: $100
Product Filter: Tag = "Clearance" OR Stock > 50 units
Triggering Rules: Any pricing rule
Safety Constraints:
  - Minimum Price Floor: 80% of cost
  - Maximum Discount: 50%
Priority: 9
Status: Active
```

**Result**: Automatically approves larger discounts for items you need to clear, while still preventing selling below cost.

#### Example 5: Premium Product Protection

**Use Case**: Prevent automatic approvals for high-value items

**Configuration:**
```
Name: Manual review for premium products
Direction: N/A (This is an exclusion rule)
Product Filter: Price > $500 OR Category = "Premium"
Action: Force Manual Review
Priority: 10
Status: Active
```

**Result**: Ensures expensive or premium products always go through manual review, regardless of other rules.

### Rule Configuration via API

Developers can create and manage rules via the API:

#### Create Auto-Approval Rule

```bash
POST /api/v1/auto-approval-rules
Content-Type: application/json
Authorization: Bearer YOUR_API_TOKEN

{
  "name": "Auto-approve small decreases",
  "enabled": true,
  "priority": 5,
  "criteria": {
    "changeDirection": "decrease",
    "maxPercentageChange": 5,
    "maxDollarChange": 20,
    "productFilters": {
      "categories": ["Electronics", "Home Goods"]
    },
    "triggeringRules": ["undercut-rule-1", "match-rule-2"]
  },
  "safetyConstraints": {
    "minPriceFloor": {
      "type": "percentage_of_cost",
      "value": 110
    },
    "maxDiscount": 30,
    "minMargin": 10
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ruleId": "auto_rule_123",
    "name": "Auto-approve small decreases",
    "status": "active",
    "createdAt": "2024-02-05T10:00:00Z"
  }
}
```

#### Update Auto-Approval Rule

```bash
PATCH /api/v1/auto-approval-rules/auto_rule_123
Content-Type: application/json
Authorization: Bearer YOUR_API_TOKEN

{
  "criteria": {
    "maxPercentageChange": 7
  }
}
```

#### List Auto-Approval Rules

```bash
GET /api/v1/auto-approval-rules
Authorization: Bearer YOUR_API_TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rules": [
      {
        "ruleId": "auto_rule_123",
        "name": "Auto-approve small decreases",
        "enabled": true,
        "priority": 5,
        "matchCount": 145,
        "lastMatched": "2024-02-05T09:30:00Z"
      }
    ]
  }
}
```

## Safety Constraints

Safety constraints are the guardrails that protect your business when using auto-approval rules. They ensure that even automated decisions stay within acceptable boundaries.

### Understanding Safety Constraints

Safety constraints work as a final check before any price change is auto-approved:

1. **Rule Criteria Match**: The price change matches your rule criteria
2. **Safety Check**: All safety constraints are evaluated
3. **Pass/Fail Decision**:
   - If all constraints pass → Auto-approve
   - If any constraint fails → Send to manual review

### Types of Safety Constraints

#### Minimum Price Floor

Prevents prices from dropping too low.

**Configuration Options:**

**Absolute Dollar Amount**
```json
{
  "minPriceFloor": {
    "type": "absolute",
    "value": 50.00
  }
}
```
- Never drop below $50.00
- Simple and straightforward
- Good for products with known minimum values

**Percentage of Cost**
```json
{
  "minPriceFloor": {
    "type": "percentage_of_cost",
    "value": 120
  }
}
```
- Never drop below 120% of product cost
- Ensures minimum 20% markup
- Protects profitability automatically

**Percentage of Original Price**
```json
{
  "minPriceFloor": {
    "type": "percentage_of_original",
    "value": 70
  }
}
```
- Never drop below 70% of original price
- Prevents excessive discounting
- Maintains brand positioning

**Use Cases:**
- Prevent selling at a loss
- Maintain minimum profit margins
- Protect brand value
- Comply with MAP (Minimum Advertised Price) policies

#### Maximum Discount Limit

Prevents excessive price reductions.

**Configuration:**
```json
{
  "maxDiscount": 30
}
```

**How It Works:**
- Calculates discount from original/reference price
- If discount exceeds 30%, change goes to manual review
- Protects against race-to-the-bottom pricing

**Example:**
- Original Price: $100
- Maximum Discount: 30%
- Minimum Allowed Price: $70
- Proposed Price: $65 → Rejected, goes to manual review

**Use Cases:**
- Maintain brand positioning
- Prevent devaluing products
- Control promotional depth
- Protect profit margins

#### Maximum Price Ceiling

Prevents prices from going too high.

**Configuration:**
```json
{
  "maxPriceCeiling": {
    "type": "absolute",
    "value": 500.00
  }
}
```

**Use Cases:**
- Prevent pricing out of market
- Cap price increases
- Maintain competitive positioning
- Control inventory hike rules

#### Minimum Margin Protection

Ensures profitability on every sale.

**Configuration:**
```json
{
  "minMargin": 15
}
```

**How It Works:**
- Calculates profit margin: `(Price - Cost) / Price * 100`
- If margin falls below 15%, change goes to manual review
- Requires accurate cost data in your system

**Example:**
- Product Cost: $80
- Minimum Margin: 15%
- Minimum Price: $94.12 (to achieve 15% margin)
- Proposed Price: $90 → Rejected, margin only 11.1%

**Use Cases:**
- Ensure profitability
- Protect against loss-making sales
- Maintain business sustainability
- Account for operational costs

### Combining Multiple Constraints

You can (and should) use multiple safety constraints together:

**Example: Comprehensive Protection**
```json
{
  "safetyConstraints": {
    "minPriceFloor": {
      "type": "percentage_of_cost",
      "value": 115
    },
    "maxDiscount": 35,
    "minMargin": 12,
    "maxPriceCeiling": {
      "type": "absolute",
      "value": 999.99
    }
  }
}
```

**How Multiple Constraints Work:**
- ALL constraints must pass for auto-approval
- If ANY constraint fails, change goes to manual review
- Most restrictive constraint wins

**Evaluation Order:**
1. Check minimum price floor
2. Check maximum discount limit
3. Check minimum margin
4. Check maximum price ceiling
5. If all pass → Auto-approve
6. If any fail → Manual review

### Safety Constraint Best Practices

#### Start Conservative

When first implementing auto-approval:

- Set tight constraints initially
- Monitor results for a few weeks
- Gradually loosen constraints as you gain confidence
- Track which constraints are triggering most often

**Example Progression:**
- Week 1-2: Max 3% change, 120% of cost floor
- Week 3-4: Max 5% change, 115% of cost floor
- Week 5+: Max 7% change, 110% of cost floor

#### Use Cost-Based Floors

Percentage-of-cost floors are more robust than absolute values:

- Automatically adjust with cost changes
- Scale appropriately across product ranges
- Ensure profitability regardless of price point

#### Layer Your Protection

Use multiple complementary constraints:

- Price floor prevents going too low
- Discount limit prevents excessive cuts
- Margin protection ensures profitability
- Price ceiling prevents going too high

#### Monitor and Adjust

Regularly review constraint performance:

- Check how many changes are blocked by each constraint
- Identify constraints that are too restrictive
- Adjust based on business performance
- Consider seasonal adjustments

### Safety Constraint Violations

When a safety constraint is violated:

**What Happens:**
1. Auto-approval is blocked
2. Change is routed to manual review queue
3. Violation reason is logged
4. You receive a notification (if configured)

**Violation Details Include:**
- Which constraint was violated
- Current value vs. constraint limit
- Recommended action
- Override option (for administrators)

**Example Notification:**
```
Price Change Requires Manual Review

Product: Samsung Galaxy S24
Current Price: $899.99
Proposed Price: $749.99
Change: -16.7%

Violation: Maximum Discount Limit Exceeded
Constraint: 15% maximum discount
Actual: 16.7% discount

Action Required: Review and approve/reject manually
```

### Overriding Safety Constraints

Administrators can override constraints for specific changes:

**When to Override:**
- Special promotions or sales events
- Clearance of discontinued items
- Competitive response to market conditions
- Strategic pricing decisions

**How to Override:**
1. Review the change in manual queue
2. Click "Override Safety Constraints"
3. Provide justification
4. Approve the change
5. Override is logged for audit

**Important:** Overrides should be rare and well-documented.

## Rule Priority

When multiple auto-approval rules could match a price change, rule priority determines which rule is applied.

### How Priority Works

**Priority Levels:**
- Priority is set from 1 to 10
- Higher numbers = higher priority
- Priority 10 is evaluated first, then 9, 8, etc.

**Evaluation Process:**
1. System sorts rules by priority (highest first)
2. Evaluates each rule's criteria in order
3. First rule that matches is applied
4. Remaining rules are not evaluated

**Example:**
```
Rule A: Priority 8 - Auto-approve decreases < 5%
Rule B: Priority 6 - Auto-approve all changes in Electronics
Rule C: Priority 4 - Auto-approve decreases < 10%

Price Change: Electronics product, 7% decrease
Result: Rule B matches first (priority 6), change is auto-approved
```

### Strategic Use of Priority

#### High Priority (8-10): Exceptions and Overrides

Use high priority for rules that should take precedence:

**Example: Force Manual Review**
```
Priority 10: Premium products always require manual review
Priority 9: Large changes (>15%) always require manual review
```

These rules "catch" changes before other rules can auto-approve them.

#### Medium Priority (5-7): Standard Auto-Approval

Use medium priority for your main auto-approval rules:

**Example: Category-Specific Rules**
```
Priority 7: Electronics auto-approval (tight constraints)
Priority 6: Home Goods auto-approval (moderate constraints)
Priority 5: Accessories auto-approval (loose constraints)
```

#### Low Priority (1-4): Catch-All Rules

Use low priority for broad, permissive rules:

**Example: General Rules**
```
Priority 3: Auto-approve any decrease < 3%
Priority 2: Auto-approve any change < $5
Priority 1: Default rule for remaining changes
```

### Priority Strategies

#### Strategy 1: Exception-Based Hierarchy

Structure rules from most specific to most general:

```
Priority 10: Never auto-approve products > $1000
Priority 9: Never auto-approve increases > 10%
Priority 7: Auto-approve Electronics decreases < 5%
Priority 5: Auto-approve all decreases < 3%
Priority 3: Auto-approve all changes < $5
```

**Benefits:**
- Specific exceptions are caught first
- General rules handle remaining cases
- Easy to understand and maintain

#### Strategy 2: Category-Based Hierarchy

Organize by product category importance:

```
Priority 9: Premium category (strict rules)
Priority 7: Standard category (moderate rules)
Priority 5: Budget category (loose rules)
Priority 3: Clearance category (very loose rules)
```

**Benefits:**
- Different strategies per category
- Reflects business priorities
- Easy to adjust category-wide

#### Strategy 3: Risk-Based Hierarchy

Organize by risk level:

```
Priority 10: High-risk changes → Manual review
Priority 8: Medium-risk changes → Strict auto-approval
Priority 6: Low-risk changes → Standard auto-approval
Priority 4: Minimal-risk changes → Loose auto-approval
```

**Benefits:**
- Risk-appropriate handling
- Protects against costly mistakes
- Balances automation with control

### Multiple Rules Matching

Understanding what happens when multiple rules could match:

**Scenario:**
```
Rule A (Priority 7): Auto-approve Electronics decreases < 10%
Rule B (Priority 5): Auto-approve all decreases < 5%

Price Change: Electronics product, 4% decrease
```

**Result:**
- Both rules match the criteria
- Rule A is evaluated first (higher priority)
- Rule A matches and is applied
- Rule B is never evaluated
- Change is auto-approved under Rule A

**Key Point:** Only the first matching rule is applied.

### Priority Best Practices

#### Keep It Simple

Don't overcomplicate your priority structure:

- Use 3-5 priority levels, not all 10
- Group similar rules at the same priority
- Leave gaps for future rules (use 3, 6, 9 instead of 1, 2, 3)

#### Document Your Strategy

Maintain clear documentation:

- Explain your priority structure
- Document why each priority level is used
- Note any special cases or exceptions

#### Review Regularly

Periodically review rule priority:

- Check if rules are matching as expected
- Identify rules that never match (wrong priority?)
- Adjust based on business changes

#### Test Before Deploying

Test new rules before activating:

- Use the rule simulator (if available)
- Start with low priority to observe behavior
- Increase priority once confident

### Rule Priority Examples

#### Example 1: E-commerce Store

```
Priority 10: Manual review for products > $500
Priority 9: Manual review for increases > 15%
Priority 7: Auto-approve Best Sellers decreases < 10%
Priority 5: Auto-approve Electronics decreases < 5%
Priority 3: Auto-approve all decreases < 3%
```

**Logic:**
- Protect high-value items
- Prevent large increases
- Aggressive automation for best sellers
- Conservative automation for electronics
- Minimal automation for everything else

#### Example 2: Wholesale Business

```
Priority 10: Manual review for custom pricing clients
Priority 8: Auto-approve volume discount changes
Priority 6: Auto-approve seasonal adjustments
Priority 4: Auto-approve cost-based changes
Priority 2: Manual review for everything else
```

**Logic:**
- Special handling for key accounts
- Automate standard discount structures
- Automate predictable seasonal changes
- Automate cost-driven changes
- Default to manual review for safety

#### Example 3: Multi-Brand Retailer

```
Priority 10: Manual review for luxury brands
Priority 8: Auto-approve Brand A (tight constraints)
Priority 6: Auto-approve Brand B (moderate constraints)
Priority 4: Auto-approve Brand C (loose constraints)
Priority 2: Auto-approve private label (very loose)
```

**Logic:**
- Protect premium brand positioning
- Different automation levels per brand
- Reflects brand importance and margins
- Most aggressive with own brands

### Troubleshooting Priority Issues

**Problem: Rule never matches**

**Possible Causes:**
- Priority too low, higher-priority rule matching first
- Criteria too specific, no changes meet requirements
- Rule disabled or inactive

**Solutions:**
- Increase priority if rule should take precedence
- Broaden criteria to match more changes
- Check rule status and enable if needed

**Problem: Wrong rule matching**

**Possible Causes:**
- Priority too high, matching before intended rule
- Criteria too broad, catching unintended changes
- Multiple rules with overlapping criteria

**Solutions:**
- Adjust priority to correct order
- Narrow criteria to be more specific
- Review all rules for conflicts

**Problem: Too many manual reviews**

**Possible Causes:**
- High-priority exception rules too broad
- Safety constraints too restrictive
- Missing auto-approval rules for common scenarios

**Solutions:**
- Narrow exception rule criteria
- Loosen safety constraints slightly
- Add new auto-approval rules for common patterns

## Monitoring and Optimization

### Tracking Rule Performance

Monitor these metrics for each auto-approval rule:

**Match Rate**
- How many price changes matched this rule
- Percentage of total changes
- Trend over time

**Approval Rate**
- How many matched changes were auto-approved
- How many failed safety constraints
- Success rate percentage

**Business Impact**
- Revenue impact of auto-approved changes
- Margin impact
- Competitive positioning improvement

**Time Savings**
- Number of manual reviews avoided
- Estimated time saved
- Efficiency gains

### Rule Analytics Dashboard

Access rule performance data:

**Dashboard → Settings → Pricing Rules → Analytics**

**Available Reports:**
- Rule match frequency
- Safety constraint violations
- Auto-approval success rate
- Business impact analysis
- Time savings calculation

### Optimization Strategies

#### Identify Underperforming Rules

Rules that rarely match may need adjustment:

- Criteria too specific
- Priority too low
- Overlapping with other rules

**Action:** Broaden criteria or adjust priority

#### Identify Overactive Rules

Rules that match too often may be too broad:

- Catching unintended changes
- Bypassing important reviews
- Creating risk

**Action:** Narrow criteria or add constraints

#### Balance Automation and Control

Find the right balance for your business:

- Start with 20-30% auto-approval rate
- Gradually increase to 50-60% as confidence grows
- Maintain manual review for high-risk changes

#### Seasonal Adjustments

Adjust rules for seasonal patterns:

- Tighten constraints during peak season
- Loosen constraints during slow periods
- Create seasonal-specific rules

### A/B Testing Rules

Test rule variations to optimize performance:

1. Create two similar rules with different constraints
2. Assign equal priority
3. Monitor performance over 2-4 weeks
4. Keep the better-performing rule
5. Disable or adjust the other

**Example Test:**
- Rule A: Max 5% change, 115% cost floor
- Rule B: Max 7% change, 110% cost floor
- Compare: Approval rate, margin impact, revenue impact

### Continuous Improvement

Regularly refine your auto-approval strategy:

**Monthly Review:**
- Analyze rule performance metrics
- Identify optimization opportunities
- Adjust constraints and criteria
- Test new rule configurations

**Quarterly Strategy Review:**
- Assess overall auto-approval effectiveness
- Align rules with business goals
- Update for market changes
- Plan new automation opportunities

## Troubleshooting

### Rule Not Matching Expected Changes

**Possible Causes:**
- Criteria too specific
- Safety constraints too restrictive
- Rule priority too low
- Rule disabled

**Solutions:**
1. Review rule criteria and broaden if needed
2. Check safety constraints and adjust
3. Increase rule priority
4. Verify rule is enabled and active

### Too Many Changes Going to Manual Review

**Possible Causes:**
- Safety constraints too tight
- Missing auto-approval rules
- Rules too specific

**Solutions:**
1. Review safety constraint violation logs
2. Identify common patterns in manual queue
3. Create new rules for common patterns
4. Loosen constraints slightly

### Auto-Approved Changes Not Applying

**Possible Causes:**
- Store integration issues
- API errors
- Network problems

**Solutions:**
1. Check store connection status
2. Review API error logs
3. Test store API manually
4. Contact support if issues persist

### Unexpected Auto-Approvals

**Possible Causes:**
- Rule criteria too broad
- Safety constraints too loose
- Wrong rule priority

**Solutions:**
1. Review rule criteria and narrow
2. Tighten safety constraints
3. Adjust rule priority
4. Add exception rules if needed

## Best Practices

### Starting with Auto-Approval

**Week 1-2: Observation**
- Don't enable any auto-approval rules yet
- Review manual approval patterns
- Identify common scenarios you approve
- Note your decision criteria

**Week 3-4: First Rules**
- Create 1-2 conservative rules
- Set tight safety constraints
- Use low priority
- Monitor closely

**Week 5-8: Expansion**
- Add more rules based on patterns
- Gradually loosen constraints
- Increase priorities as confidence grows
- Aim for 20-30% auto-approval rate

**Week 9+: Optimization**
- Fine-tune existing rules
- Add specialized rules
- Optimize for 50-60% auto-approval rate
- Maintain manual review for high-risk changes

### Rule Configuration Tips

**Do:**
- Start conservative and gradually loosen
- Use descriptive rule names
- Document your reasoning
- Test rules before full deployment
- Monitor performance regularly
- Adjust based on results

**Don't:**
- Create overly complex rules
- Set constraints too loose initially
- Ignore safety constraint violations
- Forget to review rule performance
- Auto-approve everything blindly

### Safety First

Always prioritize safety over automation:

- When in doubt, send to manual review
- Use multiple safety constraints
- Start with tight constraints
- Monitor for unexpected approvals
- Maintain override capability

## Frequently Asked Questions

**Q: Can I disable auto-approval rules temporarily?**

A: Yes, you can disable any rule without deleting it. Simply toggle the rule to "Inactive" in the rule configuration. The rule will stop matching changes but remain configured for future use.

**Q: What happens if multiple rules match a change?**

A: Only the first matching rule (highest priority) is applied. Once a rule matches, evaluation stops and that rule's decision is used.

**Q: Can I auto-approve price increases?**

A: Yes, you can configure rules to auto-approve increases, decreases, or both. However, we recommend being more conservative with auto-approving increases due to potential customer impact.

**Q: How do I know which rule auto-approved a change?**

A: Every auto-approved change is logged with the rule that approved it. You can view this in the approval history and analytics dashboard.

**Q: Can I override an auto-approval after it's applied?**

A: Once a change is auto-approved and applied to your store, you'll need to manually adjust the price in your store or create a new pricing rule to generate a different recommendation.

**Q: What if I want to review all changes for a specific product?**

A: Create a high-priority exception rule that forces manual review for that product. Set the priority to 10 and configure it to match that specific product.

**Q: How many auto-approval rules can I create?**

A: There's no hard limit, but we recommend keeping it manageable (5-10 rules). Too many rules become difficult to maintain and understand.

**Q: Do auto-approval rules work with bulk operations?**

A: Auto-approval rules are evaluated individually for each price change. They don't affect bulk manual approvals, but they can reduce the number of changes that need bulk review.

**Q: Can I test a rule before enabling it?**

A: Yes, you can create a rule in "Inactive" status and use the rule simulator (if available) to see how it would have performed on historical changes.

**Q: What's the difference between auto-approval rules and pricing rules?**

A: Pricing rules determine what price changes to recommend. Auto-approval rules determine which of those recommendations to automatically approve. They work together in sequence.

## Related Documentation

- [Price Approval Workflow](/docs/pricing/price-approval-guide) - Manual approval process
- [Update Strategies](/docs/pricing/update-strategies) - Pricing strategies and rules
- [Bulk Approval Optimization](/docs/pricing/bulk-approval-optimization) - Efficient bulk operations
- [API Documentation](/docs/pricing/api-documentation-index) - Complete API reference

## Support

Need help with auto-approval rules?

- **Documentation**: Browse our [complete documentation](/docs)
- **API Reference**: Check the [API documentation](/docs/pricing/api-documentation-index)
- **Support**: Contact our support team through your dashboard
- **Community**: Join our community forum for tips and best practices
