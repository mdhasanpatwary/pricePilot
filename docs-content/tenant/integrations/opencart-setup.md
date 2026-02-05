---
title: "OpenCart Integration Guide"
description: "Complete guide to integrating PricePilot with your OpenCart store - installation, configuration, and workflow"
category: "integrations"
subcategory: null
tags: ["opencart", "integration", "setup", "api", "installation", "configuration"]
author: "PricePilot Team"
lastReviewed: "2024-02-05"
relatedDocs: ["laravel-setup", "quick-start", "price-approval-guide"]
---

# OpenCart Integration Guide

Complete guide to integrating PricePilot with your OpenCart store. This guide covers installation, configuration, product synchronization, and the complete price update workflow.

## Overview

PricePilot integrates seamlessly with OpenCart through a custom module that enables automated price monitoring and updates. The integration is designed with security and ease of use in mind:

- **No Database Access Required**: PricePilot never accesses your OpenCart database directly
- **API-Based Communication**: All data exchange happens through secure REST APIs
- **Token Authentication**: Simple, secure API token authentication
- **Automated Synchronization**: Products sync automatically on a 24-hour schedule
- **Safe Price Updates**: Built-in safety constraints prevent pricing errors

### How It Works

1. Install the PricePilot OpenCart module (.ocmod.zip)
2. Generate an API token in the module settings
3. Connect your store to PricePilot dashboard
4. Products automatically sync every 24 hours
5. PricePilot monitors competitor prices
6. Review and approve price changes
7. Updates are applied automatically to your store

### Key Features

- **Secure Integration**: API token-based authentication with optional IP whitelisting
- **Automatic Product Sync**: Products sync every 24 hours automatically
- **Price Update Control**: Manual approval or automated rules for price changes
- **Audit Trail**: Complete history of all price changes
- **Multi-Store Support**: Manage multiple OpenCart stores from one dashboard

## Prerequisites

Before you begin, ensure you have:

- **OpenCart Version**: OpenCart 3.x or 4.x installed and running
- **Admin Access**: Full administrator access to your OpenCart admin panel
- **File Access**: FTP, SFTP, or file manager access to your server
- **HTTPS**: SSL certificate installed (strongly recommended for security)
- **PHP Version**: PHP 7.4 or higher
- **Server Requirements**: 
  - cURL extension enabled
  - JSON extension enabled
  - OpenSSL extension enabled

### Version Compatibility

| OpenCart Version | PricePilot Module | Status |
|-----------------|-------------------|---------|
| OpenCart 4.x | v2.0+ | ✅ Fully Supported |
| OpenCart 3.x | v1.5+ | ✅ Fully Supported |
| OpenCart 2.x | Not Supported | ❌ Not Compatible |

## Installation

### Step 1: Download the PricePilot Module

