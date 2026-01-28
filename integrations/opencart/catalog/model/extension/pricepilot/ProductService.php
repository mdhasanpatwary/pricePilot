<?php
/**
 * PricePilot Product Service
 * Path: catalog/model/extension/pricepilot/ProductService.php
 * 
 * Product data retrieval and manipulation service for the PricePilot plugin.
 * Provides comprehensive product listing, filtering, searching, and variant
 * handling with built-in caching for optimal performance.
 * 
 * Features:
 * - Product listing with flexible filtering (SKU, category, manufacturer, status, store)
 * - Single product retrieval with complete data
 * - Product search by name with pagination
 * - Product variant/option data retrieval
 * - Intelligent caching with 5-minute TTL
 * - Multi-store support
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 27.1
 * 
 * @package PricePilot
 * @subpackage Services
 */

require_once __DIR__ . '/Service.php';

class ProductService extends Service {
    
    /**
     * Cache TTL for product data (5 minutes)
     */
    const CACHE_TTL = 300;
    
    /**
     * Get products with filters and pagination
     * 
     * Retrieves product list with support for multiple filter criteria
     * including SKU, category, manufacturer, status, and store. Results
     * are cached for performance optimization.
     * 
     * @param array $filters Filter criteria:
     *   - 'sku' (string): Filter by product SKU
     *   - 'category_id' (int): Filter by category ID
     *   - 'manufacturer_id' (int): Filter by manufacturer ID
     *   - 'status' (int): Filter by status (1=enabled, 0=disabled)
     *   - 'store_id' (int): Filter by store ID
     *   - 'include_images' (bool): Include all product images (default: false)
     * @param int $start Pagination offset (default: 0)
     * @param int $limit Number of records to return (default: 100)
     * @return array ['products' => array, 'total' => int]
     */
    public function getProducts($filters = [], $start = 0, $limit = 100) {
        try {
            // Generate cache key based on filters and pagination
            $cacheKey = $this->generateCacheKey('products', $filters, $start, $limit);
            
            // Try to get from cache
            return $this->getCached($cacheKey, function() use ($filters, $start, $limit) {
                return $this->fetchProducts($filters, $start, $limit);
            }, self::CACHE_TTL);
            
        } catch (Exception $e) {
            $this->logMessage("Failed to get products: " . $e->getMessage(), 'error');
            return [
                'products' => [],
                'total' => 0
            ];
        }
    }
    
    /**
     * Get single product by ID
     * 
     * Retrieves complete product data including price, stock, images,
     * categories, manufacturer, and other details.
     * 
     * @param int $productId Product ID
     * @param int|null $storeId Store ID (null for default store)
     * @return array|null Product data or null if not found
     */
    public function getProduct($productId, $storeId = null) {
        try {
            // Default to store 0 if not specified
            if ($storeId === null) {
                $storeId = 0;
            }
            
            // Generate cache key
            $cacheKey = "pricepilot_product_{$productId}_store_{$storeId}";
            
            // Try to get from cache
            return $this->getCached($cacheKey, function() use ($productId, $storeId) {
                return $this->fetchProduct($productId, $storeId);
            }, self::CACHE_TTL);
            
        } catch (Exception $e) {
            $this->logMessage("Failed to get product {$productId}: " . $e->getMessage(), 'error');
            return null;
        }
    }
    
    /**
     * Search products by name
     * 
     * Performs case-insensitive search on product names with pagination
     * support. Results are cached for performance.
     * 
     * @param string $query Search query string
     * @param int $start Pagination offset (default: 0)
     * @param int $limit Number of records to return (default: 100)
     * @param bool $includeAllImages Whether to include all product images (default: false)
     * @return array ['products' => array, 'total' => int]
     */
    public function searchProducts($query, $start = 0, $limit = 100, $includeAllImages = false) {
        try {
            // Generate cache key
            $cacheKey = "pricepilot_search_" . md5($query) . "_{$start}_{$limit}_" . ($includeAllImages ? '1' : '0');
            
            // Try to get from cache
            return $this->getCached($cacheKey, function() use ($query, $start, $limit, $includeAllImages) {
                return $this->performSearch($query, $start, $limit, $includeAllImages);
            }, self::CACHE_TTL);
            
        } catch (Exception $e) {
            $this->logMessage("Failed to search products: " . $e->getMessage(), 'error');
            return [
                'products' => [],
                'total' => 0
            ];
        }
    }
    
