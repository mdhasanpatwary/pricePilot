---
title: "Price Update API Testing Guide"
description: "Testing price update API integrations"
category: "integrations"
tags: ["api", "testing", "integration"]
audience: "tenant"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
---

# Price Update API Testing Guide

## Overview

This guide provides instructions for testing the OpenCart and Laravel price update APIs to ensure they work correctly with real instances.

**Requirements**: 2.5.3

## Prerequisites

### 1. Test OpenCart Instance

You need a working OpenCart installation with the PricePilot extension installed.

**Setup Steps:**
1. Install OpenCart (version 3.x or 4.x)
2. Install the PricePilot OpenCart extension from `integrations/opencart/`
3. Configure the extension and generate an API token
4. Create at least one test product with a known product ID

**Required Information:**
- Base URL (e.g., `http://localhost/opencart`)
- API Token
- Test Product ID (e.g., `1`)
- Test Product SKU (optional)

### 2. Test Laravel Instance

You need a working Laravel application with the PricePilot package installed.

**Setup Steps:**
1. Install Laravel (version 8.x or higher)
2. Install the PricePilot Laravel package from `integrations/laravel/`
3. Configure the package and generate an API token
4. Create at least one test product with a known product ID

**Required Information:**
- Base URL (e.g., `http://localhost/laravel`)
- API Token
- Test Product ID (e.g., `1`)
- Test Product SKU (optional)

## Testing Methods

### Method 1: Automated Testing Script

We provide an automated testing script that runs comprehensive tests against your test instances.

#### Configuration

Set environment variables:

```bash
# OpenCart Configuration
export TEST_OPENCART_URL="http://your-opencart-instance.com"
export TEST_OPENCART_TOKEN="your-opencart-api-token"
export TEST_OPENCART_PRODUCT_ID="1"

# Laravel Configuration
export TEST_LARAVEL_URL="http://your-laravel-instance.com"
export TEST_LARAVEL_TOKEN="your-laravel-api-token"
export TEST_LARAVEL_PRODUCT_ID="1"
```

#### Run Tests

```bash
npx tsx scripts/test-price-update-apis.ts
```

#### Test Coverage

The automated script tests:

1. **Successful Price Update**
   - Creates a test product
   - Updates the price via API
   - Verifies the update succeeded
   - Checks that price update logs were created

2. **Invalid API Token**
   - Tests with an invalid token
   - Verifies authentication error is returned
   - Checks that error is logged correctly

3. **Product Not Found**
   - Tests with a non-existent product ID
   - Verifies appropriate error is returned
   - Checks error logging

4. **Network Error**
   - Tests with an unreachable URL
   - Verifies network error handling
   - Checks error logging

5. **Price Update Logs**
   - Verifies all log fields are populated correctly
   - Checks timestamps, prices, and status

### Method 2: Manual Testing with cURL

You can manually test the APIs using cURL commands.

#### OpenCart Price Update

```bash
# Successful update
curl -X POST "http://your-opencart-instance.com/index.php?route=api/pricepilot/update&api_token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "1",
    "price": "99.99",
    "sku": "TEST-SKU-001"
  }'

# Expected response:
# {
#   "success": true,
#   "message": "Price updated successfully",
#   "product_id": "1",
#   "old_price": "89.99",
#   "new_price": "99.99",
#   "updated_price": 99.99,
#   "sku": "TEST-SKU-001",
#   "timestamp": "2026-02-02 10:30:00"
# }
```

#### Laravel Price Update

```bash
# Successful update
curl -X POST "http://your-laravel-instance.com/api/pricepilot/update" \
  -H "Content-Type: application/json" \
  -H "X-PricePilot-Token: YOUR_TOKEN" \
  -d '{
    "product_id": "1",
    "price": "149.99",
    "sku": "TEST-SKU-002"
  }'

# Expected response:
# {
#   "success": true,
#   "message": "Price updated successfully",
#   "product_id": "1",
#   "old_price": "139.99",
#   "new_price": "149.99",
#   "updated_price": 149.99,
#   "sku": "TEST-SKU-002",
#   "timestamp": "2026-02-02 10:30:00"
# }
```

#### Test Invalid Token

```bash
# OpenCart
curl -X POST "http://your-opencart-instance.com/index.php?route=api/pricepilot/update&api_token=INVALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"product_id": "1", "price": "99.99"}'

# Expected response:
# {
#   "success": false,
#   "error": {
#     "code": "AUTHENTICATION_ERROR",
#     "message": "Invalid API token"
#   }
# }
```

#### Test Product Not Found

```bash
# OpenCart
curl -X POST "http://your-opencart-instance.com/index.php?route=api/pricepilot/update&api_token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"product_id": "999999", "price": "99.99"}'

# Expected response:
# {
#   "success": false,
#   "error": {
#     "code": "NOT_FOUND",
#     "message": "Product not found"
#   }
# }
```

### Method 3: Testing via PricePilot Dashboard

