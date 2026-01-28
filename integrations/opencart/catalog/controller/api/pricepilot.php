<?php
/**
 * PricePilot OpenCart API Controller
 * Path: catalog/controller/api/pricepilot.php
 */
class ControllerApiPricepilot extends Controller {
    
    /**
     * @var ErrorHandlingService Error handling service instance
     */
    private $errorHandler;
    
    /**
     * @var AuthenticationService Authentication service instance
     */
    private $authService;
    
    /**
     * @var RateLimitService Rate limiting service instance
     */
    private $rateLimitService;
    
    /**
     * @var ValidationService Validation service instance
     */
    private $validationService;
    
    /**
     * @var ProductService Product service instance
     */
    private $productService;
    
    /**
     * @var PriceService Price service instance
     */
    private $priceService;
    
    /**
     * Initialize error handler
     */
    private function initErrorHandler() {
        if ($this->errorHandler === null) {
            require_once(DIR_CATALOG . 'model/extension/pricepilot/ErrorHandlingService.php');
            $this->errorHandler = new ErrorHandlingService($this->registry);
        }
    }
    
    /**
     * Initialize all services
     */
    private function initServices() {
        $this->initErrorHandler();
        
        if ($this->authService === null) {
            require_once(DIR_CATALOG . 'model/extension/pricepilot/AuthenticationService.php');
            $this->authService = new AuthenticationService($this->registry);
        }
        
        if ($this->rateLimitService === null) {
            require_once(DIR_CATALOG . 'model/extension/pricepilot/RateLimitService.php');
            $this->rateLimitService = new RateLimitService($this->registry);
        }
        
        if ($this->validationService === null) {
            require_once(DIR_CATALOG . 'model/extension/pricepilot/ValidationService.php');
            $this->validationService = new ValidationService($this->registry);
        }
        
        if ($this->productService === null) {
            require_once(DIR_CATALOG . 'model/extension/pricepilot/ProductService.php');
            $this->productService = new ProductService($this->registry);
        }
        
        if ($this->priceService === null) {
            require_once(DIR_CATALOG . 'model/extension/pricepilot/PriceService.php');
            $this->priceService = new PriceService($this->registry);
        }
    }
    
    /**
     * Authenticate request
     * Checks token and IP whitelist
     * 
     * @return bool True if authenticated, false otherwise (response already sent)
     */
    private function authenticate(): bool {
        // Get token from request
        $token = isset($this->request->get['api_token']) ? $this->request->get['api_token'] : '';
        
        // Get client IP
        $ip = $this->getClientIp();
        
        // Authenticate using AuthenticationService
        $authResult = $this->authService->authenticate($token, $ip);
        
        if (!$authResult['valid']) {
            $this->errorHandler->sendAuthenticationError($authResult['error']);
            return false;
        }
        
        return true;
    }
    
    /**
     * Check rate limit
     * 
     * @param string $endpoint Endpoint being accessed
     * @return bool True if allowed, false if rate limited (response already sent)
     */
    private function checkRateLimit(string $endpoint): bool {
        $ip = $this->getClientIp();
        
        // Check rate limit
        $rateLimitResult = $this->rateLimitService->checkLimit($ip, $endpoint);
        
        if (!$rateLimitResult['allowed']) {
            // Send 429 Too Many Requests with Retry-After header
            $this->response->addHeader('Retry-After: ' . $rateLimitResult['retry_after']);
            $this->errorHandler->sendRateLimitError($rateLimitResult['retry_after']);
            return false;
        }
        
        // Record this request
        $this->rateLimitService->recordRequest($ip, $endpoint);
        
        return true;
    }
    
    /**
     * Get client IP address
     * 
     * @return string Client IP address
     */
    private function getClientIp(): string {
        // Check for IP in various headers (proxy support)
        if (!empty($this->request->server['HTTP_X_FORWARDED_FOR'])) {
            $ips = explode(',', $this->request->server['HTTP_X_FORWARDED_FOR']);
            return trim($ips[0]);
        }
        
        if (!empty($this->request->server['HTTP_X_REAL_IP'])) {
            return $this->request->server['HTTP_X_REAL_IP'];
        }
        
        return $this->request->server['REMOTE_ADDR'] ?? '0.0.0.0';
    }
    