    /**
     * Get product with all variants/options
     * 
     * Retrieves product data including all product options, option values,
     * and price modifiers for variants (size, color, etc.).
     * 
     * @param int $productId Product ID
     * @return array Product data with variants array
     */
    public function getProductWithVariants($productId) {
        try {
            // Get base product data
            $product = $this->getProduct($productId);
            
            if (!$product) {
                return null;
            }
            
            // Get product variants/options
            $product['variants'] = $this->getProductVariants($productId);
            
            return $product;
            
        } catch (Exception $e) {
            $this->logMessage("Failed to get product variants for {$productId}: " . $e->getMessage(), 'error');
            return null;
        }
    }
    
    /**
     * Get complete category tree with hierarchy
     * 
     * Retrieves the full category tree structure including all categories
     * with their parent-child relationships. Useful for understanding the
     * complete category hierarchy in the store.
     * 
     * Requirements: 18.2, 18.3
     * 
     * @return array Array of categories with parent-child relationships
     */
    public function getCategoryTree() {
        try {
            // Generate cache key
            $cacheKey = "pricepilot_category_tree";
            
            // Try to get from cache
            return $this->getCached($cacheKey, function() {
                return $this->fetchCategoryTree();
            }, self::CACHE_TTL);
            
        } catch (Exception $e) {
            $this->logMessage("Failed to get category tree: " . $e->getMessage(), 'error');
            return [];
        }
    }
    
    /**
     * Fetch products from database with filters
     * 
     * @param array $filters Filter criteria
     * @param int $start Pagination offset
     * @param int $limit Number of records
     * @return array ['products' => array, 'total' => int]
     */
    private function fetchProducts($filters, $start, $limit) {
        // Extract include_images flag
        $includeAllImages = !empty($filters['include_images']);
        
        // Build WHERE clause from filters
        $where = ["p.status = 1"]; // Default to enabled products unless filtered
        $joins = [];
        
        // SKU filter
        if (!empty($filters['sku'])) {
            $where[] = "p.sku = '" . $this->escape($filters['sku']) . "'";
        }
        
        // Category filter
        if (!empty($filters['category_id'])) {
            $joins[] = "LEFT JOIN " . $this->getTableName('product_to_category') . " p2c ON (p.product_id = p2c.product_id)";
            $where[] = "p2c.category_id = " . (int)$filters['category_id'];
        }
        
        // Manufacturer filter
        if (!empty($filters['manufacturer_id'])) {
            $where[] = "p.manufacturer_id = " . (int)$filters['manufacturer_id'];
        }
        
        // Status filter (explicit)
        if (isset($filters['status'])) {
            // Remove default status filter and add explicit one
            $where = array_filter($where, function($w) {
                return strpos($w, 'p.status') === false;
            });
            $where[] = "p.status = " . (int)$filters['status'];
        }
        
        // Store filter
        if (isset($filters['store_id'])) {
            $joins[] = "LEFT JOIN " . $this->getTableName('product_to_store') . " p2s ON (p.product_id = p2s.product_id)";
            $where[] = "p2s.store_id = " . (int)$filters['store_id'];
        }
        
        $joinClause = !empty($joins) ? implode(" ", array_unique($joins)) : "";
        $whereClause = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";
        
        // Get total count
        $countSql = "SELECT COUNT(DISTINCT p.product_id) as total 
                    FROM " . $this->getTableName('product') . " p
                    {$joinClause}
                    {$whereClause}";
        
        $countResult = $this->query($countSql);
        $total = (int)$countResult->row['total'];
        
        // Get products with details
        $sql = "SELECT DISTINCT
                    p.product_id,
                    pd.name,
                    p.model,
                    p.sku,
                    p.price,
                    p.quantity,
                    p.status,
                    p.image,
                    m.name as manufacturer,
                    p.manufacturer_id
                FROM " . $this->getTableName('product') . " p
                LEFT JOIN " . $this->getTableName('product_description') . " pd 
                    ON (p.product_id = pd.product_id AND pd.language_id = " . (int)$this->config->get('config_language_id') . ")
                LEFT JOIN " . $this->getTableName('manufacturer') . " m 
                    ON (p.manufacturer_id = m.manufacturer_id)
                {$joinClause}
                {$whereClause}
                ORDER BY p.product_id ASC
                LIMIT " . (int)$start . ", " . (int)$limit;
        
        $result = $this->query($sql);
        
        $products = [];
        foreach ($result->rows as $row) {
            $products[] = $this->formatProductData($row, $includeAllImages);
        }
        
        return [
            'products' => $products,
            'total' => $total
        ];
    }
    