You can test the price update functionality through the PricePilot web interface.

#### Steps:

1. **Set up a test site**
   - Go to Dashboard → Integrations
   - Add your test OpenCart or Laravel site
   - Enter the API token

2. **Sync products**
   - Click "Sync Products" on your test site
   - Verify products are imported correctly

3. **Update a price**
   - Go to Dashboard → Products
   - Select a product
   - Change the price
   - Click "Update Price"

4. **Verify the update**
   - Check the product in your OpenCart/Laravel admin panel
   - Verify the price was updated correctly
   - Check Dashboard → Activity for the price update log

5. **Check error handling**
   - Try updating with an invalid API token
   - Try updating a non-existent product
   - Verify errors are displayed correctly

## Verification Checklist

After running tests, verify the following:

### ✓ Successful Price Updates

- [ ] Price is updated in the external store (OpenCart/Laravel)
- [ ] Updated price matches the requested price (within 0.01 tolerance)
- [ ] Price update log is created in database
- [ ] Log status is "SUCCESS"
- [ ] Old price and new price are recorded correctly
- [ ] Execution timestamp is recorded
- [ ] SKU verification works (if provided)

### ✓ Error Handling

- [ ] Invalid API token returns 401/403 error
- [ ] Product not found returns 404 error
- [ ] Network errors are handled gracefully
- [ ] All errors are logged in price update logs
- [ ] Log status is "FAILED" for errors
- [ ] Error details are recorded in logs

### ✓ Price Update Logs

- [ ] Logs are created for both successful and failed updates
- [ ] All required fields are populated:
  - productId
  - oldPrice
  - newPrice
  - logicType
  - status
  - executedAt
  - errorDetails (for failures)

### ✓ API Response Format

- [ ] Success responses include:
  - success: true
  - product_id
  - old_price
  - new_price
  - updated_price (verification)
  - sku (if provided)
  - timestamp

- [ ] Error responses include:
  - success: false
  - error.code
  - error.message

## Common Issues and Solutions

### Issue: "Invalid API token"

**Cause**: The API token is incorrect or expired.

**Solution**:
1. Verify the token in your OpenCart/Laravel admin panel
2. Regenerate the token if necessary
3. Update the token in PricePilot settings

### Issue: "Product not found"

**Cause**: The product ID doesn't exist in the external store.

**Solution**:
1. Verify the product exists in OpenCart/Laravel
2. Check that the product ID is correct
3. Ensure the product is not deleted or disabled

### Issue: "Connection timeout"

**Cause**: The external store is unreachable or slow to respond.

**Solution**:
1. Verify the store URL is correct
2. Check that the store is online and accessible
3. Check firewall settings
4. Increase timeout settings if necessary

### Issue: "Price mismatch after update"

**Cause**: The price in the store doesn't match the requested price.

**Solution**:
1. Check for price rounding in the store
2. Verify currency settings
3. Check for tax calculations affecting the price
4. Review store-specific price formatting rules

### Issue: "SKU mismatch"

**Cause**: The SKU in PricePilot doesn't match the SKU in the store.

**Solution**:
1. Verify the SKU is correct in both systems
2. Re-sync products to update SKUs
3. Manually correct the SKU if necessary

## Test Results Documentation

After completing tests, document your results:

### OpenCart Test Results

| Test Case | Status | Notes |
|-----------|--------|-------|
| Successful Update | ✓ Pass | Price updated from $89.99 to $99.99 |
| Invalid Token | ✓ Pass | Returned 401 error as expected |
| Product Not Found | ✓ Pass | Returned 404 error as expected |
| Network Error | ✓ Pass | Handled gracefully with retry |
| Update Logs | ✓ Pass | All fields populated correctly |

### Laravel Test Results

| Test Case | Status | Notes |
|-----------|--------|-------|
| Successful Update | ✓ Pass | Price updated from $139.99 to $149.99 |
| Invalid Token | ✓ Pass | Returned 401 error as expected |
| Product Not Found | ✓ Pass | Returned 404 error as expected |
| Network Error | ✓ Pass | Handled gracefully with retry |
| Update Logs | ✓ Pass | All fields populated correctly |

## Next Steps

After successful testing:

1. **Document any issues found** in the issue tracker
2. **Update the implementation** if bugs are discovered
3. **Mark task 3.4 as complete** in the tasks.md file
4. **Proceed to task 4.1** (API Token Encryption)

## Additional Resources

- [OpenCart API Documentation](../integrations/opencart/README.md)
- [Laravel Package Documentation](../integrations/laravel/README.md)
- [Price Update API Design](./PRICE_UPDATE_API_DESIGN.md)
- [Error Handling Guide](./ERROR_HANDLING_GUIDE.md)

## Support

If you encounter issues during testing:

1. Check the logs in `storage/logs/` (Laravel) or OpenCart error logs
2. Review the PricePilot application logs
3. Check the database for price update logs
4. Consult the troubleshooting section above
5. Contact the development team for assistance
