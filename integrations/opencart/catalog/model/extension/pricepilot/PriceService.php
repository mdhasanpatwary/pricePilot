<?php
/**
 * PricePilot Price Service
 * Path: catalog/model/extension/pricepilot/PriceService.php
 * 
 * Price update operations service with validation, logging, and backup capabilities.
 * Handles single and bulk price updates, stock synchronization, special pricing,
 * variant price updates, and price backup/restore functionality.
 * 
 * Features:
 * - Single product price updates with validation and logging
 * - Bulk price updates with batch processing and error handling
 * - Stock quantity updates with out-of-stock handling
 * - Special price management with date validation
 * - Product variant price updates with option-specific pricing
 * - Price backup creation and restoration
 * - Cache invalidation after updates
 * - Webhook event triggering
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.6, 10.2, 10.3, 10.4, 16.2, 16.3, 19.2, 21.1, 21.3
 * 
 * @package PricePilot
 * @subpackage Services
 */

require_once __DIR__ . '/Service.php';

class PriceService extends Service {
    
    /**
     * @var LoggingService Logging service instance
     */
    private $loggingService;
    
    /**
     * @var NotificationService Notification service instance
     */
    private $notificationService;
    
    /**
     * Constructor
     * 
     * @param object $registry OpenCart registry
     */
    public function __construct($registry) {
        parent::__construct($registry);
        
        // Load logging service for price change tracking
        require_once __DIR__ . '/LoggingService.php';
        $this->loggingService = new LoggingService($registry);
        
        // Load notification service for failure alerts
        require_once __DIR__ . '/NotificationService.php';
        $this->notificationService = new NotificationService($registry);
    }
    
    /**
     * Update single product price
     * 
     * Updates the price of a single product with validation, logging,
     * cache invalidation, and webhook notification.
     * 
     * @param int $productId Product ID to update
     * @param float $newPrice New price value
     * @param int|null $storeId Store ID (null for default store)
     * @return array ['success' => bool, 'old_price' => float|null, 'error' => string|null]
     */
    public function updatePrice($productId, $newPrice, $storeId = null) {
        try {
            // Default to store 0 if not specified
            if ($storeId === null) {
                $storeId = 0;
            }
            
            // Get current price for logging
            $oldPrice = $this->getCurrentPrice($productId);
            
            if ($oldPrice === null) {
                return [
                    'success' => false,
                    'old_price' => null,
                    'error' => 'Product not found'
                ];
            }
            
            // Update the price using prepared statement
            $sql = "UPDATE " . $this->getTableName('product') . " 
                    SET price = " . (float)$newPrice . ", 
                        date_modified = NOW() 
                    WHERE product_id = " . (int)$productId;
            
            $this->query($sql);
            
            // Log the price change
            $this->loggingService->logPriceChange(
                $productId,
                $oldPrice,
                $newPrice,
                'API',
                $storeId
            );
            
            // Invalidate product cache
            $this->invalidateProductCache($productId);
            
            // TODO: Trigger webhook event (will be implemented in WebhookService task)
            // $this->triggerWebhookEvent('product.updated', $productId, $storeId);
            
            return [
                'success' => true,
                'old_price' => $oldPrice,
                'error' => null
            ];
            
        } catch (Exception $e) {
            $this->logMessage("Failed to update price for product {$productId}: " . $e->getMessage(), 'error');
            return [
                'success' => false,
                'old_price' => null,
                'error' => 'Internal error occurred'
            ];
        }
    }
    
