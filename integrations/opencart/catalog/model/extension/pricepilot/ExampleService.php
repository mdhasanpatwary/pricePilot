<?php
/**
 * PricePilot Example Service
 * Path: catalog/model/extension/pricepilot/ExampleService.php
 * 
 * This is an example service demonstrating how to extend the base Service class.
 * This file can be used as a template for creating new services.
 * 
 * @example
 * // In controller:
 * $this->load->model('extension/pricepilot/ExampleService');
 * $result = $this->model_extension_pricepilot_exampleservice->exampleMethod($param);
 */

// Load base service class
require_once(DIR_APPLICATION . 'model/extension/pricepilot/Service.php');

class ExampleService extends Service {
    /**
     * Example method demonstrating service capabilities
     * 
     * This method shows how to:
     * - Access database with error handling
     * - Use caching for performance
     * - Access configuration values
     * - Log operations
     * - Sanitize inputs
     * 
     * @param int $productId Product ID to process
     * @return array Result with success status and data
     */
    public function exampleMethod($productId) {
        // Sanitize input
        $productId = $this->sanitize($productId, 'int');
        
        // Validate input
        if ($this->isEmpty($productId) || $productId <= 0) {
            $this->logMessage('Invalid product ID provided: ' . $productId, 'warning');
            return [
                'success' => false,
                'error' => 'Invalid product ID'
            ];
        }
        
        // Log operation start
        $this->logMessage('Processing product ID: ' . $productId, 'info');
        
        try {
            // Use caching for expensive operations
            $cacheKey = 'pricepilot_example_' . $productId;
            $result = $this->getCached($cacheKey, function() use ($productId) {
                // Access database with prepared statement pattern
                $sql = "SELECT * FROM " . $this->getTableName('product') . " 
                        WHERE product_id = '" . $this->escape($productId) . "'";
                $query = $this->query($sql);
                
                return $query->row;
            }, 300); // Cache for 5 minutes
            
            // Check if product exists
            if (empty($result)) {
                $this->logMessage('Product not found: ' . $productId, 'warning');
                return [
                    'success' => false,
                    'error' => 'Product not found'
                ];
            }
            
            // Access configuration
            $pluginEnabled = $this->getConfig('module_pricepilot_status', 0);
            if (!$pluginEnabled) {
                $this->logMessage('Plugin is disabled', 'warning');
                return [
                    'success' => false,
                    'error' => 'Plugin is disabled'
                ];
            }
            
            // Log success
            $this->logMessage('Successfully processed product ID: ' . $productId, 'info');
            
            return [
                'success' => true,
                'data' => $result
            ];
            
        } catch (Exception $e) {
            // Log error
            $this->logMessage('Error processing product: ' . $e->getMessage(), 'error');
            
            return [
                'success' => false,
                'error' => 'Internal error occurred'
            ];
        }
    }
    
    /**
     * Example method demonstrating database transactions
     * 
     * @param array $updates Array of updates to perform
     * @return array Result with success status
     */
    public function exampleTransaction($updates) {
        try {
            // Begin transaction
            $this->beginTransaction();
            
            foreach ($updates as $update) {
                // Perform database operations
                $sql = "UPDATE " . $this->getTableName('product') . " 
                        SET price = '" . $this->escape($update['price']) . "' 
                        WHERE product_id = '" . $this->escape($update['product_id']) . "'";
                $this->query($sql);
            }
            
            // Commit transaction
            $this->commit();
            
            // Invalidate cache
            $this->invalidateCache('product');
            
            $this->logMessage('Transaction completed successfully', 'info');
            
            return [
                'success' => true,
                'updated' => count($updates)
            ];
            
        } catch (Exception $e) {
            // Rollback on error
            $this->rollback();
            
            $this->logMessage('Transaction failed: ' . $e->getMessage(), 'error');
            
            return [
                'success' => false,
                'error' => 'Transaction failed'
            ];
        }
    }
    
    /**
     * Example method demonstrating service-to-service communication
     * 
     * @param int $productId Product ID
     * @return array Result
     */
    public function exampleServiceCommunication($productId) {
        // Services can load and call other services
        // This will be demonstrated when other services are implemented
        
        // Example:
        // $this->loadModel('extension/pricepilot/ValidationService');
        // $validator = $this->model_extension_pricepilot_validationservice;
        // $validation = $validator->validateProductId($productId);
        
        return [
            'success' => true,
            'message' => 'Service communication example'
        ];
    }
}
