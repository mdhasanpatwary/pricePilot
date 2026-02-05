---
title: "Monitoring & Alerting"
description: "Complete guide to notifications, alert configuration, scraping alerts, and audit logs in PricePilot"
category: "monitoring"
subcategory: null
tags: ["monitoring", "alerts", "notifications", "audit-logs", "scraping-alerts", "price-alerts"]
author: "PricePilot Team"
lastReviewed: "2024-02-05"
relatedDocs: ["scraping-bot-protection", "price-approval-guide", "admin-monitoring"]
---

# Monitoring & Alerting

## Overview

PricePilot's monitoring and alerting system keeps you informed about important events, price changes, and system activities. Whether you need to know when competitor prices drop, when scraping encounters issues, or when price updates are applied, PricePilot's comprehensive notification system ensures you stay in control.

### What You'll Learn

- **Notifications**: Available notification channels and delivery options
- **Alert Configuration**: Setting up price change alerts and thresholds
- **Scraping Alerts**: Monitoring scraping performance and failures
- **Audit Logs**: Reviewing system activity and tracking changes

### Key Benefits

**Stay Informed**
- Real-time notifications for critical events
- Daily digests for routine updates
- Weekly summaries for strategic insights
- Custom alerts for your specific needs

**Proactive Management**
- Catch issues before they impact your business
- Respond quickly to competitor price changes
- Monitor system health and performance
- Track all pricing decisions and changes

**Complete Visibility**
- Comprehensive audit trail of all actions
- Detailed logs for troubleshooting
- Performance metrics and trends
- Historical data for analysis


## Notifications


PricePilot offers multiple notification channels to keep you informed about important events and system activities.

### Available Notification Channels

#### 1. Email Notifications

**Features:**
- Delivered to your registered email address
- Rich HTML formatting for easy reading
- Includes links to relevant dashboard pages
- Supports attachments for reports

**Best For:**
- Detailed information and reports
- Non-urgent updates
- Daily and weekly digests
- Team-wide notifications

**Configuration:**
1. Navigate to **Settings** → **Notifications**
2. Enable **Email Notifications**
3. Verify your email address
4. Select notification types to receive via email
5. Save preferences

#### 2. In-App Notifications

**Features:**
- Real-time notifications within PricePilot dashboard
- Notification bell icon with unread count
- Clickable notifications that navigate to relevant pages
- Notification history and archive

**Best For:**
- Immediate awareness while using the platform
- Quick access to related information
- Real-time updates
- Action-required notifications

**Accessing In-App Notifications:**
1. Click the **bell icon** in the top navigation
2. View unread notifications
3. Click notification to view details
4. Mark as read or dismiss

#### 3. Webhook Notifications (API Integration)

**Features:**
- POST requests to your specified endpoint
- JSON payload with event data
- Configurable retry logic
- Signature verification for security

**Best For:**
- Integration with external systems
- Custom notification handling
- Automated workflows
- Third-party tool integration

**Setting Up Webhooks:**
1. Go to **Settings** → **Integrations**
2. Select **Webhooks**
3. Click **Add Webhook**
4. Enter your endpoint URL
5. Select events to receive
6. Configure authentication (optional)
7. Test webhook connection
8. Save configuration

**Webhook Payload Example:**
```json
{
  "event": "price_change_detected",
  "timestamp": "2024-02-05T10:30:00Z",
  "data": {
    "productId": "prod_123",
    "productName": "Example Product",
    "competitorName": "Competitor Store",
    "oldPrice": 99.99,
    "newPrice": 89.99,
    "percentageChange": -10.0,
    "url": "https://app.pricepilot.com/products/prod_123"
  }
}
```

#### 4. SMS Notifications (Premium Feature)

**Features:**
- Text message alerts to your mobile phone
- Critical alerts only to avoid spam
- Short, concise messages
- Immediate delivery

**Best For:**
- Critical alerts requiring immediate attention
- System outages or failures
- High-priority price changes
- Emergency notifications

**Enabling SMS:**
1. Navigate to **Settings** → **Notifications**
2. Select **SMS Notifications** (Premium)
3. Enter and verify your phone number
4. Choose critical alert types
5. Set quiet hours (optional)
6. Save preferences

### Notification Types

#### Price Change Notifications

Get notified when competitor prices change:

**New Price Changes Detected**
- Triggered after each scraping cycle
- Shows count of new price changes
- Includes summary of significant changes
- Links to price approval dashboard

**Large Price Drops**
- Competitor price decreased significantly
- Configurable threshold (e.g., >10% decrease)
- Immediate notification
- Opportunity to respond quickly

**Large Price Increases**
- Competitor price increased significantly
- Configurable threshold (e.g., >10% increase)
- May indicate opportunity to raise your prices
- Strategic pricing insight

**Competitor Out of Stock**
- Competitor product became unavailable
- Opportunity to capture market share
- May trigger price increase rules
- Competitive advantage alert

#### Approval Workflow Notifications

Stay informed about pending price changes:

**New Changes Queued for Approval**
- Triggered when new price changes are ready for review
- Shows count of pending changes
- Includes expiration timeline
- Links to approval dashboard

**Changes Expiring Soon**
- Sent 24 hours before changes expire
- Lists changes about to expire
- Prevents missing important opportunities
- Includes quick approval links

**Approval Actions Completed**
- Confirmation when you approve/reject changes
- Summary of applied changes
- Success/failure status
- Links to updated products

**Bulk Operation Results**
- Summary of bulk approval/rejection
- Count of successful and failed operations
- Details of any errors
- Links to detailed results

#### Scraping Notifications

Monitor scraping performance and issues:

**Scraping Cycle Completed**
- Triggered after each scheduled scrape
- Summary of products scraped
- Count of price changes detected
- Success rate and any errors