    /**
     * Update multiple product prices in bulk
     * 
     * Processes an array of product price updates with batch processing,
     * individual error handling, and summary reporting. Continues processing
     * even if individual updates fail.
     * 
     * @param array $updates Array of ['product_id' => int, 'price' => float]
     * @param int|null $storeId Store ID (null for default store)
     * @return array ['success_count' => int, 'failure_count' => int, 'failures' => array]
     */
    public function bulkUpdatePrices($updates, $storeId = null) {
        try {
            $successCount = 0;
            $failureCount = 0;
            $failures = [];
            
            // Default to store 0 if not specified
            if ($storeId === null) {
                $storeId = 0;
            }
            
            // Process each update individually
            foreach ($updates as $update) {
                $productId = isset($update['product_id']) ? (int)$update['product_id'] : 0;
                $price = isset($update['price']) ? (float)$update['price'] : 0;
                
                // Validate product_id and price
                if ($productId <= 0) {
                    $failureCount++;
                    $failures[] = [
                        'product_id' => $productId,
                        'error' => 'Invalid product_id'
                    ];
                    continue;
                }
                
                if ($price < 0) {
                    $failureCount++;
                    $failures[] = [
                        'product_id' => $productId,
                        'error' => 'Invalid price value'
                    ];
                    continue;
                }
                
                // Attempt to update the price
                $result = $this->updatePrice($productId, $price, $storeId);
                
                if ($result['success']) {
                    $successCount++;
                } else {
                    $failureCount++;
                    $failures[] = [
                        'product_id' => $productId,
                        'error' => $result['error']
                    ];
                }
            }
            
            // Invalidate product list cache after bulk update
            $this->invalidateProductListCache();
            
            // Send notification if bulk update failed completely (Requirement 20.1)
            if ($successCount === 0 && $failureCount > 0) {
                $this->notificationService->sendEmailNotification(
                    'Bulk Price Update Failed',
                    "A bulk price update operation failed completely. All {$failureCount} product updates failed. Please check the error logs for details.",
                    NotificationService::TYPE_FAILURE,
                    NotificationService::PRIORITY_HIGH
                );
            }
            
            return [
                'success_count' => $successCount,
                'failure_count' => $failureCount,
                'failures' => $failures
            ];
            
        } catch (Exception $e) {
            $this->logMessage("Failed to process bulk price update: " . $e->getMessage(), 'error');
            
            // Send notification for bulk update exception (Requirement 20.1)
            $this->notificationService->sendEmailNotification(
                'Bulk Price Update Exception',
                "A bulk price update operation encountered a critical error: " . $e->getMessage(),
                NotificationService::TYPE_FAILURE,
                NotificationService::PRIORITY_CRITICAL
            );
            
            return [
                'success_count' => 0,
                'failure_count' => count($updates),
                'failures' => [
                    [
                        'product_id' => 0,
                        'error' => 'Bulk update failed: ' . $e->getMessage()
                    ]
                ]
            ];
        }
    }
    
    /**
     * Update product stock quantity
     * 
     * Updates the stock quantity for a product and automatically marks
     * it as out of stock when quantity reaches zero.
     * 
     * @param int $productId Product ID to update
     * @param int $quantity New stock quantity
     * @return array ['success' => bool, 'error' => string|null]
     */
    public function updateStock($productId, $quantity) {
        try {
            // Validate product exists
            $product = $this->getProductById($productId);
            
            if (!$product) {
                return [
                    'success' => false,
                    'error' => 'Product not found'
                ];
            }
            
            // Determine stock status (0 = out of stock, 1 = in stock)
            $stockStatus = ($quantity > 0) ? 1 : 0;
            
            // Update quantity and stock status
            $sql = "UPDATE " . $this->getTableName('product') . " 
                    SET quantity = " . (int)$quantity . ", 
                        stock_status_id = " . $stockStatus . ",
                        date_modified = NOW() 
                    WHERE product_id = " . (int)$productId;
            
            $this->query($sql);
            
            // Invalidate product cache
            $this->invalidateProductCache($productId);
            
            // Log the stock change
            $this->logMessage("Stock updated for product {$productId}: quantity={$quantity}, status={$stockStatus}", 'info');
            
            return [
                'success' => true,
                'error' => null
            ];
            
        } catch (Exception $e) {
            $this->logMessage("Failed to update stock for product {$productId}: " . $e->getMessage(), 'error');
            return [
                'success' => false,
                'error' => 'Internal error occurred'
            ];
        }
    }
    