    public function index() {
        $this->load->language('api/pricepilot');
        $this->initServices();
        
        // Start timing for API logging
        $startTime = microtime(true);
        $endpoint = '/api/pricepilot/products';

        // Authenticate request
        if (!$this->authenticate()) {
            return;
        }
        
        // Check rate limit
        if (!$this->checkRateLimit($endpoint)) {
            return;
        }

        // Get pagination parameters
        $start = isset($this->request->get['start']) ? (int)$this->request->get['start'] : 0;
        $limit = isset($this->request->get['limit']) ? (int)$this->request->get['limit'] : 100;
        
        // Validate pagination parameters
        if ($start < 0) {
            $start = 0;
        }
        if ($limit < 1 || $limit > 1000) {
            $limit = 100;
        }
        
        // Get filters from request
        $filters = [];
        
        if (isset($this->request->get['sku'])) {
            $filters['sku'] = $this->request->get['sku'];
        }
        
        if (isset($this->request->get['category_id'])) {
            $filters['category_id'] = (int)$this->request->get['category_id'];
        }
        
        if (isset($this->request->get['manufacturer_id'])) {
            $filters['manufacturer_id'] = (int)$this->request->get['manufacturer_id'];
        }
        
        if (isset($this->request->get['status'])) {
            $filters['status'] = (int)$this->request->get['status'];
        }
        
        if (isset($this->request->get['store_id'])) {
            $filters['store_id'] = (int)$this->request->get['store_id'];
        }
        
        if (isset($this->request->get['name'])) {
            $filters['name'] = $this->request->get['name'];
        }
        
        // Get products using ProductService
        $result = $this->productService->getProducts($filters, $start, $limit);
        
        // Build response
        $json = [
            'products' => $result['products'],
            'total' => $result['total'],
            'start' => $start,
            'limit' => $limit
        ];
        
        // Calculate response time
        $responseTime = microtime(true) - $startTime;
        
        // Log API request (would be done by LoggingService in production)
        // For now, we'll skip this as LoggingService is not yet implemented
        
        $this->errorHandler->sendSuccessResponse($json);
    }

    public function update() {
        $this->initServices();
        
        // Start timing for API logging
        $startTime = microtime(true);
        $endpoint = '/api/pricepilot/update';

        // Authenticate request
        if (!$this->authenticate()) {
            return;
        }
        
        // Check rate limit
        if (!$this->checkRateLimit($endpoint)) {
            return;
        }

        // Get and validate payload
        $payload = file_get_contents('php://input');
        
        // Validate payload size
        $sizeValidation = $this->validationService->validatePayloadSize($payload);
        if (!$sizeValidation['valid']) {
            $this->errorHandler->sendPayloadTooLargeError($sizeValidation['error']);
            return;
        }

        $post_data = json_decode($payload, true);

        // Check if JSON parsing was successful
        if ($post_data === null && json_last_error() !== JSON_ERROR_NONE) {
            $this->errorHandler->sendInvalidJsonError();
            return;
        }

        // Validate required parameters
        if (!isset($post_data['product_id'])) {
            $this->errorHandler->sendMissingParameterError('product_id');
            return;
        }

        if (!isset($post_data['price'])) {
            $this->errorHandler->sendMissingParameterError('price');
            return;
        }

        // Validate product_id
        $productIdValidation = $this->validationService->validateProductId($post_data['product_id']);
        if (!$productIdValidation['valid']) {
            $this->errorHandler->sendValidationError($productIdValidation['error'], array(
                'field' => 'product_id',
                'value' => $post_data['product_id']
            ));
            return;
        }

        // Validate price
        $priceValidation = $this->validationService->validatePrice($post_data['price']);
        if (!$priceValidation['valid']) {
            $this->errorHandler->sendValidationError($priceValidation['error'], array(
                'field' => 'price',
                'value' => $post_data['price']
            ));
            return;
        }

        // Use validated values
        $productId = $productIdValidation['value'];
        $price = $priceValidation['value'];
        
        // Get optional store_id
        $storeId = isset($post_data['store_id']) ? (int)$post_data['store_id'] : null;

        // Update price using PriceService
        $updateResult = $this->priceService->updatePrice($productId, $price, $storeId);
        
        if (!$updateResult['success']) {
            // Check if product not found
            if (strpos($updateResult['error'], 'not found') !== false) {
                $this->errorHandler->sendNotFoundError($updateResult['error']);
            } else {
                $this->errorHandler->sendInternalError($updateResult['error']);
            }
            return;
        }

        // Build success response
        $json = [
            'success' => true,
            'message' => 'Price updated successfully',
            'product_id' => $productId,
            'old_price' => $updateResult['old_price'],
            'new_price' => $price
        ];
        
        // Calculate response time
        $responseTime = microtime(true) - $startTime;
        
        // Log API request (would be done by LoggingService in production)
        // For now, we'll skip this as LoggingService is not yet implemented
        
        $this->errorHandler->sendSuccessResponse($json);
    }
    