**Scraping Failures**
- Triggered when scraping fails for a competitor
- Error details and possible causes
- Suggested troubleshooting steps
- Links to scraping logs

**Bot Protection Detected**
- CAPTCHA challenges encountered
- IP blocking detected
- Rate limiting triggered
- Mitigation strategies applied

**Persistent Scraping Issues**
- Multiple consecutive failures
- Declining success rates
- Requires attention
- Recommended actions

#### System Notifications

Stay informed about system events:

**Integration Status Changes**
- Store connection established/lost
- API token issues
- Authentication failures
- Configuration updates

**Price Updates Applied**
- Confirmation when prices are updated in your store
- Count of successful updates
- Any failed updates
- Links to updated products

**System Maintenance**
- Scheduled maintenance notifications
- Expected downtime
- Feature updates
- System improvements

**Account Notifications**
- Plan changes or upgrades
- Billing notifications
- Usage limit warnings
- Account security alerts

### Notification Preferences

#### Configuring Notification Preferences

Customize which notifications you receive and how:

**Step 1: Access Notification Settings**
1. Navigate to **Settings** → **Notifications**
2. Review available notification types
3. See current configuration

**Step 2: Choose Notification Types**

Enable or disable specific notification types:

```
Price Change Notifications:
☑ New price changes detected
☑ Large price drops (>10%)
☑ Large price increases (>10%)
☑ Competitor out of stock
☐ Small price changes (<5%)

Approval Workflow:
☑ New changes queued
☑ Changes expiring soon (24h)
☑ Approval actions completed
☐ Daily approval summary

Scraping Notifications:
☑ Scraping failures
☑ Bot protection detected
☑ Persistent issues
☐ Scraping cycle completed

System Notifications:
☑ Integration status changes
☑ Price updates applied
☑ System maintenance
☑ Account notifications
```

**Step 3: Select Delivery Channels**

Choose how to receive each notification type:

```
Notification Type          | Email | In-App | SMS | Webhook
---------------------------|-------|--------|-----|--------
Large price drops          |   ✓   |   ✓    |  ✓  |   ✓
Scraping failures          |   ✓   |   ✓    |     |   ✓
Changes expiring soon      |   ✓   |   ✓    |     |
Daily digest               |   ✓   |        |     |
```

**Step 4: Set Notification Frequency**

Control how often you receive notifications:

**Immediate Notifications:**
- Critical alerts
- Large price changes
- System failures
- Urgent actions required

**Batched Notifications:**
- Daily digest (once per day)
- Weekly summary (once per week)
- Monthly report (once per month)

**Step 5: Configure Quiet Hours**

Prevent notifications during specific times:

```
Quiet Hours: 10:00 PM - 7:00 AM
Days: Monday - Sunday
Timezone: Your local timezone
Exceptions: Critical alerts only
```

**Step 6: Save Preferences**

Review and save your configuration:

1. Review all settings
2. Click **Save Preferences**
3. Confirm changes
4. Test notifications (optional)

### Notification Digests

#### Daily Digest

Receive a comprehensive daily summary:

**Included Information:**
- New price changes detected (count and highlights)
- Pending approvals requiring attention
- Scraping performance summary
- Price updates applied
- Any errors or issues
- Key metrics and trends

**Delivery Time:**
- Configurable (default: 8:00 AM your timezone)
- Sent only if there's activity
- Includes previous 24 hours

**Sample Daily Digest:**
```
PricePilot Daily Digest - February 5, 2024

📊 Summary
- 15 new price changes detected
- 8 pending approvals (3 expiring soon)
- 12 products scraped successfully
- 2 price updates applied

🔴 Large Price Drops
- Product A: Competitor dropped 15% ($99.99 → $84.99)
- Product B: Competitor dropped 12% ($149.99 → $131.99)

⚠️ Attention Required
- 3 price changes expiring in 24 hours
- 1 scraping failure (Competitor X)

✅ Recent Activity
- Approved 5 price changes
- Updated 2 product prices
- Added 1 new competitor

View Full Dashboard →
```

#### Weekly Summary

Comprehensive weekly performance report:

**Included Information:**
- Total price changes detected
- Approval statistics (approved, rejected, expired)
- Scraping performance metrics
- Price update success rates
- Competitor activity trends
- System health overview
- Recommendations for optimization

**Delivery Time:**
- Configurable (default: Monday 9:00 AM)
- Covers previous 7 days
- Includes charts and visualizations

**Sample Weekly Summary:**
```
PricePilot Weekly Summary - Week of Jan 29 - Feb 4, 2024

📈 Key Metrics
- 87 price changes detected (+12% vs. last week)
- 65 changes approved (75% approval rate)
- 15 changes rejected (17% rejection rate)
- 7 changes expired (8% expiration rate)
- 95% scraping success rate

🏆 Top Performers
- Most active competitor: Competitor A (23 price changes)
- Most approved product category: Electronics (45 approvals)
- Highest price drop: Product X (-25%)

⚠️ Areas for Attention
- Competitor B: Declining scraping success (85%)
- 12 products with no recent competitor data
- 3 integration warnings

💡 Recommendations
- Review pricing rules for Electronics category
- Investigate Competitor B scraping issues
- Update product matching for 5 unmatched products

View Detailed Report →
```

#### Monthly Report

Strategic monthly performance analysis:

**Included Information:**
- Monthly performance overview
- Pricing strategy effectiveness
- Competitive landscape analysis
- ROI and business impact
- Long-term trends
- Strategic recommendations

**Delivery Time:**
- First Monday of each month
- Covers previous calendar month
- Comprehensive PDF report

### Managing Notifications

#### Notification History

View past notifications:

1. Click **bell icon** in navigation
2. Select **View All Notifications**
3. Filter by type, date, or status
4. Search for specific notifications
5. Mark as read/unread
6. Archive old notifications

