---
title: "Test Instance Setup Guide"
description: "Setting up test instances"
category: "system-monitoring"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["testing", "deployment", "configuration"]
audience: "admin"
relatedDocs: ["/docs/troubleshooting/test-instance-setup-guide.md"]
---

# Test Instance Setup Guide

This guide helps you set up test OpenCart and Laravel instances for testing the PricePilot price update APIs.

## Option 1: Local Development Setup

### OpenCart Test Instance

#### 1. Install OpenCart

```bash
# Download OpenCart
wget https://github.com/opencart/opencart/releases/download/4.0.2.3/opencart-4.0.2.3.zip
unzip opencart-4.0.2.3.zip -d opencart-test

# Set up database
mysql -u root -p -e "CREATE DATABASE opencart_test;"

# Install via web interface
# Navigate to http://localhost/opencart-test/install
# Follow the installation wizard
```

#### 2. Install PricePilot Extension

```bash
# Copy the extension files
cp -r integrations/opencart/* opencart-test/

# Or create a .ocmod.zip and install via Extension Installer
cd integrations/opencart
zip -r pricepilot.ocmod.zip *
# Upload via OpenCart Admin → Extensions → Installer
```

#### 3. Configure API Access

1. Go to OpenCart Admin → System → Users → API
2. Create a new API user or use the default one
3. Generate an API token
4. Note the token for testing

#### 4. Create Test Products

1. Go to Catalog → Products
2. Add at least 2-3 test products
3. Note the product IDs (visible in the URL when editing)
4. Set prices (e.g., $89.99, $139.99)

### Laravel Test Instance

#### 1. Create Laravel Project

```bash
# Create new Laravel project
composer create-project laravel/laravel laravel-test
cd laravel-test

# Set up database
php artisan migrate
```

#### 2. Install PricePilot Package

```bash
# Copy package files
cp -r ../integrations/laravel/pricepilot ./packages/

# Or install via Composer (if published)
composer require pricepilot/laravel-integration

# Publish configuration
php artisan vendor:publish --provider="PricePilot\LaravelIntegration\PricePilotServiceProvider"

# Run migrations
php artisan migrate
```

#### 3. Configure API Access

```bash
# Generate API token
php artisan pricepilot:generate-token

# Or add to .env
PRICEPILOT_API_TOKEN=your-generated-token
```

#### 4. Create Test Products

Create a seeder or use Tinker:

```bash
php artisan tinker
```

```php
// Create test products
DB::table('products')->insert([
    ['name' => 'Test Product 1', 'sku' => 'TEST-001', 'price' => 89.99],
    ['name' => 'Test Product 2', 'sku' => 'TEST-002', 'price' => 139.99],
    ['name' => 'Test Product 3', 'sku' => 'TEST-003', 'price' => 199.99],
]);
```

## Option 2: Docker Setup

### Docker Compose Configuration

Create `docker-compose.test.yml`:

```yaml
version: '3.8'

services:
  # OpenCart Test Instance
  opencart-test:
    image: bitnami/opencart:latest
    ports:
      - "8080:8080"
    environment:
      - OPENCART_DATABASE_HOST=mysql
      - OPENCART_DATABASE_NAME=opencart_test
      - OPENCART_DATABASE_USER=root
      - OPENCART_DATABASE_PASSWORD=password
    volumes:
      - ./integrations/opencart:/bitnami/opencart/catalog/controller/api/pricepilot
    depends_on:
      - mysql

  # Laravel Test Instance
  laravel-test:
    image: php:8.2-apache
    ports:
      - "8081:80"
    environment:
      - DB_HOST=mysql
      - DB_DATABASE=laravel_test
      - DB_USERNAME=root
      - DB_PASSWORD=password
    volumes:
      - ./laravel-test:/var/www/html
    depends_on:
      - mysql

  # MySQL Database
  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=password
      - MYSQL_DATABASE=opencart_test
    ports:
      - "3306:3306"
    volumes:
      - mysql-data:/var/lib/mysql

volumes:
  mysql-data:
```

### Start Test Instances

```bash
# Start containers
docker-compose -f docker-compose.test.yml up -d

# OpenCart will be available at http://localhost:8080
# Laravel will be available at http://localhost:8081
```

## Option 3: Cloud/Hosted Setup

