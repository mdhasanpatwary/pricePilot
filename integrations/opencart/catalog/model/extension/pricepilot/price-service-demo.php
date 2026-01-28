<?php
/**
 * PriceService Demonstration Script
 * 
 * This script demonstrates the usage of the PriceService class
 * for various price management operations.
 * 
 * NOTE: This is a demonstration file and should not be used in production.
 * It shows how to use the PriceService methods in the OpenCart context.
 */

// This would normally be loaded through OpenCart's model loading system
// require_once 'PriceService.php';

/**
 * Example 1: Update Single Product Price
 */
function example_updateSinglePrice($priceService) {
    echo "=== Example 1: Update Single Product Price ===\n";
    
    $productId = 123;
    $newPrice = 99.99;
    
    $result = $priceService->updatePrice($productId, $newPrice);
    
    if ($result['success']) {
        echo "✓ Price updated successfully!\n";
        echo "  Product ID: {$productId}\n";
        echo "  Old Price: \${$result['old_price']}\n";
        echo "  New Price: \${$newPrice}\n";
    } else {
        echo "✗ Failed to update price: {$result['error']}\n";
    }
    
    echo "\n";
}

/**
 * Example 2: Bulk Price Update
 */
function example_bulkPriceUpdate($priceService) {
    echo "=== Example 2: Bulk Price Update ===\n";
    
    $updates = [
        ['product_id' => 123, 'price' => 99.99],
        ['product_id' => 124, 'price' => 149.99],
        ['product_id' => 125, 'price' => 199.99],
        ['product_id' => 999, 'price' => 299.99], // Non-existent product
    ];
    
    $result = $priceService->bulkUpdatePrices($updates);
    
    echo "Bulk Update Results:\n";
    echo "  Successful: {$result['success_count']}\n";
    echo "  Failed: {$result['failure_count']}\n";
    
    if (!empty($result['failures'])) {
        echo "\nFailures:\n";
        foreach ($result['failures'] as $failure) {
            echo "  - Product {$failure['product_id']}: {$failure['error']}\n";
        }
    }
    
    echo "\n";
}

/**
 * Example 3: Update Stock Quantity
 */
function example_updateStock($priceService) {
    echo "=== Example 3: Update Stock Quantity ===\n";
    
    // Update stock to 50 units
    $result1 = $priceService->updateStock(123, 50);
    
    if ($result1['success']) {
        echo "✓ Stock updated to 50 units (in stock)\n";
    } else {
        echo "✗ Failed: {$result1['error']}\n";
    }
    
    // Update stock to 0 (out of stock)
    $result2 = $priceService->updateStock(123, 0);
    
    if ($result2['success']) {
        echo "✓ Stock updated to 0 units (out of stock)\n";
    } else {
        echo "✗ Failed: {$result2['error']}\n";
    }
    
    echo "\n";
}

/**
 * Example 4: Set Special Price with Date Range
 */
function example_specialPrice($priceService) {
    echo "=== Example 4: Set Special Price ===\n";
    
    $productId = 123;
    $specialPrice = 79.99;
    $dateStart = '2024-01-01';
    $dateEnd = '2024-12-31';
    
    $result = $priceService->updateSpecialPrice(
        $productId,
        $specialPrice,
        $dateStart,
        $dateEnd
    );
    
    if ($result['success']) {
        echo "✓ Special price set successfully!\n";
        echo "  Product ID: {$productId}\n";
        echo "  Special Price: \${$specialPrice}\n";
        echo "  Valid From: {$dateStart}\n";
        echo "  Valid Until: {$dateEnd}\n";
    } else {
        echo "✗ Failed: {$result['error']}\n";
    }
    
    echo "\n";
}

/**
 * Example 5: Create and Restore Price Backup
 */
function example_priceBackup($priceService) {
    echo "=== Example 5: Price Backup and Restore ===\n";
    
    $productIds = [123, 124, 125];
    
    // Create backup
    echo "Creating backup...\n";
    $backupId = $priceService->createPriceBackup($productIds);
    
    if ($backupId) {
        echo "✓ Backup created successfully!\n";
        echo "  Backup ID: {$backupId}\n";
        echo "  Products: " . count($productIds) . "\n";
        
        // Simulate some price changes
        echo "\nSimulating price changes...\n";
        $priceService->updatePrice(123, 199.99);
        $priceService->updatePrice(124, 249.99);
        
        // Restore from backup
        echo "\nRestoring from backup...\n";
        $result = $priceService->restorePriceBackup($backupId);
        
        if ($result['success']) {
            echo "✓ Prices restored successfully!\n";
            echo "  Restored: {$result['restored_count']} products\n";
        } else {
            echo "✗ Failed to restore: {$result['error']}\n";
        }
    } else {
        echo "✗ Failed to create backup\n";
    }
    
    echo "\n";
}