**Notification Details:**
- Timestamp
- Notification type
- Summary message
- Full details
- Related links
- Actions taken

#### Notification Preferences Per Competitor

Customize notifications for specific competitors:

**Use Case:**
- High-priority competitors: All notifications
- Standard competitors: Important notifications only
- Low-priority competitors: Critical notifications only

**Configuration:**
1. Navigate to **Competitors** page
2. Click on competitor name
3. Select **Notification Settings**
4. Choose notification level:
   - All notifications
   - Important only
   - Critical only
   - None (mute)
5. Save preferences

#### Muting Notifications

Temporarily disable notifications:

**Mute Options:**
- Mute for 1 hour
- Mute for 24 hours
- Mute for 1 week
- Mute until manually re-enabled

**How to Mute:**
1. Go to **Settings** → **Notifications**
2. Click **Mute Notifications**
3. Select duration
4. Confirm

**Note:** Critical system alerts cannot be muted.


## Alert Configuration


Configure custom alerts based on your specific business needs and priorities.

### Price Change Alerts

Set up alerts for significant competitor price movements:

#### Configuring Price Drop Alerts

Get notified when competitors lower their prices:

**Step 1: Access Alert Configuration**
1. Navigate to **Settings** → **Alerts**
2. Select **Price Change Alerts**
3. Click **Add New Alert**

**Step 2: Define Alert Criteria**

**Alert Type:** Price Drop

**Threshold Options:**
- **Percentage-based**: Alert when price drops by X%
  - Example: Alert when price drops >10%
- **Dollar-based**: Alert when price drops by $X
  - Example: Alert when price drops >$50
- **Combined**: Alert when either threshold is met
  - Example: Alert when price drops >10% OR >$50

**Step 3: Set Scope**

Choose which products trigger the alert:

**All Products:**
- Monitor all matched products
- Broadest coverage
- May generate many alerts

**Specific Categories:**
- Monitor products in selected categories
- Example: Electronics, Clothing, Home Goods
- Focused monitoring

**Specific Products:**
- Monitor individual high-value products
- Most targeted approach
- Minimal alert volume

**Specific Competitors:**
- Monitor specific competitor(s) only
- Focus on key competitors
- Reduce noise from less important competitors

**Step 4: Configure Delivery**

Choose how to receive the alert:

```
Delivery Channels:
☑ Email (immediate)
☑ In-app notification
☑ Webhook
☐ SMS (critical only)

Frequency:
○ Immediate (as detected)
● Batched (hourly digest)
○ Daily digest only
```

**Step 5: Test and Save**

1. Click **Test Alert** to verify configuration
2. Review test notification
3. Adjust settings if needed
4. Click **Save Alert**
5. Enable alert

**Example Configuration:**
```
Alert Name: Large Electronics Price Drops
Type: Price Drop
Threshold: >10% OR >$50
Scope: Electronics category
Competitors: All
Delivery: Email + In-app (immediate)
Status: Active
```

#### Configuring Price Increase Alerts

Monitor when competitors raise prices:

**Use Cases:**
- Identify opportunities to raise your prices
- Track competitor pricing strategies
- Understand market trends
- Maintain competitive positioning

**Configuration:**
Similar to price drop alerts, but for increases:

```
Alert Name: Competitor Price Increases
Type: Price Increase
Threshold: >15%
Scope: All products
Competitors: Top 3 competitors
Delivery: Email (daily digest)
Status: Active
```

#### Configuring Availability Alerts

Get notified when competitor stock status changes:

**Out of Stock Alerts:**
```
Alert Name: Competitor Out of Stock
Type: Availability Change
Condition: In Stock → Out of Stock
Scope: High-value products
Action: Notify immediately
Opportunity: Capture market share
```

**Back in Stock Alerts:**
```
Alert Name: Competitor Back in Stock
Type: Availability Change
Condition: Out of Stock → In Stock
Scope: All products
Action: Notify daily digest
Impact: Increased competition
```

### Alert Thresholds

#### Understanding Thresholds

Thresholds determine when alerts are triggered:

**Too Low:**
- Generates too many alerts
- Alert fatigue
- Important alerts get lost
- Reduced effectiveness

**Too High:**
- Misses important changes
- Delayed response
- Lost opportunities
- Reduced competitiveness

**Just Right:**
- Meaningful alerts only
- Actionable information
- Timely notifications
- Optimal response

#### Recommended Thresholds

**By Product Value:**

**High-Value Products (>$500):**
```
Price Drop: >5% or >$25
Price Increase: >5% or >$25
Rationale: Small changes have big impact
```

**Medium-Value Products ($100-$500):**
```
Price Drop: >10% or >$50
Price Increase: >15% or >$75
Rationale: Balance sensitivity and noise
```

**Low-Value Products (<$100):**
```
Price Drop: >15% or >$15
Price Increase: >20% or >$20
Rationale: Focus on significant changes
```

**By Industry:**

**Electronics:**
```
Price Drop: >8%
Price Increase: >12%
Rationale: Frequent price changes, competitive market
```

**Fashion/Apparel:**
```
Price Drop: >15%
Price Increase: >20%
Rationale: Seasonal pricing, sales events
```

**Home Goods:**
```
Price Drop: >10%
Price Increase: >15%
Rationale: Moderate price volatility
```

**Luxury Goods:**
```
Price Drop: >5%
Price Increase: >5%
Rationale: Price stability important, small changes significant
```

#### Dynamic Thresholds

Adjust thresholds based on market conditions:

**Seasonal Adjustments:**
- Lower thresholds during peak season
- Higher thresholds during slow periods
- Account for expected volatility

**Competitive Intensity:**
- Lower thresholds for highly competitive products
- Higher thresholds for unique products
- Adjust based on competitor count

**Historical Volatility:**
- Lower thresholds for stable products
- Higher thresholds for volatile products
- Learn from historical patterns