1. Log in to your PricePilot dashboard at [https://app.pricepilot.com](https://app.pricepilot.com)
2. Navigate to **Settings** → **Integrations**
3. Click the **OpenCart** integration card
4. Click **Download Module** button
5. Save the `pricepilot-opencart.ocmod.zip` file to your computer

> **Note**: The .ocmod.zip file is a standard OpenCart extension format. Do not extract or modify the file before installation.

### Step 2: Install the Module

You can install the module using either the OpenCart Admin Panel (recommended) or via FTP.

#### Method A: Via OpenCart Admin Panel (Recommended)

This is the easiest and safest installation method:

1. Log in to your OpenCart admin panel
2. Navigate to **Extensions** → **Installer**
3. Click the **Upload** button
4. Click **Choose File** and select the `pricepilot-opencart.ocmod.zip` file
5. Wait for the upload progress bar to complete
6. You should see a success message: "Success: You have modified extensions!"
7. Click **Continue** to proceed

```bash
# Expected file structure after installation:
upload/
├── admin/
│   ├── controller/extension/module/pricepilot.php
│   ├── language/en-gb/extension/module/pricepilot.php
│   └── view/template/extension/module/pricepilot.twig
├── catalog/
│   └── controller/api/pricepilot.php
└── system/
    └── library/pricepilot/
```

> **Tip**: If you see an error about file permissions, you may need to set write permissions on the upload directory temporarily.

#### Method B: Via FTP (Alternative)

If you prefer manual installation or the admin panel method fails:

1. Extract the `pricepilot-opencart.ocmod.zip` file on your computer
2. Connect to your server via FTP/SFTP
3. Navigate to your OpenCart root directory
4. Upload the extracted `upload/` folder contents to your OpenCart root
5. Maintain the exact directory structure from the zip file
6. Set proper file permissions:

```bash
# Set file permissions (via SSH)
find upload/ -type f -exec chmod 644 {} \;
find upload/ -type d -exec chmod 755 {} \;

# Specifically for the API controller
chmod 644 upload/catalog/controller/api/pricepilot.php
```

> **Warning**: Always backup your OpenCart installation before uploading files manually.

### Step 3: Enable the Extension

After installation, you need to enable the PricePilot module:

1. In OpenCart admin, go to **Extensions** → **Extensions**
2. From the **Choose the extension type** dropdown, select **Modules**
3. Scroll down to find **PricePilot** in the list
4. Click the green **Install** button (+ icon) on the right
5. After installation, click the blue **Edit** button (pencil icon)
6. You'll be taken to the PricePilot module configuration page

```php
// The module registers these routes automatically:
// Admin: admin/extension/module/pricepilot
// API: catalog/api/pricepilot/products
// API: catalog/api/pricepilot/products/update
```

### Step 4: Verify Installation

To confirm the module is installed correctly:

1. Check that the PricePilot module appears in **Extensions** → **Modules**
2. Verify the status shows as **Installed** (green checkmark)
3. Click **Edit** to access the configuration page
4. You should see the PricePilot settings interface

> **Troubleshooting**: If the module doesn't appear, clear your OpenCart cache:
> 1. Go to **Dashboard**
> 2. Click the blue **Settings** gear icon (top right)
> 3. Click **Refresh** to clear cache
> 4. Or manually delete files in `system/storage/cache/`

### Installation Screenshots

**[Screenshot Placeholder: OpenCart Extensions → Installer page]**
- Shows the Upload button and file selection interface

**[Screenshot Placeholder: PricePilot module in Extensions list]**
- Shows PricePilot with Install and Edit buttons

**[Screenshot Placeholder: PricePilot configuration page]**
- Shows the main module settings interface

## Configuration

### API Token Setup

The API token is the secure key that allows PricePilot to communicate with your OpenCart store. Follow these steps to generate and configure your token.

#### Generate API Token in OpenCart

1. In OpenCart admin, navigate to **Extensions** → **Extensions**
2. Select **Modules** from the dropdown
3. Find **PricePilot** and click **Edit**
4. On the PricePilot configuration page, locate the **API Token** section
5. Click the **Generate New Token** button
6. A new token will be generated automatically
7. Click the **Copy Token** button to copy it to your clipboard
8. Click **Save** to store the token in your OpenCart database

```typescript
// Example API token format
{
  "token": "pp_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "prefix": "pp_live_",
  "length": 48,
  "createdAt": "2024-02-05T10:30:00Z",
  "expiresAt": null, // Tokens don't expire unless regenerated
  "permissions": ["read:products", "write:products"]
}
```

> **Important**: The token is displayed only once during generation. Make sure to copy it before leaving the page.

**[Screenshot Placeholder: API Token generation interface]**
- Shows the Generate New Token button and Copy Token button

#### Configure Token in PricePilot Dashboard

Now connect your OpenCart store to PricePilot:

1. Open a new browser tab and log in to [PricePilot Dashboard](https://app.pricepilot.com)
2. Navigate to **Settings** → **Integrations**
3. Click **Add New Store** or **Connect Store**
4. Select **OpenCart** as the platform
5. Fill in the connection details:

```typescript
{
  "platform": "opencart",
  "storeName": "My Store", // Friendly name for identification
  "storeUrl": "https://yourstore.com", // Your OpenCart store URL
  "apiToken": "pp_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" // Paste the token
}
```

6. Click **Test Connection** to verify the setup
7. If successful, you'll see: ✅ "Connection successful! Found X products."
8. Click **Save Integration** to complete the setup

**[Screenshot Placeholder: PricePilot Add Store form]**
- Shows the form with platform selection, store URL, and API token fields

**[Screenshot Placeholder: Successful connection test]**
- Shows the success message with product count

#### Token Security Best Practices

Protect your API token to keep your store secure:

> **🔒 Security Best Practices**
>
> - **Never share your token**: Treat it like a password
> - **Use HTTPS only**: Always access your store via HTTPS
> - **Regenerate if compromised**: If you suspect the token is exposed, regenerate immediately
> - **One token per store**: Don't reuse tokens across multiple stores
> - **Store securely**: The token is encrypted in your OpenCart database
> - **Monitor access**: Review API access logs regularly in PricePilot dashboard

```php
// The token is stored encrypted in OpenCart database
// Location: oc_setting table
// Key: module_pricepilot_api_token
// Value: [encrypted token]

// Never expose the token in:
// - Frontend JavaScript code
// - Public API responses
// - Error messages
// - Log files
```

#### Regenerate API Token

If you need to regenerate your token (e.g., security breach, lost token):

1. In OpenCart admin, go to **Extensions** → **Modules** → **PricePilot**
2. Click **Edit**
3. In the API Token section, click **Regenerate Token**
4. Confirm the action (this will invalidate the old token)
5. Copy the new token
6. Update the token in PricePilot dashboard:
   - Go to **Settings** → **Integrations**
   - Find your OpenCart store
   - Click **Edit**
   - Paste the new token
   - Click **Test Connection**
   - Click **Save**

> **Warning**: Regenerating the token will immediately invalidate the old token. Make sure to update it in PricePilot dashboard right away to avoid connection errors.

#### Optional: IP Whitelisting

For additional security, restrict API access to PricePilot's IP addresses:

1. In the PricePilot module settings, enable **IP Whitelist**
2. Add these PricePilot IP addresses:

```text
52.1.2.3
52.4.5.6
52.7.8.9
```

3. Click **Save**
4. Test the connection from PricePilot dashboard to ensure it still works

> **Note**: IP whitelisting is optional but recommended for production stores handling sensitive pricing data.

### Product Synchronization

Once your store is connected, PricePilot needs to sync your product catalog to monitor and update prices.

#### Initial Product Sync

The first sync happens automatically after you connect your store:

1. After saving your integration in PricePilot dashboard
2. Navigate to **Products** → **My Products**
3. You'll see a message: "Initial sync in progress..."
4. The sync typically takes 1-2 minutes for up to 1,000 products
5. Larger catalogs (5,000+ products) may take 5-10 minutes
6. Once complete, you'll see your products listed

```typescript
// Initial sync process
{
  "status": "syncing",
  "totalProducts": 1250,
  "syncedProducts": 0,
  "estimatedTime": "2-3 minutes",
  "startedAt": "2024-02-05T10:35:00Z"
}

// After completion
{
  "status": "completed",
  "totalProducts": 1250,
  "syncedProducts": 1248,
  "failedProducts": 2,
  "completedAt": "2024-02-05T10:37:30Z",
  "duration": "2m 30s"
}
```

**[Screenshot Placeholder: Initial sync progress indicator]**
- Shows progress bar and product count

**[Screenshot Placeholder: Products list after sync]**
- Shows the My Products page with synced products

#### What Gets Synced

PricePilot syncs the following product information:

| Field | Description | Required |
|-------|-------------|----------|
| Product ID | OpenCart internal product ID | ✅ Yes |
| SKU | Stock Keeping Unit | ✅ Yes |
| Name | Product name/title | ✅ Yes |
| Price | Current selling price | ✅ Yes |
| Brand | Manufacturer/brand name | ⚪ Optional |
| Model | Model number | ⚪ Optional |
| Status | Active/Inactive | ✅ Yes |
| Image | Primary product image URL | ⚪ Optional |

```php
// Example product data synced from OpenCart
{
  "id": "123",
  "sku": "LAPTOP-001",
  "name": "Dell XPS 15 Laptop",
  "price": 1299.99,
  "brand": "Dell",
  "model": "XPS-15-9520",
  "status": "active",
  "image": "https://yourstore.com/image/catalog/dell-xps-15.jpg",
  "lastSyncedAt": "2024-02-05T10:37:30Z"
}
```

#### Automatic Ongoing Sync

After the initial sync, PricePilot automatically syncs your products every 24 hours:

- **Sync Schedule**: Every 24 hours at 2:00 AM (your store's timezone)
- **What's Updated**: Prices, product status, new products, deleted products
- **Duration**: Typically 1-5 minutes depending on catalog size
- **Notifications**: You'll receive an email if sync fails

```typescript
// Automatic sync schedule
{
  "frequency": "24 hours",
  "nextSync": "2024-02-06T02:00:00Z",
  "lastSync": "2024-02-05T02:00:00Z",
  "status": "success",
  "productsUpdated": 15,
  "productsAdded": 3,
  "productsRemoved": 1
}
```

> **Important**: The 24-hour sync schedule ensures your product data stays current without overloading your server. This is a realistic frequency for price monitoring.

#### Manual Sync

You can trigger a manual sync anytime:

1. Go to **Products** → **My Products** in PricePilot dashboard
2. Click the **Sync Now** button (top right)
3. Confirm the action
4. Wait for sync to complete (usually 1-2 minutes)
5. Review the sync results

```bash
# Manual sync is useful when:
# - You've added new products to OpenCart
# - You've updated product information
# - You want to verify changes immediately
# - Automatic sync failed and you want to retry
```

**[Screenshot Placeholder: Sync Now button]**
- Shows the Sync Now button location

#### Sync Filters

Control which products are synced:

1. In PricePilot dashboard, go to **Settings** → **Integrations**
2. Click **Edit** on your OpenCart store
3. Scroll to **Sync Filters** section
4. Configure filters:

```typescript
{
  "syncFilters": {
    "status": "active", // Only sync active products
    "minPrice": 10.00, // Ignore products under $10
    "maxPrice": 10000.00, // Ignore products over $10,000
    "categories": ["Electronics", "Computers"], // Specific categories only
    "excludeOutOfStock": true // Skip out-of-stock products
  }
}
```

5. Click **Save** and **Sync Now** to apply filters

#### Troubleshooting Sync Issues

**Products Not Appearing?**

Check these common issues:

1. **Product Status**: Ensure products are set to "Enabled" in OpenCart
2. **Price Set**: Products must have a price greater than 0
3. **SKU Required**: Products must have a SKU assigned
4. **Sync Filters**: Check if filters are excluding products

```php
// In OpenCart, verify product settings:
// Catalog → Products → Edit Product
// - Status: Enabled
// - Price: > 0
// - SKU: Not empty
// - Quantity: > 0 (if excludeOutOfStock is enabled)
```

**Sync Failed Error?**

If sync fails:

1. Check API token is still valid
2. Verify your store URL is accessible
3. Check OpenCart error logs: `system/storage/logs/error.log`
4. Try manual sync again
5. Contact support if issue persists

**Sync Taking Too Long?**

For large catalogs:

1. Enable sync filters to reduce product count
2. Sync during off-peak hours
3. Check server resources (CPU, memory)
4. Consider upgrading hosting if needed

```bash
# Expected sync times:
# - 100 products: ~30 seconds
# - 1,000 products: ~2 minutes
# - 5,000 products: ~8 minutes
# - 10,000+ products: ~15-20 minutes
```

#### Sync Logs

View detailed sync history:

1. Go to **Products** → **Sync History**
2. See all past syncs with:
   - Timestamp
   - Duration
   - Products synced
   - Errors (if any)
3. Click any sync to see detailed log
4. Download logs for troubleshooting

**[Screenshot Placeholder: Sync History page]**
- Shows list of past syncs with status and details

## Workflow

### Complete Price Update Workflow

This section explains the end-to-end process from price comparison to executing updates in your OpenCart store.

#### Step 1: Price Comparison

After products are synced and competitors are configured, PricePilot automatically compares prices:

1. **Competitor Scraping**: PricePilot scrapes competitor websites every 24 hours
2. **Product Matching**: Matched products are compared automatically
3. **Price Analysis**: System calculates price differences
4. **Status Assignment**: Products are marked as:
   - 🔴 **RED**: Your price is higher (action needed)
   - 🟢 **GREEN**: Your price is lower (competitive)
   - ⚪ **NEUTRAL**: Prices are equal

```typescript
// Price comparison result
{
  "productId": "123",
  "yourPrice": 1299.99,
  "competitorPrice": 1199.99,
  "difference": 100.00,
  "percentageDiff": 8.33,
  "status": "higher", // Your price is higher
  "recommendation": "Consider reducing price to stay competitive",
  "lastCompared": "2024-02-05T10:00:00Z"
}
```

**[Screenshot Placeholder: Price comparison table]**
- Shows products with color-coded status indicators

#### Step 2: Review Pending Changes

Navigate to the price approval interface:

1. Go to **Pricing** → **Price Approvals** in PricePilot dashboard
2. View all pending price changes
3. Each change shows:
   - Product name and SKU
   - Current price
   - Recommended new price
   - Competitor price
   - Reasoning for change
   - Potential savings/profit impact

```typescript
// Pending price change
{
  "productId": "123",
  "productName": "Dell XPS 15 Laptop",
  "sku": "LAPTOP-001",
  "currentPrice": 1299.99,
  "recommendedPrice": 1189.99,
  "competitorPrice": 1199.99,
  "strategy": "undercut_by_fixed",
  "undercutAmount": 10.00,
  "reasoning": "Competitor price is $1,199.99. Recommended price of $1,189.99 undercuts by $10",
  "estimatedImpact": {
    "revenueChange": -110.00,
    "competitiveAdvantage": "high"
  },
  "expiresAt": "2024-02-12T10:00:00Z" // 7 days from creation
}
```

**[Screenshot Placeholder: Price Approvals page]**
- Shows list of pending price changes with details

#### Step 3: Approval Process

You have several options for approving price changes:

**Option A: Manual Approval (Individual)**

1. Review each price change carefully
2. Click **Approve** to accept the change
3. Click **Reject** to decline the change
4. Add notes if needed (optional)

**Option B: Bulk Approval**

1. Select multiple products using checkboxes
2. Click **Approve Selected** button
3. Confirm the bulk action
4. All selected changes are approved at once

**Option C: Approve All**

1. Click **Approve All** button (top right)
2. Review the summary of all changes
3. Confirm to approve all pending changes
4. Useful when you trust the recommendations

```typescript
// Approval actions
{
  "action": "approve",
  "productIds": ["123", "456", "789"],
  "approvedBy": "user@example.com",
  "approvedAt": "2024-02-05T11:00:00Z",
  "notes": "Approved to match competitor pricing"
}
```

> **💡 Tip**: Use filters to approve specific categories or price ranges. For example, approve all changes under $50 automatically.

**[Screenshot Placeholder: Bulk approval interface]**
- Shows checkbox selection and Approve Selected button

#### Step 4: Price Update Execution

Once approved, PricePilot executes the price updates:

1. **Queue Processing**: Approved changes are queued for execution
2. **API Call**: PricePilot sends update request to your OpenCart store
3. **Validation**: OpenCart module validates the request
4. **Price Update**: Product price is updated in database
5. **Confirmation**: Success/failure status is returned
6. **Notification**: You receive confirmation email

```http
POST /api/pricepilot/products/update
Authorization: Bearer pp_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
Content-Type: application/json

{
  "updates": [
    {
      "id": "123",
      "price": 1189.99,
      "oldPrice": 1299.99
    }
  ]
}

Response:
{
  "success": true,
  "data": {
    "updated": 1,
    "failed": 0,
    "results": [
      {
        "id": "123",
        "status": "success",
        "oldPrice": 1299.99,
        "newPrice": 1189.99,
        "updatedAt": "2024-02-05T11:01:00Z"
      }
    ]
  }
}
```

**Execution Timeline:**
- Approved changes are processed within 1-2 minutes
- Updates happen in batches of 50 products
- Large updates (500+ products) may take 10-15 minutes
- You can monitor progress in real-time

**[Screenshot Placeholder: Price update progress]**
- Shows progress bar and update status

#### Step 5: Verification

After updates are executed, verify the changes:

1. Go to **Pricing** → **Update History**
2. View all completed updates with:
   - Product details
   - Old price → New price
   - Timestamp
   - Status (success/failed)
3. Check your OpenCart store to confirm prices are updated
4. Review customer-facing pages to ensure display is correct

```typescript
// Update history record
{
  "updateId": "upd_123456",
  "productId": "123",
  "productName": "Dell XPS 15 Laptop",
  "oldPrice": 1299.99,
  "newPrice": 1189.99,
  "difference": -110.00,
  "status": "success",
  "executedAt": "2024-02-05T11:01:00Z",
  "executedBy": "user@example.com",
  "rollbackAvailable": true
}
```

**[Screenshot Placeholder: Update History page]**
- Shows completed price updates with before/after prices

#### Safety Constraints

PricePilot includes built-in safety features to prevent pricing errors:

**Minimum Price Floor**

Set a minimum price to prevent selling below cost:

```typescript
{
  "productId": "123",
  "minPrice": 1000.00, // Never go below this price
  "currentPrice": 1299.99,
  "recommendedPrice": 950.00, // Would be rejected
  "actualPrice": 1000.00 // Adjusted to minimum
}
```

**Maximum Discount Limit**

Prevent excessive price drops:

```typescript
{
  "productId": "123",
  "maxDiscountPercent": 20, // Max 20% discount
  "currentPrice": 1299.99,
  "recommendedPrice": 900.00, // 30% discount - rejected
  "actualPrice": 1039.99 // Adjusted to 20% discount
}
```

**Price Change Velocity**

Limit how often prices can change:

```typescript
{
  "productId": "123",
  "minTimeBetweenChanges": "24 hours",
  "lastChanged": "2024-02-04T11:00:00Z",
  "nextAllowedChange": "2024-02-05T11:00:00Z"
}
```

**Configure Safety Constraints:**

1. Go to **Settings** → **Pricing Rules**
2. Set global defaults or per-product rules
3. Configure:
   - Minimum price floor
   - Maximum discount percentage
   - Minimum time between changes
4. Click **Save**

> **🔒 Safety First**: These constraints protect your business from accidental pricing errors. Always configure them before enabling automatic approvals.

#### Expiration Policy

Pending price changes expire after 7 days:

- **Why**: Competitor prices may have changed, making the recommendation outdated
- **What Happens**: Expired changes are automatically removed from the approval queue
- **Notification**: You'll receive a weekly summary of expired changes
- **Action**: Review and re-sync to get fresh recommendations

```typescript
{
  "pendingChange": {
    "createdAt": "2024-02-05T10:00:00Z",
    "expiresAt": "2024-02-12T10:00:00Z",
    "daysRemaining": 7,
    "status": "pending"
  }
}
```

#### Rollback Capability

If you need to undo a price change:

1. Go to **Pricing** → **Update History**
2. Find the update you want to rollback
3. Click **Rollback** button
4. Confirm the action
5. Price is reverted to previous value

```typescript
// Rollback action
{
  "updateId": "upd_123456",
  "action": "rollback",
  "currentPrice": 1189.99,
  "rollbackPrice": 1299.99,
  "reason": "Customer complaints about price change",
  "rolledBackAt": "2024-02-05T15:00:00Z"
}
```

> **Note**: Rollback is available for 30 days after a price update. After that, you'll need to manually adjust prices.

## Troubleshooting

This section covers common issues you may encounter during installation, configuration, and operation of the OpenCart integration.

### Installation Issues

#### Module Not Appearing in Extensions List

**Symptoms:**
- PricePilot doesn't show up in Extensions → Modules
- Installation appears successful but module is missing

**Possible Causes:**
1. Installation incomplete or corrupted
2. File permissions incorrect
3. OpenCart cache not cleared
4. Module files in wrong directory

**Solutions:**

```bash
# 1. Clear OpenCart cache
rm -rf system/storage/cache/*
rm -rf system/storage/modification/*

# 2. Check file permissions
find upload/admin/controller/extension/module/ -type f -exec chmod 644 {} \;
find upload/admin/view/template/extension/module/ -type f -exec chmod 644 {} \;
find upload/catalog/controller/api/ -type f -exec chmod 644 {} \;

# 3. Verify file structure
ls -la upload/admin/controller/extension/module/pricepilot.php
ls -la upload/catalog/controller/api/pricepilot.php
```

**Step-by-Step Fix:**
1. Log in to OpenCart admin
2. Go to **Dashboard** → Click settings gear icon
3. Click **Refresh** to clear cache
4. Go to **Extensions** → **Modifications**
5. Click **Refresh** button (top right)
6. Return to **Extensions** → **Extensions** → **Modules**
7. PricePilot should now appear

#### Upload Failed Error

**Symptoms:**
- Error message: "Warning: Upload failed!"
- File size error
- Permission denied error

**Solutions:**

1. **Check PHP upload limits:**

```php
// Check your php.ini settings
upload_max_filesize = 10M
post_max_size = 10M
max_execution_time = 300
```

2. **Increase limits in .htaccess:**

```apache
php_value upload_max_filesize 10M
php_value post_max_size 10M
php_value max_execution_time 300
```

3. **Use FTP installation method instead** (see Installation section)

#### Installation Successful But Module Won't Enable

**Symptoms:**
- Install button doesn't work
- Error when clicking Install
- Module shows as "Not Installed"

**Solutions:**

1. Check OpenCart error log:

```bash
# View error log
tail -f system/storage/logs/error.log
```

2. Verify database permissions:
   - Ensure OpenCart database user has INSERT/UPDATE permissions
   - Check if `oc_setting` table is writable

3. Try manual database entry:

```sql
-- Only use if absolutely necessary
INSERT INTO oc_setting (store_id, code, key, value, serialized)
VALUES (0, 'module_pricepilot', 'module_pricepilot_status', '1', 0);
```

### Connection Issues

#### API Connection Failed

**Symptoms:**
- "Connection failed" error in PricePilot dashboard
- "Unable to reach your store" message
- Test connection fails

**Possible Causes:**
1. Invalid or expired API token
2. HTTPS not enabled
3. Firewall blocking PricePilot IPs
4. Incorrect store URL
5. API endpoint not accessible

**Solutions:**

**Step 1: Verify API Token**

1. In OpenCart, go to module settings
2. Regenerate API token
3. Copy new token
4. Update in PricePilot dashboard
5. Test connection again

**Step 2: Check HTTPS**

```bash
# Verify SSL certificate is valid
curl -I https://yourstore.com

# Should return 200 OK, not certificate errors
```

**Step 3: Test API Endpoint Directly**

```bash
# Test products endpoint
curl -X GET "https://yourstore.com/api/pricepilot/products" \
  -H "Authorization: Bearer pp_live_your_token_here"

# Expected response:
# {"success":true,"data":{"products":[...]}}

# If you get 404, the module isn't installed correctly
# If you get 401, the token is invalid
# If you get 500, check OpenCart error logs
```

**Step 4: Check Firewall Rules**

Whitelist PricePilot IP addresses in your server firewall:

```bash
# Example for iptables
iptables -A INPUT -s 52.1.2.3 -j ACCEPT
iptables -A INPUT -s 52.4.5.6 -j ACCEPT
iptables -A INPUT -s 52.7.8.9 -j ACCEPT
```

Or configure in your hosting control panel (cPanel, Plesk, etc.)

**Step 5: Verify Store URL**

Common URL mistakes:
- ❌ `http://yourstore.com` (should be https)
- ❌ `https://yourstore.com/admin` (should be root URL)
- ❌ `https://www.yourstore.com` (if your store is at non-www)
- ✅ `https://yourstore.com` (correct format)

#### Authentication Errors

**Symptoms:**
- "Invalid API token" error
- "Unauthorized" (401) response
- "Token expired" message

**Solutions:**

1. **Regenerate Token:**
   - OpenCart admin → Extensions → Modules → PricePilot → Edit
   - Click "Regenerate Token"
   - Copy new token
   - Update in PricePilot dashboard

2. **Check Token Format:**

```typescript
// Valid token format
"pp_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"

// Invalid formats
"pp_live_" // Too short
"a1b2c3d4" // Missing prefix
"pp_test_..." // Wrong environment
```

3. **Verify Token in Database:**

```sql
-- Check if token exists
SELECT * FROM oc_setting 
WHERE `key` = 'module_pricepilot_api_token';

-- Should return encrypted token value
```

### Sync Issues

#### Products Not Syncing

**Symptoms:**
- Sync completes but no products appear
- "0 products synced" message
- Some products missing

**Diagnostic Checklist:**

```bash
# Check these in OpenCart:
1. Product Status = Enabled ✓
2. Product Price > 0 ✓
3. Product SKU not empty ✓
4. Product Quantity > 0 (if excludeOutOfStock enabled) ✓
5. Product in allowed categories (if category filter enabled) ✓
```

**Solutions:**

**Issue: Products are disabled**

```sql
-- Check product status
SELECT product_id, status FROM oc_product WHERE status = 0;

-- Enable products
UPDATE oc_product SET status = 1 WHERE product_id IN (123, 456, 789);
```

**Issue: Missing SKUs**

```sql
-- Find products without SKU
SELECT product_id, name FROM oc_product WHERE sku = '' OR sku IS NULL;

-- Add SKUs (example)
UPDATE oc_product SET sku = CONCAT('SKU-', product_id) WHERE sku = '';
```

**Issue: Price is zero**

```sql
-- Find products with zero price
SELECT product_id, name, price FROM oc_product WHERE price = 0;

-- Update prices (review manually first!)
```

**Issue: Sync filters too restrictive**

1. Go to PricePilot dashboard → Settings → Integrations
2. Edit your OpenCart store
3. Review Sync Filters
4. Temporarily disable filters to test
5. Run sync again

#### Sync Takes Too Long

**Symptoms:**
- Sync runs for 10+ minutes
- Timeout errors
- Incomplete syncs

**Solutions:**

1. **Enable Sync Filters:**

```typescript
{
  "syncFilters": {
    "status": "active",
    "minPrice": 10.00,
    "categories": ["Electronics"], // Sync specific categories only
    "excludeOutOfStock": true
  }
}
```

2. **Optimize Server Resources:**

```bash
# Check server load
top
htop

# Check PHP memory limit
php -i | grep memory_limit

# Increase if needed (in php.ini)
memory_limit = 256M
```

3. **Schedule Syncs During Off-Peak Hours:**
   - Configure sync to run at 2 AM when traffic is low
   - Reduces server load impact

4. **Contact Hosting Provider:**
   - May need to upgrade hosting plan
   - Request increased PHP execution time
   - Check for rate limiting on server

#### Sync Failed Error

**Symptoms:**
- "Sync failed" error message
- Partial sync completion
- Error in sync logs

**Solutions:**

1. **Check OpenCart Error Logs:**

```bash
# View recent errors
tail -n 100 system/storage/logs/error.log

# Common errors:
# - Database connection lost
# - Memory limit exceeded
# - Timeout errors
# - Permission denied
```

2. **Check PricePilot Sync Logs:**
   - Dashboard → Products → Sync History
   - Click failed sync
   - Review error details
   - Download full log

3. **Retry Sync:**
   - Wait 5 minutes
   - Click "Sync Now" again
   - If fails again, contact support with error logs

### Price Update Issues

#### Price Updates Not Working

**Symptoms:**
- Approved changes don't apply
- Prices unchanged in OpenCart
- "Update failed" errors

**Diagnostic Steps:**

1. **Verify Product IDs Match:**

```sql
-- Check product exists
SELECT product_id, name, price FROM oc_product WHERE product_id = 123;
```

2. **Check Price Constraints:**

```typescript
// Example constraint violation
{
  "productId": "123",
  "currentPrice": 1000.00,
  "requestedPrice": 500.00, // 50% discount
  "minPrice": 800.00, // Constraint: min price
  "maxDiscountPercent": 20, // Constraint: max 20% discount
  "result": "rejected", // Update rejected due to constraints
  "adjustedPrice": 800.00 // Would be adjusted to min price
}
```

3. **Test API Endpoint:**

```bash
# Manual test of update endpoint
curl -X POST "https://yourstore.com/api/pricepilot/products/update" \
  -H "Authorization: Bearer pp_live_your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {
        "id": "123",
        "price": 99.99
      }
    ]
  }'
```

**Solutions:**

1. **Check API Rate Limits:**
   - Wait 1 hour if rate limit exceeded
   - Review rate limit settings in module

2. **Verify Product Permissions:**
   - Ensure API has permission to update products
   - Check OpenCart user permissions

3. **Review Update History:**
   - Dashboard → Pricing → Update History
   - Check for error messages
   - Look for patterns in failures

#### Prices Update But Don't Show on Storefront

**Symptoms:**
- Price updated in database
- Admin panel shows new price
- Storefront still shows old price

**Solutions:**

1. **Clear OpenCart Cache:**

```bash
# Clear all caches
rm -rf system/storage/cache/*
rm -rf system/storage/modification/*
```

2. **Clear Browser Cache:**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Or use incognito/private browsing mode

3. **Check Theme Caching:**
   - Some themes cache product data
   - Disable theme caching temporarily
   - Check theme documentation

4. **Verify Database Update:**

```sql
-- Confirm price was updated
SELECT product_id, name, price, date_modified 
FROM oc_product 
WHERE product_id = 123;
```

### Advanced Troubleshooting

#### Enable Debug Mode

For detailed error information:

1. **Enable OpenCart Debug:**

```php
// In config.php and admin/config.php
define('DEBUG', true);
```

2. **Enable PricePilot Module Debug:**
   - Module settings → Enable Debug Logging
   - Logs saved to: `system/storage/logs/pricepilot.log`

3. **Review Debug Logs:**

```bash
# Watch logs in real-time
tail -f system/storage/logs/pricepilot.log
```

#### Database Connection Issues

**Symptoms:**
- Intermittent sync failures
- "Database connection lost" errors
- Slow API responses

**Solutions:**

```php
// Check database configuration in config.php
define('DB_HOSTNAME', 'localhost');
define('DB_USERNAME', 'your_db_user');
define('DB_PASSWORD', 'your_db_password');
define('DB_DATABASE', 'your_db_name');

// Test database connection
$mysqli = new mysqli(DB_HOSTNAME, DB_USERNAME, DB_PASSWORD, DB_DATABASE);
if ($mysqli->connect_error) {
    die('Connection failed: ' . $mysqli->connect_error);
}
```

#### Module Conflicts

**Symptoms:**
- PricePilot stops working after installing another extension
- Unexpected errors
- Features not working

**Solutions:**

1. **Identify Conflicting Module:**
   - Disable recently installed extensions one by one
   - Test PricePilot after each disable
   - Note which module causes the conflict

2. **Check Modification Conflicts:**
   - Extensions → Modifications
   - Look for modifications affecting same files
   - Disable conflicting modifications

3. **Contact Support:**
   - Report the conflicting module
   - Provide module name and version
   - Include error logs

### Getting Help

If you've tried the solutions above and still have issues:

1. **Gather Information:**
   - OpenCart version
   - PricePilot module version
   - PHP version
   - Error messages (exact text)
   - Screenshots of the issue
   - Relevant log files

2. **Check Documentation:**
   - [FAQ](../troubleshooting/faq)
   - [Common Issues](../troubleshooting/common-issues)
   - [API Documentation](api-authentication)

3. **Contact Support:**
   - Email: support@pricepilot.com
   - Include all gathered information
   - Describe steps to reproduce the issue
   - Mention solutions you've already tried

4. **Community Resources:**
   - PricePilot Community Forum
   - OpenCart Forum
   - Stack Overflow (tag: pricepilot)

## Next Steps

Now that your OpenCart store is integrated with PricePilot:

1. **Set Up Competitors**
   - Add competitor websites to monitor
   - Configure scraping settings
   - [Learn more →](../competitors/adding-competitors)

2. **Configure Product Matching**
   - Match your products to competitor products
   - Review match confidence scores
   - [Learn more →](../products/product-matching)

3. **Set Up Price Approval Workflow**
   - Configure approval rules
   - Set safety constraints
   - [Learn more →](../pricing/price-approval-guide)

4. **Enable Auto-Approval Rules** (Optional)
   - Automate price updates based on rules
   - Set conditions and limits
   - [Learn more →](../pricing/update-strategies)

5. **Monitor Performance**
   - Review price update history
   - Track competitive positioning
   - Analyze pricing trends

## Related Documentation

- [Laravel Integration](laravel-setup) - Connect Laravel stores
- [Quick Start Guide](../getting-started/quick-start) - Get started quickly
- [Price Approval Guide](../pricing/price-approval-guide) - Manage price changes
- [Product Matching](../products/product-matching) - Match products accurately
- [API Authentication](api-authentication) - API reference
- [FAQ](../troubleshooting/faq) - Frequently asked questions