    /**
     * Fetch single product from database
     * 
     * @param int $productId Product ID
     * @param int $storeId Store ID
     * @return array|null Product data or null if not found
     */
    private function fetchProduct($productId, $storeId) {
        // Check if product exists in store
        if ($storeId > 0) {
            $storeSql = "SELECT COUNT(*) as count 
                        FROM " . $this->getTableName('product_to_store') . " 
                        WHERE product_id = " . (int)$productId . " 
                        AND store_id = " . (int)$storeId;
            
            $storeResult = $this->query($storeSql);
            if ((int)$storeResult->row['count'] === 0) {
                return null;
            }
        }
        
        // Get product data
        $sql = "SELECT 
                    p.product_id,
                    pd.name,
                    p.model,
                    p.sku,
                    p.price,
                    p.quantity,
                    p.status,
                    p.image,
                    m.name as manufacturer,
                    p.manufacturer_id,
                    p.date_added,
                    p.date_modified
                FROM " . $this->getTableName('product') . " p
                LEFT JOIN " . $this->getTableName('product_description') . " pd 
                    ON (p.product_id = pd.product_id AND pd.language_id = " . (int)$this->config->get('config_language_id') . ")
                LEFT JOIN " . $this->getTableName('manufacturer') . " m 
                    ON (p.manufacturer_id = m.manufacturer_id)
                WHERE p.product_id = " . (int)$productId . "
                LIMIT 1";
        
        $result = $this->query($sql);
        
        if ($result->num_rows === 0) {
            return null;
        }
        
        $product = $this->formatProductData($result->row);
        
        // Add special price with date range if exists (Requirements 19.1, 19.5)
        $specialPriceData = $this->getSpecialPrice($productId);
        if ($specialPriceData !== null) {
            // Include both regular price and special price when active
            $product['special'] = $specialPriceData['price'];
            $product['special_start'] = $specialPriceData['date_start'];
            $product['special_end'] = $specialPriceData['date_end'];
        } else {
            $product['special'] = null;
            $product['special_start'] = null;
            $product['special_end'] = null;
        }
        
        // Add categories
        $product['categories'] = $this->getProductCategories($productId);
        
        // Add images
        $product['images'] = $this->getProductImages($productId);
        
        // Add store ID
        $product['store_id'] = $storeId;
        
        return $product;
    }
    
    /**
     * Perform product search by name
     * 
     * @param string $query Search query
     * @param int $start Pagination offset
     * @param int $limit Number of records
     * @param bool $includeAllImages Whether to include all product images
     * @return array ['products' => array, 'total' => int]
     */
    private function performSearch($query, $start, $limit, $includeAllImages = false) {
        $searchTerm = '%' . $this->escape($query) . '%';
        
        // Get total count
        $countSql = "SELECT COUNT(DISTINCT p.product_id) as total 
                    FROM " . $this->getTableName('product') . " p
                    LEFT JOIN " . $this->getTableName('product_description') . " pd 
                        ON (p.product_id = pd.product_id AND pd.language_id = " . (int)$this->config->get('config_language_id') . ")
                    WHERE pd.name LIKE '" . $searchTerm . "'
                    AND p.status = 1";
        
        $countResult = $this->query($countSql);
        $total = (int)$countResult->row['total'];
        
        // Get products
        $sql = "SELECT DISTINCT
                    p.product_id,
                    pd.name,
                    p.model,
                    p.sku,
                    p.price,
                    p.quantity,
                    p.status,
                    p.image,
                    m.name as manufacturer,
                    p.manufacturer_id
                FROM " . $this->getTableName('product') . " p
                LEFT JOIN " . $this->getTableName('product_description') . " pd 
                    ON (p.product_id = pd.product_id AND pd.language_id = " . (int)$this->config->get('config_language_id') . ")
                LEFT JOIN " . $this->getTableName('manufacturer') . " m 
                    ON (p.manufacturer_id = m.manufacturer_id)
                WHERE pd.name LIKE '" . $searchTerm . "'
                AND p.status = 1
                ORDER BY pd.name ASC
                LIMIT " . (int)$start . ", " . (int)$limit;
        
        $result = $this->query($sql);
        
        $products = [];
        foreach ($result->rows as $row) {
            $products[] = $this->formatProductData($row, $includeAllImages);
        }
        
        return [
            'products' => $products,
            'total' => $total
        ];
    }
    