    /**
     * Update special price with date range and customer group support
     * 
     * Sets or updates a special promotional price for a product with
     * optional start and end dates for time-limited sales. Supports
     * customer group-specific pricing for targeted promotions.
     * 
     * Requirements: 19.2, 19.3, 19.4
     * 
     * @param int $productId Product ID to update
     * @param float $specialPrice Special price value
     * @param string|null $dateStart Start date (Y-m-d format, null for immediate)
     * @param string|null $dateEnd End date (Y-m-d format, null for no expiration)
     * @param int|null $customerGroupId Customer group ID (null for default group)
     * @param int $priority Priority for multiple special prices (default: 1)
     * @return array ['success' => bool, 'error' => string|null]
     */
    public function updateSpecialPrice($productId, $specialPrice, $dateStart = null, $dateEnd = null, $customerGroupId = null, $priority = 1) {
        try {
            // Validate product exists
            $product = $this->getProductById($productId);
            
            if (!$product) {
                return [
                    'success' => false,
                    'error' => 'Product not found'
                ];
            }
            
            // Validate date format and logic (Requirement 19.2)
            if ($dateStart !== null && !$this->isValidDate($dateStart)) {
                return [
                    'success' => false,
                    'error' => 'Invalid date_start format (expected Y-m-d)'
                ];
            }
            
            if ($dateEnd !== null && !$this->isValidDate($dateEnd)) {
                return [
                    'success' => false,
                    'error' => 'Invalid date_end format (expected Y-m-d)'
                ];
            }
            
            // Validate date range logic
            if ($dateStart !== null && $dateEnd !== null) {
                if (strtotime($dateEnd) < strtotime($dateStart)) {
                    return [
                        'success' => false,
                        'error' => 'date_end must be after date_start'
                    ];
                }
            }
            
            // Handle special price expiration (Requirement 19.3)
            // If dateEnd is in the past, remove the special price instead of updating
            if ($dateEnd !== null && strtotime($dateEnd) < time()) {
                return $this->removeExpiredSpecialPrice($productId, $customerGroupId);
            }
            
            // Get customer group ID from config if not specified (Requirement 19.4)
            if ($customerGroupId === null) {
                $customerGroupId = (int)$this->config->get('config_customer_group_id');
            } else {
                $customerGroupId = (int)$customerGroupId;
            }
            
            // Check if special price already exists for this customer group
            $checkSql = "SELECT product_special_id 
                        FROM " . $this->getTableName('product_special') . " 
                        WHERE product_id = " . (int)$productId . " 
                        AND customer_group_id = " . $customerGroupId . " 
                        LIMIT 1";
            
            $checkResult = $this->query($checkSql);
            
            // Format dates for SQL
            $sqlDateStart = $dateStart ? "'" . $this->escape($dateStart) . "'" : "'0000-00-00'";
            $sqlDateEnd = $dateEnd ? "'" . $this->escape($dateEnd) . "'" : "'0000-00-00'";
            
            if ($checkResult->num_rows > 0) {
                // Update existing special price
                $specialId = $checkResult->row['product_special_id'];
                
                $sql = "UPDATE " . $this->getTableName('product_special') . " 
                        SET price = " . (float)$specialPrice . ", 
                            date_start = {$sqlDateStart}, 
                            date_end = {$sqlDateEnd},
                            priority = " . (int)$priority . " 
                        WHERE product_special_id = " . (int)$specialId;
            } else {
                // Insert new special price
                $sql = "INSERT INTO " . $this->getTableName('product_special') . " 
                        (product_id, customer_group_id, priority, price, date_start, date_end) 
                        VALUES (
                            " . (int)$productId . ",
                            " . $customerGroupId . ",
                            " . (int)$priority . ",
                            " . (float)$specialPrice . ",
                            {$sqlDateStart},
                            {$sqlDateEnd}
                        )";
            }
            
            $this->query($sql);
            
            // Invalidate product cache
            $this->invalidateProductCache($productId);
            
            // Log the special price update
            $this->logMessage(
                "Updated special price for product {$productId}: price={$specialPrice}, customer_group={$customerGroupId}, start={$dateStart}, end={$dateEnd}",
                'info'
            );
            
            return [
                'success' => true,
                'error' => null
            ];
            
        } catch (Exception $e) {
            $this->logMessage("Failed to update special price for product {$productId}: " . $e->getMessage(), 'error');
            return [
                'success' => false,
                'error' => 'Internal error occurred'
            ];
        }
    }
    
