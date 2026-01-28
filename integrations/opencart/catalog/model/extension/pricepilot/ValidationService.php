<?php
/**
 * PricePilot ValidationService
 * Path: catalog/model/extension/pricepilot/ValidationService.php
 * 
 * Centralized input validation and sanitization service for the PricePilot plugin.
 * Provides comprehensive validation methods for all API inputs including product IDs,
 * prices, tokens, payload sizes, and bulk update arrays.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.6
 */

require_once(__DIR__ . '/Service.php');

class ValidationService extends Service {
    
    // Validation constants
    const MAX_PRODUCT_ID = 2147483647; // Max 32-bit signed integer
    const MIN_PRICE = 0.0001;
    const MAX_PRICE = 999999.9999;
    const MAX_PRICE_DECIMALS = 4;
    const TOKEN_LENGTH = 64;
    const MAX_PAYLOAD_SIZE = 1048576; // 1MB in bytes
    const MAX_BULK_PRODUCTS = 1000;
    
    /**
     * Validate product ID
     * 
     * Requirements: 2.1
     * - Product ID must be a positive integer
     * - Maximum value: 2147483647 (32-bit signed integer max)
     * 
     * @param mixed $productId Product ID to validate
     * @return array ['valid' => bool, 'value' => int|null, 'error' => string|null]
     */
    public function validateProductId($productId): array {
        // Check if value is provided
        if ($this->isEmpty($productId)) {
            return [
                'valid' => false,
                'value' => null,
                'error' => 'Product ID is required'
            ];
        }
        
        // Check if value is numeric
        if (!is_numeric($productId)) {
            return [
                'valid' => false,
                'value' => null,
                'error' => 'Product ID must be a numeric value'
            ];
        }
        
        // Convert to integer
        $intValue = (int)$productId;
        
        // Check if conversion resulted in same value (no decimals)
        if ((string)$intValue !== (string)$productId) {
            return [
                'valid' => false,
                'value' => null,
                'error' => 'Product ID must be an integer'
            ];
        }
        
        // Check if positive
        if ($intValue <= 0) {
            return [
                'valid' => false,
                'value' => null,
                'error' => 'Product ID must be a positive integer'
            ];
        }
        
        // Check maximum value
        if ($intValue > self::MAX_PRODUCT_ID) {
            return [
                'valid' => false,
                'value' => null,
                'error' => 'Product ID exceeds maximum allowed value'
            ];
        }
        
        return [
            'valid' => true,
            'value' => $intValue,
            'error' => null
        ];
    }
    
    /**
     * Validate price value
     * 
     * Requirements: 2.2
     * - Price must be numeric
     * - Maximum 4 decimal places
     * - Range: 0.0001 to 999999.9999
     * 
     * @param mixed $price Price to validate
     * @return array ['valid' => bool, 'value' => float|null, 'error' => string|null]
     */
    public function validatePrice($price): array {
        // Check if value is provided
        if ($this->isEmpty($price)) {
            return [
                'valid' => false,
                'value' => null,
                'error' => 'Price is required'
            ];
        }
        
        // Check if value is numeric
        if (!is_numeric($price)) {
            return [
                'valid' => false,
                'value' => null,
                'error' => 'Price must be a numeric value'
            ];
        }
        
        // Convert to float
        $floatValue = (float)$price;
        
        // Check minimum value
        if ($floatValue < self::MIN_PRICE) {
            return [
                'valid' => false,
                'value' => null,
                'error' => 'Price must be at least ' . self::MIN_PRICE
            ];
        }
        
        // Check maximum value
        if ($floatValue > self::MAX_PRICE) {
            return [
                'valid' => false,
                'value' => null,
                'error' => 'Price cannot exceed ' . self::MAX_PRICE
            ];
        }
        
        // Check decimal places
        $priceString = (string)$price;
        if (strpos($priceString, '.') !== false) {
            $decimalPart = substr($priceString, strpos($priceString, '.') + 1);
            if (strlen($decimalPart) > self::MAX_PRICE_DECIMALS) {
                return [
                    'valid' => false,
                    'value' => null,
                    'error' => 'Price cannot have more than ' . self::MAX_PRICE_DECIMALS . ' decimal places'
                ];
            }
        }
        
        return [
            'valid' => true,
            'value' => $floatValue,
            'error' => null
        ];
    }
    
    /**
     * Validate API token format
     * 
     * Requirements: 2.3
     * - Token must be exactly 64 characters
     * - Token must be hexadecimal (0-9, a-f, A-F)
     * 
     * @param mixed $token Token to validate
     * @return array ['valid' => bool, 'error' => string|null]
     */
    public function validateTokenFormat($token): array {
        // Check if value is provided
        if ($this->isEmpty($token)) {
            return [
                'valid' => false,
                'error' => 'API token is required'
            ];
        }
        
        // Check if value is a string
        if (!is_string($token)) {
            return [
                'valid' => false,
                'error' => 'API token must be a string'
            ];
        }
        
        // Check length
        if (strlen($token) !== self::TOKEN_LENGTH) {
            return [
                'valid' => false,
                'error' => 'API token must be exactly ' . self::TOKEN_LENGTH . ' characters'
            ];
        }
        
        // Check if hexadecimal
        if (!ctype_xdigit($token)) {
            return [
                'valid' => false,
                'error' => 'API token must contain only hexadecimal characters (0-9, a-f, A-F)'
            ];
        }
        
        return [
            'valid' => true,
            'error' => null
        ];
    }
    
