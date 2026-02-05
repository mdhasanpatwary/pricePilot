---
title: "Frequently Asked Questions"
description: "Common questions and answers about using PricePilot"
category: "troubleshooting"
subcategory: null
tags: ["faq", "help", "questions"]
author: "PricePilot Team"
lastReviewed: "2024-02-05"
relatedDocs: ["common-issues", "quick-start"]
---

# Frequently Asked Questions

Find quick answers to common questions about PricePilot.

## General Questions

### What is PricePilot?

PricePilot is a SaaS platform that helps e-commerce businesses monitor competitor prices and automatically update their own prices to stay competitive.

### Which platforms does PricePilot support?

Currently, PricePilot supports:

**OpenCart** (Fully Supported)
- All OpenCart 3.x versions
- All OpenCart 4.x versions
- Easy installation via .ocmod.zip module
- Automatic product sync
- Real-time price updates
- See our [OpenCart Integration Guide](../integrations/opencart-setup) for setup instructions

**Laravel** (Fully Supported)
- Laravel 8.x, 9.x, 10.x, 11.x
- Composer package installation
- Service provider integration
- API-based product sync
- See our [Laravel Integration Guide](../integrations/laravel-setup) for setup instructions

**Coming Soon:**
- Shopify
- WooCommerce
- Magento 2
- Custom API integration for any platform

### How do I integrate PricePilot with OpenCart?

Integration is straightforward:

1. **Download** the PricePilot OpenCart module (.ocmod.zip) from your dashboard
2. **Install** the module through OpenCart's Extension Installer
3. **Generate** an API token in your PricePilot dashboard
4. **Configure** the module with your API token in OpenCart admin
5. **Sync** your products - initial sync happens automatically

The entire process takes 15-30 minutes. See our [OpenCart Integration Guide](../integrations/opencart-setup) for detailed step-by-step instructions.

### How do I integrate PricePilot with Laravel?

Integration uses Composer:

1. **Install** the package: `composer require pricepilot/laravel-integration`
2. **Publish** configuration: `php artisan vendor:publish --provider="PricePilot\ServiceProvider"`
3. **Configure** your API token in `.env` file
4. **Register** routes and middleware
5. **Sync** products via API endpoints

The process takes 20-40 minutes. See our [Laravel Integration Guide](../integrations/laravel-setup) for complete documentation.

### How does PricePilot access my store?

PricePilot uses secure API tokens to access your store. We never store admin credentials or access your database directly. All communication happens through secure REST APIs.

### Is my data secure?

Yes! We use industry-standard security practices:
- API token authentication
- Encrypted data transmission (HTTPS)
- No storage of admin credentials
- Regular security audits
- GDPR compliant

## Pricing & Plans

### How much does PricePilot cost?