### Using Shared Hosting

1. **Upload Files**
   - Upload OpenCart/Laravel to your hosting
   - Set up databases via cPanel/Plesk

2. **Install Extensions**
   - Install PricePilot extensions via admin panels
   - Configure API tokens

3. **Configure DNS**
   - Point test subdomains to your hosting
   - e.g., `opencart-test.yourdomain.com`

### Using Cloud Platforms

#### DigitalOcean/Linode

```bash
# Create droplet with LAMP stack
# SSH into server
ssh root@your-server-ip

# Install OpenCart
cd /var/www/html
wget https://github.com/opencart/opencart/releases/download/4.0.2.3/opencart-4.0.2.3.zip
unzip opencart-4.0.2.3.zip

# Install Laravel
composer create-project laravel/laravel laravel-test
```

## Verification Checklist

After setup, verify:

### OpenCart
- [ ] OpenCart is accessible via browser
- [ ] Admin panel is accessible
- [ ] PricePilot extension is installed
- [ ] API token is generated
- [ ] Test products are created
- [ ] API endpoint responds: `http://your-opencart/index.php?route=api/pricepilot&api_token=YOUR_TOKEN`

### Laravel
- [ ] Laravel is accessible via browser
- [ ] Database is connected
- [ ] PricePilot package is installed
- [ ] API token is configured
- [ ] Test products are created
- [ ] API endpoint responds: `http://your-laravel/api/pricepilot/sync` (with token header)

## Testing the Setup

### Quick API Test

#### OpenCart
```bash
curl "http://localhost:8080/index.php?route=api/pricepilot&api_token=YOUR_TOKEN"
```

Expected response:
```json
{
  "products": [
    {
      "product_id": "1",
      "name": "Test Product 1",
      "price": "89.99",
      ...
    }
  ]
}
```

#### Laravel
```bash
curl -H "X-PricePilot-Token: YOUR_TOKEN" \
     "http://localhost:8081/api/pricepilot/sync"
```

Expected response:
```json
{
  "data": [
    {
      "id": "1",
      "name": "Test Product 1",
      "price": "89.99",
      ...
    }
  ]
}
```

## Environment Variables for Testing

After setup, configure these environment variables:

```bash
# OpenCart
export TEST_OPENCART_URL="http://localhost:8080"
export TEST_OPENCART_TOKEN="your-api-token"
export TEST_OPENCART_PRODUCT_ID="1"

# Laravel
export TEST_LARAVEL_URL="http://localhost:8081"
export TEST_LARAVEL_TOKEN="your-api-token"
export TEST_LARAVEL_PRODUCT_ID="1"
```

Or create a `.env.test` file:

```env
TEST_OPENCART_URL=http://localhost:8080
TEST_OPENCART_TOKEN=your-api-token
TEST_OPENCART_PRODUCT_ID=1

TEST_LARAVEL_URL=http://localhost:8081
TEST_LARAVEL_TOKEN=your-api-token
TEST_LARAVEL_PRODUCT_ID=1
```

## Troubleshooting

### OpenCart Issues

**"Extension not found"**
- Verify files are in correct directory: `catalog/controller/api/pricepilot.php`
- Check file permissions (755 for directories, 644 for files)
- Clear OpenCart cache

**"API token invalid"**
- Regenerate token in System → Users → API
- Ensure API user is enabled
- Check IP whitelist settings

### Laravel Issues

**"Package not found"**
- Run `composer dump-autoload`
- Verify package is in `composer.json`
- Check namespace in service provider

**"Route not found"**
- Run `php artisan route:list` to verify routes
- Clear route cache: `php artisan route:clear`
- Ensure service provider is registered

## Next Steps

Once your test instances are set up:

1. Run the automated test script: `npx tsx scripts/test-price-update-apis.ts`
2. Follow the [Price Update API Testing Guide](./PRICE_UPDATE_API_TESTING_GUIDE.md)
3. Document your test results
4. Mark task 3.4 as complete

## Additional Resources

- [OpenCart Documentation](https://docs.opencart.com/)
- [Laravel Documentation](https://laravel.com/docs)
- [PricePilot OpenCart Extension](../integrations/opencart/README.md)
- [PricePilot Laravel Package](../integrations/laravel/README.md)