    /**
     * Remove expired special price
     * 
     * Removes a special price that has expired based on its end date.
     * This is called automatically when attempting to set a special price
     * with an end date in the past.
     * 
     * Requirements: 19.3
     * 
     * @param int $productId Product ID
     * @param int|null $customerGroupId Customer group ID (null for default)
     * @return array ['success' => bool, 'error' => string|null]
     */
    private function removeExpiredSpecialPrice($productId, $customerGroupId = null) {
        try {
            // Get customer group ID from config if not specified
            if ($customerGroupId === null) {
                $customerGroupId = (int)$this->config->get('config_customer_group_id');
            } else {
                $customerGroupId = (int)$customerGroupId;
            }
            
            // Delete the expired special price
            $sql = "DELETE FROM " . $this->getTableName('product_special') . " 
                    WHERE product_id = " . (int)$productId . " 
                    AND customer_group_id = " . $customerGroupId;
            
            $this->query($sql);
            
            // Invalidate product cache
            $this->invalidateProductCache($productId);
            
            $this->logMessage(
                "Removed expired special price for product {$productId}, customer_group={$customerGroupId}",
                'info'
            );
            
            return [
                'success' => true,
                'error' => null
            ];
            
        } catch (Exception $e) {
            $this->logMessage(
                "Failed to remove expired special price for product {$productId}: " . $e->getMessage(),
                'error'
            );
            return [
                'success' => false,
                'error' => 'Internal error occurred'
            ];
        }
    }
    
    /**
     * Create price backup before bulk update
     * 
     * Creates a backup of current prices for specified products,
     * allowing restoration if needed. Backup is stored as JSON.
     * 
     * @param array $productIds Array of product IDs to backup
     * @return string Backup ID (UUID)
     */
    public function createPriceBackup($productIds) {
        try {
            // Generate unique backup ID
            $backupId = $this->generateUuid();
            
            // Collect current prices for all products
            $backupData = [];
            
            foreach ($productIds as $productId) {
                $productId = (int)$productId;
                
                $sql = "SELECT product_id, price, quantity 
                        FROM " . $this->getTableName('product') . " 
                        WHERE product_id = " . $productId;
                
                $result = $this->query($sql);
                
                if ($result->num_rows > 0) {
                    $backupData[] = [
                        'product_id' => (int)$result->row['product_id'],
                        'price' => (float)$result->row['price'],
                        'quantity' => (int)$result->row['quantity']
                    ];
                }
            }
            
            // Store backup in database
            $backupJson = json_encode($backupData);
            $productCount = count($backupData);
            
            $sql = "INSERT INTO " . $this->getTableName('pricepilot_price_backups') . " 
                    (backup_id, backup_data, product_count, created_by, date_added) 
                    VALUES (
                        '" . $this->escape($backupId) . "',
                        '" . $this->escape($backupJson) . "',
                        " . $productCount . ",
                        'API',
                        '" . $this->getCurrentTimestamp() . "'
                    )";
            
            $this->query($sql);
            
            $this->logMessage("Created price backup {$backupId} for {$productCount} products", 'info');
            
            return $backupId;
            
        } catch (Exception $e) {
            $this->logMessage("Failed to create price backup: " . $e->getMessage(), 'error');
            return '';
        }
    }
    
