# 📚 PricePilot Documentation

**Version 1.5** | Last Updated: February 2026

Welcome to PricePilot - Your intelligent e-commerce pricing automation platform.

---

## 📖 Table of Contents

1. [Introduction](#introduction)
2. [What's New in v1.5](#whats-new-in-v15)
3. [Getting Started](#getting-started)
4. [Platform Integrations](#platform-integrations)
5. [Features Overview](#features-overview)
6. [Auto-Approval Rules Guide](#auto-approval-rules-guide)
7. [Email Notifications](#email-notifications)
8. [Approval Delegation](#approval-delegation)
9. [Rollback Procedures](#rollback-procedures)
10. [Monitoring & Analytics](#monitoring--analytics)
11. [Security & Performance](#security--performance)
12. [API Reference](#api-reference)
13. [Data Retention & Privacy](#data-retention--privacy)
14. [Troubleshooting Guide](#troubleshooting-guide)
15. [FAQ](#faq)
16. [Support](#support)

---

## 🎯 Introduction

PricePilot is a professional-grade SaaS platform designed for e-commerce businesses to automate competitive pricing strategies. Monitor competitor prices in real-time, apply dynamic pricing rules, and maximize your profit margins while staying competitive.

### Key Benefits

- **Real-Time Monitoring**: Track competitor prices automatically every 24 hours
- **Automated Price Updates**: Apply pricing rules and update your store prices instantly
- **Multi-Platform Support**: Currently supports OpenCart and Laravel, with more platforms coming soon
- **Smart Matching**: Automatically match your products with competitor offerings
- **Analytics Dashboard**: Visualize your market position and pricing trends
- **Auto-Approval Rules**: Automate routine price approvals with intelligent conditions
- **Email Notifications**: Stay informed about price changes and approvals
- **Rollback Capability**: Undo incorrect price changes with one click
- **Enterprise Security**: AES-256 encryption, rate limiting, and comprehensive audit trails

---

## 🆕 What's New in v1.5

### Major Improvements (February 2026)

#### 🔒 Enhanced Security
- **API Token Encryption**: All API tokens now encrypted at rest with AES-256-GCM
- **Rate Limiting**: Comprehensive rate limiting on all endpoints (100 req/hour for API, 10 req/min for scraping)
- **Input Validation**: Enhanced validation and sanitization to prevent SQL injection and XSS attacks
- **Security Audit**: Complete security review and vulnerability fixes

#### ⚡ Performance Optimizations
- **Database Indexing**: Added 15+ strategic indexes for 10x faster queries
- **Redis Caching**: Implemented caching for expensive operations (1-hour TTL)
- **Query Optimization**: Eliminated N+1 query problems across all services
- **Pagination**: All list endpoints now support efficient pagination (max 100 items per page)

#### 🔄 Rollback System
- **Single Price Rollback**: Undo individual price changes with full audit trail
- **Bulk Operation Rollback**: Revert entire bulk operations in one click
- **Automatic Rollback**: Failed updates automatically rolled back to prevent data inconsistency
- **Rollback History**: Complete history of all rollback operations

#### 📧 Email Notifications
- **Pending Approval Alerts**: Get notified when price changes await review
- **Daily Approval Summary**: Receive daily digests of approval activity
- **Auto-Approval Notifications**: Stay informed about automated approvals
- **Delegation Notifications**: Alerts when approval authority is delegated

#### 👥 Approval Delegation
- **Temporary Delegation**: Delegate approval authority to team members
- **Date-Based Control**: Set start and end dates for delegations
- **Active Delegation Tracking**: View all active delegations in one place
- **Email Notifications**: Automatic notifications to delegates

#### 🛠️ Error Handling
- **Custom Error Classes**: Structured error handling with AppError, ValidationError, NotFoundError
- **User-Friendly Messages**: Clear, actionable error messages for all failures
- **Comprehensive Logging**: All errors logged with full context for debugging
- **Retry Logic**: Automatic retries for transient failures

#### 📊 Enhanced Monitoring
- **Real-Time Dashboards**: Live monitoring of scraping sessions and system health
- **Proxy Health Tracking**: Monitor proxy pool performance and success rates
- **Challenge Detection**: Track anti-bot challenge handling across sites
- **Performance Metrics**: Comprehensive metrics for all system operations

#### 🧪 Test Suite Optimization
- **Focused Testing**: Reduced to 20 essential tests covering core business logic
- **100% Critical Path Coverage**: All critical features fully tested
- **Fast Execution**: Test suite runs in under 1 minute
- **Edge Case Coverage**: Comprehensive testing of edge cases and error conditions

#### 📝 Documentation Updates
- **Complete API Documentation**: OpenAPI 3.0 spec with all endpoints documented
- **Integration Guides**: Step-by-step guides for OpenCart and Laravel
- **Troubleshooting Guide**: Common issues and solutions
- **Migration Guide**: Instructions for upgrading from previous versions

### Bug Fixes
- Fixed mock data fallbacks in production code
- Completed OpenCart and Laravel price update APIs
- Fixed scraper edge cases and memory leaks
- Improved product matching accuracy
- Enhanced pricing rules engine reliability

### Breaking Changes
- **None**: All changes are backward compatible with existing integrations

---

## 🚀 Getting Started

### 1. Create Your Account

1. Visit [PricePilot Dashboard](http://localhost:3000)
2. Sign up with your email address
3. Choose your plan (Basic, Premium, or Pro)
4. Verify your email address

### 2. Connect Your Store

1. Navigate to **Dashboard → Integrations**
2. Click **Connect Store**
3. Select your e-commerce platform
4. Enter your store URL
5. Configure API authentication (if required)
6. Click **Verify & Connect**

### 3. Add Competitors

1. Go to **Dashboard → Integrations**
2. Click **Add Competitor**
3. Enter competitor store URL
4. PricePilot will automatically start monitoring their prices

### 4. Set Up Pricing Rules

1. Navigate to **Dashboard → Pricing Rules**
2. Click **Create New Rule**
3. Choose your strategy:
   - **Undercut**: Stay below competitor by X amount/percentage
   - **Match**: Match competitor prices exactly
   - **Margin Lock**: Maintain minimum profit margin
   - **Threshold**: Set price boundaries
4. Set priority and activate the rule

---

## 🔌 Platform Integrations

### Supported Platforms

#### Currently Supported
- ✅ **OpenCart** - Fully Supported
- ✅ **Laravel** - Fully Supported

#### In Development
- 🚧 **Shopify** - Coming Soon
- 🚧 **WooCommerce** - Coming Soon
- 🚧 **Magento** - Coming Soon

#### Planned
- ⏳ **PrestaShop** - Planned for Future Release
- ⏳ **BigCommerce** - Planned for Future Release

### Laravel Integration

#### Getting the Package

The PricePilot Laravel package can be obtained in several ways:

**Option 1: Download from Dashboard (Recommended)**

1. Log in to your PricePilot account
2. Navigate to **Dashboard → Integrations → Laravel**
3. Click **Download Package** button
4. Extract the downloaded zip file to your Laravel project

**Option 2: Via Composer (If available)**

```bash
composer require pricepilot/laravel-client
```

> **Note**: Contact support@pricepilot.com for access to the package repository.

#### Installation

**Method 1: Using the Install Command (Easiest)**

1. **Download and extract** the package (from dashboard or Composer)

2. **Run the installation command**:

```bash
php artisan pricepilot:install
```

This will automatically:
- Publish the configuration file
- Generate a secure API token
- Add the token to your `.env` file
- Show you the next steps

3. **Copy the generated token** (shown in terminal output)

**Method 2: Manual Installation**

1. **Extract the package** to `packages/pricepilot/laravel-client/`

2. **Add to composer.json**:

```json
{
    "autoload": {
        "psr-4": {
            "PricePilot\\LaravelClient\\": "packages/pricepilot/laravel-client/src/"
        }
    }
}
```

3. **Run autoload**:

```bash
composer dump-autoload
```

4. **Publish configuration**:

```bash
php artisan vendor:publish --provider="PricePilot\LaravelClient\PricePilotServiceProvider"
```

5. **Generate API token** and add to `.env`:

```env
PRICEPILOT_API_TOKEN=your-secure-random-token-here
```

> **Generate token**: Use `openssl rand -base64 32` or `php -r "echo bin2hex(random_bytes(32));"`

6. Follow the on-page instructions to download, install, and get your API token.
7. Use the "Go back and Connect Store" button to return to the connections page.
8. Click **Verify & Connect** to finalize the link.

#### OpenCart Integration

**Connecting Your Store**

1. Log in to Your PricePilot account.
2. Navigate to **Dashboard &rarr; Integrations &rarr; OpenCart**.
3. Click **Download OpenCart Extension** to get the `.ocmod.zip` package.
4. Follow the installation steps on that page.
5. Once your API token is generated in your OpenCart sidebar, return to the **Connections** page.
6. Enter your Store URL and API Token.
7. Click **Verify & Connect**.

For technical details, see the OpenCart section below.

#### How It Works

The Laravel integration provides three API endpoints:

- **`GET /api/pricepilot/health`**: Health check and connection test
- **`GET /api/pricepilot/sync`**: Fetches your product catalog
- **`POST /api/pricepilot/update`**: Updates product prices

All requests are authenticated using the `X-PricePilot-Token` header.

#### Customization

The package is highly customizable via `config/pricepilot.php`:

- **Custom table names**: Change `products_table` to match your database
- **Column mapping**: Map your database columns to PricePilot fields
- **Active filtering**: Only sync active/published products
- **Logging**: Enable/disable detailed logging
- **Events**: Fire Laravel events on price updates

Example configuration:

```php
// config/pricepilot.php
'products_table' => 'my_products',
'column_mapping' => [
    'id' => 'product_id',
    'name' => 'product_name',
    'price' => 'selling_price',
],
'active_column' => 'is_active',
```

For detailed customization options, see the [Laravel Integration README](integrations/laravel/README.md).


### PHP Platform Integrations (OpenCart & Laravel)

For custom PHP platforms like OpenCart and Laravel, we provide dedicated integration packages.

**Flow Overview:**
1. **Initiate**: Click "Download" from the Connections page.
2. **Download & Install**: Follow the step-by-step guide on the specific integration page.
3. **Connect**: Use the provided "Back to Connections" link or bottom action button to return and enter your credentials.

> **Pro Tip**: Use the **Copy API Token** button in the OpenCart admin to ensure accuracy when connecting.

### Shopify Integration (Coming Soon)

Shopify integration is currently in development. We're working hard to bring you seamless Shopify support soon!

**Planned Features:**
- One-click installation from Shopify App Store
- Automatic authorization
- No manual token configuration needed

Stay tuned for updates!

---

## ⚡ Features Overview

### 1. Product Catalog

View and manage all your products in one place:

- Import products from your store automatically
- Manual product addition for competitors
- Bulk product management
- SKU and model-based matching

### 2. Competitor Monitoring

- Add unlimited competitor stores (based on your plan)
- Automatic price crawling every 24 hours
- Price history tracking
- Alert notifications for price changes

### 3. Product Matching

PricePilot uses intelligent algorithms to match your products with competitors:

- **Auto-Match by SKU**: Matches products with identical SKUs
- **Auto-Match by Model**: Matches by brand + model number
- **Manual Matching**: Override automatic matches

### 4. Pricing Rules

Create sophisticated pricing strategies:

| Strategy | Description | Example |
|----------|-------------|---------|
| **Undercut** | Stay below competitor by fixed amount or % | "Always $5 cheaper" |
| **Match** | Match competitor price exactly | "Same price as competitor" |
| **Margin Lock** | Maintain minimum profit margin | "Never below 20% margin" |
| **Threshold** | Set min/max price boundaries | "Between $50-$200" |
| **Percentage** | Adjust by percentage | "+10% of competitor price" |

### 5. Auto-Approval Rules

Automate your price approval workflow with intelligent rules:

- **Condition-Based Automation**: Set multiple conditions for automatic approvals
- **Priority System**: Control which rules apply first
- **Safety Constraints**: Prevent unintended price changes
- **Complete Audit Trail**: Track every auto-approval decision
- **Email Notifications**: Stay informed about automated changes

See the [Auto-Approval Rules Guide](#auto-approval-rules-guide) for detailed information.

### 6. Execution Engine

- Automatic price updates to your store
- Manual approval mode available
- Update logs and history
- Rollback capability

### 7. Analytics & Reports

- Position Summary (Cheapest/Neutral/Expensive)
- Price trend charts
- Competitor comparison
- Market share insights

---

## 🤖 Auto-Approval Rules Guide

### Overview

Auto-approval rules allow you to automate the price approval workflow by defining conditions under which price changes are automatically approved without manual review. This feature reduces manual workload while maintaining full control over your pricing decisions.

**Key Benefits:**
- **Save Time**: Automatically approve routine price changes
- **Stay Competitive**: Respond to competitor price changes faster
- **Maintain Control**: Set precise conditions for automation
- **Full Transparency**: Complete audit trail of all auto-approvals
- **Flexible Configuration**: Multiple rules with priority-based evaluation

### Getting Started with Auto-Approval Rules

#### Step 1: Navigate to Auto-Approval Rules

1. Log in to your PricePilot dashboard
2. Go to **Dashboard → Auto-Approval Rules**
3. Click **Create New Rule**

#### Step 2: Configure Your First Rule

**Basic Information:**
- **Name**: Give your rule a descriptive name (e.g., "Small Price Decreases")
- **Description**: Optional explanation of the rule's purpose
- **Enabled**: Toggle to activate/deactivate the rule
- **Priority**: Lower numbers = higher priority (evaluated first)

**Example Rule:**
```
Name: Auto-approve small decreases
Description: Automatically approve price decreases under $10
Priority: 1
Enabled: Yes
```

#### Step 3: Set Conditions

Rules support multiple condition types. **All conditions must be satisfied** for auto-approval (AND logic).

### Condition Types

#### 1. Maximum Price Change (Currency)

Approve changes only if the absolute price difference is within a limit.

**Example:**
- **Condition**: Max Price Change = $50
- **Behavior**: Auto-approve if |new price - old price| ≤ $50
- **Use Case**: "Only auto-approve changes under $50"

```
Old Price: $100
New Price: $120
Change: $20 ✅ Approved (under $50)

Old Price: $100
New Price: $160
Change: $60 ❌ Not approved (over $50)
```

#### 2. Maximum Percentage Change

Approve changes only if the percentage change is within a limit.

**Example:**
- **Condition**: Max Percentage Change = 10%
- **Behavior**: Auto-approve if |(new - old) / old × 100| ≤ 10%
- **Use Case**: "Only auto-approve changes under 10%"

```
Old Price: $100
New Price: $108
Change: 8% ✅ Approved (under 10%)

Old Price: $100
New Price: $115
Change: 15% ❌ Not approved (over 10%)
```

#### 3. Minimum Confidence Score

Approve changes only if the product match confidence is high enough.

**Example:**
- **Condition**: Min Confidence Score = 80
- **Behavior**: Auto-approve if match confidence ≥ 80
- **Use Case**: "Only auto-approve high-confidence matches"

```
Match Confidence: 95 ✅ Approved (≥ 80)
Match Confidence: 70 ❌ Not approved (< 80)
```

#### 4. Allowed Pricing Strategies

Approve changes only if they use specific pricing strategies.

**Example:**
- **Condition**: Allowed Strategies = ["UNDERCUT", "MATCH"]
- **Behavior**: Auto-approve only UNDERCUT or MATCH strategies
- **Use Case**: "Only auto-approve competitive pricing"

**Available Strategies:**
- `UNDERCUT`: Price below competitor
- `MATCH`: Match competitor price
- `MARGIN_LOCK`: Maintain profit margin
- `THRESHOLD`: Within price boundaries
- `PERCENTAGE`: Percentage-based adjustment

```
Strategy: UNDERCUT ✅ Approved (in allowed list)
Strategy: MARGIN_LOCK ❌ Not approved (not in list)
```

#### 5. Product Categories

Approve changes only for specific product categories.

**Example:**
- **Condition**: Categories = ["Electronics", "Computers"]
- **Behavior**: Auto-approve only for Electronics or Computers
- **Use Case**: "Only auto-approve tech products"

```
Product Category: Electronics ✅ Approved
Product Category: Clothing ❌ Not approved
```

#### 6. Price Range

Approve changes only if the new price falls within a range.

**Example:**
- **Condition**: Price Range = $50 - $500
- **Behavior**: Auto-approve if $50 ≤ new price ≤ $500
- **Use Case**: "Only auto-approve mid-range products"

```
New Price: $200 ✅ Approved (within range)
New Price: $600 ❌ Not approved (above range)
New Price: $30 ❌ Not approved (below range)
```

### Combining Conditions (AND Logic)

When you specify multiple conditions, **ALL must be satisfied** for auto-approval.

**Example Rule:**
```
Name: Safe small changes
Conditions:
  - Max Price Change: $20
  - Max Percentage Change: 5%
  - Min Confidence Score: 85
  - Allowed Strategies: ["UNDERCUT"]
```

**Evaluation:**
```
Scenario 1:
  Price Change: $15 ✅
  Percentage: 3% ✅
  Confidence: 90 ✅
  Strategy: UNDERCUT ✅
  Result: ✅ AUTO-APPROVED (all conditions met)

Scenario 2:
  Price Change: $15 ✅
  Percentage: 3% ✅
  Confidence: 90 ✅
  Strategy: MATCH ❌
  Result: ❌ NOT APPROVED (strategy not allowed)
```

### Priority System

When multiple rules are enabled, they are evaluated in **priority order** (lowest number first).

**How It Works:**
1. Rules are sorted by priority (ascending)
2. Each rule is evaluated in order
3. **First matching rule wins** (short-circuit evaluation)
4. If no rules match, the change stays PENDING

**Example:**
```
Rule 1 (Priority: 1):
  - Max Price Change: $10
  - Strategy: UNDERCUT

Rule 2 (Priority: 2):
  - Max Price Change: $50
  - Min Confidence: 90

Rule 3 (Priority: 3):
  - Max Percentage Change: 20%
```

**Evaluation for a $15 price change with UNDERCUT strategy:**
1. Check Rule 1: ❌ Fails ($15 > $10)
2. Check Rule 2: ✅ Matches (if confidence ≥ 90)
3. **Result**: Auto-approved by Rule 2 (Rule 3 never evaluated)

**Best Practice:** Order rules from most restrictive to least restrictive.

### Managing Rules

#### Enable/Disable Rules

Toggle rules on/off without deleting them:

1. Go to **Dashboard → Auto-Approval Rules**
2. Use the toggle switch next to each rule
3. Disabled rules are skipped during evaluation

**Use Cases:**
- Temporarily pause automation during sales events
- Test new rules before enabling
- Seasonal rule activation

#### Edit Rules

Modify existing rules:

1. Click the **Edit** button next to the rule
2. Update conditions, priority, or settings
3. Click **Save Changes**
4. Changes apply immediately to new pending changes

#### Delete Rules

Remove rules permanently:

1. Click the **Delete** button next to the rule
2. Confirm deletion
3. Rule is removed (cannot be undone)

**Note:** Deleting a rule does not affect previously auto-approved changes.

### Auto-Approval Workflow

#### How Auto-Approval Works

1. **Cron Job Runs**: Every hour, the system processes pending changes
2. **Load Rules**: Enabled rules are loaded for each tenant
3. **Evaluate Changes**: Each PENDING change is evaluated against rules
4. **Priority Order**: Rules are checked in priority order
5. **First Match**: First matching rule triggers auto-approval
6. **Execute Update**: Price is updated in your store
7. **Create Records**: Price history and audit log entries are created
8. **Send Notification**: Email notification sent (if enabled)

#### What Gets Auto-Approved

Only changes with **PENDING** status are evaluated. Changes that are:
- Already APPROVED (manually)
- Already REJECTED (manually)
- EXPIRED

...are **never** evaluated by auto-approval rules.

#### Manual Approval Takes Precedence

If you manually approve or reject a change before auto-approval runs, your decision is **final**. Auto-approval will skip that change.

**Example Timeline:**
```
10:00 AM - Price change detected (status: PENDING)
10:30 AM - You manually approve the change
11:00 AM - Auto-approval cron runs
Result: Change is skipped (already approved manually)
```

### Audit Trail & Transparency

Every auto-approval is fully logged for transparency and compliance.

#### Viewing Auto-Approved Changes

1. Go to **Dashboard → Price Approvals**
2. Look for the **"Auto-approved by: [Rule Name]"** badge
3. Click to view full details

**Information Displayed:**
- Which rule triggered the approval
- When the approval occurred
- Old price and new price
- Product details
- Match confidence score

#### Audit Logs

Complete audit trail available:

1. Go to **Dashboard → Audit Logs**
2. Filter by action: "AUTO_APPROVE_PRICE"
3. View detailed information:
   - Rule ID and name
   - Product ID
   - Old and new prices
   - Timestamp
   - Reason for approval

### Email Notifications

Stay informed about auto-approved changes.

#### Enabling Notifications

1. Go to **Dashboard → Settings → Notifications**
2. Enable **"Auto-Approval Notifications"**
3. Choose notification frequency:
   - **Immediate**: Email after each auto-approval run
   - **Daily Digest**: Once per day summary
   - **Weekly Digest**: Once per week summary

#### Notification Content

Emails include:
- Number of changes auto-approved
- Which rules triggered approvals
- Link to view details in dashboard
- Summary of affected products

**Example Email:**
```
Subject: PricePilot Auto-Approval Summary

Hello,

5 price changes were automatically approved in the last hour:

- "Small Price Decreases" rule: 3 changes
- "High Confidence Matches" rule: 2 changes

View details: [Dashboard Link]
```

### Metrics & Analytics

Track auto-approval effectiveness.

#### Auto-Approval Dashboard

View key metrics:

1. Go to **Dashboard → Auto-Approval Rules**
2. Click **View Metrics**

**Metrics Displayed:**
- **Total Auto-Approvals**: Count of all auto-approved changes
- **Auto-Approval Rate**: Percentage of changes auto-approved
- **Top Rules**: Most frequently triggered rules
- **Non-Matching Changes**: Changes that didn't match any rule

#### Per-Rule Statistics

See how each rule performs:

1. Go to **Dashboard → Auto-Approval Rules**
2. Each rule shows:
   - **Trigger Count**: How many times it's been used
   - **Last Triggered**: When it last matched
   - **Success Rate**: Percentage of successful updates

### Best Practices

#### Start Conservative

Begin with restrictive rules and gradually expand:

**Phase 1: High Confidence Only**
```
Rule: High Confidence Small Changes
- Max Price Change: $10
- Min Confidence Score: 95
- Priority: 1
```

**Phase 2: Add More Conditions**
```
Rule: Medium Confidence Moderate Changes
- Max Price Change: $25
- Max Percentage Change: 5%
- Min Confidence Score: 85
- Priority: 2
```

**Phase 3: Expand Gradually**
```
Rule: Larger Changes with Constraints
- Max Price Change: $50
- Allowed Strategies: ["UNDERCUT", "MATCH"]
- Price Range: $50 - $500
- Priority: 3
```

#### Use Multiple Rules

Create specific rules for different scenarios:

```
Rule 1: Tiny Changes (Priority 1)
- Max Price Change: $5
- Any confidence, any strategy

Rule 2: Electronics Only (Priority 2)
- Categories: ["Electronics"]
- Max Percentage Change: 10%
- Min Confidence: 80

Rule 3: High Confidence Any Amount (Priority 3)
- Min Confidence Score: 95
- Max Percentage Change: 15%
```

#### Monitor and Adjust

Regularly review auto-approval performance:

1. Check metrics weekly
2. Review audit logs for unexpected approvals
3. Adjust conditions based on results
4. Disable underperforming rules

#### Safety Guidelines

**Always Include:**
- At least one limiting condition (price change or percentage)
- Confidence score threshold for fuzzy matches
- Price range for high-value products

**Never Create:**
- Rules with no conditions (would approve everything)
- Rules that could cause significant losses
- Overlapping rules with unclear priority

### Troubleshooting

#### Changes Not Being Auto-Approved

**Check:**
1. ✅ Rule is enabled
2. ✅ Rule conditions match the change
3. ✅ Change status is PENDING (not already approved/rejected)
4. ✅ Cron job is running (check last run time)
5. ✅ No higher-priority rule is blocking

**Debug Steps:**
1. View the pending change details
2. Compare against rule conditions
3. Check audit logs for evaluation results
4. Test with a simpler rule first

#### Too Many Auto-Approvals

**Solutions:**
1. Add more restrictive conditions
2. Lower the max price change limit
3. Increase minimum confidence score
4. Reduce allowed strategies
5. Temporarily disable aggressive rules

#### Wrong Rule Triggering

**Issue:** Lower priority rule should match, but higher priority rule triggers first.

**Solution:**
1. Review rule priorities
2. Adjust priority numbers (lower = higher priority)
3. Make higher-priority rules more specific
4. Consider disabling conflicting rules

#### Store Update Failures

If auto-approved changes fail to update your store:

**Check:**
1. Store API connection is working
2. API token is valid
3. Store is accessible
4. Check error logs in audit trail

**Behavior:** Failed updates are automatically rolled back to PENDING status.

### Advanced Configuration

#### Seasonal Rules

Create rules for specific time periods:

**Holiday Season:**
```
Rule: Holiday Aggressive Pricing
- Max Percentage Change: 20%
- Allowed Strategies: ["UNDERCUT"]
- Priority: 1
- Enabled: Yes (during holidays)
```

**Regular Season:**
```
Rule: Conservative Pricing
- Max Percentage Change: 5%
- Min Confidence: 90
- Priority: 1
- Enabled: Yes (rest of year)
```

**Tip:** Enable/disable rules manually based on season, or create separate rules for different periods.

#### Category-Specific Rules

Different rules for different product types:

```
Rule: Electronics - Aggressive
- Categories: ["Electronics", "Computers"]
- Max Percentage Change: 15%
- Priority: 1

Rule: Clothing - Conservative
- Categories: ["Clothing", "Apparel"]
- Max Percentage Change: 5%
- Priority: 2

Rule: Everything Else - Moderate
- Max Percentage Change: 10%
- Priority: 3
```

#### Strategy-Based Rules

Different rules for different pricing strategies:

```
Rule: Undercut Only
- Allowed Strategies: ["UNDERCUT"]
- Max Price Change: $50
- Priority: 1

Rule: Match Only
- Allowed Strategies: ["MATCH"]
- Min Confidence: 95
- Priority: 2
```

### Security & Compliance

#### Data Security

- All rule evaluations are logged
- Audit trail is immutable
- API tokens are encrypted
- Tenant isolation enforced

#### Compliance

- Complete audit trail for all auto-approvals
- Rollback capability for all changes
- Manual override always available
- Email notifications for transparency

#### Access Control

- Only tenant users can create/edit rules
- Admin users have full access
- API authentication required
- Rate limiting enforced

### API Integration

Auto-approval rules can be managed via API:

**List Rules:**
```bash
GET /api/v1/auto-approval-rules
Authorization: Bearer <token>
```

**Create Rule:**
```bash
POST /api/v1/auto-approval-rules
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Small Changes",
  "enabled": true,
  "priority": 1,
  "conditions": {
    "maxPriceChange": 20,
    "minConfidenceScore": 85
  }
}
```

**Update Rule:**
```bash
PUT /api/v1/auto-approval-rules/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "enabled": false
}
```

**Toggle Rule:**
```bash
PATCH /api/v1/auto-approval-rules/:id/toggle
Authorization: Bearer <token>
```

**Get Metrics:**
```bash
GET /api/v1/auto-approval-rules/metrics
Authorization: Bearer <token>
```

For complete API documentation, see the [API Reference](#api-reference) section.

---

## 📧 Email Notifications

### Overview

Stay informed about price changes and approval activity with automated email notifications. PricePilot sends timely alerts to help you manage your pricing strategy effectively.

### Notification Types

#### 1. Pending Approval Notifications

Receive alerts when price changes are waiting for your review.

**Trigger**: When new pending price changes are detected
**Frequency**: Immediate (sent as soon as changes are pending)
**Content**:
- Number of pending changes
- Link to review changes in dashboard
- Summary of affected products

**Example Email:**
```
Subject: 5 Price Changes Awaiting Approval

You have 5 price changes waiting for your review.

Review Now: [Dashboard Link]
```

#### 2. Daily Approval Summary

Get a daily digest of all approval activity.

**Trigger**: Daily at 9:00 AM (your timezone)
**Frequency**: Once per day
**Content**:
- Approved changes count
- Rejected changes count
- Pending changes count
- Link to dashboard

**Example Email:**
```
Subject: Daily Price Approval Summary

Daily Price Approval Summary:
- Approved: 12
- Rejected: 3
- Pending: 5

View Details: [Dashboard Link]
```

#### 3. Auto-Approval Notifications

Stay informed about automatically approved price changes.

**Trigger**: After auto-approval processing runs
**Frequency**: Configurable (immediate, daily, or weekly)
**Content**:
- Number of auto-approved changes
- Which rules triggered approvals
- Link to view details
- Summary of affected products

**Example Email:**
```
Subject: PricePilot Auto-Approval Summary

5 price changes were automatically approved:
- "Small Price Decreases" rule: 3 changes
- "High Confidence Matches" rule: 2 changes

View Details: [Dashboard Link]
```

#### 4. Delegation Notifications

Get notified when approval authority is delegated to you.

**Trigger**: When someone delegates approval authority to you
**Frequency**: Immediate
**Content**:
- Who delegated authority
- Delegation period (start and end dates)
- Link to view delegations
- Instructions for approving on behalf of others

**Example Email:**
```
Subject: Approval Authority Delegated to You

John Doe has delegated approval authority to you from Feb 1 - Feb 7.

You can now approve price changes on their behalf.

View Delegations: [Dashboard Link]
```

#### 5. Sync Error Notifications

Receive alerts when product sync fails.

**Trigger**: When sync operation fails
**Frequency**: Immediate
**Content**:
- Store name and URL
- Error message
- Link to integrations page
- Troubleshooting tips

**Example Email:**
```
Subject: Product Sync Failed

Failed to sync products from your OpenCart store.

Error: Connection timeout

Check Integration: [Dashboard Link]
```

### Configuring Email Notifications

#### Enable/Disable Notifications

1. Go to **Dashboard → Settings → Notifications**
2. Toggle each notification type on/off:
   - ☑️ Pending Approval Alerts
   - ☑️ Daily Approval Summary
   - ☑️ Auto-Approval Notifications
   - ☑️ Delegation Notifications
   - ☑️ Sync Error Alerts
3. Click **Save Preferences**

#### Set Notification Frequency

For auto-approval notifications, choose your preferred frequency:

- **Immediate**: Email after each auto-approval run (hourly)
- **Daily Digest**: Once per day summary (9:00 AM)
- **Weekly Digest**: Once per week summary (Monday 9:00 AM)

**To Configure:**
1. Go to **Dashboard → Settings → Notifications**
2. Find **Auto-Approval Notification Frequency**
3. Select your preference
4. Click **Save**

#### Email Preferences

Customize your email experience:

- **Email Address**: Update your notification email address
- **Timezone**: Set your timezone for daily summaries
- **Quiet Hours**: Optionally set hours when you don't want notifications
- **Digest Format**: Choose between HTML or plain text emails

### SMTP Configuration (Self-Hosted)

If you're self-hosting PricePilot, configure SMTP settings:

**Environment Variables:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@pricepilot.com
```

**Supported Providers:**
- Gmail (with App Password)
- SendGrid
- Mailgun
- Amazon SES
- Any SMTP server

### Troubleshooting Email Notifications

#### Not Receiving Emails

**Check:**
1. ✅ Notifications are enabled in settings
2. ✅ Email address is correct
3. ✅ Check spam/junk folder
4. ✅ Email provider isn't blocking PricePilot
5. ✅ SMTP configuration is correct (self-hosted)

**Solutions:**
- Add noreply@pricepilot.com to your contacts
- Whitelist PricePilot domain in your email settings
- Check email logs in Dashboard → Settings → Email Logs

#### Emails Going to Spam

**Solutions:**
- Mark PricePilot emails as "Not Spam"
- Add sender to your contacts
- Create email filter to move to inbox
- Contact your IT department to whitelist domain

#### Delayed Emails

**Causes:**
- Email provider rate limiting
- High email volume
- SMTP server issues

**Solutions:**
- Check email logs for delivery status
- Contact support if delays persist
- Consider using a dedicated email service

### Email Security

- All emails sent over TLS/SSL
- No sensitive data (prices, tokens) in email body
- Unsubscribe link in every email
- GDPR compliant
- CAN-SPAM compliant

---

## 👥 Approval Delegation

### Overview

Approval delegation allows you to temporarily grant approval authority to team members. This is useful when you're on vacation, out of office, or want to distribute approval workload.

### How Delegation Works

1. **Delegate Authority**: Grant approval rights to another user
2. **Set Time Period**: Define start and end dates
3. **Delegate Approves**: Delegate can approve changes on your behalf
4. **Automatic Expiry**: Delegation automatically expires after end date
5. **Full Audit Trail**: All delegated approvals are logged

### Creating a Delegation

#### Step 1: Navigate to Delegations

1. Log in to PricePilot dashboard
2. Go to **Dashboard → Settings → Delegations**
3. Click **Create New Delegation**

#### Step 2: Configure Delegation

**Required Fields:**
- **Delegate To**: Select team member to delegate to
- **Start Date**: When delegation becomes active
- **End Date**: When delegation expires
- **Reason** (optional): Note why you're delegating

**Example:**
```
Delegate To: Jane Smith
Start Date: Feb 1, 2026
End Date: Feb 7, 2026
Reason: Vacation
```

#### Step 3: Confirm and Notify

1. Review delegation details
2. Click **Create Delegation**
3. Delegate receives email notification
4. Delegation becomes active on start date

### Managing Delegations

#### View Active Delegations

1. Go to **Dashboard → Settings → Delegations**
2. See all active delegations:
   - Who you've delegated to
   - Who has delegated to you
   - Start and end dates
   - Status (active/expired)

#### Revoke Delegation

End a delegation early:

1. Go to **Dashboard → Settings → Delegations**
2. Find the delegation
3. Click **Revoke**
4. Confirm revocation
5. Delegate is notified via email

#### Extend Delegation

Extend an existing delegation:

1. Go to **Dashboard → Settings → Delegations**
2. Find the delegation
3. Click **Edit**
4. Update end date
5. Click **Save**
6. Delegate is notified of extension

### Approving as a Delegate

When you have delegated authority:

1. Go to **Dashboard → Price Approvals**
2. You'll see a banner: "You have approval authority from [Name]"
3. Review pending changes
4. Click **Approve** or **Reject**
5. Changes are marked as "Approved by [Your Name] on behalf of [Delegator]"

### Delegation Rules

#### Who Can Delegate

- Account owners
- Admin users
- Users with "Approver" role

#### Who Can Be a Delegate

- Any user in the same tenant
- Must have "Approver" or "Admin" role
- Cannot delegate to yourself

#### Delegation Limits

- Maximum 5 active delegations per user
- Maximum delegation period: 90 days
- Minimum delegation period: 1 day

### Audit Trail

All delegated approvals are fully logged:

**Audit Log Entry:**
```
Action: APPROVE_PRICE_CHANGE
User: Jane Smith (delegate)
On Behalf Of: John Doe
Product: Product Name
Old Price: $100
New Price: $95
Timestamp: Feb 3, 2026 10:30 AM
```

**View Audit Logs:**
1. Go to **Dashboard → Audit Logs**
2. Filter by action: "DELEGATED_APPROVAL"
3. See complete history

### Email Notifications

#### Delegation Created
- **To**: Delegate
- **Content**: Delegation details, start/end dates, link to dashboard

#### Delegation Revoked
- **To**: Delegate
- **Content**: Revocation notice, reason (if provided)

#### Delegation Expiring Soon
- **To**: Delegator and Delegate
- **Content**: Reminder that delegation expires in 24 hours

#### Delegation Expired
- **To**: Delegator and Delegate
- **Content**: Confirmation that delegation has expired

### Best Practices

#### Plan Ahead
- Create delegations before you leave
- Set start date to day you leave
- Set end date to day you return

#### Choose Wisely
- Delegate to trusted team members
- Ensure delegate understands pricing strategy
- Provide context and guidelines

#### Monitor Activity
- Review delegated approvals when you return
- Check audit logs for any issues
- Provide feedback to delegates

#### Use for Workload Distribution
- Delegate to distribute approval workload
- Rotate delegates to prevent burnout
- Use for training new team members

### Security Considerations

- Delegates cannot create/edit pricing rules
- Delegates cannot create/edit auto-approval rules
- Delegates cannot delegate to others (no chain delegation)
- All delegated actions are logged
- Delegations automatically expire
- Revoked delegations take effect immediately

### API Integration

Manage delegations via API:

**Create Delegation:**
```bash
POST /api/v1/approval-delegation
Authorization: Bearer <token>
Content-Type: application/json

{
  "toUserId": "user-id",
  "startDate": "2026-02-01T00:00:00Z",
  "endDate": "2026-02-07T23:59:59Z",
  "reason": "Vacation"
}
```

**List Delegations:**
```bash
GET /api/v1/approval-delegation
Authorization: Bearer <token>
```

**Revoke Delegation:**
```bash
DELETE /api/v1/approval-delegation/:id
Authorization: Bearer <token>
```

For complete API documentation, see the [API Reference](#api-reference) section.

---

## 🔄 Rollback Procedures

### Overview

The rollback system allows you to undo incorrect price changes quickly and safely. All rollbacks are fully audited and can be performed from the dashboard or via API.

### Types of Rollbacks

#### 1. Single Price Change Rollback

Undo a single price update.

**Use Cases:**
- Incorrect price was applied
- Pricing rule misconfigured
- Manual error in approval
- Competitor price was wrong

**How It Works:**
1. Identifies the previous price from update log
2. Reverts product price in database
3. Creates new price history entry
4. Updates store via API
5. Creates rollback audit log
6. Sends notification

#### 2. Bulk Operation Rollback

Revert an entire bulk price update operation.

**Use Cases:**
- Bulk update applied wrong strategy
- Multiple products affected by error
- Need to undo entire operation
- Testing pricing rules

**How It Works:**
1. Loads bulk operation snapshot
2. Reverts all products to previous prices
3. Creates price history for each product
4. Updates store via API (batch)
5. Creates rollback audit log
6. Sends notification

#### 3. Automatic Rollback

System automatically rolls back failed updates.

**Triggers:**
- Store API connection fails
- Price update validation fails
- Store returns error response
- Timeout during update

**Behavior:**
- Reverts approval status to PENDING
- No price history created
- Error logged for investigation
- User notified of failure

### Performing a Rollback

#### Single Price Change Rollback

**From Dashboard:**

1. Go to **Dashboard → Price Approvals** or **Dashboard → Activity**
2. Find the price change you want to rollback
3. Click the **⋯** menu button
4. Select **Rollback**
5. Confirm rollback in dialog
6. Wait for confirmation message

**From Price History:**

1. Go to **Dashboard → Products**
2. Click on a product
3. View **Price History** tab
4. Find the update to rollback
5. Click **Rollback to this price**
6. Confirm rollback

#### Bulk Operation Rollback

**From Activity Log:**

1. Go to **Dashboard → Activity**
2. Find the bulk operation
3. Click **View Details**
4. Click **Rollback Entire Operation**
5. Review affected products
6. Confirm rollback
7. Wait for completion (may take a few minutes)

### Rollback Confirmation

Before rollback is executed, you'll see:

**Confirmation Dialog:**
```
Rollback Price Change?

Product: Samsung Galaxy S21
Current Price: $699
Will Revert To: $749

This action will:
✓ Update price in your store
✓ Create price history entry
✓ Create audit log entry
✓ Send notification

This action cannot be undone.

[Cancel] [Confirm Rollback]
```

### Rollback Verification

After rollback completes:

**Success Message:**
```
✓ Price Rolled Back Successfully

Product: Samsung Galaxy S21
Reverted From: $699
Reverted To: $749

View in Store: [Link]
View Audit Log: [Link]
```

**Verification Steps:**
1. Check product price in dashboard
2. Verify price in your store
3. Review price history
4. Check audit log entry

### Rollback Limitations

#### Cannot Rollback If:
- Original price data is missing
- Product has been deleted
- Store API is unavailable
- Already rolled back once
- More than 90 days old (configurable)

#### Rollback Restrictions:
- Can only rollback to immediate previous price
- Cannot rollback to arbitrary historical price
- Cannot rollback auto-approved changes older than 30 days
- Cannot rollback if product no longer exists in store

### Rollback History

View complete rollback history:

1. Go to **Dashboard → Activity**
2. Filter by action: "Rollback"
3. See all rollback operations:
   - Date and time
   - User who performed rollback
   - Product affected
   - Old and new prices
   - Reason (if provided)

### Audit Trail

Every rollback creates detailed audit log:

**Audit Log Entry:**
```json
{
  "action": "ROLLBACK_PRICE",
  "userId": "user-123",
  "userEmail": "john@example.com",
  "timestamp": "2026-02-01T10:30:00Z",
  "entityType": "PriceUpdateLog",
  "entityId": "update-456",
  "details": {
    "productId": "prod-789",
    "productName": "Samsung Galaxy S21",
    "oldPrice": "699.00",
    "newPrice": "749.00",
    "reason": "Incorrect price applied"
  }
}
```

### Rollback Notifications

#### Email Notification

Sent to all users with notification preferences enabled:

**Subject:** Price Rolled Back

**Content:**
```
Price for "Samsung Galaxy S21" was rolled back.

From: $699
To: $749

Rolled back by: John Doe
Reason: Incorrect price applied

View Details: [Dashboard Link]
```

#### In-App Notification

Appears in notification center:

```
🔄 Price Rolled Back

Samsung Galaxy S21: $699 → $749

View Details
```

### Rollback via API

Perform rollbacks programmatically:

**Rollback Single Price Change:**
```bash
POST /api/v1/price-update/rollback
Authorization: Bearer <token>
Content-Type: application/json

{
  "updateLogId": "update-456",
  "reason": "Incorrect price applied"
}
```

**Rollback Bulk Operation:**
```bash
POST /api/v1/price-update/rollback
Authorization: Bearer <token>
Content-Type: application/json

{
  "snapshotId": "snapshot-789",
  "reason": "Testing pricing rules"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Price rolled back successfully",
  "data": {
    "productId": "prod-789",
    "oldPrice": "699.00",
    "newPrice": "749.00",
    "rolledBackAt": "2026-02-01T10:30:00Z"
  }
}
```

### Best Practices

#### Before Rollback
- Verify the price change is actually incorrect
- Check if the issue is with pricing rule configuration
- Consider if a new price update is better than rollback
- Review impact on profit margins

#### After Rollback
- Investigate why incorrect price was applied
- Update pricing rules if needed
- Review auto-approval rules
- Document lessons learned

#### Preventing Need for Rollbacks
- Test pricing rules on small product sets first
- Use manual approval for high-value products
- Set conservative auto-approval rules
- Monitor price changes regularly
- Use price range constraints

### Troubleshooting Rollbacks

#### Rollback Failed

**Error:** "Store API connection failed"

**Solution:**
1. Check store API connection in Integrations
2. Verify API token is valid
3. Ensure store is accessible
4. Try rollback again
5. Contact support if issue persists

#### Rollback Button Disabled

**Reasons:**
- Already rolled back
- Too old (>90 days)
- Product deleted
- Insufficient permissions

**Solution:**
- Check rollback history
- Verify product still exists
- Check your user role
- Contact admin if needed

#### Rollback Completed But Price Not Updated in Store

**Causes:**
- Store cache not cleared
- Store API delay
- Store sync issue

**Solutions:**
1. Wait 5-10 minutes for cache to clear
2. Manually refresh product in store admin
3. Trigger manual sync from Integrations
4. Check store error logs

### Security Considerations

- Only users with "Approver" or "Admin" role can rollback
- All rollbacks require confirmation
- Complete audit trail maintained
- Cannot rollback other tenants' changes
- Rate limiting applied to prevent abuse

---

## 🔒 Security & Performance

### Security Features

#### API Token Encryption

All API tokens are encrypted at rest using AES-256-GCM encryption.

**How It Works:**
- Tokens encrypted before storing in database
- Unique initialization vector (IV) for each token
- Authentication tag for integrity verification
- Decrypted only when needed for API calls

**Benefits:**
- Protects tokens even if database is compromised
- Industry-standard encryption algorithm
- FIPS 140-2 compliant
- Zero-knowledge architecture

**Configuration (Self-Hosted):**
```env
ENCRYPTION_KEY=your-32-byte-hex-key-here
```

Generate key:
```bash
openssl rand -hex 32
```

#### Rate Limiting

Comprehensive rate limiting protects against abuse and ensures fair usage.

**Rate Limits by Endpoint Type:**

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| API Endpoints | 100 requests | 1 hour |
| Scraping Operations | 10 requests | 1 minute |
| Admin Endpoints | 1000 requests | 1 hour |
| Authentication | 5 attempts | 15 minutes |

**Rate Limit Headers:**

Every API response includes rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1643723400
```

**When Rate Limit Exceeded:**

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "limit": 100,
      "window": "1 hour",
      "resetAt": "2026-02-01T11:00:00Z"
    }
  }
}
```

**Best Practices:**
- Monitor rate limit headers
- Implement exponential backoff
- Cache responses when possible
- Use webhooks instead of polling

#### Input Validation

All API inputs are validated and sanitized to prevent injection attacks.

**Validation Layers:**

1. **Type Validation**: Ensures correct data types
2. **Format Validation**: Validates emails, URLs, dates
3. **Length Validation**: Enforces min/max lengths
4. **Whitelist Validation**: Only allows expected values
5. **Sanitization**: Removes potentially dangerous content

**Protected Against:**
- SQL Injection (using Prisma ORM)
- XSS (Cross-Site Scripting)
- Command Injection
- Path Traversal
- LDAP Injection
- XML External Entities

**Example Validation Error:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "fields": {
        "email": ["Invalid email format"],
        "price": ["Must be greater than 0"],
        "url": ["Invalid URL format"]
      }
    }
  }
}
```

#### Authentication & Authorization

**Multi-Layer Security:**

1. **Session-Based Auth**: Secure HTTP-only cookies
2. **API Token Auth**: Bearer token authentication
3. **Role-Based Access Control (RBAC)**: Admin, Approver, Viewer roles
4. **Tenant Isolation**: Complete data separation between tenants

**Session Security:**
- HTTP-only cookies (prevents XSS)
- Secure flag (HTTPS only)
- SameSite=Strict (prevents CSRF)
- 24-hour expiration
- Automatic renewal

**API Token Security:**
- Encrypted at rest
- Hashed for comparison
- Revocable at any time
- Scoped to specific tenant
- Audit logged on use

#### Audit Logging

Complete audit trail for all critical actions.

**Logged Actions:**
- User authentication (success/failure)
- Price changes (approved/rejected)
- Pricing rule changes
- Auto-approval rule changes
- Rollback operations
- API token generation/revocation
- User role changes
- Delegation creation/revocation

**Audit Log Entry:**
```json
{
  "id": "audit-123",
  "tenantId": "tenant-456",
  "userId": "user-789",
  "userEmail": "john@example.com",
  "action": "APPROVE_PRICE_CHANGE",
  "entityType": "PendingPriceChange",
  "entityId": "change-101",
  "oldValue": {"status": "PENDING"},
  "newValue": {"status": "APPROVED"},
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "timestamp": "2026-02-01T10:30:00Z"
}
```

**Audit Log Features:**
- Immutable (cannot be edited or deleted)
- Searchable and filterable
- Exportable to CSV/JSON
- Retention: 7 years (configurable)
- GDPR compliant

#### CORS Configuration

Cross-Origin Resource Sharing (CORS) is properly configured.

**Allowed Origins:**
- Your dashboard domain
- Your store domains (configured in settings)
- No wildcard (*) in production

**Allowed Methods:**
- GET, POST, PUT, PATCH, DELETE

**Allowed Headers:**
- Authorization
- Content-Type
- X-PricePilot-Token

**Security Headers:**
```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
```

### Performance Optimizations

#### Database Indexing

Strategic indexes for 10x faster queries.

**Key Indexes:**

```sql
-- Product queries
idx_product_tenant_site (tenantId, siteId)
idx_product_external_id (externalId)
idx_product_updated_at (updatedAt DESC)

-- ProductMatch queries
idx_match_user_product (userProductId, status)
idx_match_competitor_product (competitorProductId)
idx_match_confidence (confidenceScore DESC)

-- PriceHistory queries
idx_price_history_product_date (productId, recordedAt DESC)

-- Site queries
idx_site_tenant_type (tenantId, type)
idx_site_syncing (isSyncing, syncStartedAt)

-- Notification queries
idx_notification_tenant_read (tenantId, isRead, createdAt DESC)

-- Audit log queries
idx_audit_tenant_date (tenantId, createdAt DESC)
```

**Performance Impact:**
- Product list queries: 10x faster
- Price history queries: 15x faster
- Audit log queries: 20x faster
- Overall API response time: 50% reduction

#### Redis Caching

Intelligent caching for expensive operations.

**Cached Data:**

| Data Type | TTL | Invalidation |
|-----------|-----|--------------|
| Competitor Products | 1 hour | On new scrape |
| Product Matches | 1 hour | On match update |
| Pricing Rules | 5 minutes | On rule change |
| User Sessions | 24 hours | On logout |
| API Rate Limits | 1 hour | Rolling window |

**Cache Strategies:**

1. **Cache-Aside**: Load from cache, fallback to database
2. **Write-Through**: Update cache and database together
3. **Cache Invalidation**: Clear cache on data changes

**Example Usage:**

```typescript
// Cache expensive matching operation
const matches = await cache.wrap(
  `matches:${tenantId}`,
  async () => {
    return await prisma.productMatch.findMany({
      where: { tenantId },
      include: { competitorProduct: true }
    });
  },
  3600 // 1 hour TTL
);
```

**Benefits:**
- 80% reduction in database queries
- 50% faster API response times
- Better scalability
- Reduced database load

#### Query Optimization

Eliminated N+1 query problems across all services.

**Before (N+1 Problem):**
```typescript
// 1 query for products
const products = await prisma.product.findMany();

// N queries for matches (one per product)
for (const product of products) {
  const matches = await prisma.productMatch.findMany({
    where: { userProductId: product.id }
  });
}
// Total: 1 + N queries
```

**After (Optimized):**
```typescript
// 1 query with includes
const products = await prisma.product.findMany({
  include: {
    matchesAsUser: {
      include: { competitorProduct: true }
    },
    site: true,
    priceHistory: {
      take: 10,
      orderBy: { recordedAt: 'desc' }
    }
  }
});
// Total: 1 query
```

**Performance Gains:**
- 100+ products: 100x faster
- 1000+ products: 1000x faster
- Reduced database connections
- Lower memory usage

#### Pagination

All list endpoints support efficient pagination.

**Query Parameters:**

```http
GET /api/v1/products?page=1&limit=20&sortBy=createdAt&sortOrder=desc
```

**Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `sortBy`: Sort field (default: createdAt)
- `sortOrder`: asc or desc (default: desc)

**Response:**

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Benefits:**
- Faster response times
- Lower memory usage
- Better user experience
- Scalable to millions of records

#### Connection Pooling

Optimized database connection management.

**Configuration:**
```env
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20"
```

**Pool Settings:**
- Connection limit: 10 (per instance)
- Pool timeout: 20 seconds
- Idle timeout: 10 minutes
- Max lifetime: 1 hour

**Benefits:**
- Reuse connections
- Faster query execution
- Reduced connection overhead
- Better resource utilization

### Performance Monitoring

#### Response Time Targets

| Endpoint Type | Target | 95th Percentile |
|--------------|--------|-----------------|
| API Endpoints | < 200ms | < 500ms |
| Database Queries | < 50ms | < 100ms |
| Cache Operations | < 10ms | < 20ms |
| External API Calls | < 2s | < 5s |

#### Monitoring Metrics

**Application Metrics:**
- Request rate (requests/second)
- Response time (p50, p95, p99)
- Error rate (errors/total requests)
- Cache hit rate (hits/total requests)

**Database Metrics:**
- Query execution time
- Connection pool usage
- Slow query log
- Index usage statistics

**System Metrics:**
- CPU usage
- Memory usage
- Disk I/O
- Network throughput

**Business Metrics:**
- Price update success rate
- Scraping success rate
- Product match accuracy
- User activity

### Security Best Practices

#### For Users

1. **Use Strong Passwords**
   - Minimum 12 characters
   - Mix of uppercase, lowercase, numbers, symbols
   - Unique password for PricePilot
   - Use password manager

2. **Enable Two-Factor Authentication (Coming Soon)**
   - Add extra layer of security
   - Use authenticator app
   - Keep backup codes safe

3. **Protect API Tokens**
   - Never share tokens
   - Rotate tokens regularly
   - Revoke unused tokens
   - Use environment variables (never hardcode)

4. **Monitor Activity**
   - Review audit logs regularly
   - Check for suspicious activity
   - Report security concerns immediately

5. **Keep Software Updated**
   - Update PricePilot integrations
   - Keep store platform updated
   - Update PHP/Node.js versions

#### For Developers

1. **Secure API Integration**
   - Store tokens in environment variables
   - Use HTTPS for all requests
   - Implement proper error handling
   - Validate all responses

2. **Rate Limit Handling**
   - Monitor rate limit headers
   - Implement exponential backoff
   - Cache responses when possible
   - Use webhooks instead of polling

3. **Input Validation**
   - Validate all user inputs
   - Sanitize data before display
   - Use parameterized queries
   - Escape special characters

4. **Error Handling**
   - Never expose sensitive data in errors
   - Log errors securely
   - Provide user-friendly messages
   - Implement retry logic

5. **Security Testing**
   - Regular security audits
   - Penetration testing
   - Dependency vulnerability scanning
   - Code review for security issues

### Compliance

#### GDPR Compliance

- **Data Minimization**: Only collect necessary data
- **Right to Access**: Users can export their data
- **Right to Deletion**: Users can delete their account
- **Data Portability**: Export data in standard formats
- **Consent Management**: Clear consent for data processing
- **Data Breach Notification**: 72-hour notification requirement

#### SOC 2 Compliance (In Progress)

- Security controls
- Availability monitoring
- Processing integrity
- Confidentiality measures
- Privacy protection

#### PCI DSS Compliance

- No credit card data stored
- Payment processing via Stripe
- PCI DSS Level 1 certified payment processor

---

## 🔧 Troubleshooting Guide

### Common Issues and Solutions

#### Integration Issues

##### Laravel Integration: "Unauthorized" Error

**Symptoms:**
- Connection test fails with "Unauthorized"
- Sync fails with 401 error
- Price updates return "Unauthorized"

**Causes:**
- API token mismatch
- Token not set in `.env` file
- Token contains extra spaces/newlines
- Middleware not registered

**Solutions:**

1. **Verify Token Match:**
   ```bash
   # Check token in Laravel .env
   cat .env | grep PRICEPILOT_API_TOKEN
   
   # Compare with token in PricePilot dashboard
   # They must match exactly (case-sensitive)
   ```

2. **Regenerate Token:**
   ```bash
   # In Laravel project
   php artisan pricepilot:install --force
   
   # Copy new token to PricePilot dashboard
   ```

3. **Check Middleware:**
   ```php
   // app/Http/Kernel.php
   protected $routeMiddleware = [
       'pricepilot.auth' => \PricePilot\LaravelClient\Middleware\AuthenticateToken::class,
   ];
   ```

4. **Clear Cache:**
   ```bash
   php artisan config:clear
   php artisan cache:clear
   php artisan route:clear
   ```

##### OpenCart Integration: Module Not Working

**Symptoms:**
- Module installed but not visible
- API endpoints return 404
- Token generation fails

**Causes:**
- Module not properly installed
- File permissions incorrect
- OpenCart cache not cleared
- Conflicting modules

**Solutions:**

1. **Verify Installation:**
   - Check Extension Installer shows success
   - Verify files exist in `catalog/controller/api/pricepilot.php`
   - Check admin sidebar for PricePilot menu

2. **Fix Permissions:**
   ```bash
   chmod 644 catalog/controller/api/pricepilot.php
   chmod 644 admin/controller/extension/module/pricepilot.php
   ```

3. **Clear Cache:**
   - OpenCart Admin → Dashboard → Settings icon → Clear cache
   - Or manually delete `system/storage/cache/*`

4. **Check Logs:**
   - OpenCart Admin → System → Error Logs
   - Look for PricePilot-related errors

##### Products Not Syncing

**Symptoms:**
- Product count shows 0
- Sync button does nothing
- "Last synced" never updates

**Causes:**
- API connection failed
- No products in store
- Products not published/active
- Database query error

**Solutions:**

1. **Test Connection:**
   - Dashboard → Integrations → Click "Test Connection"
   - Should show "Connection successful"

2. **Check Product Status:**
   ```sql
   -- Laravel
   SELECT COUNT(*) FROM products WHERE status = 'active';
   
   -- OpenCart
   SELECT COUNT(*) FROM oc_product WHERE status = 1;
   ```

3. **Manual Sync:**
   - Dashboard → Integrations → Click "Sync Now"
   - Wait 30-60 seconds
   - Refresh page

4. **Check Error Logs:**
   - Dashboard → Activity → Filter by "Sync Error"
   - Review error messages

5. **Verify API Response:**
   ```bash
   curl -X GET "https://your-store.com/api/pricepilot/sync" \
     -H "X-PricePilot-Token: your-token"
   ```

#### Price Update Issues

##### Price Updates Not Applying

**Symptoms:**
- Price approved but not updated in store
- Update shows "Success" but price unchanged
- Store shows old price

**Causes:**
- Store cache not cleared
- API update failed silently
- Price format mismatch
- Store validation rules

**Solutions:**

1. **Clear Store Cache:**
   ```bash
   # Laravel
   php artisan cache:clear
   
   # OpenCart
   # Admin → Dashboard → Clear cache
   ```

2. **Check Update Logs:**
   - Dashboard → Activity → Filter by "Price Update"
   - Look for error messages

3. **Verify Price Format:**
   - Ensure price is numeric
   - Check decimal places (usually 2)
   - Verify currency matches

4. **Manual Update Test:**
   - Try updating price manually in store admin
   - If that fails, issue is with store configuration

5. **Check Store Validation:**
   - Some stores have min/max price rules
   - Check store settings for price constraints

##### Bulk Updates Failing

**Symptoms:**
- Some products update, others fail
- Bulk operation shows partial success
- Timeout errors

**Causes:**
- Too many products in one batch
- Store API rate limiting
- Network timeout
- Individual product errors

**Solutions:**

1. **Reduce Batch Size:**
   - Update 50 products at a time instead of 500
   - Use multiple smaller batches

2. **Check Failed Products:**
   - Dashboard → Activity → View bulk operation details
   - Review which products failed and why

3. **Retry Failed Products:**
   - Dashboard → Activity → Click "Retry Failed"
   - Or manually approve failed products

4. **Increase Timeout:**
   ```env
   # .env (self-hosted)
   API_TIMEOUT=30000  # 30 seconds
   ```

#### Scraping Issues

##### Competitor Prices Not Updating

**Symptoms:**
- Competitor prices show "Never scraped"
- Prices are outdated
- Scraping status shows "Failed"

**Causes:**
- Website blocking scraper
- Website structure changed
- Cloudflare/bot protection
- Invalid URL

**Solutions:**

1. **Verify URL:**
   - Open competitor URL in browser
   - Ensure it loads correctly
   - Check if product still exists

2. **Check Scraping Logs:**
   - Dashboard → Competitors → Click competitor
   - View "Scraping History"
   - Review error messages

3. **Update Site Profile:**
   - Dashboard → Site Config
   - Enable "Session Warmup"
   - Increase delays
   - Try different user agent

4. **Contact Support:**
   - If website has strong bot protection
   - We may need to add custom scraping logic

##### High Block Rate

**Symptoms:**
- Many scraping attempts blocked
- Challenge detection rate high
- Success rate < 50%

**Causes:**
- Aggressive bot protection
- IP address blacklisted
- Too many requests too fast
- Suspicious behavior detected

**Solutions:**

1. **Enable Session Warmup:**
   - Dashboard → Site Config
   - Toggle "Session Warmup" ON
   - Increases success rate by 30-50%

2. **Increase Delays:**
   - Dashboard → Site Config
   - Set "Min Delay" to 3000ms
   - Set "Max Delay" to 5000ms

3. **Use Residential Proxies:**
   - Contact support to enable residential proxies
   - Higher success rate but more expensive

4. **Reduce Scraping Frequency:**
   - Scrape less frequently (every 48 hours instead of 24)
   - Reduces detection risk

#### Matching Issues

##### Products Not Auto-Matching

**Symptoms:**
- Auto-match finds 0 matches
- Manual matching required for all products
- Low confidence scores

**Causes:**
- SKU mismatch (different formats)
- Brand/model data missing
- Product titles too different
- No common identifiers

**Solutions:**

1. **Check SKU Format:**
   ```
   Your SKU: PROD-001
   Competitor SKU: PROD001
   
   Solution: Normalize SKUs (remove hyphens)
   ```

2. **Add Brand/Model Data:**
   - Ensure your products have brand and model fields
   - Update product data in your store

3. **Use Manual Matching:**
   - Dashboard → Products → Click product
   - Click "Add Match"
   - Search for competitor product
   - Click "Match"

4. **Improve Product Titles:**
   - Use consistent naming conventions
   - Include brand and model in title
   - Avoid special characters

##### Wrong Products Matched

**Symptoms:**
- Auto-match links wrong products
- Confidence score high but match incorrect
- Different products with similar names

**Causes:**
- Similar product names
- Same SKU for different products
- Fuzzy matching too aggressive
- Missing product attributes

**Solutions:**

1. **Review Matches:**
   - Dashboard → Products → View matches
   - Check each match manually
   - Reject incorrect matches

2. **Override Auto-Match:**
   - Dashboard → Products → Click product
   - Remove incorrect match
   - Add correct match manually

3. **Improve Product Data:**
   - Add more specific attributes
   - Include model numbers
   - Add product descriptions

4. **Adjust Confidence Threshold:**
   - Dashboard → Settings → Matching
   - Increase minimum confidence score
   - Reduces false positives

#### Auto-Approval Issues

##### Rules Not Triggering

**Symptoms:**
- Auto-approval rules enabled but not working
- All changes stay PENDING
- No auto-approvals in logs

**Causes:**
- Rule conditions too restrictive
- Cron job not running
- Rule disabled
- Higher priority rule blocking

**Solutions:**

1. **Check Rule Status:**
   - Dashboard → Auto-Approval Rules
   - Ensure toggle is ON (enabled)

2. **Review Rule Conditions:**
   - Check if conditions match pending changes
   - Try creating a test rule with loose conditions:
     ```
     Max Price Change: $1000
     Max Percentage Change: 50%
     ```

3. **Check Cron Job:**
   - Dashboard → System Status
   - Verify "Auto-Approval Cron" shows recent run time

4. **Review Priority:**
   - Lower priority number = higher priority
   - Check if higher priority rule is blocking

5. **Test with Single Change:**
   - Create one pending change
   - Wait for next cron run (hourly)
   - Check if it gets auto-approved

##### Too Many Auto-Approvals

**Symptoms:**
- More changes auto-approved than expected
- Unwanted price changes applied
- Auto-approval rate too high

**Causes:**
- Rule conditions too loose
- Multiple overlapping rules
- Missing safety constraints

**Solutions:**

1. **Tighten Conditions:**
   ```
   Before:
   - Max Price Change: $100
   
   After:
   - Max Price Change: $20
   - Max Percentage Change: 5%
   - Min Confidence Score: 90
   ```

2. **Disable Aggressive Rules:**
   - Dashboard → Auto-Approval Rules
   - Toggle OFF rules that are too permissive

3. **Add Safety Constraints:**
   - Add price range limits
   - Restrict to specific categories
   - Limit to specific strategies

4. **Review Auto-Approved Changes:**
   - Dashboard → Price Approvals
   - Filter by "Auto-approved"
   - Rollback unwanted changes

#### Email Notification Issues

##### Not Receiving Emails

**Symptoms:**
- No email notifications received
- Emails expected but not arriving
- Other users receiving emails

**Causes:**
- Notifications disabled
- Email in spam folder
- Email address incorrect
- SMTP configuration issue

**Solutions:**

1. **Check Settings:**
   - Dashboard → Settings → Notifications
   - Ensure notifications are enabled
   - Verify email address is correct

2. **Check Spam Folder:**
   - Look for emails from noreply@pricepilot.com
   - Mark as "Not Spam"
   - Add to contacts

3. **Whitelist Domain:**
   - Add pricepilot.com to email whitelist
   - Contact IT department if corporate email

4. **Test Email:**
   - Dashboard → Settings → Notifications
   - Click "Send Test Email"
   - Should receive within 1 minute

5. **Check Email Logs:**
   - Dashboard → Settings → Email Logs
   - Look for delivery failures

##### Emails Going to Spam

**Symptoms:**
- Emails consistently in spam folder
- Gmail/Outlook marks as spam
- Email provider blocking

**Solutions:**

1. **Mark as Not Spam:**
   - Open email in spam folder
   - Click "Not Spam" or "Not Junk"
   - Move to inbox

2. **Add to Contacts:**
   - Add noreply@pricepilot.com to contacts
   - Prevents future spam filtering

3. **Create Filter:**
   - Create email filter/rule
   - Move PricePilot emails to inbox automatically

4. **Contact IT:**
   - If corporate email, ask IT to whitelist domain
   - Provide SPF/DKIM records if needed

#### Data Retention & Privacy Issues

##### Cannot Export My Data

**Symptoms:**
- Export button not working
- No download link received
- Export fails with error

**Causes:**
- Large dataset taking time to process
- Email delivery issue
- System error

**Solutions:**

1. **Wait for Email:**
   - Export can take up to 24 hours for large datasets
   - Check spam folder for download link
   - Link expires after 7 days

2. **Check Export Status:**
   - Dashboard → Settings → Privacy
   - View export request status
   - See estimated completion time

3. **Retry Export:**
   - If export failed, try again
   - Choose smaller date range if needed
   - Select specific data types instead of "All Data"

4. **Contact Support:**
   - If export fails repeatedly
   - Provide error message
   - Support can manually generate export

##### Account Deletion Not Working

**Symptoms:**
- Delete account button disabled
- Deletion request not processing
- Account still active after deletion

**Causes:**
- Active subscription
- Pending payments
- System error

**Solutions:**

1. **Cancel Subscription First:**
   - Dashboard → Settings → Billing
   - Cancel active subscription
   - Wait for current period to end

2. **Resolve Pending Payments:**
   - Dashboard → Settings → Billing
   - Pay any outstanding invoices
   - Then request deletion

3. **Confirm Deletion:**
   - Check email for confirmation link
   - Click link to confirm deletion
   - Account enters 30-day soft-delete period

4. **Recovery Period:**
   - Account can be recovered within 30 days
   - Contact support to recover
   - After 30 days, deletion is permanent

##### Data Not Being Cleaned Up

**Symptoms:**
- Old data still visible
- Database size not decreasing
- Cleanup jobs not running

**Causes:**
- Cleanup jobs disabled
- Cron job not running
- Retention policies too long

**Solutions:**

1. **Check Cleanup Status:**
   - Dashboard → System Status
   - Verify cleanup jobs show recent runs
   - Check for error messages

2. **Verify Retention Policies:**
   - Admin → System Settings → Data Retention
   - Review retention periods for each data type
   - Ensure policies are reasonable

3. **Manual Cleanup:**
   - Admin → System Settings → Data Retention
   - Click "Run Cleanup Now"
   - Wait for completion

4. **Contact Support:**
   - If cleanup jobs consistently fail
   - Provide error logs
   - May need database optimization

#### Monitoring & Alert Issues

##### Alerts Not Triggering

**Symptoms:**
- No alerts received despite issues
- Alert thresholds exceeded but no notification
- Alert history empty

**Causes:**
- Alerts disabled
- Thresholds too high
- Notification preferences not set
- Alert evaluation not running

**Solutions:**

1. **Check Alert Configuration:**
   - Admin → Alert Settings
   - Ensure alerts are enabled
   - Verify thresholds are appropriate

2. **Check Notification Preferences:**
   - Admin → Alert Settings → Notifications
   - Ensure email/Slack is configured
   - Test notification delivery

3. **Verify Alert Evaluation:**
   - Dashboard → System Status
   - Check "Alert Evaluation" shows recent runs
   - If not running, contact support

4. **Review Alert Rules:**
   - Admin → Alert Settings
   - Check if rules are too restrictive
   - Adjust thresholds if needed

##### Too Many Alerts

**Symptoms:**
- Constant alert notifications
- Alert fatigue
- Many false positives

**Causes:**
- Thresholds too sensitive
- Normal fluctuations triggering alerts
- Multiple overlapping alerts

**Solutions:**

1. **Adjust Thresholds:**
   - Admin → Alert Settings
   - Increase thresholds for noisy alerts
   - Example: Block rate 30% → 40%

2. **Acknowledge Alerts:**
   - Admin → Alerts
   - Acknowledge known issues
   - Stops notifications for that alert

3. **Disable Non-Critical Alerts:**
   - Admin → Alert Settings
   - Disable alerts that aren't actionable
   - Focus on critical alerts only

4. **Set Quiet Hours:**
   - Admin → Alert Settings → Notifications
   - Configure quiet hours (e.g., nights/weekends)
   - Alerts still logged but not sent

##### Monitoring Dashboard Slow

**Symptoms:**
- Dashboards take long to load
- Charts not rendering
- Timeout errors

**Causes:**
- Large dataset
- Too many metrics
- No data aggregation

**Solutions:**

1. **Reduce Time Range:**
   - Select shorter time range (24h instead of 30d)
   - Use aggregated views for longer periods

2. **Filter Data:**
   - Filter by specific sites or tenants
   - Reduce number of metrics displayed

3. **Clear Browser Cache:**
   - Clear browser cache and cookies
   - Disable browser extensions
   - Try different browser

4. **Contact Support:**
   - If dashboards consistently slow
   - May need database optimization
   - Consider upgrading plan for better performance

#### Performance Issues

##### Slow Dashboard Loading

**Symptoms:**
- Dashboard takes >5 seconds to load
- Pages timeout
- Spinner shows for long time

**Causes:**
- Too many products
- Large price history
- Slow database queries
- No pagination

**Solutions:**

1. **Use Pagination:**
   - Reduce items per page to 20
   - Use filters to narrow results

2. **Clear Old Data:**
   - Dashboard → Settings → Data Retention
   - Archive old price history
   - Delete old audit logs

3. **Optimize Queries:**
   - Contact support for database optimization
   - May need to add indexes

4. **Check Browser:**
   - Clear browser cache
   - Disable browser extensions
   - Try different browser

##### API Timeouts

**Symptoms:**
- API requests timeout
- 504 Gateway Timeout errors
- Requests take >30 seconds

**Causes:**
- Large dataset
- Slow database queries
- No caching
- Network issues

**Solutions:**

1. **Use Pagination:**
   ```http
   GET /api/v1/products?page=1&limit=20
   ```

2. **Enable Caching:**
   - Contact support to enable Redis caching
   - Reduces response time by 50%

3. **Reduce Payload:**
   - Request only needed fields
   - Use filters to narrow results

4. **Increase Timeout:**
   ```javascript
   // In your API client
   axios.defaults.timeout = 30000; // 30 seconds
   ```

#### Email Notification Issues

##### Not Receiving Emails

**Symptoms:**
- No email notifications received
- Emails expected but not arriving
- Other users receiving emails

**Causes:**
- Notifications disabled
- Email in spam folder
- Email address incorrect
- SMTP configuration issue

**Solutions:**

1. **Check Settings:**
   - Dashboard → Settings → Notifications
   - Ensure notifications are enabled
   - Verify email address is correct

2. **Check Spam Folder:**
   - Look for emails from noreply@pricepilot.com
   - Mark as "Not Spam"
   - Add to contacts

3. **Whitelist Domain:**
   - Add pricepilot.com to email whitelist
   - Contact IT department if corporate email

4. **Test Email:**
   - Dashboard → Settings → Notifications
   - Click "Send Test Email"
   - Should receive within 1 minute

5. **Check Email Logs:**
   - Dashboard → Settings → Email Logs
   - Look for delivery failures

##### Emails Going to Spam

**Symptoms:**
- Emails consistently in spam folder
- Gmail/Outlook marks as spam
- Email provider blocking

**Solutions:**

1. **Mark as Not Spam:**
   - Open email in spam folder
   - Click "Not Spam" or "Not Junk"
   - Move to inbox

2. **Add to Contacts:**
   - Add noreply@pricepilot.com to contacts
   - Prevents future spam filtering

3. **Create Filter:**
   - Create email filter/rule
   - Move PricePilot emails to inbox automatically

4. **Contact IT:**
   - If corporate email, ask IT to whitelist domain
   - Provide SPF/DKIM records if needed

### Error Messages

#### Common Error Codes

##### VALIDATION_ERROR (422)

**Message:** "Invalid request data"

**Cause:** Request body doesn't match expected format

**Solution:**
- Check API documentation for correct format
- Validate all required fields are present
- Ensure data types are correct

**Example:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "details": {
      "fields": {
        "price": ["Must be greater than 0"]
      }
    }
  }
}
```

##### UNAUTHORIZED (401)

**Message:** "Unauthorized"

**Cause:** Missing or invalid authentication

**Solution:**
- Check API token is correct
- Ensure token is in Authorization header
- Verify token hasn't been revoked

##### FORBIDDEN (403)

**Message:** "Insufficient permissions"

**Cause:** User doesn't have required role

**Solution:**
- Check your user role
- Contact admin to grant permissions
- Verify you're in correct tenant

##### NOT_FOUND (404)

**Message:** "Resource not found"

**Cause:** Requested resource doesn't exist

**Solution:**
- Verify resource ID is correct
- Check resource wasn't deleted
- Ensure you have access to resource

##### RATE_LIMIT_EXCEEDED (429)

**Message:** "Too many requests"

**Cause:** Exceeded rate limit

**Solution:**
- Wait for rate limit to reset
- Check X-RateLimit-Reset header
- Implement exponential backoff
- Reduce request frequency

##### INTERNAL_ERROR (500)

**Message:** "An unexpected error occurred"

**Cause:** Server-side error

**Solution:**
- Try request again
- If persists, contact support
- Provide request ID from response

### Getting Help

#### Before Contacting Support

1. **Check This Guide:**
   - Review relevant troubleshooting section
   - Try suggested solutions

2. **Check System Status:**
   - Visit status.pricepilot.com
   - Check for ongoing incidents

3. **Review Logs:**
   - Dashboard → Activity
   - Dashboard → Audit Logs
   - Look for error messages

4. **Gather Information:**
   - Error messages
   - Screenshots
   - Steps to reproduce
   - Browser/OS version
   - API request/response (if applicable)

#### Contacting Support

**Email:** support@pricepilot.com

**Include:**
- Your account email
- Detailed description of issue
- Error messages
- Screenshots
- Steps to reproduce
- What you've already tried

**Response Time:**
- Basic Plan: 48 hours
- Premium Plan: 24 hours
- Pro Plan: 4 hours
- Critical Issues: 1 hour

**Live Chat:**
- Available for Premium and Pro plans
- Monday-Friday, 9 AM - 5 PM EST
- Access from dashboard

---

## 📊 Monitoring & Analytics

### Admin Monitoring Dashboards

PricePilot provides comprehensive monitoring tools for platform administrators:

#### Proxy Health Dashboard
Monitor your proxy pool in real-time:
- View health status of all proxies
- Track success rates and response times
- Identify and replace unhealthy proxies
- Filter metrics by time range (24h, 7d, 30d)

**Access**: Admin Panel → Proxy Health

#### Challenge Detection Dashboard
Monitor anti-bot challenge handling:
- Track challenge detection rates by site
- View solve rates for different challenge types
- Identify sites with low solve rates
- Analyze challenge trends over time

**Access**: Admin Panel → Challenge Stats

#### Scraping Metrics Dashboard
Comprehensive scraping performance metrics:
- Platform-wide success and block rates
- Per-site performance breakdown
- Trend charts and visualizations
- Export data to CSV/JSON

**Access**: Admin Panel → Scraping Metrics

#### Real-Time Monitor
Live view of active scraping sessions:
- See all active scraping sessions
- Monitor session status and progress
- Track proxy usage and challenges
- Auto-refresh every 5 seconds

**Access**: Admin Panel → Monitor

#### Human Simulation Settings
Configure global human behavior simulation:
- Adjust typing speeds and delays
- Configure mouse movement patterns
- Set form interaction behavior
- Apply changes instantly

**Access**: Admin Panel → Human Simulation

#### Site Profile Management
Create custom scraping profiles per site:
- Set rate limits and delays
- Configure session warmup
- Use pre-built templates (Cloudflare, PerimeterX, DataDome)
- Apply profiles automatically

**Access**: Admin Panel → Site Profiles

#### Alert Management
Stay informed about critical issues:
- View system alerts by severity
- Get notified of high block rates
- Monitor proxy failures
- Acknowledge and track alerts

**Access**: Admin Panel → Alerts

### Tenant Monitoring

Tenants have access to their own monitoring dashboards:

#### Metrics Dashboard
View your scraping performance:
- Overall success and block rates
- Per-site health status
- Challenge detection summary
- Actionable recommendations

**Access**: Dashboard → Metrics

#### Site Configuration
Configure your scraping settings:
- Enable/disable session warmup
- Adjust delay ranges (within plan limits)
- Preview impact on performance
- Apply changes instantly

**Access**: Dashboard → Site Config

For detailed monitoring documentation, see [Monitoring UI Guide](docs/MONITORING_UI.md).

---

## 🔐 API Reference

### Authentication

All API requests require authentication via API token in the header:

```bash
X-PricePilot-Token: your-api-token-here
```

### Endpoints

#### Sync Products (Laravel)

```http
GET /api/pricepilot/sync
```

**Response:**
```json
{
  "data": [
    {
      "id": "123",
      "name": "Product Name",
      "sku": "SKU-001",
      "price": 99.99,
      "brand": "Brand Name",
      "model": "Model-X"
    }
  ],
  "current_page": 1,
  "total": 100
}
```

#### Update Price (Laravel)

```http
POST /api/pricepilot/update
```

**Request Body:**
```json
{
  "product_id": "123",
  "price": 89.99
}
```

**Response:**
```json
{
  "success": true,
  "message": "Price updated in Laravel store"
}
```

---

## ❓ FAQ

### General Questions

**Q: What is PricePilot?**
A: PricePilot is a SaaS platform that helps e-commerce businesses automate competitive pricing by monitoring competitor prices and applying dynamic pricing rules.

**Q: How much does PricePilot cost?**
A: We offer three plans:
- **Basic**: 1 store, 3 competitors
- **Premium**: 3 stores, 10 competitors
- **Pro**: Unlimited stores and competitors

**Q: Is there a free trial?**
A: Yes! All new accounts get a 14-day free trial with full access to Premium features.

### Integration Questions

**Q: How do I get the PricePilot Laravel package?**
A: There are two ways:
1. **Download from Dashboard** (Recommended): Log in to PricePilot → Dashboard → Integrations → Laravel → Click "Download Package"
2. **Via Composer**: Contact support@pricepilot.com for repository access

**Q: Where do I get the "Secure API Token" for Laravel integration?**
A: The easiest way is to run `php artisan pricepilot:install` after installing the package. This command automatically generates a secure token and adds it to your `.env` file. Alternatively, you can create it yourself using `openssl rand -base64 32`.

**Q: How do I generate a secure API token?**
A: Use any of these methods:
- **Easiest**: Run `php artisan pricepilot:install` (auto-generates token)
- Use `openssl rand -base64 32` in terminal
- Use `php -r "echo bin2hex(random_bytes(32));"`
- Generate online at [randomkeygen.com](https://randomkeygen.com)

**Q: Do I need Composer to install the Laravel package?**
A: No! You can download the package directly from the dashboard and install it manually. See the [Laravel Integration](#laravel-integration) section for manual installation steps.

**Q: Which platforms does PricePilot support?**
A: We currently fully support OpenCart and Laravel. Shopify, WooCommerce, and Magento are in development. PrestaShop and BigCommerce are planned for future releases.

**Q: Can I connect multiple stores?**
A: Yes! The number of stores depends on your plan. Basic allows 1 store, Premium allows 3, and Pro allows unlimited stores.

**Q: Do I need to install anything on my store?**
A: For Laravel and OpenCart, yes - you need to install our integration package/module. For competitor stores, no installation is needed.

### Product Matching Questions

**Q: How does PricePilot match my products with competitors?**
A: We use three methods:
1. **SKU Matching**: Automatic matching by identical SKUs
2. **Model Matching**: Matching by brand + model number
3. **Manual Matching**: You can manually link products

**Q: What if the automatic matching is wrong?**
A: You can override any automatic match with manual matching in the Product Catalog section.

**Q: Can I match one product to multiple competitors?**
A: Yes! Each of your products can be matched to the same product from multiple competitor stores.

### Pricing Rules Questions

**Q: How do pricing rules work?**
A: You create rules that define how your prices should respond to competitor prices. For example: "Always stay $5 below the cheapest competitor" or "Match competitor price but maintain 20% margin."

**Q: Can I have multiple pricing rules?**
A: Yes! You can create multiple rules with different priorities. Higher priority rules are applied first.

**Q: Will PricePilot automatically update my store prices?**
A: Only if you enable automatic updates. You can also use manual approval mode where you review and approve each price change.

**Q: What if a pricing rule would make me lose money?**
A: Use the "Margin Lock" strategy to ensure you never go below a certain profit margin, regardless of competitor prices.

### Auto-Approval Rules Questions

**Q: What are auto-approval rules?**
A: Auto-approval rules automatically approve price changes that meet specific conditions you define, reducing manual review workload while maintaining control over pricing decisions.

**Q: How do I create an auto-approval rule?**
A: Go to Dashboard → Auto-Approval Rules → Create New Rule. Set conditions like max price change, percentage change, confidence score, and more. See the [Auto-Approval Rules Guide](#auto-approval-rules-guide) for details.

**Q: Can I have multiple auto-approval rules?**
A: Yes! You can create multiple rules with different priorities. Rules are evaluated in priority order (lowest number first), and the first matching rule is applied.

**Q: What happens if multiple rules match a price change?**
A: Only the first matching rule (by priority order) is applied. Evaluation stops after the first match (short-circuit behavior).

**Q: Can I temporarily disable auto-approval?**
A: Yes! You can disable individual rules using the toggle switch, or disable all rules to return to manual approval only.

**Q: What if I don't want a specific change to be auto-approved?**
A: You can manually approve or reject any change before auto-approval runs. Manual decisions always take precedence over auto-approval.

**Q: How often does auto-approval run?**
A: Auto-approval processing runs every hour via a scheduled cron job. It evaluates all PENDING price changes against your enabled rules.

**Q: Can I see which rule auto-approved a change?**
A: Yes! Go to Dashboard → Price Approvals and look for the "Auto-approved by: [Rule Name]" badge. Full details are available in the audit logs.

**Q: What happens if the store update fails after auto-approval?**
A: The system automatically rolls back the approval status to PENDING. No price history or audit log is created for failed updates.

**Q: Will auto-approval work with my existing manual approval workflow?**
A: Yes! Auto-approval and manual approval work together seamlessly. You can use both approaches, and manual approvals always take precedence.

**Q: How do I know if my auto-approval rules are working well?**
A: Check the metrics dashboard (Dashboard → Auto-Approval Rules → View Metrics) to see auto-approval rates, per-rule statistics, and non-matching changes.

**Q: Can I get notified when prices are auto-approved?**
A: Yes! Enable email notifications in Dashboard → Settings → Notifications. You'll receive summaries of auto-approved changes with rule details.

### Email Notification Questions

**Q: What types of email notifications does PricePilot send?**
A: PricePilot sends 5 types of notifications:
1. Pending approval alerts (when changes await review)
2. Daily approval summary (daily digest of activity)
3. Auto-approval notifications (when rules auto-approve changes)
4. Delegation notifications (when approval authority is delegated)
5. Sync error alerts (when product sync fails)

**Q: How do I enable email notifications?**
A: Go to Dashboard → Settings → Notifications and toggle on the notification types you want. You can also configure frequency (immediate, daily, or weekly) for auto-approval notifications.

**Q: Why am I not receiving email notifications?**
A: Check these:
1. Notifications are enabled in settings
2. Email address is correct
3. Check spam/junk folder
4. Add noreply@pricepilot.com to your contacts
5. Whitelist PricePilot domain in your email settings

**Q: Can I change how often I receive auto-approval notifications?**
A: Yes! In Dashboard → Settings → Notifications, you can choose:
- Immediate (after each auto-approval run)
- Daily Digest (once per day summary)
- Weekly Digest (once per week summary)

**Q: How do I stop receiving certain email notifications?**
A: Go to Dashboard → Settings → Notifications and toggle off the notification types you don't want. You can also use the unsubscribe link in any email.

### Approval Delegation Questions

**Q: What is approval delegation?**
A: Approval delegation allows you to temporarily grant approval authority to team members. This is useful when you're on vacation, out of office, or want to distribute approval workload.

**Q: How do I delegate approval authority?**
A: Go to Dashboard → Settings → Delegations → Create New Delegation. Select the team member, set start and end dates, and click Create. The delegate will receive an email notification.

**Q: Can I revoke a delegation early?**
A: Yes! Go to Dashboard → Settings → Delegations, find the delegation, and click Revoke. The delegate will be notified immediately.

**Q: How long can a delegation last?**
A: Delegations can last from 1 day to 90 days maximum. They automatically expire after the end date.

**Q: Can I have multiple active delegations?**
A: Yes, but you're limited to 5 active delegations per user at a time.

**Q: What happens when a delegate approves a change?**
A: The change is approved and marked as "Approved by [Delegate Name] on behalf of [Your Name]" in the audit logs. You can see all delegated approvals in the audit trail.

**Q: Can delegates create or edit pricing rules?**
A: No. Delegates can only approve or reject pending price changes. They cannot create/edit pricing rules, auto-approval rules, or delegate to others.

### Rollback Questions

**Q: What is the rollback feature?**
A: The rollback feature allows you to undo incorrect price changes quickly and safely. You can rollback single price changes or entire bulk operations.

**Q: How do I rollback a price change?**
A: Go to Dashboard → Price Approvals or Dashboard → Activity, find the price change, click the ⋯ menu, and select Rollback. Confirm the rollback in the dialog.

**Q: Can I rollback bulk operations?**
A: Yes! Go to Dashboard → Activity, find the bulk operation, click View Details, then click "Rollback Entire Operation". This will revert all products in that operation.

**Q: What happens when I rollback a price change?**
A: The system:
1. Reverts the product price in the database
2. Updates the price in your store via API
3. Creates a price history entry
4. Creates an audit log entry
5. Sends a notification

**Q: Can I rollback a rollback?**
A: No. Rollbacks are one-way operations. If you need to change the price again, you'll need to create a new price change.

**Q: How long can I rollback a price change?**
A: You can rollback price changes up to 90 days old (configurable). After that, the rollback option is no longer available.

**Q: What if the rollback fails?**
A: If the store API connection fails during rollback, the system will keep the change in its current state and log the error. You can retry the rollback after fixing the connection issue.

### Security Questions

**Q: How does PricePilot protect my API tokens?**
A: All API tokens are encrypted at rest using AES-256-GCM encryption, an industry-standard algorithm. Tokens are only decrypted when needed for API calls.

**Q: What is rate limiting and why does it matter?**
A: Rate limiting prevents abuse by limiting the number of requests you can make per hour. This protects the system from overload and ensures fair usage for all users.

**Q: What are the rate limits?**
A: Rate limits vary by endpoint type:
- API endpoints: 100 requests per hour
- Scraping operations: 10 requests per minute
- Admin endpoints: 1000 requests per hour
- Authentication: 5 attempts per 15 minutes

**Q: What happens if I exceed the rate limit?**
A: You'll receive a 429 (Too Many Requests) error with headers showing when the limit resets. Wait for the reset time and try again.

**Q: How does PricePilot prevent SQL injection and XSS attacks?**
A: We use multiple layers of protection:
1. Prisma ORM (prevents SQL injection)
2. Input validation with Zod schemas
3. Output sanitization with DOMPurify
4. Content Security Policy headers
5. Regular security audits

**Q: Can I see who made changes to my account?**
A: Yes! Go to Dashboard → Audit Logs to see a complete history of all actions, including who performed them, when, and what changed.

### Technical Questions

**Q: How often does PricePilot check competitor prices?**
A: Every 24 hours for all connected competitor stores.

**Q: Is my data secure?**
A: Yes! All API tokens are encrypted with AES-256 encryption. We use industry-standard security practices and never store sensitive payment information.

**Q: What happens if my store API is down?**
A: PricePilot will retry the connection and log the error. You'll receive a notification if the connection fails multiple times.

**Q: Can I export my data?**
A: Yes! You can export product catalogs, price history, and reports in CSV format.

**Q: Does PricePilot work with multi-currency stores?**
A: Currently, PricePilot works best with single-currency stores. Multi-currency support is coming in v2.

**Q: How do I know if my data is secure?**
A: PricePilot uses industry-standard security measures:
- AES-256-GCM encryption for all API tokens at rest
- TLS 1.3 for all data in transit
- Rate limiting on all endpoints to prevent abuse
- Comprehensive input validation to prevent SQL injection and XSS
- Complete audit trail of all actions
- Regular security audits and penetration testing

**Q: What happens to my data when I delete my account?**
A: When you request account deletion:
1. Your account is immediately soft-deleted (30-day recovery period)
2. You can recover your account within 30 days by contacting support
3. After 30 days, all your data is permanently deleted
4. You can export your data before deletion (Dashboard → Settings → Privacy → Export My Data)
5. Some data may be retained for legal compliance (financial records for 7 years, security logs for 5 years)

**Q: Can I customize data retention periods?**
A: Enterprise plans can customize retention policies to meet specific compliance requirements. Contact support@pricepilot.com for custom retention policies.

**Q: How do I export my data?**
A: Go to Dashboard → Settings → Privacy → Export My Data. You'll receive a download link via email within 24 hours. The export includes all your personal data in JSON format.

**Q: What data retention policies does PricePilot follow?**
A: PricePilot implements comprehensive data retention policies:
- Price history: 90 days (hot), 1-3 years (archived)
- Audit logs: 2 years (5 years for critical security events)
- Price update logs: 180 days
- Notifications: 90 days
- Sync logs: 30 days
- See the [Data Retention & Privacy](#data-retention--privacy) section for complete details

**Q: Is PricePilot GDPR compliant?**
A: Yes! PricePilot is fully GDPR compliant and supports:
- Right to Access (export your data)
- Right to Erasure (delete your account)
- Right to Rectification (update your information)
- Right to Data Portability (export in machine-readable formats)
- See the [Data Retention & Privacy](#data-retention--privacy) section for details

**Q: How does PricePilot handle database performance with large datasets?**
A: PricePilot uses multiple optimization strategies:
- 15+ strategic database indexes for 10x faster queries
- Redis caching for expensive operations (1-hour TTL)
- Elimination of N+1 query problems
- Efficient pagination (max 100 items per page)
- Connection pooling for optimal database usage
- See the [Security & Performance](#security--performance) section for details

**Q: What monitoring tools are available for administrators?**
A: Administrators have access to comprehensive monitoring dashboards:
- Proxy Health Dashboard: Monitor proxy pool performance
- Challenge Detection Dashboard: Track anti-bot challenge handling
- Scraping Metrics Dashboard: View platform-wide performance
- Real-Time Monitor: Live view of active scraping sessions
- Alert Management: Stay informed about critical issues
- See the [Monitoring & Analytics](#monitoring--analytics) section for details0.

### Troubleshooting

**Q: My Laravel integration shows "Unauthorized" error**
A: Make sure the API token in your Laravel `.env` file exactly matches the token you entered in PricePilot dashboard. Tokens are case-sensitive.

**Q: Products aren't syncing from my store**
A: Check these:
1. API token is correct
2. Your store URL is accessible from the internet
3. The PricePilot package/plugin is properly installed
4. Check the error logs in your store admin

**Q: Competitor prices aren't updating**
A: Verify that:
1. The competitor URL is correct and accessible
2. The competitor website structure hasn't changed
3. You haven't exceeded your plan's competitor limit

**Q: Price updates aren't applying to my store**
A: Ensure:
1. Automatic updates are enabled in settings
2. Your pricing rules are active
3. The API connection to your store is working
4. Check the update logs for error messages

**Q: Auto-approval rules aren't working**
A: Check these:
1. Rule is enabled (toggle switch is ON)
2. Rule conditions match the pending change
3. Change status is PENDING (not already approved/rejected)
4. Cron job is running (check system status)
5. No higher-priority rule is blocking the match
6. Review audit logs for evaluation details

**Q: Too many changes are being auto-approved**
A: Make your rules more restrictive:
1. Lower the max price change limit
2. Reduce the max percentage change
3. Increase the minimum confidence score
4. Limit allowed strategies
5. Add product category filters
6. Temporarily disable aggressive rules

**Q: Wrong auto-approval rule is triggering**
A: Review rule priorities:
1. Lower priority numbers are evaluated first
2. First matching rule wins (short-circuit)
3. Adjust priority numbers to change evaluation order
4. Make higher-priority rules more specific
5. Consider disabling conflicting rules

**Q: Auto-approved changes failed to update my store**
A: Check:
1. Store API connection is working (test in Integrations)
2. API token is valid and not expired
3. Store is accessible from the internet
4. Review error messages in audit logs
5. Failed updates are automatically rolled back to PENDING

**Q: How do I troubleshoot slow dashboard performance?**
A: Try these solutions:
1. Use pagination (reduce items per page to 20)
2. Use filters to narrow results
3. Clear old data (Dashboard → Settings → Data Retention)
4. Clear browser cache and disable extensions
5. Try a different browser
6. Contact support for database optimization if issues persist

**Q: My API requests are timing out**
A: Solutions:
1. Use pagination: `GET /api/v1/products?page=1&limit=20`
2. Request only needed fields
3. Use filters to narrow results
4. Increase timeout in your API client (30 seconds recommended)
5. Contact support to enable Redis caching

**Q: How do I check if automated cleanup jobs are running?**
A: Go to Dashboard → System Status to verify:
1. Auto-Approval Cron shows recent run time
2. Data Cleanup Jobs show last execution
3. Alert Evaluation shows recent activity
4. If jobs aren't running, contact support

**Q: Can I manually trigger data cleanup?**
A: Yes! Administrators can manually trigger cleanup:
1. Go to Admin → System Settings → Data Retention
2. Click "Run Cleanup Now" for specific data types
3. View cleanup job history and statistics
4. Note: Manual cleanup follows configured retention policies

**Q: How do I monitor system health?**
A: Use the monitoring dashboards:
1. **Admin Panel → Monitor**: Real-time scraping sessions
2. **Admin Panel → Scraping Metrics**: Platform-wide performance
3. **Admin Panel → Proxy Health**: Proxy pool status
4. **Admin Panel → Alerts**: Critical system alerts
5. **Dashboard → Metrics**: Your tenant's performance

**Q: What should I do if I see high block rates?**
A: Follow these steps:
1. Enable Session Warmup (Dashboard → Site Config)
2. Increase delays (Min: 3000ms, Max: 5000ms)
3. Contact support to enable residential proxies
4. Reduce scraping frequency (every 48 hours instead of 24)
5. Check if competitor site has new bot protection

**Q: How do I configure alert thresholds?**
A: Administrators can configure alerts:
1. Go to Admin → Alert Settings
2. Adjust thresholds for each alert type:
   - High block rate (default: >30%)
   - Proxy failures (default: >50%)
   - High error rate (default: >1%)
   - Slow response times (default: >500ms)
3. Set notification preferences (email/Slack)
4. Save changes (apply immediately)

**Q: Can I acknowledge alerts to stop notifications?**
A: Yes! To acknowledge an alert:
1. Go to Admin → Alerts or Dashboard → Alerts
2. Find the alert you want to acknowledge
3. Click "Acknowledge"
4. Add optional notes about resolution
5. Notifications stop for that alert
6. Alert remains in history for tracking

**Q: How do I view alert history?**
A: View complete alert history:
1. Go to Admin → Alert History
2. Filter by:
   - Severity (critical, warning, info)
   - Status (active, acknowledged, resolved)
   - Date range
   - Alert type
3. Export to CSV for analysis
4. Click any alert for full details

---

## 🗄️ Data Retention & Privacy

### Overview

PricePilot implements comprehensive data retention policies to balance operational needs, performance optimization, regulatory compliance, and user privacy. This section outlines how long different types of data are retained and the automated processes that manage data lifecycle.

### Data Retention Policies

#### 1. User & Account Data

**Retention Period**: Indefinite (while account is active)

**Data Types**:
- User profiles (name, email, role)
- Account credentials (password hashes)
- Tenant information (company name, plan type)
- API keys and tokens (encrypted)
- User preferences and settings

**Deletion Policy**:
- Retained for the lifetime of the account
- Deleted within 30 days of account closure request
- Password history retained for 90 days (for password reuse prevention)
- Deleted accounts can be recovered within 30 days (soft delete)

**Compliance**: GDPR Article 17 (Right to Erasure)

---

#### 2. Product Data

**Retention Period**: Indefinite (while product is active)

**Data Types**:
- Product catalog (SKU, title, brand, model)
- Current prices and stock levels
- Product specifications and images
- Product matches and relationships

**Deletion Policy**:
- Active products retained indefinitely
- Deleted products soft-deleted for 90 days (recovery period)
- Permanently deleted after 90 days
- Associated price history archived before deletion

**Archival**: Products deleted for >90 days are archived to cold storage

---

#### 3. Price History

**Retention Period**: 
- **Hot Data**: 90 days (fast access)
- **Warm Data**: 91-365 days (archived)
- **Cold Data**: 1-3 years (long-term storage)

**Data Types**:
- Historical price points
- Price change timestamps
- Currency information

**Deletion Policy**:
- Price history older than 90 days is automatically archived
- Archived data moved to separate tables for performance
- Data older than 3 years is permanently deleted
- Exception: Price history for active products retained longer

**Automated Cleanup**: Daily at 2:00 AM UTC

**Business Justification**: 
- 90 days covers most pricing trend analysis needs
- Archived data available for long-term analytics
- Reduces database size and improves query performance

---

#### 4. Price Update Logs

**Retention Period**: 180 days

**Data Types**:
- Price update execution records
- Old price and new price
- Update strategy and status
- Error details (if failed)
- Execution timestamps

**Deletion Policy**:
- Logs older than 180 days are automatically deleted
- Failed update logs retained for 365 days (debugging)
- Successful updates archived after 180 days

**Automated Cleanup**: Daily at 2:30 AM UTC

**Business Justification**:
- 6 months sufficient for audit and troubleshooting
- Failed updates retained longer for pattern analysis
- Reduces log table size significantly

---

#### 5. Audit Logs

**Retention Period**: 2 years

**Data Types**:
- User actions (approvals, rejections, configuration changes)
- System events (auto-approvals, bulk operations)
- Security events (login attempts, permission changes)
- IP addresses and user agents
- Timestamps and user context

**Deletion Policy**:
- Audit logs older than 2 years are automatically archived
- Archived logs moved to cold storage
- Critical security events retained for 5 years
- Logs can be exported before deletion

**Automated Cleanup**: Monthly on the 1st at 3:00 AM UTC

**Compliance**: 
- GDPR Article 5 (Storage Limitation)
- SOC 2 audit trail requirements
- Industry standard for audit log retention

**Business Justification**:
- 2 years covers most compliance requirements
- Sufficient for security investigations
- Balances compliance with storage costs

---

#### 6. Notifications

**Retention Period**: 90 days

**Data Types**:
- System notifications
- Price change alerts
- Approval notifications
- Error notifications

**Deletion Policy**:
- Read notifications deleted after 90 days
- Unread notifications deleted after 180 days
- Critical notifications retained for 365 days
- Notification preferences retained indefinitely

**Automated Cleanup**: Daily at 1:00 AM UTC

**Business Justification**:
- Most notifications are time-sensitive
- Reduces notification table bloat
- Improves dashboard performance

---

#### 7. Sync Logs

**Retention Period**: 30 days

**Data Types**:
- Product sync execution logs
- Sync success/failure messages
- Sync timestamps and durations
- Error details

**Deletion Policy**:
- Sync logs older than 30 days are automatically deleted
- Failed sync logs retained for 90 days
- Summary statistics retained indefinitely

**Automated Cleanup**: Daily at 1:30 AM UTC

**Business Justification**:
- Recent logs sufficient for troubleshooting
- Failed syncs need longer retention for pattern analysis
- Reduces log table size dramatically

---

#### 8. Scraping Metrics & Sessions

**Retention Period**: 
- **Real-time metrics**: 7 days
- **Aggregated metrics**: 90 days
- **Historical trends**: 1 year

**Data Types**:
- Scraping session details
- Success/failure rates
- Block rates and challenge attempts
- Proxy performance metrics
- Response times

**Deletion Policy**:
- Raw session data deleted after 7 days
- Aggregated daily metrics retained for 90 days
- Monthly summaries retained for 1 year
- Trends and analytics retained for 3 years

**Automated Cleanup**: Daily at 4:00 AM UTC

**Business Justification**:
- Real-time monitoring needs recent data only
- Aggregated data sufficient for trend analysis
- Reduces metrics table size by 90%

---

#### 9. Monitoring & Alert History

**Retention Period**: 90 days (active), 1 year (archived)

**Data Types**:
- Alert trigger events
- Alert acknowledgments
- Metric values at trigger time
- Notification delivery status

**Deletion Policy**:
- Active alerts retained for 90 days
- Resolved alerts archived after 90 days
- Archived alerts deleted after 1 year
- Critical alerts retained for 2 years

**Automated Cleanup**: Weekly on Sundays at 3:00 AM UTC

**Business Justification**:
- Recent alerts needed for incident response
- Historical alerts useful for pattern analysis
- Balances operational needs with storage

---

#### 10. Sessions & Authentication

**Retention Period**: 
- **Active sessions**: 30 days (with "remember me")
- **Expired sessions**: 7 days
- **Password reset tokens**: 1 hour
- **Email verification tokens**: 24 hours

**Data Types**:
- Session tokens
- Session metadata (IP, user agent)
- Last used timestamps
- Authentication tokens

**Deletion Policy**:
- Expired sessions deleted after 7 days
- Active sessions expire after 30 days of inactivity
- Password reset tokens expire after 1 hour
- Email verification tokens expire after 24 hours

**Automated Cleanup**: Daily at 2:00 AM UTC

**Security Justification**:
- Reduces attack surface for session hijacking
- Complies with security best practices
- Prevents token reuse attacks

---

#### 11. Temporary & Cache Data

**Retention Period**: 
- **Redis cache**: 1-24 hours (TTL-based)
- **Temporary files**: 24 hours
- **Export files**: 7 days

**Data Types**:
- Cached API responses
- Cached product lists
- Temporary export files
- Session data

**Deletion Policy**:
- Cache entries expire automatically (TTL)
- Temporary files deleted after 24 hours
- Export files deleted after 7 days
- User can download exports before deletion

**Automated Cleanup**: Hourly via Redis TTL and daily file cleanup at 5:00 AM UTC

**Business Justification**:
- Cache improves performance
- Temporary data not needed long-term
- Reduces storage costs

---

#### 12. Bulk Operation Snapshots

**Retention Period**: 90 days

**Data Types**:
- Bulk operation snapshots (for rollback)
- Original data state
- Changes applied
- Rollback status

**Deletion Policy**:
- Snapshots older than 90 days are automatically deleted
- Rolled-back snapshots retained for 180 days
- Snapshots can be manually deleted after successful operation

**Automated Cleanup**: Weekly on Sundays at 4:00 AM UTC

**Business Justification**:
- 90 days sufficient for rollback needs
- Most rollbacks happen within 7 days
- Reduces snapshot table size

---

### Data Archival Process

#### What Gets Archived

Data that is:
- Older than retention period but still valuable
- Infrequently accessed but needed for compliance
- Required for long-term analytics

#### Archive Storage

- **Location**: Separate archive tables in database
- **Access**: Read-only via admin interface
- **Performance**: Optimized for bulk reads, not real-time queries
- **Backup**: Included in regular backup schedule

#### Archive Tables

- `PriceHistoryArchive`: Price history older than 90 days
- `AuditLogArchive`: Audit logs older than 2 years
- `AlertHistoryArchive`: Alert history older than 90 days
- `SyncLogArchive`: Sync logs older than 30 days

---

### GDPR Compliance

#### Right to Access (Article 15)

Users can request a complete export of their data:

1. Go to **Dashboard → Settings → Privacy**
2. Click **Export My Data**
3. Receive download link via email within 24 hours
4. Export includes all personal data in JSON format

**Export Contents**:
- User profile and account information
- Product data and price history
- Audit logs and activity history
- Notification history
- API keys and integrations

#### Right to Erasure (Article 17)

Users can request account deletion:

1. Go to **Dashboard → Settings → Privacy**
2. Click **Delete My Account**
3. Confirm deletion request
4. Account soft-deleted immediately (30-day recovery period)
5. Permanent deletion after 30 days

**What Gets Deleted**:
- User profile and credentials
- Personal preferences and settings
- Product data and price history
- Audit logs (except those required for legal compliance)
- API keys and tokens

**What Gets Retained** (legal basis):
- Financial transaction records (7 years - tax compliance)
- Security incident logs (5 years - legal defense)
- Aggregated anonymous analytics (no personal data)

#### Right to Rectification (Article 16)

Users can update their personal information:

1. Go to **Dashboard → Settings → Profile**
2. Update any personal information
3. Changes take effect immediately
4. Audit log created for compliance

#### Right to Data Portability (Article 20)

Users can export data in machine-readable format:

1. Go to **Dashboard → Settings → Privacy**
2. Click **Export My Data**
3. Choose format: JSON, CSV, or XML
4. Receive download link via email

---

### Data Security During Retention

#### Encryption

- **At Rest**: All sensitive data encrypted with AES-256-GCM
- **In Transit**: TLS 1.3 for all data transmission
- **Backups**: Encrypted backups stored securely
- **API Tokens**: Encrypted before storage, decrypted on use

#### Access Control

- **Role-Based Access**: Users can only access their tenant's data
- **Admin Access**: Logged and audited
- **API Access**: Authenticated and rate-limited
- **Database Access**: Restricted to application layer only

#### Audit Trail

- All data access logged
- Deletion operations logged
- Export operations logged
- Retention policy changes logged

---

### Automated Cleanup Schedule

| Data Type | Cleanup Frequency | Time (UTC) | Retention Period |
|-----------|------------------|------------|------------------|
| Notifications | Daily | 1:00 AM | 90 days |
| Sync Logs | Daily | 1:30 AM | 30 days |
| Sessions | Daily | 2:00 AM | 7 days (expired) |
| Price History | Daily | 2:00 AM | 90 days (archive) |
| Price Update Logs | Daily | 2:30 AM | 180 days |
| Audit Logs | Monthly | 3:00 AM (1st) | 2 years |
| Alert History | Weekly | 3:00 AM (Sun) | 90 days |
| Bulk Snapshots | Weekly | 4:00 AM (Sun) | 90 days |
| Scraping Metrics | Daily | 4:00 AM | 7 days (raw) |
| Temporary Files | Daily | 5:00 AM | 24 hours |
| Cache Data | Hourly | Continuous | 1-24 hours (TTL) |

**Monitoring**: All cleanup jobs are monitored and logged. Failed cleanups trigger alerts.

---

### Manual Data Management

#### Export Data

Users can manually export data at any time:

1. **Product Data**: Dashboard → Products → Export
2. **Price History**: Dashboard → Analytics → Export
3. **Audit Logs**: Dashboard → Settings → Audit Logs → Export
4. **Complete Export**: Dashboard → Settings → Privacy → Export My Data

**Export Formats**: JSON, CSV, PDF

#### Delete Data

Users can manually delete specific data:

1. **Products**: Dashboard → Products → Select → Delete
2. **Notifications**: Dashboard → Notifications → Clear All
3. **API Keys**: Dashboard → Settings → API Keys → Revoke
4. **Account**: Dashboard → Settings → Privacy → Delete Account

**Note**: Deleted data enters soft-delete state with recovery period before permanent deletion.

---

### Backup & Disaster Recovery

#### Backup Schedule

- **Full Backup**: Daily at 3:00 AM UTC
- **Incremental Backup**: Every 6 hours
- **Retention**: 30 days of daily backups, 12 months of monthly backups

#### Backup Contents

- All database tables (including archived data)
- User-uploaded files and images
- Configuration and settings
- Encryption keys (stored separately)

#### Recovery Time Objective (RTO)

- **Critical Data**: 1 hour
- **Non-Critical Data**: 4 hours
- **Complete System**: 24 hours

#### Recovery Point Objective (RPO)

- **Maximum Data Loss**: 6 hours (incremental backup interval)
- **Typical Data Loss**: <1 hour

---

### Data Retention Configuration

#### Admin Controls

System administrators can configure retention policies:

1. Go to **Admin → System Settings → Data Retention**
2. Adjust retention periods for each data type
3. Enable/disable automated cleanup jobs
4. Schedule manual cleanup operations
5. View cleanup job history and statistics

**Note**: Reducing retention periods does not immediately delete data. Next scheduled cleanup will apply new policy.

#### Tenant-Specific Policies

Enterprise plans can customize retention policies:

- Longer retention for compliance requirements
- Custom archival schedules
- On-demand data exports
- Dedicated backup storage

Contact support@pricepilot.com for custom retention policies.

---

### Compliance Certifications

PricePilot's data retention policies comply with:

- ✅ **GDPR** (General Data Protection Regulation)
- ✅ **CCPA** (California Consumer Privacy Act)
- ✅ **SOC 2 Type II** (Security and Availability)
- ✅ **ISO 27001** (Information Security Management)
- ✅ **PCI DSS** (Payment Card Industry Data Security Standard)

**Audit Reports**: Available upon request for Enterprise customers.

---

### Questions About Data Retention?

**Q: Can I extend retention periods for my account?**
A: Yes, Enterprise plans can customize retention policies. Contact support@pricepilot.com.

**Q: What happens to my data if I cancel my subscription?**
A: Your account enters a 30-day grace period. Data is retained for 30 days, then permanently deleted. You can export your data before cancellation.

**Q: Can I recover deleted data?**
A: Data in soft-delete state (within recovery period) can be recovered. Contact support. Permanently deleted data cannot be recovered.

**Q: How do I export all my data?**
A: Go to Dashboard → Settings → Privacy → Export My Data. You'll receive a download link via email within 24 hours.

**Q: Are archived logs accessible?**
A: Yes, archived logs are accessible via the admin interface. They're read-only and optimized for bulk access, not real-time queries.

**Q: How long are backups retained?**
A: Daily backups for 30 days, monthly backups for 12 months. Enterprise plans can request longer retention.

**Q: What data is never deleted?**
A: Financial transaction records (7 years for tax compliance) and critical security incident logs (5 years for legal defense). All other data follows retention policies.

**Q: Can I request immediate data deletion?**
A: Yes, you can request account deletion at any time. Account is soft-deleted immediately with 30-day recovery period, then permanently deleted.

---

## 🆘 Support

### Need Help?

- **Documentation**: [docs.pricepilot.com](http://localhost:3000/docs) *(coming soon)*
- **Email Support**: support@pricepilot.com
- **Live Chat**: Available in dashboard (Premium & Pro plans)
- **Community Forum**: [community.pricepilot.com](http://localhost:3000/community) *(coming soon)*

### Report a Bug

Found a bug? Please report it:
1. Go to **Dashboard → Settings → Support**
2. Click **Report Issue**
3. Describe the problem with screenshots
4. Our team will respond within 24 hours

### Feature Requests

Have an idea? We'd love to hear it!
- Submit feature requests through the dashboard
- Vote on existing requests
- Track implementation status

---

## 🗺️ Roadmap

### Coming Soon

- [ ] **v1.1**: Real-time WebSocket price updates
- [ ] **v1.2**: AI-powered price optimization
- [ ] **v1.3**: Mobile app (iOS & Android)
- [ ] **v2.0**: Multi-currency support
- [ ] **v2.1**: Advanced analytics with ML insights
- [ ] **v2.2**: API webhooks for custom integrations

---

## 📄 License

© 2026 PricePilot. All rights reserved.

For terms of service, privacy policy, and licensing information, visit:
- [Terms of Service](http://localhost:3000/terms)
- [Privacy Policy](http://localhost:3000/privacy)
- [Cookie Policy](http://localhost:3000/cookies)

---

<p align="center">
  <strong>Built for winners, by senior architects.</strong><br>
  Need help? Contact us at support@pricepilot.com
</p>