### Alert Rules

#### Creating Alert Rules

Combine multiple conditions for sophisticated alerting:

**Rule Structure:**
```
IF [Condition 1] AND/OR [Condition 2]
THEN [Action]
FOR [Scope]
DELIVER VIA [Channels]
```

**Example Rule 1: Competitive Threat**
```
IF competitor price drops >10%
AND competitor is in stock
AND our price is higher
THEN send immediate alert
FOR high-value products
DELIVER VIA email + SMS
```

**Example Rule 2: Pricing Opportunity**
```
IF competitor price increases >15%
OR competitor goes out of stock
THEN send alert
FOR all matched products
DELIVER VIA email (daily digest)
```

**Example Rule 3: Market Movement**
```
IF 3+ competitors change price
AND average change >10%
THEN send market trend alert
FOR affected product category
DELIVER VIA email + webhook
```

#### Rule Priority

When multiple rules match, priority determines which fires:

**Priority Levels:**
1. **Critical**: Immediate action required
2. **High**: Important, timely response needed
3. **Medium**: Notable, review when convenient
4. **Low**: Informational, batch with other alerts

**Setting Priority:**
1. Edit alert rule
2. Select **Priority Level**
3. Configure delivery based on priority
4. Save changes

**Priority-Based Delivery:**
```
Critical: Email + SMS + In-app (immediate)
High: Email + In-app (immediate)
Medium: Email (hourly batch) + In-app
Low: Daily digest only
```

### Alert Management

#### Viewing Active Alerts

Monitor your configured alerts:

1. Navigate to **Settings** → **Alerts**
2. View list of active alerts
3. See alert statistics:
   - Times triggered
   - Last triggered
   - Success rate
   - Delivery status

**Alert Dashboard:**
```
Alert Name                    | Status | Triggered | Last Fired
------------------------------|--------|-----------|------------
Large Electronics Price Drops | Active | 23 times  | 2 hours ago
Competitor Out of Stock       | Active | 5 times   | 1 day ago
Market Trend Alert            | Paused | 12 times  | 3 days ago
```

#### Editing Alerts

Modify existing alerts:

1. Click on alert name
2. Update configuration:
   - Thresholds
   - Scope
   - Delivery channels
   - Priority
3. Test updated alert
4. Save changes

#### Pausing Alerts

Temporarily disable alerts without deleting:

**Use Cases:**
- During promotions or sales
- When on vacation
- During system maintenance
- Testing new configurations

**How to Pause:**
1. Navigate to alert list
2. Click **Pause** button
3. Select duration (optional)
4. Confirm

**Resuming:**
1. Click **Resume** button
2. Alert becomes active immediately

#### Deleting Alerts

Remove alerts you no longer need:

1. Navigate to alert list
2. Click **Delete** button
3. Confirm deletion
4. Alert is permanently removed

**Note:** Alert history is preserved for audit purposes.

### Alert Analytics

#### Alert Performance Metrics

Track how your alerts are performing:

**Available Metrics:**
- Total alerts triggered
- Alerts by type
- Alerts by priority
- Delivery success rate
- Response time
- False positive rate

**Viewing Metrics:**
1. Go to **Settings** → **Alerts**
2. Select **Analytics** tab
3. Choose time range
4. Review performance data

**Sample Metrics:**
```
Last 30 Days:
- 156 alerts triggered
- 98% delivery success rate
- Average response time: 2.3 hours
- Most triggered: Price Drop Alerts (89)
- Least triggered: Market Trend Alerts (12)
```

#### Optimizing Alert Configuration

Use analytics to improve your alerts:

**High False Positive Rate:**
- Increase thresholds
- Narrow scope
- Add more conditions
- Reduce sensitivity

**Missing Important Changes:**
- Lower thresholds
- Broaden scope
- Add more alert types
- Increase monitoring

**Alert Fatigue:**
- Consolidate similar alerts
- Use batched delivery
- Increase thresholds
- Focus on high-priority only

**Low Response Rate:**
- Improve alert relevance
- Adjust delivery timing
- Clarify alert messages
- Add actionable information


## Scraping Alerts


Monitor scraping performance and get notified about issues that could impact data collection.

### Scraping Performance Monitoring

#### Success Rate Tracking

Monitor how reliably scraping is working:

**Key Metrics:**
- **Overall Success Rate**: Percentage of successful scrapes across all competitors
- **Per-Competitor Success Rate**: Success rate for each competitor
- **Product Coverage**: Percentage of products successfully scraped
- **Data Freshness**: How recent the scraped data is

**Viewing Success Rates:**
1. Navigate to **Competitors** page
2. View **Success Rate** column
3. Click on competitor for detailed metrics
4. Review trends over time

**Success Rate Indicators:**
```
95-100%: 🟢 Excellent - No action needed
85-94%:  🟡 Good - Monitor for patterns
70-84%:  🟠 Fair - Review scraping logs
<70%:    🔴 Poor - Immediate attention required
```

#### Scraping Failure Alerts

Get notified when scraping fails:

**Alert Types:**

**Single Scraping Failure:**
```
Alert: Scraping Failed
Competitor: Example Store
Timestamp: 2024-02-05 10:30 AM
Error: Connection timeout
Products Affected: 45
Action: Automatic retry scheduled
```

**Multiple Consecutive Failures:**
```
Alert: Persistent Scraping Failure
Competitor: Example Store
Failures: 3 consecutive
Last Success: 3 days ago
Products Affected: 45
Action: Manual intervention required
```

**Declining Success Rate:**
```
Alert: Scraping Success Rate Declining
Competitor: Example Store
Current Rate: 75% (down from 95%)
Period: Last 7 days
Trend: Declining
Action: Review scraping configuration
```

#### Configuring Scraping Alerts

Set up alerts for scraping issues:

**Step 1: Access Scraping Alerts**
1. Navigate to **Settings** → **Alerts**
2. Select **Scraping Alerts**
3. Click **Configure**

**Step 2: Choose Alert Conditions**

```
☑ Single scraping failure
☑ 2+ consecutive failures
☑ Success rate drops below 85%
☑ Success rate drops below 70%
☑ No successful scrape in 48 hours
☐ Any scraping error (verbose)
```

**Step 3: Set Notification Preferences**

```
Delivery:
☑ Email (immediate for critical)
☑ In-app notification
☐ SMS (critical only)
☑ Webhook

Frequency:
● Immediate for critical issues
○ Hourly digest
○ Daily digest
```

**Step 4: Save Configuration**

### Bot Protection Alerts

Monitor bot protection encounters:

#### CAPTCHA Detection Alerts

Get notified when CAPTCHA challenges are encountered:

**Alert Information:**
- Competitor affected
- CAPTCHA type (reCAPTCHA, hCaptcha, etc.)
- Frequency of encounters
- Resolution success rate
- Impact on data collection

**Sample Alert:**
```
Alert: CAPTCHA Detected
Competitor: Example Store
Type: reCAPTCHA v3
Frequency: 3 out of last 5 scrapes
Resolution: 2 successful, 1 failed
Impact: 20% of products not updated
Recommendation: Enable IP rotation
```

#### IP Blocking Alerts

Monitor IP blocking events:

**Alert Types:**

**Temporary IP Block:**
```
Alert: Temporary IP Block
Competitor: Example Store
IP Address: 192.168.1.100
Block Duration: Estimated 24 hours
Action: Rotated to alternative IP
Status: Scraping resumed
```

**Persistent IP Block:**
```
Alert: Persistent IP Block
Competitor: Example Store
Blocked IPs: 3
Duration: 7+ days
Impact: Unable to scrape competitor
Action: Manual intervention required
Recommendation: Contact support
```

#### Rate Limiting Alerts

Track rate limiting encounters:

**Alert Information:**
- Rate limit threshold hit
- Frequency of rate limiting
- Automatic slowdown applied
- Impact on scraping schedule

**Sample Alert:**
```
Alert: Rate Limit Encountered
Competitor: Example Store
Limit: 100 requests/hour
Current Rate: 120 requests/hour
Action: Automatic slowdown applied
New Rate: 80 requests/hour
Impact: Scraping time increased by 25%
```

### Scraping Error Notifications

#### Error Types and Alerts

Different error types trigger different alerts:

**Network Errors:**
```
Error Type: Connection Timeout
Severity: Medium
Action: Automatic retry
Alert: Only if persistent (3+ failures)
```

**HTTP Errors:**
```
Error Type: 404 Not Found
Severity: Low (product may be removed)
Action: Mark product as unavailable
Alert: Daily digest

Error Type: 500 Server Error
Severity: Medium
Action: Retry after delay
Alert: If persistent

Error Type: 403 Forbidden
Severity: High (blocking)
Action: Bot protection mitigation
Alert: Immediate
```

**Parsing Errors:**
```
Error Type: Price Selector Not Found
Severity: High
Action: Try alternative selectors
Alert: Immediate (site structure may have changed)
```

#### Error Alert Configuration

Customize which errors trigger alerts:

**Error Severity Levels:**

**Critical Errors (Immediate Alert):**
- Complete scraping failure
- Persistent blocking (3+ days)
- Site structure changes affecting all products
- Authentication failures

**High Priority Errors (Hourly Digest):**
- Multiple consecutive failures
- Bot protection encounters
- Declining success rates
- Parsing errors affecting >20% of products

**Medium Priority Errors (Daily Digest):**
- Single scraping failures
- Temporary network issues
- Individual product errors
- Rate limiting encounters

**Low Priority Errors (Weekly Summary):**
- Occasional timeouts
- Individual product unavailability
- Minor parsing issues
- Informational messages

### Scraping Performance Optimization Alerts

#### Performance Degradation Alerts

Get notified when scraping performance declines:

**Metrics Monitored:**
- Average scraping time per product
- Total scraping cycle duration
- Response time from competitor sites
- Resource usage

**Sample Alert:**
```
Alert: Scraping Performance Degradation
Competitor: Example Store
Metric: Average scraping time
Current: 8 seconds/product (up from 3 seconds)
Trend: Increasing over last 7 days
Impact: Scraping cycles taking 2x longer
Recommendation: Review site profile configuration
```

#### Optimization Recommendations

Receive proactive optimization suggestions:

**Recommendation Types:**

**Selector Optimization:**
```
Recommendation: Update Price Selectors
Competitor: Example Store
Issue: Primary selector failing 30% of time
Suggestion: Update to more reliable selector
Impact: Improve success rate by 25%
```

**Rate Limit Adjustment:**
```
Recommendation: Adjust Rate Limiting
Competitor: Example Store
Issue: Frequent rate limit encounters
Suggestion: Increase delay from 3s to 5s
Impact: Reduce rate limiting by 80%
```

**IP Rotation:**
```
Recommendation: Enable IP Rotation
Competitor: Example Store
Issue: Frequent CAPTCHA challenges
Suggestion: Enable residential proxy rotation
Impact: Reduce CAPTCHA encounters by 70%
```

### Troubleshooting Scraping Issues

#### Common Scraping Alert Scenarios

**Scenario 1: Sudden Success Rate Drop**

**Alert:**
```
Success rate dropped from 95% to 60% overnight
```

**Possible Causes:**
- Competitor website redesign
- New bot protection implemented
- IP address blocked
- Site temporarily down

**Troubleshooting Steps:**
1. Check competitor website manually
2. Review scraping logs for error patterns
3. Test site profile selectors
4. Verify IP address status
5. Check for site maintenance announcements

