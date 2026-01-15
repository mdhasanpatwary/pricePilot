# PricePilot Laravel Integration - Quick Start Guide

Get your Laravel store connected to PricePilot in 5 minutes!

## 📦 Step 1: Install the Package

```bash
composer require pricepilot/laravel-client
```

## ⚙️ Step 2: Run Installation Command

```bash
php artisan pricepilot:install
```

This command will:
- ✅ Publish the configuration file to `config/pricepilot.php`
- ✅ Generate a secure API token
- ✅ Add the token to your `.env` file

**Important:** Copy the generated API token - you'll need it in Step 4!

## 🔧 Step 3: Configure Your Database (Optional)

If your database uses different table/column names, update `config/pricepilot.php`:

```php
'products_table' => 'your_products_table',

'column_mapping' => [
    'id' => 'product_id',
    'name' => 'product_name',
    'sku' => 'product_sku',
    'price' => 'selling_price',
    'brand' => 'brand_name',
    'model' => 'model_number',
],
```

## 🔌 Step 4: Connect to PricePilot Dashboard

1. Log in to [PricePilot Dashboard](http://localhost:3000)
2. Go to **Dashboard → Integrations**
3. Click **Connect Store**
4. Select **Laravel** as your platform
5. Enter your details:
   - **Store Base URL**: `https://yourstore.com`
   - **Secure API Token**: Paste the token from Step 2
6. Click **Verify & Connect**

## ✅ Step 5: Test the Connection

Test the health endpoint:

```bash
curl -X GET https://yourstore.com/api/pricepilot/health \
  -H "X-PricePilot-Token: your-token-here"
```

Expected response:
```json
{
  "status": "ok",
  "message": "PricePilot integration is working",
  "products_count": 150,
  "version": "1.0.0"
}
```

## 🎉 Done!

Your Laravel store is now connected to PricePilot!

### What's Next?

- **Add Competitors**: Monitor competitor prices in the dashboard
- **Create Pricing Rules**: Set up automated pricing strategies
- **View Analytics**: Track your market position

### Need Help?

- 📖 [Full Documentation](../README.md)
- 📧 Email: support@pricepilot.com
- 💬 Live Chat: Available in dashboard

---

## 🔒 Security Checklist

- ✅ Never commit `.env` to version control
- ✅ Use HTTPS in production
- ✅ Rotate API tokens periodically
- ✅ Enable Laravel's rate limiting
- ✅ Monitor logs for unauthorized access

## 🐛 Troubleshooting

### "Unauthorized" Error
- Verify the token in `.env` matches the dashboard
- Run `php artisan config:clear`
- Check token has no extra spaces

### "Table not found" Error
- Update `products_table` in config
- Verify table exists: `php artisan tinker >>> DB::table('products')->count()`

### Routes Not Working
- Run `php artisan route:list | grep pricepilot`
- Clear route cache: `php artisan route:clear`

---

**Built with ❤️ by the PricePilot Team**
