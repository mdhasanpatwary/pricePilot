# PricePilot Database Installation - Quick Start Guide

## 🚀 Installation (3 Steps)

### Step 1: Upload Files
Upload the entire `install` directory to your OpenCart root directory.

### Step 2: Run Installer
Open your browser and navigate to:
```
http://yourstore.com/install/install.php
```

### Step 3: Clean Up
After successful installation, **delete the install directory**:
```bash
rm -rf install/
```

## ✅ Verification

Check that all 6 tables were created:

```sql
SHOW TABLES LIKE 'pricepilot_%';
```

Expected tables:
- ✓ pricepilot_activity_log
- ✓ pricepilot_api_logs
- ✓ pricepilot_price_backups
- ✓ pricepilot_product_mapping
- ✓ pricepilot_queue
- ✓ pricepilot_webhooks

## 📋 What Gets Created

| Table | Purpose | Records |
|-------|---------|---------|
| activity_log | Price change history | Grows over time |
| api_logs | API request/response logs | Grows over time |
| product_mapping | Competitor product links | User-defined |
| webhooks | Webhook configurations | User-defined |
| queue | Background job queue | Transient |
| price_backups | Price backup snapshots | User-created |

## 🔧 Troubleshooting

### "Table already exists"
Tables are already installed. You can:
- Skip installation (tables are ready)
- Drop tables and reinstall (data will be lost)

### "Access denied"
Your database user needs these permissions:
- CREATE
- ALTER
- INDEX

### "Unknown collation"
Edit SQL files and change `utf8mb4_general_ci` to `utf8_general_ci`

## 🗑️ Uninstallation

To remove all PricePilot tables:

1. Navigate to: `http://yourstore.com/install/uninstall.php`
2. Confirm deletion
3. Delete the install directory

**⚠️ Warning:** This permanently deletes all data!

## 📚 Need More Info?

See `README.md` for:
- Detailed table descriptions
- Manual installation methods
- Database maintenance tips
- Security best practices

## 🆘 Support

- Check `README.md` for detailed documentation
- Review `IMPLEMENTATION_SUMMARY.md` for technical details
- Contact PricePilot support for assistance