**Resolution:**
- Update selectors if site changed
- Enable IP rotation if blocked
- Wait if temporary site issues
- Contact support if persistent

**Scenario 2: Persistent CAPTCHA Challenges**

**Alert:**
```
CAPTCHA encountered on 80% of scraping attempts
```

**Possible Causes:**
- Scraping frequency too high
- IP address flagged
- Suspicious request patterns
- Aggressive bot protection

**Troubleshooting Steps:**
1. Review scraping frequency settings
2. Check IP rotation status
3. Verify request patterns
4. Review user-agent configuration
5. Check for recent scraping changes

**Resolution:**
- Reduce scraping frequency
- Enable IP rotation (Premium)
- Add more delays between requests
- Update user-agent strings
- Pause scraping temporarily

**Scenario 3: Parsing Errors**

**Alert:**
```
Price selector not found for 40% of products
```

**Possible Causes:**
- Competitor site structure changed
- Incorrect selectors configured
- JavaScript rendering issues
- Dynamic content loading

**Troubleshooting Steps:**
1. Visit competitor site manually
2. Inspect product page HTML
3. Verify price element selectors
4. Check JavaScript requirements
5. Test with browser developer tools

**Resolution:**
- Update price selectors
- Enable JavaScript rendering
- Add wait time for dynamic content
- Configure alternative selectors
- Update site profile

#### Getting Help with Scraping Issues

**Self-Service Resources:**
1. Review [Scraping & Bot Protection Guide](/docs/competitors/scraping-bot-protection)
2. Check [Site Profile Examples](/docs/competitors/site-profile-examples)
3. Browse [Troubleshooting Guide](/docs/troubleshooting)
4. Search documentation

**Support Options:**
1. **In-App Support**: Click support icon in dashboard
2. **Email Support**: support@pricepilot.com
3. **Documentation**: Browse help articles
4. **Community Forum**: Ask questions and share solutions

**When Contacting Support:**

Include this information:
- Competitor name and URL
- Error messages from logs
- Success rate history
- Recent configuration changes
- Screenshots of issues
- Steps already attempted


## Audit Logs


Comprehensive audit logging provides complete visibility into all system activities and user actions.

### What Are Audit Logs?

Audit logs are detailed records of every action taken in PricePilot:

**Logged Activities:**
- User actions (login, logout, configuration changes)
- Price approvals and rejections
- Price updates applied to your store
- Scraping activities and results
- Integration changes
- System events
- API calls
- Configuration modifications

**Why Audit Logs Matter:**

**Accountability**
- Track who did what and when
- Understand decision history
- Identify user actions
- Support compliance requirements

**Troubleshooting**
- Diagnose issues
- Understand system behavior
- Trace error sources
- Identify patterns

**Security**
- Detect unauthorized access
- Monitor suspicious activity
- Track security events
- Support incident response

**Analysis**
- Understand usage patterns
- Optimize workflows
- Identify bottlenecks
- Measure performance

### Accessing Audit Logs

#### Viewing Audit Logs

Access comprehensive audit logs:

**Step 1: Navigate to Audit Logs**
1. Click **Settings** in navigation
2. Select **Audit Logs**
3. View recent activity

**Step 2: Filter Logs**

Use filters to find specific events:

```
Filters:
- Date Range: Last 7 days, 30 days, custom
- Event Type: All, User Actions, Price Changes, Scraping, System
- User: All users, specific user
- Action: All actions, specific action type
- Status: All, Success, Failed
- Entity: Products, Competitors, Settings, etc.
```

**Step 3: Search Logs**

Search for specific events:
- Search by keyword
- Search by product name
- Search by competitor name
- Search by user email
- Search by error message

**Step 4: View Details**

Click on any log entry to see full details:
- Timestamp (precise to the second)
- User who performed the action
- Action type and description
- Entity affected (product, competitor, etc.)
- Before and after values (for changes)
- IP address
- User agent
- Request ID
- Result (success/failure)
- Error message (if failed)

### Audit Log Types

#### User Activity Logs

Track all user actions:

**Authentication Events:**
```
Event: User Login
User: john@example.com
Timestamp: 2024-02-05 09:15:23
IP Address: 192.168.1.100
User Agent: Chrome 121.0
Status: Success
```

```
Event: Failed Login Attempt
User: john@example.com
Timestamp: 2024-02-05 09:14:50
IP Address: 192.168.1.100
Reason: Invalid password
Status: Failed
```

**Configuration Changes:**
```
Event: Notification Settings Updated
User: john@example.com
Timestamp: 2024-02-05 10:30:00
Changes:
  - Email notifications: Disabled → Enabled
  - SMS notifications: Disabled → Enabled
Status: Success
```

**User Management:**
```
Event: User Invited
Admin: admin@example.com
New User: newuser@example.com
Role: Reviewer
Timestamp: 2024-02-05 11:00:00
Status: Success
```

#### Price Change Logs

Complete history of all price-related activities:

**Price Approval Actions:**
```
Event: Price Change Approved
User: john@example.com
Product: Example Product (SKU: PROD-001)
Old Price: $99.99
New Price: $89.99
Change: -10.0%
Reason: Undercut competitor by $5
Timestamp: 2024-02-05 10:45:00
Status: Approved
```

```
Event: Price Change Rejected
User: john@example.com
Product: Example Product (SKU: PROD-002)
Proposed Price: $79.99
Current Price: $99.99
Reason: "Price too low for current market"
Timestamp: 2024-02-05 10:46:00
Status: Rejected
```

**Bulk Operations:**
```
Event: Bulk Price Approval
User: john@example.com
Products: 15 items
Successful: 14
Failed: 1
Total Value: $1,245.50 price reduction
Timestamp: 2024-02-05 11:00:00
Duration: 3.2 seconds
Status: Completed
```