Visit our [Pricing Page](https://pricepilot.com/pricing) for current plans and pricing.

### Can I try PricePilot for free?

Yes! We offer a 14-day free trial with full access to all features. No credit card required.

### What happens if I exceed my plan limits?

We'll notify you when you're approaching your limits. You can upgrade your plan at any time to increase limits.

### Can I cancel anytime?

Yes, you can cancel your subscription at any time. Your access continues until the end of your billing period.

## Product Matching

### How does product matching work?

PricePilot uses multiple strategies to match your products with competitor products:

1. **Exact SKU Match**: Matches products with identical SKUs
2. **Brand + Model Match**: Matches based on brand and model number
3. **Fuzzy Title Match**: Uses AI to match similar product names
4. **Manual Override**: You can manually match products

### Why aren't my products matching automatically?

Common reasons:
- Different SKU formats between stores
- Missing brand or model information
- Significantly different product names
- Competitor product not yet scraped

**Solution**: Use manual matching or improve product data (add SKUs, brands, models).

### Can I manually match products?

Yes! Go to the Product Matching page, select a product, and click "Manual Match" to choose the correct competitor product.

### How do I unmatch incorrect matches?

1. Go to **Product Matching** page
2. Find the incorrect match
3. Click **Actions** > **Unmatch**
4. Optionally, create a new manual match

## Price Updates

### How quickly do price updates apply?

Price updates typically apply within:
- **OpenCart**: 1-2 minutes
- **Laravel**: 1-2 minutes
- **API-based**: Immediate

Actual time depends on your platform's caching and your internet connection.

### Can I undo a price update?

Yes! PricePilot maintains a complete history of all price changes. You can:
1. Go to **Price History** page
2. Select a product
3. Click **Rollback** to restore a previous price

### Why didn't my price update?

Common reasons:
- Minimum price floor prevented the update
- Maximum discount limit reached
- API token expired or invalid
- Product not found in your store
- Network connectivity issues

Check the **Price Update Logs** for specific error messages.

### Can I set different strategies for different products?

Yes! You can:
- Set default strategy for all products
- Override strategy for specific products
- Create rules based on categories or brands
- Use bulk update with different strategies

## Price Approval Workflows

### What is the price approval workflow?

The price approval workflow is a manual review process that allows you to review and approve price changes before they're applied to your store. When enabled:

1. PricePilot calculates suggested price changes based on competitor data
2. Changes are marked as "Pending Approval"
3. You review each change and see the reasoning behind it
4. You approve or reject individual changes or in bulk
5. Approved changes are applied to your store

This gives you full control over pricing decisions while still benefiting from automated competitor monitoring.

### Should I use manual or automatic approval?

**Manual Approval** is recommended if you:
- Want full control over every price change
- Have specific pricing strategies or constraints
- Sell high-value or specialized products
- Need to review competitive positioning before changes
- Are new to automated pricing

**Automatic Approval** (via Auto-Approval Rules) is recommended if you:
- Have a large product catalog
- Trust the system to make routine pricing decisions
- Want to respond quickly to competitor changes
- Have clear, rule-based pricing strategies
- Are comfortable with safety constraints (min price, max discount)

Many users start with manual approval and gradually transition to automatic approval with rules as they gain confidence.

### How long do pending price changes last?

Pending price changes expire after **7 days** if not approved or rejected. This ensures:
- Your approval queue doesn't become cluttered with outdated changes
- Price suggestions remain relevant to current market conditions
- You're prompted to make timely pricing decisions

You'll receive notifications before changes expire, giving you time to review them.

### Can I approve multiple price changes at once?

Yes! The bulk approval feature allows you to:
- **Approve All**: Accept all pending changes with one click
- **Reject All**: Decline all pending changes
- **Selective Approval**: Filter by product, category, or price range, then approve/reject the filtered set
- **Sort and Filter**: Organize pending changes by priority, discount amount, or competitor

This makes managing large numbers of price changes efficient and practical.

### What are auto-approval rules?

Auto-approval rules automatically approve price changes that meet specific criteria you define. For example:

- "Auto-approve if competitor price is lower by less than 10%"
- "Auto-approve price decreases only"
- "Auto-approve for products in the 'Electronics' category"
- "Auto-approve if new price stays above $50"

Rules include safety constraints:
- **Minimum Price Floor**: Never go below a certain price
- **Maximum Discount Limit**: Never discount more than a certain percentage
- **Category/Brand Filters**: Apply rules only to specific products

This combines automation with control, letting you automate routine decisions while maintaining guardrails.

## Competitor Tracking

### How many competitors can I track?

This depends on your plan:
- **Starter**: Up to 3 competitors
- **Professional**: Up to 10 competitors
- **Enterprise**: Unlimited competitors

### How often are competitor prices updated?

Competitor prices are scraped every **24 hours**. This schedule ensures:
- Reliable data collection without triggering bot protection
- Consistent monitoring across all competitors
- Optimal balance between freshness and system resources

The 24-hour scraping cycle runs continuously, so your competitor data is always up-to-date within a day.

### What if a competitor blocks scraping?

PricePilot includes advanced bot protection mitigation strategies:
- **CAPTCHA Detection & Resolution**: Automatic detection and handling of CAPTCHA challenges
- **Proxy Rotation**: Distributed IP addresses to avoid rate limiting
- **Smart Rate Limiting**: Respects competitor site limits to avoid detection
- **User-Agent Rotation**: Mimics real browser behavior
- **Retry Logic**: Automatic retry with exponential backoff for failed requests

If you're experiencing persistent blocking issues, contact support for site-specific configuration.

### How does PricePilot handle CAPTCHAs?

PricePilot uses multiple strategies to handle CAPTCHA challenges:

1. **Detection**: Automatically identifies when a CAPTCHA is present
2. **Resolution**: Uses advanced solving techniques to bypass CAPTCHAs
3. **Fallback**: If automatic resolution fails, the scraping job is queued for retry
4. **Notification**: You're notified if manual intervention is needed

Most CAPTCHAs are resolved automatically without any action required from you.

### Can I track international competitors?

Yes! PricePilot supports:
- Multiple currencies
- Automatic currency conversion
- Geographic proxies for region-specific pricing
- Multi-language product matching

## Integration & Setup

### How long does setup take?

Typical setup time:
- **OpenCart**: 15-30 minutes
- **Laravel**: 20-40 minutes

This includes installing the integration, configuring API tokens, and syncing initial products.

### Do I need technical knowledge?

Basic setup requires minimal technical knowledge. However, for advanced features like custom price formulas or webhook configuration, some technical expertise is helpful.

### Can I test without affecting my live store?

Yes! We recommend:
1. Set up PricePilot in "Preview Mode"
2. Review suggested price changes
3. Test with a few products first
4. Enable automatic updates once confident

### What if my platform isn't supported?

Contact our sales team. We can:
- Provide API documentation for custom integration
- Develop custom integration (Enterprise plans)
- Add your platform to our roadmap

## Billing & Account

### How do I upgrade my plan?

1. Go to **Settings** > **Billing**
2. Click **Upgrade Plan**
3. Select new plan
4. Confirm payment

Changes take effect immediately.

### How do I update my payment method?

1. Go to **Settings** > **Billing**
2. Click **Payment Methods**
3. Add new card or update existing
4. Set as default if desired

### Can I get a refund?

We offer refunds within 30 days of purchase if you're not satisfied. Contact support@pricepilot.com.

### How do I delete my account?

1. Go to **Settings** > **Account**
2. Click **Delete Account**
3. Confirm deletion
4. All data will be permanently deleted within 30 days

## Technical Questions

### What are the API rate limits?

Rate limits by plan:
- **Starter**: 100 requests/hour
- **Professional**: 1,000 requests/hour
- **Enterprise**: 10,000 requests/hour

### Can I use PricePilot API directly?

Yes! We provide a comprehensive REST API. See our [API Documentation](https://docs.pricepilot.com/api) for details.

### Does PricePilot work with headless commerce?

Yes! PricePilot's API-first design works perfectly with headless commerce architectures.

### Can I integrate PricePilot with other tools?

Yes! PricePilot supports:
- Webhooks for real-time notifications
- REST API for custom integrations
- Zapier integration (coming soon)
- CSV import/export

## Troubleshooting

### I'm getting authentication errors

1. Verify API token is correct
2. Check token hasn't expired
3. Ensure token has correct permissions
4. Try regenerating the token

### Products aren't syncing

1. Check API token is valid
2. Verify field mapping is correct
3. Review sync logs for errors
4. Try manual sync

### Prices aren't updating

1. Check minimum price floors
2. Verify update strategy is configured
3. Review price update logs
4. Test with a single product first

### Competitor scraping is failing

Common causes and solutions:

**CAPTCHA Challenges:**
- PricePilot automatically handles most CAPTCHAs
- Check scraping logs for CAPTCHA detection
- Contact support if persistent issues occur

**IP Blocking:**
- Proxy rotation is automatic
- Check if competitor site has aggressive bot protection
- Try adjusting scraping frequency in site profile settings

**Rate Limiting:**
- PricePilot respects rate limits automatically
- Failed requests are retried with exponential backoff
- Check scraping logs for rate limit errors

**Site Structure Changes:**
- Competitor websites sometimes change their HTML structure
- PricePilot adapts automatically in most cases
- Contact support if scraping stops working for a specific site

### How do I know if scraping is working?

Check these indicators:

1. **Dashboard**: View "Last Scraped" timestamp for each competitor
2. **Scraping Logs**: Review detailed logs in Settings > Scraping Logs
3. **Price History**: Check if competitor prices are updating
4. **Notifications**: Enable alerts for scraping failures

If "Last Scraped" is more than 24 hours old, check the scraping logs for errors.

### Why are some products not being matched?

Common reasons and solutions:

**Missing Product Data:**
- Ensure your products have SKUs, brands, and models filled in
- Add more detailed product descriptions
- Use consistent naming conventions

**Different SKU Formats:**
- Competitor may use different SKU format
- Use manual matching for these products
- Consider adding SKU aliases

**Product Not Found on Competitor Site:**
- Verify the product exists on competitor website
- Check if competitor uses different product name
- Try searching competitor site manually

**Low Confidence Score:**
- Fuzzy matching may have low confidence
- Review suggested matches and approve manually
- Improve product data quality for better automatic matching

### What do the different match confidence scores mean?

Match confidence scores indicate how certain PricePilot is about a product match:

- **90-100%**: Exact SKU match - very reliable
- **70-89%**: Brand + Model match - highly reliable
- **50-69%**: Fuzzy title match - review recommended
- **Below 50%**: Low confidence - manual review required

You can set a minimum confidence threshold in Settings to auto-accept only high-confidence matches.

### I need more help

- Check [Common Issues](common-issues) guide
- Contact support: support@pricepilot.com
- Schedule a demo: https://pricepilot.com/demo
- Join our community forum

## Still Have Questions?

Can't find what you're looking for?

- **Email**: support@pricepilot.com
- **Live Chat**: Available in your dashboard
- **Phone**: +1 (555) 123-4567 (Enterprise plans)
- **Documentation**: https://docs.pricepilot.com

## Related Documentation

- [Common Issues](common-issues)
- [Quick Start Guide](../getting-started/quick-start)
- [OpenCart Setup](../integrations/opencart-setup)
- [Laravel Setup](../integrations/laravel-setup)