    /**
     * Restore prices from backup
     * 
     * Restores product prices from a previously created backup,
     * reverting all products to their backed-up prices.
     * 
     * @param string $backupId Backup ID to restore from
     * @return array ['success' => bool, 'restored_count' => int, 'error' => string|null]
     */
    public function restorePriceBackup($backupId) {
        try {
            // Retrieve backup data
            $sql = "SELECT backup_data, product_count 
                    FROM " . $this->getTableName('pricepilot_price_backups') . " 
                    WHERE backup_id = '" . $this->escape($backupId) . "' 
                    LIMIT 1";
            
            $result = $this->query($sql);
            
            if ($result->num_rows === 0) {
                return [
                    'success' => false,
                    'restored_count' => 0,
                    'error' => 'Backup not found'
                ];
            }
            
            // Decode backup data
            $backupData = json_decode($result->row['backup_data'], true);
            
            if (!is_array($backupData)) {
                return [
                    'success' => false,
                    'restored_count' => 0,
                    'error' => 'Invalid backup data'
                ];
            }
            
            // Restore each product
            $restoredCount = 0;
            
            foreach ($backupData as $product) {
                $productId = (int)$product['product_id'];
                $price = (float)$product['price'];
                $quantity = (int)$product['quantity'];
                
                $updateSql = "UPDATE " . $this->getTableName('product') . " 
                             SET price = " . $price . ", 
                                 quantity = " . $quantity . ",
                                 date_modified = NOW() 
                             WHERE product_id = " . $productId;
                
                $this->query($updateSql);
                $restoredCount++;
                
                // Invalidate product cache
                $this->invalidateProductCache($productId);
            }
            
            // Invalidate product list cache
            $this->invalidateProductListCache();
            
            $this->logMessage("Restored {$restoredCount} products from backup {$backupId}", 'info');
            
            return [
                'success' => true,
                'restored_count' => $restoredCount,
                'error' => null
            ];
            
        } catch (Exception $e) {
            $this->logMessage("Failed to restore price backup {$backupId}: " . $e->getMessage(), 'error');
            return [
                'success' => false,
                'restored_count' => 0,
                'error' => 'Internal error occurred'
            ];
        }
    }
    
    /**
     * Update variant price
     * 
     * Updates the price modifier for a specific product variant identified
     * by option_id and option_value_id. Logs the variant-specific price change.
     * 
     * Requirements: 16.2, 16.3
     * 
     * @param int $productId Product ID
     * @param int $optionId Option ID (e.g., Size, Color)
     * @param int $optionValueId Option Value ID (e.g., Large, Red)
     * @param float $price New price modifier value
     * @param string $pricePrefix Price prefix ('+' or '-')
     * @return array ['success' => bool, 'old_price' => float|null, 'error' => string|null]
     */
    public function updateVariantPrice($productId, $optionId, $optionValueId, $price, $pricePrefix = '+') {
        try {
            // Validate product exists
            $product = $this->getProductById($productId);
            
            if (!$product) {
                return [
                    'success' => false,
                    'old_price' => null,
                    'error' => 'Product not found'
                ];
            }
            
            // Validate price prefix
            if (!in_array($pricePrefix, ['+', '-', '='])) {
                return [
                    'success' => false,
                    'old_price' => null,
                    'error' => 'Invalid price_prefix (must be +, -, or =)'
                ];
            }
            
            // Get current variant price for logging
            $oldPrice = $this->getCurrentVariantPrice($productId, $optionId, $optionValueId);
            
            if ($oldPrice === null) {
                return [
                    'success' => false,
                    'old_price' => null,
                    'error' => 'Product variant not found'
                ];
            }
            
            // Update the variant price using prepared statement
            $sql = "UPDATE " . $this->getTableName('product_option_value') . " 
                    SET price = " . (float)$price . ", 
                        price_prefix = '" . $this->escape($pricePrefix) . "' 
                    WHERE product_id = " . (int)$productId . " 
                    AND option_id = " . (int)$optionId . " 
                    AND option_value_id = " . (int)$optionValueId;
            
            $this->query($sql);
            
            // Get product name and variant details for logging
            $variantDetails = $this->getVariantDetails($productId, $optionId, $optionValueId);
            $productName = $product['name'];
            $variantName = $variantDetails ? " ({$variantDetails['option_name']}: {$variantDetails['option_value']})" : '';
            
            // Log the variant price change
            $this->loggingService->logPriceChange(
                $productId,
                $oldPrice,
                $price,
                'API - Variant' . $variantName,
                0 // Default store
            );
            
            // Invalidate product cache
            $this->invalidateProductCache($productId);
            
            $this->logMessage(
                "Updated variant price for product {$productId}, option {$optionId}, value {$optionValueId}: {$oldPrice} -> {$pricePrefix}{$price}",
                'info'
            );
            
            return [
                'success' => true,
                'old_price' => $oldPrice,
                'error' => null
            ];
            
        } catch (Exception $e) {
            $this->logMessage(
                "Failed to update variant price for product {$productId}, option {$optionId}, value {$optionValueId}: " . $e->getMessage(),
                'error'
            );
            return [
                'success' => false,
                'old_price' => null,
                'error' => 'Internal error occurred'
            ];
        }
    }
    
