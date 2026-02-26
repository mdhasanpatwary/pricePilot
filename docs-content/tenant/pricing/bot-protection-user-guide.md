---
title: "Bot Protection User Guide"
description: "Guide for understanding and working with bot protection features"
category: "pricing"
tags: ["bot-protection", "security", "guide"]
audience: "tenant"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
---

# Bot Protection User Guide

## Overview

This guide explains how to use PricePilot's bot protection features to monitor competitor prices effectively. Learn about site status indicators, manual price entry, last known good prices, and the monitoring dashboard.

## Table of Contents

1. [Understanding Site Status Indicators](#understanding-site-status-indicators)
2. [Manual Price Entry](#manual-price-entry)
3. [Last Known Good Prices](#last-known-good-prices)
4. [Monitoring Dashboard](#monitoring-dashboard)
5. [Common Scenarios](#common-scenarios)
6. [Best Practices](#best-practices)

---

## Understanding Site Status Indicators

### What Are Site Status Indicators?

Site status indicators show the health of competitor website scraping. They help you quickly identify which sites are working well and which need attention.

### Status Levels

#### 🟢 Healthy (Success Rate ≥ 80%)

**What It Means**:
- Scraping is working well
- Most price updates are successful
- No immediate action needed

**What You See**:
- Green indicator on site card
- "Healthy" status label
- Recent successful scrape timestamp

**What to Do**:
- Continue monitoring
- No action required

---

#### 🟡 Degraded (Success Rate 50-79%)

**What It Means**:
- Some scraping issues occurring
- Price data may be delayed
- Situation is being monitored

**What You See**:
- Yellow indicator on site card
- "Degraded" status label
- Warning message with details

**What to Do**:
- Check monitoring dashboard for details
- Review error messages
- Consider manual price entry for critical products
- System will attempt automatic recovery

---

#### 🔴 Blocked (Success Rate < 50%)

**What It Means**:
- Significant scraping problems
- Most attempts are failing
- Immediate attention needed

**What You See**:
- Red indicator on site card
- "Blocked" status label
- Alert notification
- Detailed error information

**What to Do**:
- Use manual price entry for important products
- Check monitoring dashboard
- Review troubleshooting suggestions
- Contact support if persistent


### Where to Find Status Indicators

**Dashboard View**:
1. Navigate to **Dashboard**
2. View **Competitor Sites** section
3. Each site shows status indicator

**Competitor Products View**:
1. Navigate to **Competitor Products**
2. Status indicator shown per site
3. Hover for detailed information

**Monitoring Dashboard**:
1. Navigate to **Admin** → **Scraping Monitor**
2. Comprehensive status overview
3. Detailed metrics and trends

### Understanding Status Changes

**Status Can Change**:
- Status updates every hour
- Based on recent scraping attempts
- Reflects current performance

**Common Status Transitions**:
- Healthy → Degraded: Minor issues starting
- Degraded → Blocked: Issues worsening
- Blocked → Degraded: Recovery beginning
- Degraded → Healthy: Issues resolved

### Status Alerts

**When You'll Be Notified**:
- Status changes to Blocked
- Success rate drops significantly
- CAPTCHA challenges detected
- All proxies blocked

**Notification Channels**:
- In-app notifications
- Email alerts (if configured)
- Dashboard alerts panel

---

## Manual Price Entry

### What Is Manual Price Entry?

When automated scraping fails, you can manually enter competitor prices to keep your price comparisons up to date.

### When to Use Manual Entry

**Use Manual Entry When**:
- Automated scraping is blocked
- Price data is critical and time-sensitive
- Waiting for automatic recovery isn't feasible
- You have the correct price from another source

**Don't Use Manual Entry When**:
- Automated scraping is working (even if slow)
- You're unsure of the correct price
- Price isn't critical for immediate decisions

### How to Enter Prices Manually

#### Method 1: From Competitor Products Page

1. Navigate to **Competitor Products**
2. Find product with failed scraping
3. Look for **"Enter Price Manually"** button
4. Click button to open entry form

#### Method 2: From Product Details

1. Click on competitor product
2. View product details
3. Click **"Manual Price Entry"** button
4. Enter price in form

### Manual Entry Form

**Fields**:
- **Price**: Enter the competitor's current price
- **Currency**: Select currency (usually auto-detected)
- **Source** (optional): Note where you found the price

**Validation**:
- Price must be greater than $0
- Price must be less than $1,000,000
- Price must have valid format (e.g., 99.99)

**Example**:
```
Price: 89.99
Currency: USD
Source: Checked competitor website manually
```

### After Entering a Price

**What Happens**:
1. Price is saved immediately
2. Marked as "manually entered"
3. Your username and timestamp recorded
4. Price comparison updates
5. Available for pricing decisions

**Manual Price Indicator**:
- Shows "✋ Manual" badge
- Displays who entered it
- Shows when it was entered
- Different styling from automated prices

### Automatic Override

**When Scraping Recovers**:
- System continues trying to scrape
- When successful, replaces manual price
- Manual price preserved in history
- You're notified of the update

**Example Timeline**:
```
Day 1, 10:00 AM: Automated scraping fails
Day 1, 10:30 AM: You enter price manually ($89.99)
Day 1, 2:00 PM: Automated scraping succeeds ($92.99)
Day 1, 2:00 PM: Manual price replaced with scraped price
```

### Manual Entry Best Practices

✅ **DO**:
- Verify price before entering
- Enter prices promptly when needed
- Add source notes for reference
- Check for sale prices vs regular prices
- Update if price changes

❌ **DON'T**:
- Guess prices
- Enter outdated prices
- Forget to check currency
- Enter prices when scraping works
- Ignore automatic updates


---

## Last Known Good Prices

### What Are Last Known Good Prices?

When current scraping fails, the system displays the last successfully scraped price with an age indicator. This helps you make informed decisions even when current data isn't available.

### How It Works

**Normal Operation**:
```
Current scrape: Success → Display current price
```

**When Scraping Fails**:
```
Current scrape: Failed → Display last known good price + age
```

### Understanding Age Indicators

**Recent (< 24 hours)**:
- Shows: "Last updated 2 hours ago"
- Indicator: 🟢 Green
- Reliability: High
- Action: Safe to use for decisions

**Moderate (24-48 hours)**:
- Shows: "Last updated 1 day ago"
- Indicator: 🟡 Yellow
- Reliability: Medium
- Action: Use with caution

**Stale (> 48 hours)**:
- Shows: "Last updated 3 days ago" + ⚠️ Stale warning
- Indicator: 🔴 Red
- Reliability: Low
- Action: Consider manual entry or wait

### Where to See Last Known Good Prices

**Competitor Products List**:
```
Product Name: Widget Pro
Price: $89.99
Status: ⚠️ Last known good (2 hours ago)
```

**Product Details Page**:
```
Current Price: Not available
Last Known Good: $89.99 (updated 2 hours ago)
Status: Scraping temporarily unavailable
```

**Price Comparison Table**:
```
Your Price: $99.99
Competitor Price: $89.99 ⚠️ (2 hours old)
Difference: +$10.00
```

### Staleness Configuration

**Default Threshold**: 48 hours

**Customizing Threshold**:
1. Navigate to **Admin** → **Scraping Configuration**
2. Click **Staleness Settings**
3. Set threshold (in hours)
4. Save changes

**Recommended Thresholds**:
- Fast-moving products: 24 hours
- Standard products: 48 hours
- Slow-moving products: 72 hours

### Using Last Known Good Prices

**When to Trust Them**:
- Age < 24 hours
- Product prices don't change frequently
- For general market awareness
- When combined with other data sources

**When to Be Cautious**:
- Age > 48 hours
- Product prices change frequently
- For critical pricing decisions
- During sales or promotions

**When to Use Manual Entry Instead**:
- Age > 72 hours
- Price is critical for immediate decision
- You know price has changed
- Competitor is running a sale

### Price History

**Viewing Price History**:
1. Click on competitor product
2. Navigate to **Price History** tab
3. View historical price chart

**What You'll See**:
- Price trends over time
- Gaps where scraping failed
- Manual entries (marked differently)
- Current vs historical comparison

**Using Price History**:
- Identify price patterns
- Spot sales and promotions
- Validate current prices
- Make informed pricing decisions


---

## Monitoring Dashboard

### Accessing the Dashboard

**Navigation**:
1. Click **Admin** in main menu
2. Select **Scraping Monitor**
3. View comprehensive monitoring dashboard

**Dashboard Sections**:
- Overall metrics
- Site-by-site status
- Recent alerts
- Protection type breakdown
- Proxy health
- Recent scrape attempts

### Overall Metrics

**Key Metrics Displayed**:

**Success Rate**:
- Overall scraping success percentage
- Last 24 hours by default
- Color-coded indicator
- Trend arrow (↑ improving, ↓ declining)

**Total Attempts**:
- Number of scrape attempts
- Successful vs failed breakdown
- Comparison to previous period

**Average Response Time**:
- How long scrapes take
- Helps identify performance issues
- Shown in milliseconds

**Active Alerts**:
- Number of unacknowledged alerts
- Click to view details
- Severity indicators

### Site-by-Site Status

**Site Cards Show**:
- Site name and logo
- Current status indicator
- Success rate percentage
- Last successful scrape time
- Recent protection types
- Quick actions

**Sorting Options**:
- By status (blocked first)
- By success rate (lowest first)
- By last update (oldest first)
- Alphabetically

**Filtering Options**:
- Show only blocked sites
- Show only degraded sites
- Show only healthy sites
- Show sites with alerts

### Protection Type Breakdown

**Chart Shows**:
- Distribution of protection types detected
- Last 24 hours by default
- Helps identify common issues

**Protection Types**:
- IP Block: X attempts
- Rate Limit: X attempts
- CAPTCHA: X attempts
- Fake Data: X attempts
- Other: X attempts

**Using This Information**:
- Identify most common issues
- Prioritize configuration changes
- Understand competitor protection strategies

### Recent Alerts

**Alert List Shows**:
- Alert severity (Critical, Warning, Info)
- Alert type
- Affected site
- Timestamp
- Status (New, Acknowledged)

**Alert Actions**:
- **View Details**: See full alert information
- **Acknowledge**: Mark as seen
- **Dismiss**: Remove from list
- **View Logs**: See related scrape attempts

**Alert Types**:
- 🔴 **Critical**: CAPTCHA detected, all proxies blocked
- 🟡 **Warning**: Success rate drop, high failure rate
- 🔵 **Info**: Scraping recovered, configuration changed

### Proxy Health

**Proxy List Shows**:
- Proxy identifier
- Provider name
- Success rate
- Last used timestamp
- Status (Active, Cooldown, Blocked)

**Health Indicators**:
- 🟢 Green: Success rate > 80%
- 🟡 Yellow: Success rate 50-80%
- 🔴 Red: Success rate < 50%

**Proxy Actions**:
- View detailed health stats
- Disable/enable proxy
- Remove proxy
- Test proxy

### Recent Scrape Attempts

**Attempt Log Shows**:
- Timestamp
- Competitor site
- Product
- Strategy used
- Success/failure
- Protection detected
- Response time

**Filtering**:
- By site
- By success/failure
- By protection type
- By date range

**Viewing Details**:
- Click attempt to see full details
- View response sample
- See screenshot (if available)
- Review error messages

### Time Range Selection

**Available Ranges**:
- Last hour
- Last 24 hours (default)
- Last 7 days
- Last 30 days
- Custom range

**Affects**:
- All metrics
- Charts and graphs
- Success rate calculations
- Alert counts

### Exporting Data

**Export Options**:
- Export metrics as CSV
- Export logs as CSV
- Export charts as images
- Generate PDF report

**Use Cases**:
- Share with team
- Track trends over time
- Include in reports
- Analyze in external tools


---

## Common Scenarios

### Scenario 1: Competitor Site Suddenly Blocked

**What You See**:
- Status changes to 🔴 Blocked
- Alert notification appears
- Recent scrapes all failing
- Protection type: IP Block

**What to Do**:
1. **Acknowledge the alert**
2. **Check if urgent**: Do you need prices immediately?
   - Yes → Use manual price entry
   - No → Wait for automatic recovery
3. **Review dashboard**: Check protection type and details
4. **Monitor**: System will attempt recovery automatically
5. **If persistent** (> 48 hours): Contact support

**Expected Timeline**:
- System tries different strategies automatically
- Recovery usually within 24 hours
- Manual intervention may be needed for persistent blocks

---

### Scenario 2: Price Data Is Stale

**What You See**:
- "Last updated 3 days ago" message
- ⚠️ Stale warning indicator
- Yellow or red age indicator

**What to Do**:
1. **Check site status**: Is scraping currently blocked?
2. **Verify manually**: Visit competitor site to check current price
3. **Enter manually**: If price is critical and different
4. **Wait if possible**: System continues trying to scrape
5. **Check back**: Monitor for automatic updates

**When to Act Immediately**:
- Price is critical for pricing decision
- You know competitor is running a sale
- Stale price is significantly different from current
- Customer is asking about competitor pricing

---

### Scenario 3: Manual Price Needs Updating

**What You See**:
- ✋ Manual price indicator
- Price was entered days ago
- Scraping still not working
- Price may have changed

**What to Do**:
1. **Verify current price**: Check competitor website
2. **Update if changed**: Enter new manual price
3. **Add note**: Explain why updating
4. **Monitor scraping**: Check if automatic recovery happening
5. **Consider alternatives**: Contact support if long-term issue

---

### Scenario 4: Multiple Sites Degraded

**What You See**:
- Several sites showing 🟡 Degraded status
- Success rates between 50-80%
- Multiple alerts

**What to Do**:
1. **Check overall metrics**: Is this a system-wide issue?
2. **Review protection types**: Common pattern?
3. **Prioritize**: Focus on most important competitors
4. **Manual entry**: For critical products only
5. **Contact support**: If affecting many sites

**Possible Causes**:
- Proxy provider issues
- Network problems
- Coordinated protection updates
- System configuration issue

---

### Scenario 5: CAPTCHA Challenge Detected

**What You See**:
- 🔴 Critical alert
- "CAPTCHA Challenge Detected" message
- Scraping completely blocked
- Protection type: CAPTCHA

**What to Do**:
1. **Use manual entry**: For all products from this site
2. **Acknowledge alert**: Mark as seen
3. **Wait for recovery**: System will try advanced strategies
4. **Monitor progress**: Check dashboard daily
5. **Contact support**: If persists > 7 days

**What System Does Automatically**:
- Switches to stealth browser
- Increases delays significantly
- Uses residential proxies
- Attempts recovery periodically

**Expected Timeline**:
- CAPTCHA challenges are difficult to bypass
- May take several days to resolve
- Manual entry recommended during this time

---

## Best Practices

### Daily Routine

**Morning Check** (5 minutes):
1. Review dashboard overall metrics
2. Check for new alerts
3. Identify any blocked sites
4. Enter manual prices if critical

**Weekly Review** (15 minutes):
1. Review success rate trends
2. Check all site statuses
3. Update manual prices if needed
4. Acknowledge resolved alerts
5. Review price history for key products

**Monthly Audit** (30 minutes):
1. Review all competitor sites
2. Check for persistent issues
3. Verify manual entries are still needed
4. Review and export metrics
5. Plan any configuration changes

### Pricing Decision Guidelines

**Using Automated Prices**:
- ✅ Status is Healthy
- ✅ Price is current (< 24 hours)
- ✅ No protection detected
- ✅ Consistent with history

**Using Last Known Good**:
- ⚠️ Age < 48 hours
- ⚠️ Status is Degraded
- ⚠️ Price consistent with trends
- ⚠️ Not during known sales

**Using Manual Prices**:
- ✅ Recently verified
- ✅ Entered by trusted user
- ✅ Includes source notes
- ✅ Consistent with market

**When to Wait**:
- ❌ All data is stale (> 72 hours)
- ❌ Status is Blocked with no manual entry
- ❌ Conflicting information
- ❌ Major price discrepancy

### Communication

**With Your Team**:
- Share dashboard access
- Discuss blocked sites
- Coordinate manual entries
- Review pricing decisions together

**With Support**:
- Provide specific site names
- Include success rates
- Share alert details
- Describe business impact

**With Stakeholders**:
- Explain data limitations
- Highlight manual entries
- Note stale data
- Provide context for decisions

### Optimization Tips

**Improve Success Rates**:
- Monitor dashboard regularly
- Act on alerts promptly
- Keep manual entries updated
- Report persistent issues

**Reduce Manual Work**:
- Let system recover automatically when possible
- Don't enter prices unnecessarily
- Use staleness thresholds appropriately
- Trust last known good for non-critical decisions

**Better Decision Making**:
- Review price history
- Consider multiple data points
- Note data freshness
- Document your reasoning

---

## Frequently Asked Questions

**Q: How often does the system try to scrape?**
A: Typically every 4-24 hours depending on configuration and site status.

**Q: Will manual prices be overwritten?**
A: Yes, when automated scraping succeeds, it replaces manual prices. Manual prices are preserved in history.

**Q: How long are last known good prices kept?**
A: Indefinitely, but marked as stale after configured threshold (default 48 hours).

**Q: Can I disable scraping for a specific site?**
A: Yes, contact support or use the configuration interface to disable specific sites.

**Q: What happens if I enter a wrong price manually?**
A: You can update it immediately. All changes are logged with timestamps and user information.

**Q: How do I know if scraping has recovered?**
A: You'll receive a recovery notification, and the site status will change to Healthy or Degraded.

**Q: Can I see who entered manual prices?**
A: Yes, manual price entries show the username and timestamp.

**Q: What if competitor prices change frequently?**
A: Consider reducing staleness threshold and monitoring more closely. Manual entry may be needed more often.

**Q: Are there limits on manual price entries?**
A: No limits, but excessive manual entries may indicate a configuration issue worth investigating.

**Q: Can I export price history?**
A: Yes, use the export feature in the monitoring dashboard or price history view.

---

## Getting Help

**Documentation**:
- [Configuration Guide](./BOT_PROTECTION_CONFIGURATION_GUIDE.md)
- [Troubleshooting Guide](./BOT_PROTECTION_TROUBLESHOOTING_GUIDE.md)
- [API Reference](./BOT_PROTECTION_API_REFERENCE.md)

**Support Channels**:
- **Email**: support@pricepilot.com
- **Priority Support**: priority@pricepilot.com
- **Documentation**: https://docs.pricepilot.com
- **Community**: https://community.pricepilot.com

**Training Resources**:
- Video tutorials
- Webinars
- Best practices guides
- Case studies

**Feedback**:
We welcome your feedback on this feature. Contact us with suggestions, issues, or success stories.
