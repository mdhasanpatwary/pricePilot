---
title: "Frequently Asked Questions"
description: "Common questions and answers about using PricePilot"
category: "troubleshooting"
subcategory: null
tags: ["faq", "help", "questions"]
author: "PricePilot Team"
lastReviewed: "2024-01-15"
relatedDocs: ["common-issues", "quick-start"]
---

# Frequently Asked Questions

Find quick answers to common questions about PricePilot.

## General Questions

### What is PricePilot?

PricePilot is a SaaS platform that helps e-commerce businesses monitor competitor prices and automatically update their own prices to stay competitive.

### Which platforms does PricePilot support?

Currently, PricePilot supports:
- OpenCart (all versions)
- Laravel-based e-commerce stores

Support for Shopify, WooCommerce, and Magento is coming soon.

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

## Competitor Tracking

### How many competitors can I track?

This depends on your plan:
- **Starter**: Up to 3 competitors
- **Professional**: Up to 10 competitors
- **Enterprise**: Unlimited competitors

### How often are competitor prices updated?

You can configure scraping frequency:
- Every 6 hours (recommended for high-priority)
- Every 12 hours (recommended for medium-priority)
- Every 24 hours (recommended for low-priority)
- Custom schedules available on Enterprise plans

### What if a competitor blocks scraping?

PricePilot includes advanced features to handle bot protection:
- Automatic CAPTCHA solving (Enterprise plans)
- Proxy rotation
- User-agent rotation
- Cloudflare bypass

Contact support if you're experiencing blocking issues.

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