**Price Updates Applied:**
```
Event: Price Updated in Store
Product: Example Product (SKU: PROD-001)
Old Price: $99.99
New Price: $89.99
Store: OpenCart Store
API Response: Success
Timestamp: 2024-02-05 10:45:15
Status: Success
```

```
Event: Price Update Failed
Product: Example Product (SKU: PROD-003)
Attempted Price: $79.99
Store: OpenCart Store
Error: "Product not found in store"
Timestamp: 2024-02-05 10:45:20
Status: Failed
```

#### Scraping Activity Logs

Detailed scraping history:

**Scraping Cycles:**
```
Event: Scraping Cycle Started
Competitor: Example Store
Products: 45 matched products
Timestamp: 2024-02-05 10:00:00
Status: In Progress
```

```
Event: Scraping Cycle Completed
Competitor: Example Store
Products Scraped: 43/45
Success Rate: 95.6%
Duration: 4 minutes 32 seconds
Price Changes Detected: 8
Errors: 2 (timeouts)
Timestamp: 2024-02-05 10:04:32
Status: Completed
```

**Individual Product Scraping:**
```
Event: Product Scraped
Competitor: Example Store
Product: Example Product
URL: https://example.com/product/123
Old Price: $99.99
New Price: $89.99
Change: -10.0%
Response Time: 2.3 seconds
Timestamp: 2024-02-05 10:02:15
Status: Success
```

**Scraping Errors:**
```
Event: Scraping Failed
Competitor: Example Store
Product: Example Product
URL: https://example.com/product/456
Error: Connection timeout
Retry Attempt: 2 of 3
Timestamp: 2024-02-05 10:03:45
Status: Failed
```

#### Integration Logs

Track integration activities:

**Connection Events:**
```
Event: Store Connected
Integration: OpenCart
Store URL: https://mystore.com
API Token: ****1234 (last 4 digits)
Test Result: Success
Timestamp: 2024-02-05 09:00:00
Status: Connected
```

```
Event: Integration Test Failed
Integration: OpenCart
Store URL: https://mystore.com
Error: "Invalid API token"
Timestamp: 2024-02-05 09:05:00
Status: Failed
```

**API Calls:**
```
Event: API Call - Get Products
Integration: OpenCart
Endpoint: /api/pricepilot/products
Products Retrieved: 150
Response Time: 1.2 seconds
Timestamp: 2024-02-05 09:10:00
Status: Success
```

```
Event: API Call - Update Prices
Integration: OpenCart
Endpoint: /api/pricepilot/products/update
Products Updated: 5
Response Time: 2.8 seconds
Timestamp: 2024-02-05 10:45:15
Status: Success
```

#### System Event Logs

Track system-level activities:

**Scheduled Tasks:**
```
Event: Scheduled Scraping Job
Job ID: scrape_job_12345
Competitors: 5
Status: Started
Timestamp: 2024-02-05 10:00:00
```

```
Event: Scheduled Scraping Job Completed
Job ID: scrape_job_12345
Duration: 23 minutes
Success Rate: 94%
Timestamp: 2024-02-05 10:23:00
Status: Completed
```

**System Maintenance:**
```
Event: System Maintenance Started
Type: Database optimization
Expected Duration: 30 minutes
Impact: Read-only mode
Timestamp: 2024-02-05 02:00:00
Status: In Progress
```

**Error Events:**
```
Event: System Error
Component: Price Update Service
Error: Database connection timeout
Impact: Price updates delayed
Resolution: Automatic retry
Timestamp: 2024-02-05 10:45:30
Status: Resolved
```

### Searching and Filtering Audit Logs

#### Advanced Search

Find specific events quickly:

**Search by Keywords:**
```
Search: "price update failed"
Results: All failed price update events
```

**Search by Product:**
```
Search: "PROD-001" or "Example Product"
Results: All events related to that product
```

**Search by User:**
```
Search: "john@example.com"
Results: All actions by that user
```

**Search by Date Range:**
```
Date Range: 2024-02-01 to 2024-02-05
Results: All events in that period
```

#### Filter Combinations

Combine multiple filters for precise results:

**Example 1: Failed Price Updates**
```
Filters:
- Event Type: Price Updates
- Status: Failed
- Date Range: Last 7 days
Results: All failed price updates in the last week
```

**Example 2: User Activity**
```
Filters:
- Event Type: User Actions
- User: john@example.com
- Date Range: Today
Results: All actions by John today
```

**Example 3: Scraping Issues**
```
Filters:
- Event Type: Scraping
- Status: Failed
- Competitor: Example Store
Results: All scraping failures for that competitor
```

### Exporting Audit Logs

#### Export Options

Download audit logs for external analysis:

**Export Formats:**
- CSV (Excel-compatible)
- JSON (for programmatic processing)
- PDF (for reports and documentation)

**Export Process:**
1. Apply desired filters
2. Click **Export** button
3. Choose format
4. Select date range
5. Click **Download**

**Export Contents:**
- All filtered log entries
- Complete event details
- Timestamps
- User information
- Before/after values
- Status and results

**Sample CSV Export:**
```csv
Timestamp,Event Type,User,Action,Entity,Status,Details
2024-02-05 10:45:00,Price Change,john@example.com,Approved,PROD-001,Success,"$99.99 → $89.99"
2024-02-05 10:46:00,Price Change,john@example.com,Rejected,PROD-002,Rejected,"Price too low"
2024-02-05 11:00:00,Bulk Operation,john@example.com,Bulk Approve,15 products,Success,"14 successful, 1 failed"
```

#### Scheduled Exports

Automate audit log exports:

**Configuration:**
1. Navigate to **Settings** → **Audit Logs**
2. Select **Scheduled Exports**
3. Click **Add Schedule**
4. Configure:
   - Frequency (daily, weekly, monthly)
   - Format (CSV, JSON, PDF)
   - Filters to apply
   - Delivery method (email, webhook, FTP)