/**
 * Example 6: Multi-Store Price Update
 */
function example_multiStore($priceService) {
    echo "=== Example 6: Multi-Store Price Update ===\n";
    
    $productId = 123;
    $newPrice = 99.99;
    
    // Update price for store 0 (default)
    $result1 = $priceService->updatePrice($productId, $newPrice, 0);
    echo "Store 0: " . ($result1['success'] ? "✓ Updated" : "✗ Failed") . "\n";
    
    // Update price for store 1
    $result2 = $priceService->updatePrice($productId, 109.99, 1);
    echo "Store 1: " . ($result2['success'] ? "✓ Updated" : "✗ Failed") . "\n";
    
    echo "\n";
}

/**
 * Example 7: Error Handling
 */
function example_errorHandling($priceService) {
    echo "=== Example 7: Error Handling ===\n";
    
    // Try to update non-existent product
    $result1 = $priceService->updatePrice(999999, 99.99);
    echo "Non-existent product: ";
    echo $result1['success'] ? "✓ Success" : "✗ {$result1['error']}\n";
    
    // Try to set special price with invalid date
    $result2 = $priceService->updateSpecialPrice(123, 79.99, 'invalid-date', '2024-12-31');
    echo "Invalid date format: ";
    echo $result2['success'] ? "✓ Success" : "✗ {$result2['error']}\n";
    
    // Try to set special price with end before start
    $result3 = $priceService->updateSpecialPrice(123, 79.99, '2024-12-31', '2024-01-01');
    echo "End before start: ";
    echo $result3['success'] ? "✓ Success" : "✗ {$result3['error']}\n";
    
    // Try to restore non-existent backup
    $result4 = $priceService->restorePriceBackup('non-existent-backup-id');
    echo "Non-existent backup: ";
    echo $result4['success'] ? "✓ Success" : "✗ {$result4['error']}\n";
    
    echo "\n";
}

/**
 * Main demonstration
 */
function runDemonstration() {
    echo "╔════════════════════════════════════════════════════════════╗\n";
    echo "║         PriceService Demonstration Script                 ║\n";
    echo "╚════════════════════════════════════════════════════════════╝\n\n";
    
    // In a real OpenCart environment, you would load the service like this:
    // $this->load->model('extension/pricepilot/PriceService');
    // $priceService = $this->model_extension_pricepilot_PriceService;
    
    echo "NOTE: This is a demonstration of the PriceService API.\n";
    echo "In production, load the service through OpenCart's model system.\n\n";
    
    // Uncomment these when running in actual OpenCart environment:
    // example_updateSinglePrice($priceService);
    // example_bulkPriceUpdate($priceService);
    // example_updateStock($priceService);
    // example_specialPrice($priceService);
    // example_priceBackup($priceService);
    // example_multiStore($priceService);
    // example_errorHandling($priceService);
    
    echo "╔════════════════════════════════════════════════════════════╗\n";
    echo "║                    Demonstration Complete                  ║\n";
    echo "╚════════════════════════════════════════════════════════════╝\n";
}

// Run the demonstration
runDemonstration();

/**
 * API Usage Summary
 * 
 * 1. Update Single Price:
 *    $result = $priceService->updatePrice($productId, $newPrice, $storeId);
 * 
 * 2. Bulk Update Prices:
 *    $updates = [['product_id' => 123, 'price' => 99.99], ...];
 *    $result = $priceService->bulkUpdatePrices($updates, $storeId);
 * 
 * 3. Update Stock:
 *    $result = $priceService->updateStock($productId, $quantity);
 * 
 * 4. Set Special Price:
 *    $result = $priceService->updateSpecialPrice($productId, $price, $start, $end);
 * 
 * 5. Create Backup:
 *    $backupId = $priceService->createPriceBackup($productIds);
 * 
 * 6. Restore Backup:
 *    $result = $priceService->restorePriceBackup($backupId);
 * 
 * All methods return structured arrays with success status and error messages.
 */