    /**
     * Get product variants/options
     * 
     * @param int $productId Product ID
     * @return array Array of variant data
     */
    private function getProductVariants($productId) {
        $sql = "SELECT 
                    po.product_option_id,
                    po.option_id,
                    od.name as option_name,
                    po.required,
                    pov.product_option_value_id,
                    pov.option_value_id,
                    ovd.name as option_value,
                    pov.quantity,
                    pov.price,
                    pov.price_prefix
                FROM " . $this->getTableName('product_option') . " po
                LEFT JOIN " . $this->getTableName('option_description') . " od 
                    ON (po.option_id = od.option_id AND od.language_id = " . (int)$this->config->get('config_language_id') . ")
                LEFT JOIN " . $this->getTableName('product_option_value') . " pov 
                    ON (po.product_option_id = pov.product_option_id)
                LEFT JOIN " . $this->getTableName('option_value_description') . " ovd 
                    ON (pov.option_value_id = ovd.option_value_id AND ovd.language_id = " . (int)$this->config->get('config_language_id') . ")
                WHERE po.product_id = " . (int)$productId . "
                ORDER BY po.option_id, pov.option_value_id";
        
        $result = $this->query($sql);
        
        $variants = [];
        foreach ($result->rows as $row) {
            if ($row['option_value_id']) {
                $priceModifier = $row['price_prefix'] . $row['price'];
                
                $variants[] = [
                    'option_id' => (int)$row['option_id'],
                    'option_name' => $row['option_name'],
                    'option_value_id' => (int)$row['option_value_id'],
                    'option_value' => $row['option_value'],
                    'price_modifier' => $priceModifier,
                    'quantity' => (int)$row['quantity']
                ];
            }
        }
        
        return $variants;
    }
    
    /**
     * Get special price for product with date range
     * 
     * Returns the active special price along with its date range if configured.
     * Checks date range to ensure the special price is currently active.
     * 
     * Requirements: 19.1, 19.5
     * 
     * @param int $productId Product ID
     * @return array|null Special price data or null if not active
     *   - 'price' (string): Special price value
     *   - 'date_start' (string): Start date (Y-m-d format or '0000-00-00')
     *   - 'date_end' (string): End date (Y-m-d format or '0000-00-00')
     */
    private function getSpecialPrice($productId) {
        $sql = "SELECT price, date_start, date_end 
                FROM " . $this->getTableName('product_special') . " 
                WHERE product_id = " . (int)$productId . "
                AND customer_group_id = " . (int)$this->config->get('config_customer_group_id') . "
                AND ((date_start = '0000-00-00' OR date_start < NOW()) 
                AND (date_end = '0000-00-00' OR date_end > NOW()))
                ORDER BY priority ASC, price ASC 
                LIMIT 1";
        
        $result = $this->query($sql);
        
        if ($result->num_rows > 0) {
            return [
                'price' => number_format((float)$result->row['price'], 4, '.', ''),
                'date_start' => $result->row['date_start'] !== '0000-00-00' ? $result->row['date_start'] : null,
                'date_end' => $result->row['date_end'] !== '0000-00-00' ? $result->row['date_end'] : null
            ];
        }
        
        return null;
    }
    
    /**
     * Get product categories
     * 
     * @param int $productId Product ID
     * @return array Array of category data
     */
    private function getProductCategories($productId) {
        $sql = "SELECT 
                    c.category_id,
                    cd.name
                FROM " . $this->getTableName('product_to_category') . " p2c
                LEFT JOIN " . $this->getTableName('category') . " c 
                    ON (p2c.category_id = c.category_id)
                LEFT JOIN " . $this->getTableName('category_description') . " cd 
                    ON (c.category_id = cd.category_id AND cd.language_id = " . (int)$this->config->get('config_language_id') . ")
                WHERE p2c.product_id = " . (int)$productId;
        
        $result = $this->query($sql);
        
        $categories = [];
        foreach ($result->rows as $row) {
            $categories[] = [
                'category_id' => (int)$row['category_id'],
                'name' => $row['name']
            ];
        }
        
        return $categories;
    }
    
