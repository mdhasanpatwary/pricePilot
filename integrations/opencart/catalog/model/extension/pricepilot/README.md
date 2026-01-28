# PricePilot Service Layer Architecture

## Overview

The PricePilot service layer provides a clean separation between business logic and controller code, following OpenCart's MVC pattern while adding a service-oriented architecture for better maintainability, testability, and code reuse.

## Architecture

### Base Service Class

All service classes extend the `Service` base class, which provides:

- **Dependency Injection**: Automatic injection of OpenCart registry and common dependencies
- **Database Access**: Simplified database query methods with error handling
- **Caching**: Built-in caching utilities with TTL support
- **Configuration**: Easy access to plugin configuration values
- **Logging**: Centralized logging with level support
- **Utility Methods**: Common operations like sanitization, validation, and transactions

### Directory Structure

```
catalog/model/extension/pricepilot/
├── Service.php                    # Base service class
├── ValidationService.php          # Input validation and sanitization
├── AuthenticationService.php      # Token validation and security
├── RateLimitService.php          # Request throttling
├── ProductService.php            # Product data operations
├── PriceService.php              # Price update operations
├── LoggingService.php            # Activity and API logging
├── WebhookService.php            # Event notifications
├── QueueService.php              # Background job processing
└── README.md                     # This file
```

## Creating a New Service

### Step 1: Create Service Class

Create a new PHP file in `catalog/model/extension/pricepilot/` that extends the `Service` base class:

```php
<?php
/**
 * Example Service
 * Path: catalog/model/extension/pricepilot/ExampleService.php
 */
class ExampleService extends Service {
    /**
     * Example method
     */
    public function doSomething($param) {
        // Access database
        $result = $this->query("SELECT * FROM " . $this->getTableName('product'));
        
        // Access cache
        $cached = $this->getCached('example_key', function() {
            return $this->computeExpensiveOperation();
        }, 300);
        
        // Access configuration
        $setting = $this->getConfig('module_pricepilot_setting', 'default');
        
        // Log message
        $this->logMessage('Operation completed', 'info');
        
        return $result;
    }
}
```

### Step 2: Load Service in Controller

In your controller, load the service using OpenCart's model loader:

```php
<?php
class ControllerApiPricepilot extends Controller {
    public function index() {
        // Load the service
        $this->load->model('extension/pricepilot/ExampleService');
        
        // Access the service (OpenCart converts path to property name)
        $result = $this->model_extension_pricepilot_exampleservice->doSomething($param);
    }
}
```

## Dependency Injection Pattern

The service layer uses constructor-based dependency injection through OpenCart's registry:

```php
// Service receives registry in constructor
public function __construct($registry) {
    $this->registry = $registry;
    $this->db = $registry->get('db');
    $this->cache = $registry->get('cache');
    // ... other dependencies
}
```

This pattern provides:

1. **Testability**: Services can be tested with mock dependencies
2. **Flexibility**: Dependencies can be swapped without changing service code
3. **Clarity**: All dependencies are explicit and documented
4. **Reusability**: Services can be used across controllers and other services

## Available Base Methods

### Database Operations

```php
// Execute query with error handling
$result = $this->query("SELECT * FROM " . $this->getTableName('product'));

// Escape values for queries
$safe = $this->escape($userInput);

// Transactions
$this->beginTransaction();
try {
    // ... operations
    $this->commit();
} catch (Exception $e) {
    $this->rollback();
    throw $e;
}
```

### Caching

```php
// Get cached value or compute and cache
$value = $this->getCached('cache_key', function() {
    return $this->expensiveOperation();
}, 300); // TTL in seconds

// Invalidate cache
$this->invalidateCache('cache_key');
```

### Configuration

```php
// Get config value with default
$token = $this->getConfig('module_pricepilot_token', null);
$limit = $this->getConfig('module_pricepilot_rate_limit', 100);
```

### Logging

```php
// Log messages with level
$this->logMessage('Operation started', 'info');
$this->logMessage('Warning condition', 'warning');
$this->logMessage('Error occurred', 'error');
```

### Utilities

