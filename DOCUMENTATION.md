# 📚 PricePilot Documentation

**Version 1.0** | Last Updated: January 2026

Welcome to PricePilot - Your intelligent e-commerce pricing automation platform.

---

## 📖 Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Platform Integrations](#platform-integrations)
4. [Features Overview](#features-overview)
5. [Auto-Approval Rules Guide](#auto-approval-rules-guide)
6. [Monitoring & Analytics](#monitoring--analytics)
7. [API Reference](#api-reference)
8. [FAQ](#faq)
9. [Support](#support)

---

## 🎯 Introduction

PricePilot is a professional-grade SaaS platform designed for e-commerce businesses to automate competitive pricing strategies. Monitor competitor prices in real-time, apply dynamic pricing rules, and maximize your profit margins while staying competitive.

### Key Benefits

- **Real-Time Monitoring**: Track competitor prices automatically every 24 hours
- **Automated Price Updates**: Apply pricing rules and update your store prices instantly
- **Multi-Platform Support**: Currently supports OpenCart and Laravel, with more platforms coming soon
- **Smart Matching**: Automatically match your products with competitor offerings
- **Analytics Dashboard**: Visualize your market position and pricing trends

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
A: Currently, PricePilot works best with single-currency stores. Multi-currency support is coming in v2.0.

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
