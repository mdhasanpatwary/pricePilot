# Tenant Dashboard User Guide

## Overview

This guide helps PricePilot tenants use the monitoring and configuration features to optimize their competitive pricing operations. Learn how to monitor scraping performance and configure settings for your sites.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Metrics Dashboard](#metrics-dashboard)
3. [Site Configuration](#site-configuration)
4. [Understanding Metrics](#understanding-metrics)
5. [Optimization Tips](#optimization-tips)
6. [Troubleshooting](#troubleshooting)
7. [FAQ](#faq)

---

## Getting Started

### Accessing Your Dashboards

1. Log in to your PricePilot account
2. Navigate to the Dashboard from the main menu
3. Select "Metrics" or "Site Config" from the dashboard navigation

### Dashboard Overview

**Metrics Dashboard** (`/dashboard/metrics`):
- View scraping performance for your sites
- Monitor success and block rates
- Get actionable recommendations
- Track challenge detection

**Site Configuration** (`/dashboard/site-config`):
- Configure scraping settings for your sites
- Adjust delays and warmup settings
- Preview impact of changes
- Apply configurations instantly

---

## Metrics Dashboard

### Purpose

Monitor the health and performance of your competitive price tracking to ensure reliable data collection.

### Overview Cards

**Overall Metrics**:
- **Success Rate**: Percentage of successful scraping requests
- **Block Rate**: Percentage of requests that were blocked
- **Total Requests**: Number of scraping attempts
- **Average Response Time**: How long requests take

**What the Numbers Mean**:
- Success Rate > 90%: Excellent ✅
- Success Rate 70-90%: Good ⚠️
- Success Rate < 70%: Needs attention 🔴

- Block Rate < 10%: Excellent ✅
- Block Rate 10-30%: Acceptable ⚠️
- Block Rate > 30%: Problematic 🔴

### Site Health Cards

Each configured competitor site shows:
- **Domain**: The competitor website
- **Status**: Health indicator (healthy/degraded/critical)
- **Success Rate**: How often scraping succeeds
- **Block Rate**: How often requests are blocked
- **Last Sync**: When data was last collected
- **Challenges**: Anti-bot challenges encountered

**Status Indicators**:
- 🟢 **Healthy**: Everything working well
- 🟡 **Degraded**: Some issues, monitoring needed
- 🔴 **Critical**: Significant problems, action required

### Recommendations Panel

When issues are detected, you'll see actionable recommendations:

**Example Recommendations**:
- "High block rate detected - consider adjusting delays"
- "Challenge solve rate low - contact support for assistance"
- "All systems healthy - no action needed"

### How to Use

1. **Check Overall Health**: Review the overview cards first
2. **Identify Problem Sites**: Look for sites with degraded or critical status
3. **Read Recommendations**: Follow the suggested actions
4. **Adjust Settings**: Use Site Configuration to make changes
5. **Monitor Results**: Check back after changes to verify improvement

### Time Range Filtering

Use the time range selector to view metrics for:
- **24 Hours**: Recent performance, good for immediate issues
- **7 Days**: Weekly trends, good for pattern identification
- **30 Days**: Long-term trends, good for overall health

---

## Site Configuration

### Purpose

Customize scraping behavior for each competitor site to optimize the balance between speed and stealth.

### Configuration Options

**Session Warmup**:
- **What it does**: Visits the homepage before scraping product pages
- **When to enable**: For sites with aggressive anti-bot protection
- **Impact**: Increases stealth, adds slight delay

**Delay Settings**:
- **Minimum Delay**: Shortest wait between requests
- **Maximum Delay**: Longest wait between requests
- **Allowed Range**: Limits based on your plan

**Plan Limits**:
- **Basic Plan**: 1-5 second delays, no warmup
- **Premium Plan**: 0.5-3 second delays, warmup allowed
- **Pro Plan**: 0.1-2 second delays, full warmup control

### How to Use

1. **Select a Site**: Choose the competitor site to configure
2. **Toggle Warmup**: Enable or disable session warmup
3. **Adjust Delays**: Use sliders to set min/max delays
4. **Preview Impact**: Review the estimated effect
5. **Save Configuration**: Click "Save" to apply changes

### Impact Preview

The preview shows estimated effects of your settings:

**Speed Impact**:
- Lower delays = Faster data collection
- Higher delays = Slower data collection

**Stealth Impact**:
- Lower delays = Higher detection risk
- Higher delays = Better stealth
- Warmup enabled = Better stealth

**Example**:
```
Current Settings:
- Min Delay: 1.5s
- Max Delay: 2.5s
- Warmup: Enabled

Estimated Impact:
- Speed: ~25 products/minute
- Stealth: High
- Detection Risk: Low
```

### Best Practices

**Starting Configuration**:
1. Begin with higher delays (2-3 seconds)
2. Enable warmup for unknown sites
3. Monitor metrics for 24 hours
4. Adjust based on results

**Optimization Process**:
1. Check metrics dashboard daily
2. If block rate < 10%, consider reducing delays
3. If block rate > 30%, increase delays or enable warmup
4. Make small adjustments (0.5s at a time)
5. Wait 24 hours between changes

**Site-Specific Tips**:
- **Large e-commerce sites**: Use higher delays (2-4s)
- **Small stores**: Can use lower delays (1-2s)
- **Sites with Cloudflare**: Enable warmup, use 3-5s delays
- **Sites blocking frequently**: Increase delays, enable warmup

---

## Understanding Metrics

### Success Rate

**What it measures**: Percentage of scraping requests that successfully collected data

**Good values**: > 90%

**What affects it**:
- Proxy health
- Site anti-bot protection
- Delay settings
- Challenge handling

**How to improve**:
- Increase delays
- Enable session warmup
- Contact support if consistently low

### Block Rate

**What it measures**: Percentage of requests that were blocked or rejected

**Good values**: < 10%

**What affects it**:
- Request frequency (delays)
- Session warmup
- Proxy quality
- Site protection level

**How to improve**:
- Increase minimum delay
- Enable session warmup
- Reduce scraping frequency
- Contact support for assistance

### Challenge Detection

**What it measures**: Anti-bot challenges encountered and solved

**What it means**:
- **Detected**: System identified a challenge (CAPTCHA, Cloudflare, etc.)
- **Solved**: System successfully passed the challenge
- **Solve Rate**: Percentage of challenges successfully solved

**Good values**: Solve rate > 70%

**What to do**:
- If solve rate is low, contact support
- System handles most challenges automatically
- Some challenges may require manual intervention

### Response Time

**What it measures**: Average time for scraping requests to complete

**Typical values**: 200-500ms

**What affects it**:
- Proxy location and speed
- Site server response time
- Network conditions
- Delay settings

**What to do**:
- High response times (>1000ms) may indicate proxy issues
- Contact support if consistently high
- Not directly controllable by configuration

---

## Optimization Tips

### Balancing Speed and Stealth

**Aggressive (Fast)**:
- Min delay: 0.5-1s
- Max delay: 1-2s
- Warmup: Disabled
- Risk: Higher block rate
- Best for: Small sites, low protection

**Balanced (Recommended)**:
- Min delay: 1.5-2s
- Max delay: 2.5-3s
- Warmup: Enabled
- Risk: Low block rate
- Best for: Most sites

**Conservative (Stealth)**:
- Min delay: 3-4s
- Max delay: 4-5s
- Warmup: Enabled
- Risk: Very low block rate
- Best for: Heavily protected sites

### Monitoring Strategy

**Daily Checks**:
1. Review overall success and block rates
2. Check for sites with critical status
3. Follow any recommendations
4. Verify data is being collected

**Weekly Reviews**:
1. Compare 7-day metrics to previous week
2. Identify trends (improving or degrading)
3. Adjust configurations if needed
4. Document what works

**Monthly Analysis**:
1. Review 30-day trends
2. Evaluate overall data quality
3. Optimize configurations
4. Plan for scaling

### When to Contact Support

Contact support if you experience:
- Block rate > 30% for more than 48 hours
- Success rate < 70% consistently
- Challenge solve rate < 50%
- No data collected for 24+ hours
- Unexpected errors or issues

---

## Troubleshooting

### High Block Rate

**Symptoms**: Block rate > 30%, many failed requests

**Solutions**:
1. Increase minimum delay by 1-2 seconds
2. Enable session warmup if not already enabled
3. Check if the site recently changed
4. Wait 24 hours and monitor
5. Contact support if no improvement

### Low Success Rate

**Symptoms**: Success rate < 70%, inconsistent data

**Solutions**:
1. Check block rate (may be related)
2. Verify site is still accessible
3. Review challenge detection stats
4. Increase delays
5. Enable session warmup
6. Contact support for assistance

### No Data Collected

**Symptoms**: Last sync timestamp is old, no recent data

**Solutions**:
1. Check metrics dashboard for errors
2. Verify site URL is correct
3. Check if site is accessible in browser
4. Review block rate and success rate
5. Contact support immediately

### Configuration Not Saving

**Symptoms**: Changes don't persist or apply

**Solutions**:
1. Check for validation errors (red text)
2. Ensure delays are within allowed range
3. Verify you have permission to edit
4. Try refreshing the page
5. Contact support if issue persists

### Metrics Not Updating

**Symptoms**: Dashboard shows old data

**Solutions**:
1. Refresh the page manually
2. Check your internet connection
3. Try a different browser
4. Clear browser cache
5. Contact support if problem continues

---

## FAQ

### General Questions

**Q: How often is data collected from competitor sites?**
A: By default, every 15 minutes. This can be adjusted based on your plan.

**Q: Can I configure different settings for each competitor?**
A: Yes! Each site can have its own configuration.

**Q: Will changing settings affect data already collected?**
A: No, only future scraping sessions use the new settings.

**Q: How long does it take for configuration changes to apply?**
A: Changes apply to the next scraping session, typically within 15 minutes.

### Metrics Questions

**Q: What's a good success rate?**
A: Above 90% is excellent. 70-90% is acceptable. Below 70% needs attention.

**Q: Why is my block rate high?**
A: Usually due to aggressive anti-bot protection. Increase delays and enable warmup.

**Q: What are challenges?**
A: Anti-bot systems like CAPTCHAs or Cloudflare checks. The system handles most automatically.

**Q: How do I know if my settings are working?**
A: Monitor metrics for 24 hours after changes. Look for improved success rate and lower block rate.

### Configuration Questions

**Q: What delay should I use?**
A: Start with 2-3 seconds. Adjust based on metrics. Higher delays = more stealth.

**Q: Should I enable session warmup?**
A: Yes, for sites with anti-bot protection. It improves success rates.

**Q: Can I use very low delays (< 1 second)?**
A: Only on Pro plan, and only for sites without protection. Risk of blocking is high.

**Q: What if I exceed my plan limits?**
A: The system enforces limits. Upgrade your plan for more flexibility.

### Technical Questions

**Q: Why can't I set delays below 1 second?**
A: Plan limits ensure responsible scraping. Upgrade to Pro for lower limits.

**Q: What happens if a site blocks us?**
A: The system automatically adjusts and retries. You'll see it in metrics.

**Q: Can I scrape more frequently?**
A: Frequency is managed automatically. Focus on optimizing delays and warmup.

**Q: Is my data secure?**
A: Yes, all data is encrypted and isolated per tenant.

---

## Support

Need help? We're here for you:

- **Documentation**: [docs.pricepilot.com](http://localhost:3000/docs)
- **Email**: support@pricepilot.com
- **Live Chat**: Available in dashboard (Premium & Pro plans)
- **Knowledge Base**: [help.pricepilot.com](http://localhost:3000/help)

---

## Quick Reference

### Recommended Settings by Site Type

| Site Type | Min Delay | Max Delay | Warmup | Notes |
|-----------|-----------|-----------|--------|-------|
| Small store | 1.0s | 2.0s | Optional | Low protection |
| Medium e-commerce | 1.5s | 2.5s | Yes | Standard protection |
| Large marketplace | 2.0s | 3.0s | Yes | Moderate protection |
| Cloudflare-protected | 3.0s | 5.0s | Yes | High protection |
| Heavily protected | 4.0s | 6.0s | Yes | Maximum stealth |

### Health Status Guide

| Status | Success Rate | Block Rate | Action |
|--------|--------------|------------|--------|
| 🟢 Healthy | > 90% | < 10% | None needed |
| 🟡 Degraded | 70-90% | 10-30% | Monitor closely |
| 🔴 Critical | < 70% | > 30% | Immediate action |

### Troubleshooting Checklist

- [ ] Check overall success and block rates
- [ ] Review site-specific metrics
- [ ] Read recommendations panel
- [ ] Verify configuration settings
- [ ] Increase delays if block rate high
- [ ] Enable warmup if not already on
- [ ] Wait 24 hours after changes
- [ ] Contact support if no improvement

---

*Last Updated: January 26, 2026*