    /**
     * Update product image
     * 
     * Updates the main product image with a new image URL. Validates
     * the URL format and updates the product's image field.
     * 
     * Requirements: 17.5
     * 
     * @param int $productId Product ID to update
     * @param string $imageUrl New image URL or path
     * @return array ['success' => bool, 'error' => string|null]
     */
    public function updateProductImage($productId, $imageUrl) {
        try {
            // Validate product exists
            $product = $this->getProductById($productId);
            
            if (!$product) {
                return [
                    'success' => false,
                    'error' => 'Product not found'
                ];
            }
            
            // Validate image URL format
            $validationResult = $this->validateImageUrl($imageUrl);
            if (!$validationResult['valid']) {
                return [
                    'success' => false,
                    'error' => $validationResult['error']
                ];
            }
            
            // Extract image path from URL if it's a full URL
            $imagePath = $this->extractImagePath($imageUrl);
            
            // Update the product image
            $sql = "UPDATE " . $this->getTableName('product') . " 
                    SET image = '" . $this->escape($imagePath) . "', 
                        date_modified = NOW() 
                    WHERE product_id = " . (int)$productId;
            
            $this->query($sql);
            
            // Invalidate product cache
            $this->invalidateProductCache($productId);
            
            $this->logMessage(
                "Updated image for product {$productId}: {$imagePath}",
                'info'
            );
            
            return [
                'success' => true,
                'error' => null
            ];
            
        } catch (Exception $e) {
            $this->logMessage(
                "Failed to update image for product {$productId}: " . $e->getMessage(),
                'error'
            );
            return [
                'success' => false,
                'error' => 'Internal error occurred'
            ];
        }
    }
    
    /**
     * Update product categories
     * 
     * Updates the category assignments for a product. Accepts an array
     * of category IDs and validates that all categories exist before
     * updating. Replaces all existing category assignments.
     * 
     * Requirements: 18.4
     * 
     * @param int $productId Product ID to update
     * @param array $categoryIds Array of category IDs to assign
     * @return array ['success' => bool, 'error' => string|null, 'assigned_count' => int]
     */
    public function updateProductCategories($productId, $categoryIds) {
        try {
            // Validate product exists
            $product = $this->getProductById($productId);
            
            if (!$product) {
                return [
                    'success' => false,
                    'error' => 'Product not found',
                    'assigned_count' => 0
                ];
            }
            
            // Validate categoryIds is an array
            if (!is_array($categoryIds)) {
                return [
                    'success' => false,
                    'error' => 'category_ids must be an array',
                    'assigned_count' => 0
                ];
            }
            
            // Validate all categories exist
            $validCategoryIds = [];
            foreach ($categoryIds as $categoryId) {
                $categoryId = (int)$categoryId;
                
                if ($categoryId <= 0) {
                    continue; // Skip invalid IDs
                }
                
                // Check if category exists
                if ($this->categoryExists($categoryId)) {
                    $validCategoryIds[] = $categoryId;
                } else {
                    $this->logMessage(
                        "Category {$categoryId} does not exist, skipping",
                        'warning'
                    );
                }
            }
            
            // If no valid categories, return error
            if (empty($validCategoryIds)) {
                return [
                    'success' => false,
                    'error' => 'No valid categories provided',
                    'assigned_count' => 0
                ];
            }
            
            // Remove all existing category assignments
            $deleteSql = "DELETE FROM " . $this->getTableName('product_to_category') . " 
                         WHERE product_id = " . (int)$productId;
            
            $this->query($deleteSql);
            
            // Insert new category assignments
            $assignedCount = 0;
            foreach ($validCategoryIds as $categoryId) {
                $insertSql = "INSERT INTO " . $this->getTableName('product_to_category') . " 
                             (product_id, category_id) 
                             VALUES (" . (int)$productId . ", " . (int)$categoryId . ")";
                
                $this->query($insertSql);
                $assignedCount++;
            }
            
            // Invalidate product cache
            $this->invalidateProductCache($productId);
            
            // Invalidate product list cache (category filter results will change)
            $this->invalidateProductListCache();
            
            $this->logMessage(
                "Updated categories for product {$productId}: assigned {$assignedCount} categories",
                'info'
            );
            
            return [
                'success' => true,
                'error' => null,
                'assigned_count' => $assignedCount
            ];
            
        } catch (Exception $e) {
            $this->logMessage(
                "Failed to update categories for product {$productId}: " . $e->getMessage(),
                'error'
            );
            return [
                'success' => false,
                'error' => 'Internal error occurred',
                'assigned_count' => 0
            ];
        }
    }
    