5. Save schedule

**Use Cases:**
- Compliance reporting
- Regular backups
- External analysis
- Long-term archival

### Audit Log Retention

#### Retention Policies

Understand how long audit logs are kept:

**Standard Retention:**
- **Active Logs**: 90 days (full detail, searchable)
- **Archived Logs**: 1 year (compressed, exportable)
- **Compliance Logs**: 7 years (critical events only)

**What's Retained:**

**Forever (Compliance):**
- User authentication events
- Price change approvals
- Configuration changes
- Security events

**1 Year (Archived):**
- Scraping activities
- API calls
- System events
- Routine operations

**90 Days (Active):**
- All events with full searchability
- Complete details
- Fast access

#### Accessing Archived Logs

Retrieve older audit logs:

1. Navigate to **Audit Logs**
2. Select **Archived Logs**
3. Choose date range
4. Request archive retrieval
5. Wait for processing (5-10 minutes)
6. Download or view archived logs

**Note:** Archived logs may take longer to retrieve and search.

### Audit Log Best Practices

#### Regular Review

Establish a routine for reviewing audit logs:

**Daily Review:**
- Check for failed operations
- Review security events
- Monitor unusual activity
- Verify critical changes

**Weekly Review:**
- Analyze activity patterns
- Identify optimization opportunities
- Review user actions
- Check system health

**Monthly Review:**
- Comprehensive audit
- Compliance verification
- Trend analysis
- Performance assessment

#### Security Monitoring

Use audit logs for security:

**Monitor For:**
- Failed login attempts (especially multiple)
- Unusual access patterns
- Configuration changes
- Unauthorized actions
- Suspicious API calls

**Set Up Alerts:**
- Multiple failed logins
- Configuration changes
- After-hours activity
- Unusual data access

#### Compliance and Reporting

Leverage audit logs for compliance:

**Compliance Requirements:**
- Track all price changes
- Document approval decisions
- Maintain user activity records
- Preserve security events

**Reporting:**
- Generate compliance reports
- Export for auditors
- Document procedures
- Demonstrate controls

### Troubleshooting with Audit Logs

#### Diagnosing Issues

Use audit logs to troubleshoot problems:

**Problem: Price Updates Not Working**

**Investigation Steps:**
1. Search for "price update" events
2. Filter by status: Failed
3. Review error messages
4. Check integration logs
5. Verify API connectivity

**Problem: Missing Competitor Data**

**Investigation Steps:**
1. Search for competitor name
2. Filter event type: Scraping
3. Review scraping cycle logs
4. Check for errors
5. Verify scraping schedule

**Problem: Unexpected Configuration Changes**

**Investigation Steps:**
1. Filter event type: Configuration
2. Review recent changes
3. Identify who made changes
4. Check timestamps
5. Restore previous settings if needed

#### Common Audit Log Patterns

**Pattern 1: Repeated Failures**
```
Multiple consecutive failed events
→ Indicates persistent issue
→ Requires immediate attention
```

**Pattern 2: Unusual Activity Times**
```
Activity outside normal business hours
→ May indicate automation or security issue
→ Review for legitimacy
```

**Pattern 3: High Error Rate**
```
Many failed events in short period
→ System or integration issue
→ Check system status
```

## API Access to Monitoring Data

### Programmatic Access

Access monitoring and audit data via API:

#### Get Audit Logs

```bash
GET /api/v1/audit-logs
Authorization: Bearer YOUR_API_TOKEN

Query Parameters:
- startDate: ISO 8601 date
- endDate: ISO 8601 date
- eventType: user_action, price_change, scraping, system
- status: success, failed
- userId: specific user ID
- limit: results per page (max 100)
- page: page number
```

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "log_123",
        "timestamp": "2024-02-05T10:45:00Z",
        "eventType": "price_change",
        "action": "approved",
        "userId": "user_456",
        "userEmail": "john@example.com",
        "entityType": "product",
        "entityId": "prod_789",
        "details": {
          "productName": "Example Product",
          "oldPrice": 99.99,
          "newPrice": 89.99,
          "percentageChange": -10.0
        },
        "status": "success"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "pages": 3
    }
  }
}
```

#### Get Alert History

```bash
GET /api/v1/alerts/history
Authorization: Bearer YOUR_API_TOKEN

Query Parameters:
- startDate: ISO 8601 date
- endDate: ISO 8601 date
- alertType: price_drop, price_increase, scraping_failure
- status: triggered, resolved
- limit: results per page
```

#### Get Scraping Metrics

```bash
GET /api/v1/scraping/metrics
Authorization: Bearer YOUR_API_TOKEN

Query Parameters:
- competitorId: specific competitor
- startDate: ISO 8601 date
- endDate: ISO 8601 date
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overallSuccessRate": 94.5,
    "totalScrapes": 450,
    "successfulScrapes": 425,
    "failedScrapes": 25,
    "averageResponseTime": 2.3,
    "byCompetitor": [
      {
        "competitorId": "comp_123",
        "competitorName": "Example Store",
        "successRate": 96.0,
        "scrapes": 150,
        "priceChanges": 12
      }
    ]
  }
}
```

## Related Documentation

- [Scraping & Bot Protection](/docs/competitors/scraping-bot-protection) - Understanding scraping frequency and bot protection
- [Price Approval Workflow](/docs/pricing/price-approval-guide) - Managing price change approvals
- [Admin Monitoring](/docs/admin/system-monitoring) - System-wide monitoring for administrators
- [API Documentation](/docs/api) - Complete API reference

## Support

Need help with monitoring and alerts?

- **Documentation**: Browse our [complete documentation](/docs)
- **API Reference**: Check the [API documentation](/docs/api)
- **Support**: Contact our support team through your dashboard
- **Community**: Join our community forum for tips and best practices