    /**
     * Fetch complete category tree from database
     * 
     * Retrieves all categories with their parent-child relationships,
     * building a hierarchical tree structure.
     * 
     * @return array Array of categories with parent-child relationships
     */
    private function fetchCategoryTree() {
        // Get all categories with their parent information
        $sql = "SELECT 
                    c.category_id,
                    cd.name,
                    c.parent_id,
                    c.sort_order,
                    c.status
                FROM " . $this->getTableName('category') . " c
                LEFT JOIN " . $this->getTableName('category_description') . " cd 
                    ON (c.category_id = cd.category_id AND cd.language_id = " . (int)$this->config->get('config_language_id') . ")
                ORDER BY c.parent_id ASC, c.sort_order ASC, cd.name ASC";
        
        $result = $this->query($sql);
        
        $categories = [];
        $categoryMap = [];
        
        // First pass: Create all category objects
        foreach ($result->rows as $row) {
            $category = [
                'category_id' => (int)$row['category_id'],
                'name' => $row['name'],
                'parent_id' => (int)$row['parent_id'],
                'sort_order' => (int)$row['sort_order'],
                'status' => (int)$row['status'],
                'children' => []
            ];
            
            $categoryMap[$category['category_id']] = $category;
        }
        
        // Second pass: Build parent-child relationships
        foreach ($categoryMap as $categoryId => $category) {
            if ($category['parent_id'] === 0) {
                // Top-level category
                $categories[] = &$categoryMap[$categoryId];
            } else {
                // Child category - add to parent's children array
                if (isset($categoryMap[$category['parent_id']])) {
                    $categoryMap[$category['parent_id']]['children'][] = &$categoryMap[$categoryId];
                }
            }
        }
        
        return $categories;
    }
    
    /**
     * Get product images
     * 
     * @param int $productId Product ID
     * @return array Array of image URLs
     */
    private function getProductImages($productId) {
        $sql = "SELECT image 
                FROM " . $this->getTableName('product_image') . " 
                WHERE product_id = " . (int)$productId . "
                ORDER BY sort_order ASC";
        
        $result = $this->query($sql);
        
        $images = [];
        foreach ($result->rows as $row) {
            if ($row['image']) {
                $images[] = $this->getImageUrl($row['image']);
            }
        }
        
        return $images;
    }
    
    /**
     * Format product data for API response
     * 
     * @param array $row Database row
     * @param bool $includeAllImages Whether to include all product images (default: false)
     * @return array Formatted product data
     */
    private function formatProductData($row, $includeAllImages = false) {
        $productId = (int)$row['product_id'];
        
        $data = [
            'product_id' => $productId,
            'name' => $row['name'] ?? '',
            'model' => $row['model'] ?? '',
            'sku' => $row['sku'] ?? '',
            'price' => number_format((float)$row['price'], 4, '.', ''),
            'quantity' => (int)$row['quantity'],
            'status' => (int)$row['status'],
            'manufacturer' => $row['manufacturer'] ?? '',
            'manufacturer_id' => (int)($row['manufacturer_id'] ?? 0),
            'image' => $this->getImageUrl($row['image'] ?? null),
            'category' => '', // Legacy field - will be populated with first category name
            'categories' => [] // All categories with IDs and names
        ];
        
        // Get all categories for this product (Requirements 18.1, 18.5)
        $categories = $this->getProductCategories($productId);
        $data['categories'] = $categories;
        
        // Set legacy category field to first category name for backward compatibility
        if (!empty($categories)) {
            $data['category'] = $categories[0]['name'];
        }
        
        // Include special price with date range if active (Requirements 19.1, 19.5)
        $specialPriceData = $this->getSpecialPrice($productId);
        if ($specialPriceData !== null) {
            // Return both regular and special price when active
            $data['special'] = $specialPriceData['price'];
            $data['special_start'] = $specialPriceData['date_start'];
            $data['special_end'] = $specialPriceData['date_end'];
        } else {
            $data['special'] = null;
            $data['special_start'] = null;
            $data['special_end'] = null;
        }
        
        // Include all images if requested
        if ($includeAllImages) {
            $data['images'] = $this->getProductImages($productId);
        }
        
        return $data;
    }
    
    /**
     * Get full image URL from image path
     * 
     * @param string|null $imagePath Image path
     * @return string|null Full image URL or null
     */
    private function getImageUrl($imagePath) {
        if (!$imagePath) {
            return null;
        }
        
        // Get store URL from config
        $storeUrl = $this->config->get('config_url');
        if (!$storeUrl) {
            $storeUrl = HTTP_SERVER;
        }
        
        // Ensure trailing slash
        $storeUrl = rtrim($storeUrl, '/') . '/';
        
        return $storeUrl . 'image/' . $imagePath;
    }
    
    /**
     * Generate cache key for products query
     * 
     * @param string $prefix Cache key prefix
     * @param array $filters Filter criteria
     * @param int $start Pagination offset
     * @param int $limit Number of records
     * @return string Cache key
     */
    private function generateCacheKey($prefix, $filters, $start, $limit) {
        $filterString = json_encode($filters);
        $hash = md5($filterString);
        return "pricepilot_{$prefix}_{$hash}_{$start}_{$limit}";
    }
}