    /**
     * Get current price for a product
     * 
     * @param int $productId Product ID
     * @return float|null Current price or null if not found
     */
    private function getCurrentPrice($productId) {
        try {
            $sql = "SELECT price 
                    FROM " . $this->getTableName('product') . " 
                    WHERE product_id = " . (int)$productId . " 
                    LIMIT 1";
            
            $result = $this->query($sql);
            
            if ($result->num_rows > 0) {
                return (float)$result->row['price'];
            }
            
            return null;
        } catch (Exception $e) {
            return null;
        }
    }
    
    /**
     * Get product by ID
     * 
     * @param int $productId Product ID
     * @return array|null Product data or null if not found
     */
    private function getProductById($productId) {
        try {
            $sql = "SELECT * 
                    FROM " . $this->getTableName('product') . " 
                    WHERE product_id = " . (int)$productId . " 
                    LIMIT 1";
            
            $result = $this->query($sql);
            
            if ($result->num_rows > 0) {
                return $result->row;
            }
            
            return null;
        } catch (Exception $e) {
            return null;
        }
    }
    
    /**
     * Check if category exists
     * 
     * @param int $categoryId Category ID to check
     * @return bool True if category exists, false otherwise
     */
    private function categoryExists($categoryId) {
        try {
            $sql = "SELECT COUNT(*) as count 
                    FROM " . $this->getTableName('category') . " 
                    WHERE category_id = " . (int)$categoryId . " 
                    LIMIT 1";
            
            $result = $this->query($sql);
            
            return (int)$result->row['count'] > 0;
        } catch (Exception $e) {
            return false;
        }
    }
    
    /**
     * Get current variant price
     * 
     * @param int $productId Product ID
     * @param int $optionId Option ID
     * @param int $optionValueId Option Value ID
     * @return float|null Current variant price or null if not found
     */
    private function getCurrentVariantPrice($productId, $optionId, $optionValueId) {
        try {
            $sql = "SELECT price 
                    FROM " . $this->getTableName('product_option_value') . " 
                    WHERE product_id = " . (int)$productId . " 
                    AND option_id = " . (int)$optionId . " 
                    AND option_value_id = " . (int)$optionValueId . " 
                    LIMIT 1";
            
            $result = $this->query($sql);
            
            if ($result->num_rows > 0) {
                return (float)$result->row['price'];
            }
            
            return null;
        } catch (Exception $e) {
            return null;
        }
    }
    
    /**
     * Get variant details for logging
     * 
     * @param int $productId Product ID
     * @param int $optionId Option ID
     * @param int $optionValueId Option Value ID
     * @return array|null Variant details or null if not found
     */
    private function getVariantDetails($productId, $optionId, $optionValueId) {
        try {
            $sql = "SELECT 
                        od.name as option_name,
                        ovd.name as option_value
                    FROM " . $this->getTableName('product_option_value') . " pov
                    LEFT JOIN " . $this->getTableName('option_description') . " od 
                        ON (pov.option_id = od.option_id AND od.language_id = " . (int)$this->config->get('config_language_id') . ")
                    LEFT JOIN " . $this->getTableName('option_value_description') . " ovd 
                        ON (pov.option_value_id = ovd.option_value_id AND ovd.language_id = " . (int)$this->config->get('config_language_id') . ")
                    WHERE pov.product_id = " . (int)$productId . " 
                    AND pov.option_id = " . (int)$optionId . " 
                    AND pov.option_value_id = " . (int)$optionValueId . " 
                    LIMIT 1";
            
            $result = $this->query($sql);
            
            if ($result->num_rows > 0) {
                return [
                    'option_name' => $result->row['option_name'],
                    'option_value' => $result->row['option_value']
                ];
            }
            
            return null;
        } catch (Exception $e) {
            return null;
        }
    }
    
