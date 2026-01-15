# How to Distribute the PricePilot Laravel Package to Users

## 📦 Distribution Options

There are **3 ways** to distribute the Laravel package to your users:

---

## Option 1: GitHub Repository (Recommended)

### Setup (One-time)

1. **Create a GitHub repository** for the package:
   ```bash
   cd /Applications/MAMP/htdocs/PricePilot/integrations/laravel
   git init
   git add .
   git commit -m "Initial release v1.0.0"
   git tag v1.0.0
   ```

2. **Push to GitHub**:
   ```bash
   git remote add origin https://github.com/pricepilot/laravel-client.git
   git push -u origin main
   git push --tags
   ```

### User Installation

Users install directly from GitHub:

```bash
composer require pricepilot/laravel-client:dev-main
```

Or add to their `composer.json`:

```json
{
    "require": {
        "pricepilot/laravel-client": "dev-main"
    },
    "repositories": [
        {
            "type": "vcs",
            "url": "https://github.com/pricepilot/laravel-client.git"
        }
    ]
}
```

Then run:
```bash
composer install
```

---

## Option 2: Private Packagist (For Private Distribution)

### Setup

1. **Create account** at [packagist.com](https://packagist.com) or [Private Packagist](https://packagist.com/plans)

2. **Submit your package**:
   - Go to "Submit Package"
   - Enter repository URL: `https://github.com/pricepilot/laravel-client`
   - Click "Check"

3. **Auto-update webhook** (optional):
   - Packagist provides a webhook URL
   - Add to GitHub repository settings

### User Installation

Once published, users install normally:

```bash
composer require pricepilot/laravel-client
```

---

## Option 3: Direct Download (Simplest for Users)

### Setup

1. **Create a download link** in your PricePilot dashboard
2. **Zip the package**:
   ```bash
   cd /Applications/MAMP/htdocs/PricePilot/integrations
   zip -r pricepilot-laravel-v1.0.0.zip laravel/ -x "*/vendor/*" "*/node_modules/*"
   ```

3. **Host the zip file** on your server or CDN

### User Installation

**Step 1**: Download the package
```bash
# From PricePilot dashboard or direct link
wget https://pricepilot.com/downloads/laravel-client-v1.0.0.zip
```

**Step 2**: Extract to Laravel project
```bash
# Extract to packages directory
mkdir -p packages/pricepilot
unzip pricepilot-laravel-v1.0.0.zip -d packages/pricepilot/laravel-client
```

**Step 3**: Add to composer.json
```json
{
    "autoload": {
        "psr-4": {
            "PricePilot\\LaravelClient\\": "packages/pricepilot/laravel-client/src/"
        }
    }
}
```

**Step 4**: Register service provider (Laravel 10 and below)
```php
// config/app.php
'providers' => [
    // ...
    PricePilot\LaravelClient\PricePilotServiceProvider::class,
],
```

**Step 5**: Run setup
```bash
composer dump-autoload
php artisan pricepilot:install
```

---

## 🎯 Recommended Approach for PricePilot

### Best Practice: Automated Download from Dashboard

Create a **download page in your PricePilot dashboard** that:

1. **Shows installation instructions**
2. **Provides download button** for the latest version
3. **Includes step-by-step guide**
4. **Auto-generates installation commands**

### Implementation

Add a new page in your dashboard:

```
/dashboard/integrations/laravel/download
```

This page should:
- ✅ Display current version (v1.0.0)
- ✅ Provide download link
- ✅ Show installation steps
- ✅ Include video tutorial (optional)
- ✅ Link to documentation

---

## 📋 User Installation Guide (For Documentation)

### Method 1: Via Composer (GitHub)

```bash
# Add repository to composer.json
composer config repositories.pricepilot-laravel vcs https://github.com/pricepilot/laravel-client

# Install package
composer require pricepilot/laravel-client:dev-main

# Run installation
php artisan pricepilot:install
```

### Method 2: Manual Download

```bash
# 1. Download from PricePilot dashboard
# 2. Extract to packages/pricepilot/laravel-client
# 3. Add to composer.json autoload
# 4. Run: composer dump-autoload
# 5. Run: php artisan pricepilot:install
```

---

## 🔄 Version Updates

### For GitHub Distribution

```bash
# Create new version
git tag v1.1.0
git push --tags

# Users update with:
composer update pricepilot/laravel-client
```

### For Direct Download

1. Update version in `composer.json`
2. Create new zip file
3. Update download link in dashboard
4. Notify users via email/dashboard notification

---

## 📊 Recommended Distribution Strategy

For **PricePilot SaaS**, I recommend:

### Phase 1: Direct Download (Now)
- Host zip file on your server
- Provide download in dashboard
- Simple for users to get started

### Phase 2: GitHub Repository (Soon)
- Create public/private GitHub repo
- Users install via Composer
- Easier version management

### Phase 3: Packagist (Later)
- Publish to Packagist
- Standard Composer installation
- Professional distribution

---

## 🎨 Dashboard Integration

Create a dedicated page: `/dashboard/integrations/laravel`

**Content:**
```
┌─────────────────────────────────────────────────┐
│  PricePilot Laravel Integration                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  📦 Latest Version: v1.0.0                      │
│                                                 │
│  [Download Package]  [View Documentation]       │
│                                                 │
│  Installation Steps:                            │
│  1. Download the package above                  │
│  2. Extract to your Laravel project             │
│  3. Run: composer dump-autoload                 │
│  4. Run: php artisan pricepilot:install         │
│  5. Copy the generated token                    │
│  6. Return here and click "Connect Store"       │
│                                                 │
│  Need help? [Watch Video Tutorial]              │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 📞 Support

Users can get the package from:
- **Dashboard**: Download page with instructions
- **Documentation**: Installation guide
- **Support**: Email with download link
- **GitHub**: Direct repository access (if public)

---

**Recommendation**: Start with **Direct Download** from dashboard, then migrate to **GitHub + Composer** as you scale.
