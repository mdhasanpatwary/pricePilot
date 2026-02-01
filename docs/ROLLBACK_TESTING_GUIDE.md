# Rollback Testing Guide

## Overview

This guide provides comprehensive instructions for testing the rollback mechanism with real OpenCart and Laravel store instances. Testing with real stores ensures that the rollback functionality works correctly in production environments.

## Prerequisites

### Required Setup

1. **Test OpenCart Instance**
   - OpenCart 3.x or 4.x installation
   - PricePilot OpenCart extension installed
   - API token configured
   - At least 5 test products

2. **Test Laravel Instance**
   - Laravel 9.x or 10.x installation
   - PricePilot Laravel package installed
   - API token configured
   - At least 5 test products

3. **PricePilot Application**
   - Development or staging environment
   - Database access
   - Admin access
   - API access

### Test Data Requirements

- **Test Products**: Create products with known prices
- **Product SKUs**: Ensure products have unique SKUs
- **Price Range**: Use varied prices ($10 - $1000)
- **Product Categories**: Mix of different product types

## Test Environment Setup

### 1. OpenCart Test Environment

```bash
# Install OpenCart (if not already installed)
# Download from https://www.opencart.com/

# Install PricePilot extension
# Upload integrations/opencart/pricepilot.ocmod.zip
# Install via Extensions > Installer

# Configure API token
# Navigate to System > Users > API
# Create new API user "pricepilot"
# Copy API token

# Add test products
# Navigate to Catalog > Products
# Add 5-10 test products with prices
```

### 2. Laravel Test Environment

```bash
# Install Laravel (if not already installed)
composer create-project laravel/laravel test-store

# Install PricePilot package
cd test-store
composer require pricepilot/laravel

# Publish configuration
php artisan vendor:publish --provider="PricePilot\Laravel\PricePilotServiceProvider"

# Configure API token in .env
PRICEPILOT_API_TOKEN=your-token-here

# Run migrations
php artisan migrate

# Seed test products
php artisan db:seed --class=ProductSeeder
```

### 3. PricePilot Configuration

```bash
# Add test stores to PricePilot
# Navigate to Dashboard > Integrations

# Add OpenCart store
# - Platform: OpenCart
# - Base URL: http://localhost/opencart
# - API Token: [from OpenCart setup]

# Add Laravel store
# - Platform: Laravel
# - Base URL: http://localhost:8000
# - API Token: [from .env]

# Sync products
# Click "Sync Now" for each store
# Verify products appear in Products page
```

## Test Scenarios

### Scenario 1: Single Price Change Rollback (OpenCart)

**Objective**: Verify single price change can be rolled back successfully in OpenCart

**Steps**:

1. **Initial State**
   ```bash
   # Record initial product price
   Product: Samsung Galaxy S21
   Initial Price: $799.99
   SKU: SAMSUNG-S21
   ```

2. **Perform Price Update**
   - Navigate to Dashboard > Products
   - Find "Samsung Galaxy S21"
   - Update price to $749.99
   - Click "Update Price"
   - Wait for success notification

3. **Verify Update in OpenCart**
   - Log into OpenCart admin
   - Navigate to Catalog > Products
   - Find "Samsung Galaxy S21"
   - Verify price is $749.99

4. **Perform Rollback**
   - Navigate to Dashboard > Activity > Rollback History
   - Find the price update for Samsung Galaxy S21
   - Click "Rollback" button
   - Review rollback details in dialog
   - Click "Confirm Rollback"
   - Wait for success notification

5. **Verify Rollback in OpenCart**
   - Refresh OpenCart admin
   - Navigate to Catalog > Products
   - Find "Samsung Galaxy S21"
   - Verify price is back to $799.99

6. **Verify Rollback in PricePilot**
   - Navigate to Dashboard > Products
   - Find "Samsung Galaxy S21"
   - Verify current price is $799.99
   - Navigate to Dashboard > Activity > Rollback History
   - Verify rollback entry exists

**Expected Results**:
- ✅ Price updates successfully in OpenCart
- ✅ Rollback completes without errors
- ✅ Price reverts to original value in OpenCart
- ✅ Price reverts to original value in PricePilot
- ✅ Rollback history entry is created
- ✅ Audit log entry is created

### Scenario 2: Single Price Change Rollback (Laravel)

**Objective**: Verify single price change can be rolled back successfully in Laravel

**Steps**: Same as Scenario 1, but using Laravel store

**Expected Results**: Same as Scenario 1

### Scenario 3: Bulk Operation Rollback (OpenCart)

**Objective**: Verify bulk price changes can be rolled back successfully

**Steps**:

1. **Initial State**
   ```bash
   # Record initial prices for 5 products
   Product 1: $99.99
   Product 2: $149.99
   Product 3: $199.99
   Product 4: $249.99
   Product 5: $299.99
   ```

2. **Perform Bulk Update**
   - Navigate to Dashboard > Products
   - Select 5 products
   - Click "Bulk Update"
   - Choose "Undercut by $50"
   - Click "Apply"
   - Wait for success notification