    /**
     * Bulk update endpoint
     * Updates multiple product prices in a single request
     * 
     * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
     */
    public function bulkUpdate() {
        $this->initServices();
        
        // Start timing for API logging
        $startTime = microtime(true);
        $endpoint = '/api/pricepilot/bulk-update';

        // Authenticate request
        if (!$this->authenticate()) {
            return;
        }
        
        // Check rate limit
        if (!$this->checkRateLimit($endpoint)) {
            return;
        }

        // Get and validate payload
        $payload = file_get_contents('php://input');
        
        // Validate payload size
        $sizeValidation = $this->validationService->validatePayloadSize($payload);
        if (!$sizeValidation['valid']) {
            $this->errorHandler->sendPayloadTooLargeError($sizeValidation['error']);
            return;
        }

        $post_data = json_decode($payload, true);

        // Check if JSON parsing was successful
        if ($post_data === null && json_last_error() !== JSON_ERROR_NONE) {
            $this->errorHandler->sendInvalidJsonError();
            return;
        }

        // Validate required parameters
        if (!isset($post_data['products'])) {
            $this->errorHandler->sendMissingParameterError('products');
            return;
        }
        
        if (!is_array($post_data['products'])) {
            $this->errorHandler->sendValidationError('products parameter must be an array', array(
                'field' => 'products',
                'value' => gettype($post_data['products'])
            ));
            return;
        }

        // Validate bulk update array using ValidationService
        $bulkValidation = $this->validationService->validateBulkUpdate($post_data['products']);
        
        if (!$bulkValidation['valid']) {
            $this->errorHandler->sendValidationError('Bulk update validation failed', array(
                'errors' => $bulkValidation['errors']
            ));
            return;
        }
        
        // Get optional store_id
        $storeId = isset($post_data['store_id']) ? (int)$post_data['store_id'] : null;
        
        // Process bulk update using PriceService
        $bulkResult = $this->priceService->bulkUpdatePrices($bulkValidation['products'], $storeId);
        
        // Build response
        $json = [
            'success' => true,
            'success_count' => $bulkResult['success_count'],
            'failure_count' => $bulkResult['failure_count'],
            'failures' => $bulkResult['failures']
        ];
        
        // If queued, include job_id
        if (isset($bulkResult['job_id'])) {
            $json['job_id'] = $bulkResult['job_id'];
            $json['message'] = 'Bulk update queued for background processing';
        } else {
            $json['message'] = 'Bulk update completed';
        }
        
        // Calculate response time
        $responseTime = microtime(true) - $startTime;
        
        // Log API request (would be done by LoggingService in production)
        // For now, we'll skip this as LoggingService is not yet implemented
        
        $this->errorHandler->sendSuccessResponse($json);
    }
    
    /**
     * Stock update endpoint
     * Updates product stock quantity
     * 
     * Requirements: 10.1, 10.2, 10.3, 10.4
     */
    public function stockUpdate() {
        $this->initServices();
        
        // Start timing for API logging
        $startTime = microtime(true);
        $endpoint = '/api/pricepilot/stock-update';

        // Authenticate request
        if (!$this->authenticate()) {
            return;
        }
        
        // Check rate limit
        if (!$this->checkRateLimit($endpoint)) {
            return;
        }

        // Get and validate payload
        $payload = file_get_contents('php://input');
        
        // Validate payload size
        $sizeValidation = $this->validationService->validatePayloadSize($payload);
        if (!$sizeValidation['valid']) {
            $this->errorHandler->sendPayloadTooLargeError($sizeValidation['error']);
            return;
        }

        $post_data = json_decode($payload, true);

        // Check if JSON parsing was successful
        if ($post_data === null && json_last_error() !== JSON_ERROR_NONE) {
            $this->errorHandler->sendInvalidJsonError();
            return;
        }

        // Validate required parameters
        if (!isset($post_data['product_id'])) {
            $this->errorHandler->sendMissingParameterError('product_id');
            return;
        }

        if (!isset($post_data['quantity'])) {
            $this->errorHandler->sendMissingParameterError('quantity');
            return;
        }

        // Validate product_id
        $productIdValidation = $this->validationService->validateProductId($post_data['product_id']);
        if (!$productIdValidation['valid']) {
            $this->errorHandler->sendValidationError($productIdValidation['error'], array(
                'field' => 'product_id',
                'value' => $post_data['product_id']
            ));
            return;
        }

        // Validate quantity (must be non-negative integer)
        $quantity = $post_data['quantity'];
        if (!is_numeric($quantity) || $quantity < 0 || $quantity != (int)$quantity) {
            $this->errorHandler->sendValidationError('Quantity must be a non-negative integer', array(
                'field' => 'quantity',
                'value' => $quantity
            ));
            return;
        }

        // Use validated values
        $productId = $productIdValidation['value'];
        $quantity = (int)$quantity;

        // Update stock using PriceService
        $updateResult = $this->priceService->updateStock($productId, $quantity);
        
        if (!$updateResult['success']) {
            // Check if product not found
            if (strpos($updateResult['error'], 'not found') !== false) {
                $this->errorHandler->sendNotFoundError($updateResult['error']);
            } else {
                $this->errorHandler->sendInternalError($updateResult['error']);
            }
            return;
        }

        // Build success response
        $json = [
            'success' => true,
            'message' => 'Stock updated successfully',
            'product_id' => $productId,
            'quantity' => $quantity,
            'out_of_stock' => ($quantity === 0)
        ];
        
        // Calculate response time
        $responseTime = microtime(true) - $startTime;
        
        // Log API request (would be done by LoggingService in production)
        // For now, we'll skip this as LoggingService is not yet implemented
        
        $this->errorHandler->sendSuccessResponse($json);
    }
}
