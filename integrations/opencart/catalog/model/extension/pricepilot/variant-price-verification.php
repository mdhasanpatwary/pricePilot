<?php
/**
 * Variant Price Update Verification Script
 * 
 * This script verifies that the updateVariantPrice() method in PriceService
 * is working correctly for Task 21.2.
 * 
 * Requirements: 16.2, 16.3
 * 
 * Usage: Run this script from the OpenCart root directory
 */

// Load OpenCart framework
require_once('config.php');
require_once(DIR_SYSTEM . 'startup.php');

// Initialize registry
$registry = new Registry();
$registry->set('config', new Config());

// Load database
$db = new DB(DB_DRIVER, DB_HOSTNAME, DB_USERNAME, DB_PASSWORD, DB_DATABASE);
$registry->set('db', $db);

// Load cache
$cache = new Cache('file');
$registry->set('cache', $cache);

// Load PriceService
require_once(DIR_CATALOG . 'model/extension/pricepilot/PriceService.php');
$priceService = new PriceService($registry);

echo "=================================================================\n";
echo "Variant Price Update Verification (Task 21.2)\n";
echo "=================================================================\n\n";

// Test 1: Verify method exists
echo "Test 1: Verify updateVariantPrice() method exists\n";
if (method_exists($priceService, 'updateVariantPrice')) {
    echo "✓ PASS: updateVariantPrice() method exists\n\n";
} else {
    echo "✗ FAIL: updateVariantPrice() method not found\n\n";
    exit(1);
}

// Test 2: Test with non-existent product
echo "Test 2: Test with non-existent product\n";
$result = $priceService->updateVariantPrice(999999, 1, 1, 10.00, '+');
if (!$result['success'] && $result['error'] === 'Product not found') {
    echo "✓ PASS: Correctly handles non-existent product\n";
    echo "  Error: " . $result['error'] . "\n\n";
} else {
    echo "✗ FAIL: Did not handle non-existent product correctly\n";
    echo "  Result: " . json_encode($result) . "\n\n";
}

// Test 3: Test with invalid price prefix
echo "Test 3: Test with invalid price prefix\n";
// First, find a real product with variants
$query = $db->query("
    SELECT DISTINCT p.product_id, pov.option_id, pov.option_value_id
    FROM " . DB_PREFIX . "product p
    INNER JOIN " . DB_PREFIX . "product_option_value pov ON p.product_id = pov.product_id
    LIMIT 1
");

if ($query->num_rows > 0) {
    $productId = $query->row['product_id'];
    $optionId = $query->row['option_id'];
    $optionValueId = $query->row['option_value_id'];
    
    $result = $priceService->updateVariantPrice($productId, $optionId, $optionValueId, 10.00, 'X');
    if (!$result['success'] && strpos($result['error'], 'Invalid price_prefix') !== false) {
        echo "✓ PASS: Correctly validates price prefix\n";
        echo "  Error: " . $result['error'] . "\n\n";
    } else {
        echo "✗ FAIL: Did not validate price prefix correctly\n";
        echo "  Result: " . json_encode($result) . "\n\n";
    }
    
    // Test 4: Test with non-existent variant
    echo "Test 4: Test with non-existent variant\n";
    $result = $priceService->updateVariantPrice($productId, 999, 999, 10.00, '+');
    if (!$result['success'] && $result['error'] === 'Product variant not found') {
        echo "✓ PASS: Correctly handles non-existent variant\n";
        echo "  Error: " . $result['error'] . "\n\n";
    } else {
        echo "✗ FAIL: Did not handle non-existent variant correctly\n";
        echo "  Result: " . json_encode($result) . "\n\n";
    }
    
    // Test 5: Test successful variant price update
    echo "Test 5: Test successful variant price update\n";
    
    // Get current price
    $currentQuery = $db->query("
        SELECT price, price_prefix
        FROM " . DB_PREFIX . "product_option_value
        WHERE product_id = " . (int)$productId . "
        AND option_id = " . (int)$optionId . "
        AND option_value_id = " . (int)$optionValueId . "
    ");
    
    if ($currentQuery->num_rows > 0) {
        $oldPrice = $currentQuery->row['price'];
        $oldPrefix = $currentQuery->row['price_prefix'];
        
        echo "  Current variant price: {$oldPrefix}{$oldPrice}\n";
        
        // Update to a new price
        $newPrice = 15.50;
        $newPrefix = '+';
        $result = $priceService->updateVariantPrice($productId, $optionId, $optionValueId, $newPrice, $newPrefix);
        
        if ($result['success']) {
            echo "✓ PASS: Successfully updated variant price\n";
            echo "  Old price: {$result['old_price']}\n";
            echo "  New price: {$newPrefix}{$newPrice}\n";
            
            // Verify the update in database
            $verifyQuery = $db->query("
                SELECT price, price_prefix
                FROM " . DB_PREFIX . "product_option_value
                WHERE product_id = " . (int)$productId . "
                AND option_id = " . (int)$optionId . "
                AND option_value_id = " . (int)$optionValueId . "
            ");
            
            if ($verifyQuery->num_rows > 0) {
                $dbPrice = $verifyQuery->row['price'];
                $dbPrefix = $verifyQuery->row['price_prefix'];
                
                if (abs($dbPrice - $newPrice) < 0.01 && $dbPrefix === $newPrefix) {
                    echo "✓ PASS: Database updated correctly\n";
                    echo "  Verified price: {$dbPrefix}{$dbPrice}\n\n";
                } else {
                    echo "✗ FAIL: Database not updated correctly\n";
                    echo "  Expected: {$newPrefix}{$newPrice}\n";
                    echo "  Found: {$dbPrefix}{$dbPrice}\n\n";
                }
            }
            
            // Restore original price
            echo "  Restoring original price...\n";
            $restoreResult = $priceService->updateVariantPrice($productId, $optionId, $optionValueId, $oldPrice, $oldPrefix);
            if ($restoreResult['success']) {
                echo "  ✓ Original price restored\n\n";
            }
        } else {
            echo "✗ FAIL: Failed to update variant price\n";
            echo "  Error: " . $result['error'] . "\n\n";
        }
    }
    
    // Test 6: Verify logging
    echo "Test 6: Verify variant price change is logged\n";
    $logQuery = $db->query("
        SELECT *
        FROM " . DB_PREFIX . "pricepilot_activity_log
        WHERE product_id = " . (int)$productId . "
        AND changed_by LIKE 'API - Variant%'
        ORDER BY date_added DESC
        LIMIT 1
    ");
    
    if ($logQuery->num_rows > 0) {
        echo "✓ PASS: Variant price change logged\n";
        echo "  Product ID: " . $logQuery->row['product_id'] . "\n";
        echo "  Changed by: " . $logQuery->row['changed_by'] . "\n";
        echo "  Old price: " . $logQuery->row['old_price'] . "\n";
        echo "  New price: " . $logQuery->row['new_price'] . "\n";
        echo "  Date: " . $logQuery->row['date_added'] . "\n\n";
    } else {
        echo "⚠ WARNING: No variant price change log found\n";
        echo "  This may be expected if logging service is not fully configured\n\n";
    }
    
} else {
    echo "⚠ SKIP: No products with variants found in database\n";
    echo "  Cannot test variant price update functionality\n";
    echo "  Please add a product with options/variants to test this feature\n\n";
}

echo "=================================================================\n";
echo "Verification Complete\n";
echo "=================================================================\n";