```php
// Sanitize input
$id = $this->sanitize($input, 'int');
$price = $this->sanitize($input, 'float');
$name = $this->sanitize($input, 'string');

// Check if empty
if ($this->isEmpty($value)) {
    // Handle empty value
}

// Get current timestamp
$now = $this->getCurrentTimestamp(); // Y-m-d H:i:s format

// Get table name with prefix
$table = $this->getTableName('product'); // Returns DB_PREFIX . 'product'
```

## Service Communication

Services can call other services by loading them:

```php
class PriceService extends Service {
    public function updatePrice($productId, $price) {
        // Load validation service
        $this->loadModel('extension/pricepilot/ValidationService');
        $validator = $this->model_extension_pricepilot_validationservice;
        
        // Validate input
        $validation = $validator->validatePrice($price);
        if (!$validation['valid']) {
            return ['error' => $validation['error']];
        }
        
        // Load logging service
        $this->loadModel('extension/pricepilot/LoggingService');
        $logger = $this->model_extension_pricepilot_loggingservice;
        
        // Update price
        // ...
        
        // Log change
        $logger->logPriceChange($productId, $oldPrice, $price, 'API');
        
        return ['success' => true];
    }
}
```

## Best Practices

1. **Single Responsibility**: Each service should handle one domain of functionality
2. **Dependency Injection**: Use constructor injection for all dependencies
3. **Error Handling**: Always handle exceptions and log errors
4. **Validation**: Validate all inputs before processing
5. **Transactions**: Use transactions for multi-step database operations
6. **Caching**: Cache expensive operations with appropriate TTL
7. **Logging**: Log important operations and errors for debugging
8. **Documentation**: Document all public methods with PHPDoc comments
9. **Type Safety**: Use type hints and return type declarations where possible
10. **Testing**: Write unit tests for all service methods

## Testing Services

Services can be tested by mocking the registry and dependencies:

```php
// Create mock registry
$registry = $this->createMock(Registry::class);
$db = $this->createMock(DB::class);
$cache = $this->createMock(Cache::class);

$registry->method('get')
    ->willReturnMap([
        ['db', $db],
        ['cache', $cache],
    ]);

// Create service with mock dependencies
$service = new ExampleService($registry);

// Test service methods
$result = $service->doSomething($param);
$this->assertEquals($expected, $result);
```

## Migration from Controller Logic

When refactoring existing controller code to use services:

1. Identify business logic in controllers
2. Create appropriate service class
3. Move business logic to service methods
4. Update controller to load and call service
5. Add proper error handling and logging
6. Write tests for service methods

### Before (Controller with Business Logic)

```php
class ControllerApiPricepilot extends Controller {
    public function update() {
        // Business logic mixed with controller code
        $post_data = json_decode(file_get_contents('php://input'), true);
        $this->db->query("UPDATE " . DB_PREFIX . "product SET price = '" . (float)$post_data['price'] . "'");
        $this->cache->delete('product');
    }
}
```

### After (Controller with Service)

```php
class ControllerApiPricepilot extends Controller {
    public function update() {
        // Load service
        $this->load->model('extension/pricepilot/PriceService');
        
        // Call service method
        $post_data = json_decode(file_get_contents('php://input'), true);
        $result = $this->model_extension_pricepilot_priceservice->updatePrice(
            $post_data['product_id'],
            $post_data['price']
        );
        
        // Handle result
        if ($result['success']) {
            $json['success'] = 'Price updated successfully';
        } else {
            $json['error'] = $result['error'];
        }
    }
}
```

## Requirements Satisfied

This service layer architecture satisfies the following requirements:

- **Requirement 26.1**: Business logic separated from controller classes into service classes
- **Requirement 26.2**: Follows OpenCart coding standards and conventions
- **Requirement 26.3**: Uses dependency injection pattern
- **Requirement 26.4**: Includes inline documentation for all public methods
- **Requirement 26.5**: Organized into logical namespaces and directories

## Next Steps

1. Implement ValidationService for input validation (Task 2)
2. Implement AuthenticationService for token handling (Task 3)
3. Implement RateLimitService for request throttling (Task 5)
4. Implement ProductService for data retrieval (Task 10)
5. Implement PriceService for price operations (Task 11)
6. Implement LoggingService for activity logging (Task 8)
7. Implement WebhookService for event notifications (Task 13)
8. Implement QueueService for background processing (Task 14)
