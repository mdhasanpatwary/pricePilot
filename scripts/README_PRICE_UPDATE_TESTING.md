# Price Update API Testing Script

## Quick Start

This script provides automated testing for OpenCart and Laravel price update APIs.

### Prerequisites

1. **Test OpenCart Instance**
   - OpenCart 3.x or 4.x installed
   - PricePilot extension installed
   - API token generated
   - At least one test product

2. **Test Laravel Instance**
   - Laravel 8.x or higher installed
   - PricePilot package installed
   - API token generated
   - At least one test product

### Configuration

Set environment variables:

```bash
# OpenCart
export TEST_OPENCART_URL="http://your-opencart-instance.com"
export TEST_OPENCART_TOKEN="your-api-token"
export TEST_OPENCART_PRODUCT_ID="1"

# Laravel
export TEST_LARAVEL_URL="http://your-laravel-instance.com"
export TEST_LARAVEL_TOKEN="your-api-token"
export TEST_LARAVEL_PRODUCT_ID="1"
```

### Run Tests

```bash
npx tsx scripts/test-price-update-apis.ts
```

### What Gets Tested

1. ✓ Successful price updates
2. ✓ Invalid API token handling
3. ✓ Product not found errors
4. ✓ Network error handling
5. ✓ Price update log creation

### Expected Output

```
============================================================
Price Update API Testing Suite
============================================================

Testing OpenCart API
------------------------------------------------------------

▶ Test 1: Successful Price Update
  ✓ Price updated successfully! Updated 1 product(s)
  ✓ Price update log created with SUCCESS status

▶ Test 2: Invalid API Token
  ✓ Correctly rejected invalid API token
  ✓ Price update log created with FAILED status

...

============================================================
Test Results Summary
============================================================
  ✓ OpenCart - Successful Update
  ✓ OpenCart - Invalid Token
  ✓ OpenCart - Product Not Found
  ✓ OpenCart - Network Error
  ✓ OpenCart - Update Logs
  ✓ Laravel - Successful Update
  ✓ Laravel - Invalid Token
  ✓ Laravel - Product Not Found
  ✓ Laravel - Network Error
  ✓ Laravel - Update Logs
============================================================
Total: 10 | Passed: 10 | Failed: 0
============================================================

All tests passed! ✓
```

### Troubleshooting

**"Please configure test instances"**
- Set the environment variables listed above
- Or edit the script directly to hardcode your test configuration

**"Invalid API token"**
- Verify your API token is correct
- Check that the token hasn't expired
- Ensure the PricePilot extension/package is properly installed

**"Product not found"**
- Verify the product ID exists in your test store
- Check that the product is not deleted or disabled

**"Connection timeout"**
- Verify your test store is online and accessible
- Check firewall settings
- Ensure the URL is correct

### Manual Testing Alternative

If you prefer manual testing, see the comprehensive guide:
- [Price Update API Testing Guide](../docs/PRICE_UPDATE_API_TESTING_GUIDE.md)

### Related Documentation

- [OpenCart Integration](../integrations/opencart/README.md)
- [Laravel Integration](../integrations/laravel/README.md)
- [Error Handling Guide](../docs/ERROR_HANDLING_GUIDE.md)