3. **Verify Updates in OpenCart**
   - Log into OpenCart admin
   - Verify all 5 products have reduced prices:
     - Product 1: $49.99
     - Product 2: $99.99
     - Product 3: $149.99
     - Product 4: $199.99
     - Product 5: $249.99

4. **Perform Bulk Rollback**
   - Navigate to Dashboard > Activity > Rollback History
   - Find the bulk operation entry
   - Click "Rollback" button
   - Review rollback details (5 products)
   - Click "Confirm Rollback"
   - Wait for success notification

5. **Verify Rollback in OpenCart**
   - Refresh OpenCart admin
   - Verify all 5 products have original prices

6. **Verify Rollback in PricePilot**
   - Navigate to Dashboard > Products
   - Verify all 5 products have original prices
   - Navigate to Dashboard > Activity > Rollback History
   - Verify bulk rollback entry exists

**Expected Results**:
- ✅ Bulk update succeeds for all products
- ✅ All prices update correctly in OpenCart
- ✅ Bulk rollback completes without errors
- ✅ All prices revert to original values
- ✅ Rollback history entry shows correct product count
- ✅ Audit log entry is created

### Scenario 4: Rollback Eligibility - Subsequent Changes

**Objective**: Verify rollback is prevented when subsequent changes exist

**Steps**:

1. **Perform First Price Update**
   - Update product price from $99.99 to $89.99
   - Wait for success

2. **Perform Second Price Update**
   - Update same product price from $89.99 to $79.99
   - Wait for success

3. **Attempt to Rollback First Update**
   - Navigate to price update history
   - Find first update ($99.99 → $89.99)
   - Click "Rollback" button
   - Observe error message

**Expected Results**:
- ✅ First update succeeds
- ✅ Second update succeeds
- ✅ Rollback is prevented
- ✅ Error message: "Cannot rollback: subsequent changes exist"
- ✅ No changes made to product price

### Scenario 5: Rollback Eligibility - Already Rolled Back

**Objective**: Verify rollback is prevented for already rolled back operations

**Steps**:

1. **Perform Price Update**
   - Update product price from $99.99 to $89.99
   - Wait for success

2. **Perform First Rollback**
   - Rollback the price change
   - Wait for success
   - Verify price is back to $99.99

3. **Attempt Second Rollback**
   - Try to rollback the same operation again
   - Observe error message

**Expected Results**:
- ✅ Price update succeeds
- ✅ First rollback succeeds
- ✅ Second rollback is prevented
- ✅ Error message: "This operation has already been rolled back"
- ✅ No changes made to product price

### Scenario 6: Rollback with Sync Failure

**Objective**: Verify graceful handling when store sync fails

**Steps**:

1. **Perform Price Update**
   - Update product price from $99.99 to $89.99
   - Wait for success

2. **Simulate Sync Failure**
   - Temporarily disable store API (change API token)
   - Or stop store server

3. **Perform Rollback**
   - Rollback the price change
   - Observe behavior

4. **Verify Database Rollback**
   - Check PricePilot database
   - Verify price is rolled back to $99.99

5. **Verify Notification**
   - Check for sync failure notification
   - Verify message indicates manual sync needed

6. **Restore Store Connection**
   - Re-enable store API
   - Manually sync product

7. **Verify Final State**
   - Check store price matches database

**Expected Results**:
- ✅ Database rollback succeeds
- ✅ Sync failure is logged
- ✅ User receives notification about sync failure
- ✅ Manual sync resolves the issue
- ✅ Final state is consistent

### Scenario 7: Concurrent Rollback Attempts

**Objective**: Verify system handles concurrent rollback attempts correctly

**Steps**:

1. **Perform Price Update**
   - Update product price from $99.99 to $89.99
   - Wait for success

2. **Attempt Concurrent Rollbacks**
   - Open two browser tabs
   - In both tabs, navigate to rollback page
   - Click rollback button in both tabs simultaneously
   - Observe behavior

**Expected Results**:
- ✅ Only one rollback succeeds
- ✅ Second attempt receives error
- ✅ Error message: "This operation has already been rolled back"
- ✅ Database remains consistent
- ✅ No duplicate rollback entries

## Performance Testing

### Load Test: Multiple Rollbacks

**Objective**: Verify system handles multiple rollback operations efficiently

**Steps**:

1. **Setup**
   - Perform 50 price updates
   - Record update log IDs

2. **Execute Rollbacks**
   - Rollback all 50 updates sequentially
   - Measure time for each rollback
   - Monitor system resources

3. **Verify Results**
   - Check all rollbacks succeeded
   - Verify all prices reverted correctly
   - Check database consistency

**Expected Results**:
- ✅ All rollbacks complete successfully
- ✅ Average rollback time < 2 seconds
- ✅ No database deadlocks
- ✅ No memory leaks
- ✅ All audit logs created

### Stress Test: Bulk Rollback with Large Dataset

**Objective**: Verify bulk rollback handles large datasets

**Steps**:

1. **Setup**
   - Perform bulk update on 1000 products
   - Wait for completion

2. **Execute Bulk Rollback**
   - Rollback the bulk operation
   - Monitor progress
   - Measure completion time