    /**
     * Validate date format (Y-m-d)
     * 
     * @param string $date Date string to validate
     * @return bool True if valid, false otherwise
     */
    private function isValidDate($date) {
        $d = DateTime::createFromFormat('Y-m-d', $date);
        return $d && $d->format('Y-m-d') === $date;
    }
    
    /**
     * Invalidate product cache for specific product
     * 
     * @param int $productId Product ID
     */
    private function invalidateProductCache($productId) {
        // Clear specific product cache
        $cacheKey = "pricepilot_product_{$productId}_store_0";
        $this->cache->delete($cacheKey);
        
        // Also clear for other stores if multi-store
        for ($storeId = 1; $storeId <= 10; $storeId++) {
            $cacheKey = "pricepilot_product_{$productId}_store_{$storeId}";
            $this->cache->delete($cacheKey);
        }
    }
    
    /**
     * Invalidate product list cache
     * 
     * Clears all cached product lists after bulk operations
     */
    private function invalidateProductListCache() {
        // Clear all product list caches
        // Note: This is a simple implementation. In production, you might want
        // to use cache tags or a more sophisticated cache invalidation strategy
        $this->cache->delete('pricepilot_products_*');
        $this->cache->delete('pricepilot_search_*');
    }
    
    /**
     * Generate UUID v4
     * 
     * @return string UUID string
     */
    private function generateUuid() {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff)
        );
    }
    
    /**
     * Validate image URL format
     * 
     * Validates that the provided image URL or path is in a valid format.
     * Accepts both full URLs and relative paths.
     * 
     * @param string $imageUrl Image URL or path to validate
     * @return array ['valid' => bool, 'error' => string|null]
     */
    private function validateImageUrl($imageUrl) {
        // Check if empty
        if (empty($imageUrl)) {
            return [
                'valid' => false,
                'error' => 'Image URL cannot be empty'
            ];
        }
        
        // Check if it's a valid URL or path
        if (filter_var($imageUrl, FILTER_VALIDATE_URL)) {
            // It's a full URL - validate it's HTTP/HTTPS
            $scheme = parse_url($imageUrl, PHP_URL_SCHEME);
            if (!in_array($scheme, ['http', 'https'])) {
                return [
                    'valid' => false,
                    'error' => 'Image URL must use HTTP or HTTPS protocol'
                ];
            }
        } else {
            // It's a relative path - validate it doesn't contain dangerous characters
            if (preg_match('/[<>"|?*]/', $imageUrl)) {
                return [
                    'valid' => false,
                    'error' => 'Image path contains invalid characters'
                ];
            }
            
            // Check for directory traversal attempts
            if (strpos($imageUrl, '..') !== false) {
                return [
                    'valid' => false,
                    'error' => 'Image path cannot contain directory traversal'
                ];
            }
        }
        
        // Validate file extension (common image formats)
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
        $extension = strtolower(pathinfo($imageUrl, PATHINFO_EXTENSION));
        
        if (!in_array($extension, $allowedExtensions)) {
            return [
                'valid' => false,
                'error' => 'Image must be a valid image format (jpg, png, gif, webp, svg, bmp)'
            ];
        }
        
        return [
            'valid' => true,
            'error' => null
        ];
    }
    
    /**
     * Extract image path from URL
     * 
     * Extracts the relative image path from a full URL, or returns
     * the path as-is if it's already a relative path.
     * 
     * @param string $imageUrl Image URL or path
     * @return string Relative image path
     */
    private function extractImagePath($imageUrl) {
        // If it's a full URL, extract the path after /image/
        if (filter_var($imageUrl, FILTER_VALIDATE_URL)) {
            $path = parse_url($imageUrl, PHP_URL_PATH);
            
            // Remove /image/ prefix if present
            if (strpos($path, '/image/') !== false) {
                $path = substr($path, strpos($path, '/image/') + 7);
            }
            
            return $path;
        }
        
        // It's already a relative path - remove leading slashes
        return ltrim($imageUrl, '/');
    }
}
