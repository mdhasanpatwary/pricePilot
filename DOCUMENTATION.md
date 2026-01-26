# 📚 PricePilot Documentation

**Version 1.0** | Last Updated: January 2026

Welcome to PricePilot - Your intelligent e-commerce pricing automation platform.

---

## 📖 Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Platform Integrations](#platform-integrations)
4. [Features Overview](#features-overview)
5. [Monitoring & Analytics](#monitoring--analytics)
6. [API Reference](#api-reference)
7. [FAQ](#faq)
8. [Support](#support)

---

## 🎯 Introduction

PricePilot is a professional-grade SaaS platform designed for e-commerce businesses to automate competitive pricing strategies. Monitor competitor prices in real-time, apply dynamic pricing rules, and maximize your profit margins while staying competitive.

### Key Benefits

- **Real-Time Monitoring**: Track competitor prices automatically every 15 minutes
- **Automated Price Updates**: Apply pricing rules and update your store prices instantly
- **Multi-Platform Support**: Works with Shopify, WooCommerce, Laravel, Magento, and more
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

- ✅ Shopify
- ✅ WooCommerce
- ✅ Laravel
- ✅ Magento
- ✅ PrestaShop
- ✅ BigCommerce
- ✅ OpenCart

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

### Shopify Integration

1. Install PricePilot from Shopify App Store
2. Authorize the app
3. Connection is automatic - no manual token needed

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
- Automatic price crawling every 15 minutes
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

### 5. Execution Engine

- Automatic price updates to your store
- Manual approval mode available
- Update logs and history
- Rollback capability

### 6. Analytics & Reports

- Position Summary (Cheapest/Neutral/Expensive)
- Price trend charts
- Competitor comparison
- Market share insights

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
A: We support Shopify, WooCommerce, Laravel, Magento, PrestaShop, BigCommerce, and OpenCart. More platforms coming soon!

**Q: Can I connect multiple stores?**
A: Yes! The number of stores depends on your plan. Basic allows 1 store, Premium allows 3, and Pro allows unlimited stores.

**Q: Do I need to install anything on my store?**
A: For Laravel, yes - you need to install our package. For Shopify and WooCommerce, you install our app/plugin. For competitor stores, no installation is needed.

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

### Technical Questions

**Q: How often does PricePilot check competitor prices?**
A: Every 15 minutes for all connected competitor stores.

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