3. **Verify Results**
   - Check all products reverted
   - Verify database consistency
   - Check system stability

**Expected Results**:
- ✅ Bulk rollback completes successfully
- ✅ Completion time < 30 seconds
- ✅ All products reverted correctly
- ✅ No timeout errors
- ✅ System remains stable

## Error Handling Testing

### Test Case: Invalid Update Log ID

```bash
# Test with non-existent ID
curl -X POST http://localhost:3000/api/v1/price-update/rollback \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"updateLogId": "00000000-0000-0000-0000-000000000000"}'

# Expected: 404 Not Found
# Error: "Price update log not found"
```

### Test Case: Invalid Snapshot ID

```bash
# Test with non-existent ID
curl -X POST http://localhost:3000/api/v1/price-update/rollback \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"snapshotId": "00000000-0000-0000-0000-000000000000"}'

# Expected: 404 Not Found
# Error: "Bulk operation snapshot not found"
```

### Test Case: Missing Authentication

```bash
# Test without auth token
curl -X POST http://localhost:3000/api/v1/price-update/rollback \
  -H "Content-Type: application/json" \
  -d '{"updateLogId": "valid-id"}'

# Expected: 401 Unauthorized
# Error: "Authentication required"
```

### Test Case: Invalid Request Body

```bash
# Test with neither updateLogId nor snapshotId
curl -X POST http://localhost:3000/api/v1/price-update/rollback \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: 422 Unprocessable Entity
# Error: "Either updateLogId or snapshotId must be provided"
```

## Test Results Documentation

### Test Report Template

```markdown
# Rollback Testing Report

**Date**: [Date]
**Tester**: [Name]
**Environment**: [Development/Staging/Production]

## Test Summary

- Total Scenarios: 7
- Passed: X
- Failed: X
- Blocked: X

## Scenario Results

### Scenario 1: Single Price Change Rollback (OpenCart)
- Status: ✅ PASS / ❌ FAIL
- Duration: X seconds
- Notes: [Any observations]

### Scenario 2: Single Price Change Rollback (Laravel)
- Status: ✅ PASS / ❌ FAIL
- Duration: X seconds
- Notes: [Any observations]

[Continue for all scenarios...]

## Issues Found

### Issue 1: [Title]
- Severity: Critical/High/Medium/Low
- Description: [Details]
- Steps to Reproduce: [Steps]
- Expected: [Expected behavior]
- Actual: [Actual behavior]
- Screenshots: [If applicable]

## Performance Metrics

- Average rollback time: X seconds
- Bulk rollback time (1000 products): X seconds
- Database query time: X ms
- API response time: X ms

## Recommendations

1. [Recommendation 1]
2. [Recommendation 2]
3. [Recommendation 3]

## Sign-off

- [ ] All critical scenarios passed
- [ ] Performance meets requirements
- [ ] No blocking issues found
- [ ] Documentation updated

**Approved by**: [Name]
**Date**: [Date]
```

## Troubleshooting

### Issue: Rollback succeeds but store price doesn't update

**Possible Causes**:
- Store API token invalid
- Store API endpoint unreachable
- Network connectivity issues

**Solution**:
1. Verify API token is correct
2. Test API endpoint manually
3. Check network connectivity
4. Review sync error logs
5. Manually sync product

### Issue: Rollback fails with "subsequent changes exist"

**Possible Causes**:
- Another price update was made after the one being rolled back
- Concurrent price updates

**Solution**:
- This is expected behavior
- Rollback the most recent change first
- Or manually update the price

### Issue: Bulk rollback times out

**Possible Causes**:
- Too many products in bulk operation
- Database performance issues
- Network latency

**Solution**:
1. Increase timeout settings
2. Optimize database queries
3. Consider breaking into smaller batches
4. Check database indexes

## Continuous Testing

### Automated Test Suite

Create automated tests for rollback functionality:

```typescript
// __tests__/integration/rollback-e2e.test.ts

describe("Rollback E2E Tests", () => {
  it("should rollback single price change in OpenCart", async () => {
    // Test implementation
  });

  it("should rollback bulk operation in Laravel", async () => {
    // Test implementation
  });

  it("should prevent rollback with subsequent changes", async () => {
    // Test implementation
  });
});
```

### CI/CD Integration

Add rollback tests to CI/CD pipeline:

```yaml
# .github/workflows/test.yml

name: Rollback Tests

on: [push, pull_request]

jobs:
  rollback-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup test environment
        run: ./scripts/setup-test-stores.sh
      - name: Run rollback tests
        run: npm run test:rollback
      - name: Generate test report
        run: npm run test:report
```

## Conclusion

Thorough testing with real stores ensures the rollback mechanism works correctly in production environments. Follow this guide to validate all rollback scenarios and document results for future reference.

## Related Documentation

- [Rollback Procedures](./ROLLBACK_PROCEDURES.md)
- [Rollback Implementation Summary](./ROLLBACK_IMPLEMENTATION_SUMMARY.md)
- [Rollback UI Guide](./ROLLBACK_UI_GUIDE.md)
- [Testing Guide](../TESTING.md)