    /**
     * Validate request payload size
     * 
     * Requirements: 2.4
     * - Maximum payload size: 1MB (1048576 bytes)
     * 
     * @param string $payload JSON payload
     * @return array ['valid' => bool, 'error' => string|null]
     */
    public function validatePayloadSize(string $payload): array {
        $size = strlen($payload);
        
        if ($size > self::MAX_PAYLOAD_SIZE) {
            return [
                'valid' => false,
                'error' => 'Request payload size (' . $size . ' bytes) exceeds maximum allowed size (' . self::MAX_PAYLOAD_SIZE . ' bytes)'
            ];
        }
        
        return [
            'valid' => true,
            'error' => null
        ];
    }
    
    /**
     * Sanitize and validate bulk update array
     * 
     * Requirements: 2.6
     * - Array must not exceed 1000 products
     * - Each product must have valid product_id and price
     * - Returns validated products and any validation errors
     * 
     * @param array $products Array of product updates
     * @return array ['valid' => bool, 'products' => array, 'errors' => array]
     */
    public function validateBulkUpdate(array $products): array {
        $errors = [];
        $validProducts = [];
        
        // Check if array is empty
        if (empty($products)) {
            return [
                'valid' => false,
                'products' => [],
                'errors' => ['Bulk update array cannot be empty']
            ];
        }
        
        // Check maximum number of products
        if (count($products) > self::MAX_BULK_PRODUCTS) {
            return [
                'valid' => false,
                'products' => [],
                'errors' => ['Bulk update cannot contain more than ' . self::MAX_BULK_PRODUCTS . ' products']
            ];
        }
        
        // Validate each product
        foreach ($products as $index => $product) {
            $productErrors = [];
            
            // Check if product is an array
            if (!is_array($product)) {
                $errors[] = "Product at index {$index}: Must be an array";
                continue;
            }
            
            // Validate product_id
            if (!isset($product['product_id'])) {
                $productErrors[] = "Missing product_id";
            } else {
                $productIdValidation = $this->validateProductId($product['product_id']);
                if (!$productIdValidation['valid']) {
                    $productErrors[] = "Invalid product_id: " . $productIdValidation['error'];
                } else {
                    $product['product_id'] = $productIdValidation['value'];
                }
            }
            
            // Validate price
            if (!isset($product['price'])) {
                $productErrors[] = "Missing price";
            } else {
                $priceValidation = $this->validatePrice($product['price']);
                if (!$priceValidation['valid']) {
                    $productErrors[] = "Invalid price: " . $priceValidation['error'];
                } else {
                    $product['price'] = $priceValidation['value'];
                }
            }
            
            // If there are errors for this product, add them to the errors array
            if (!empty($productErrors)) {
                $errors[] = "Product at index {$index}: " . implode(', ', $productErrors);
            } else {
                // Product is valid, add to valid products array
                $validProducts[] = $product;
            }
        }
        
        // Return result
        return [
            'valid' => empty($errors),
            'products' => $validProducts,
            'errors' => $errors
        ];
    }
    
    /**
     * Validate required parameter exists
     * 
     * Helper method to check if a required parameter is present
     * 
     * @param mixed $value Parameter value
     * @param string $paramName Parameter name for error message
     * @return array ['valid' => bool, 'error' => string|null]
     */
    public function validateRequired($value, string $paramName): array {
        if ($this->isEmpty($value)) {
            return [
                'valid' => false,
                'error' => "Required parameter '{$paramName}' is missing"
            ];
        }
        
        return [
            'valid' => true,
            'error' => null
        ];
    }
    
    /**
     * Validate data type
     * 
     * Helper method to validate parameter data type
     * 
     * @param mixed $value Parameter value
     * @param string $expectedType Expected type (string, int, float, bool, array)
     * @param string $paramName Parameter name for error message
     * @return array ['valid' => bool, 'error' => string|null]
     */
    public function validateDataType($value, string $expectedType, string $paramName): array {
        $actualType = gettype($value);
        
        // Handle special cases
        if ($expectedType === 'int' && $actualType === 'integer') {
            $actualType = 'int';
        }
        if ($expectedType === 'float' && ($actualType === 'double' || $actualType === 'float')) {
            return ['valid' => true, 'error' => null];
        }
        if ($expectedType === 'bool' && $actualType === 'boolean') {
            $actualType = 'bool';
        }
        
        if ($actualType !== $expectedType) {
            return [
                'valid' => false,
                'error' => "Parameter '{$paramName}' must be of type {$expectedType}, {$actualType} given"
            ];
        }
        
        return [
            'valid' => true,
            'error' => null
        ];
    }
}
