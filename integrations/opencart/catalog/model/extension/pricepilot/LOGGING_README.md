# LoggingService - Activity and API Request Logging

## Overview

The LoggingService provides comprehensive logging capabilities for the PricePilot OpenCart plugin. It records all price changes and API interactions to dedicated database tables, enabling audit trails, monitoring, debugging, and compliance with data retention policies.

## Quick Start

### Basic Usage

```php
// Initialize the service
$loggingService = new LoggingService($registry);

// Log a price change
$loggingService->logPriceChange(
    123,        // product_id
    99.99,      // old_price
    89.99,      // new_price
    'API',      // changed_by
    0           // store_id
);

// Log an API request
$startTime = microtime(true);
// ... process request ...
$responseTime = microtime(true) - $startTime;

$loggingService->logApiRequest(
    '/api/pricepilot/update',  // endpoint
    'POST',                     // method
    '192.168.1.1',             // ip
    json_encode($data),         // request_data
    200,                        // response_code
    $responseTime               // response_time
);
```

## Features

### 1. Price Change Logging

Records all price changes with complete audit trail:
- Product ID and name
- Old and new price values
- Source of change (API, Admin, System, etc.)
- Store ID for multi-store support
- Automatic timestamp

**Method:** `logPriceChange($productId, $oldPrice, $newPrice, $changedBy, $storeId)`

**Returns:** `bool` - True if logged successfully

### 2. API Request Logging

Logs all API endpoint accesses with performance metrics:
- Endpoint path and HTTP method
- Client IP address
- Request payload (sanitized)
- Response status code
- Response time in seconds

**Method:** `logApiRequest($endpoint, $method, $ip, $requestData, $responseCode, $responseTime)`

**Returns:** `bool` - True if logged successfully

**Security Features:**
- Automatically redacts sensitive fields (api_token, password, secret)
- Limits request data to 10KB to prevent storage abuse
- Sanitizes all input before logging

### 3. Activity Log Retrieval

Retrieve price change history with flexible filtering:

**Method:** `getActivityLog($filters, $start, $limit)`

**Parameters:**
- `$filters` (array): Filter criteria
  - `product_id` (int): Filter by specific product
  - `date_from` (string): Start date (Y-m-d format)
  - `date_to` (string): End date (Y-m-d format)
  - `changed_by` (string): Filter by change source
  - `store_id` (int): Filter by store
- `$start` (int): Pagination offset (default: 0)
- `$limit` (int): Number of records (default: 50)

**Returns:** `array` with keys:
- `logs` (array): Array of log entries
- `total` (int): Total count for pagination

**Example:**
```php
$result = $loggingService->getActivityLog([
    'product_id' => 123,
    'date_from' => '2024-01-01',
    'date_to' => '2024-01-31'
], 0, 50);

echo "Total: {$result['total']}\n";
foreach ($result['logs'] as $log) {
    echo "{$log['product_name']}: {$log['old_price']} → {$log['new_price']}\n";
}
```

### 4. API Statistics

Generate comprehensive statistics for dashboard displays:

**Method:** `getApiStatistics($period)`

**Parameters:**
- `$period` (string): Time period
  - `today`: Current day only
  - `week`: Last 7 days
  - `month`: Last 30 days
  - `all`: All time

**Returns:** `array` with keys:
- `total_requests` (int): Total number of requests
- `success_count` (int): Successful requests (2xx status)
- `error_count` (int): Failed requests (4xx, 5xx status)
- `avg_response_time` (float): Average response time in seconds
- `by_endpoint` (array): Top 10 endpoints by request count
- `by_status` (array): Request counts grouped by status code

**Example:**
```php
$stats = $loggingService->getApiStatistics('today');

echo "Total Requests: {$stats['total_requests']}\n";
echo "Success Rate: " . ($stats['success_count'] / $stats['total_requests'] * 100) . "%\n";
echo "Avg Response Time: {$stats['avg_response_time']}s\n";

foreach ($stats['by_endpoint'] as $endpoint) {
    echo "{$endpoint['endpoint']}: {$endpoint['count']} requests\n";
}
```

### 5. Log Retention Management

Automatically clean old log entries:

**Method:** `cleanOldLogs($daysToKeep)`

**Parameters:**
- `$daysToKeep` (int): Number of days to retain logs (default: 90)

**Returns:** `int` - Number of log entries deleted

**Example:**
```php
// Clean logs older than 90 days
$deletedCount = $loggingService->cleanOldLogs(90);
echo "Deleted {$deletedCount} old log entries\n";
```

**Recommended Schedule:**
- Run daily via cron job
- Default retention: 90 days
- Adjust based on compliance requirements

## Database Tables

### pricepilot_activity_log

Stores price change history:

| Column | Type | Description |
|--------|------|-------------|
| log_id | int(11) | Primary key |
| product_id | int(11) | Product that was updated |
| product_name | varchar(255) | Product name at time of change |
| old_price | decimal(15,4) | Previous price value |
| new_price | decimal(15,4) | New price value |
| changed_by | varchar(255) | Source of change (API, Admin, etc.) |
| store_id | int(11) | Store identifier |
| date_added | datetime | Timestamp of change |

**Indexes:**
- Primary key on `log_id`
- Index on `product_id`
- Index on `date_added`
- Index on `store_id`

### pricepilot_api_logs

Stores API request/response data:

| Column | Type | Description |
|--------|------|-------------|
| log_id | int(11) | Primary key |
| endpoint | varchar(255) | API endpoint path |
| method | varchar(10) | HTTP method (GET, POST, etc.) |
| ip_address | varchar(45) | Client IP address |
| request_data | text | Request payload (sanitized) |
| response_code | int(3) | HTTP status code |
| response_time | decimal(10,4) | Response time in seconds |
| date_added | datetime | Timestamp of request |

**Indexes:**
- Primary key on `log_id`
- Index on `date_added`
- Index on `ip_address`
- Index on `endpoint`

## Integration Examples

### API Controller Integration

```php
class ControllerApiPricepilot extends Controller {
    public function update() {
        $startTime = microtime(true);
        
        // Load logging service
        $this->load->model('extension/pricepilot/LoggingService');
        $loggingService = new LoggingService($this->registry);
        
        // Get old price before update
        $oldPrice = $this->getProductPrice($productId);
        
        // Update price
        $this->updateProductPrice($productId, $newPrice);
        
        // Log the price change
        $loggingService->logPriceChange(
            $productId,
            $oldPrice,
            $newPrice,
            'API',
            $storeId
        );
        
        // Calculate response time
        $responseTime = microtime(true) - $startTime;
        
        // Log the API request
        $loggingService->logApiRequest(
            $this->request->get['route'],
            $this->request->server['REQUEST_METHOD'],
            $this->request->server['REMOTE_ADDR'],
            file_get_contents('php://input'),
            200,
            $responseTime
        );
        
        // Send response
        $this->response->setOutput(json_encode(['success' => true]));
    }
}
```

### Admin Dashboard Integration

```php
class ControllerExtensionModulePricepilot extends Controller {
    public function dashboard() {
        // Load logging service
        $this->load->model('extension/pricepilot/LoggingService');
        $loggingService = new LoggingService($this->registry);
        
        // Get today's statistics
        $stats = $loggingService->getApiStatistics('today');
        $data['total_requests'] = $stats['total_requests'];
        $data['success_rate'] = $stats['success_count'] / $stats['total_requests'] * 100;
        $data['avg_response_time'] = $stats['avg_response_time'];
        
        // Get recent activity
        $activity = $loggingService->getActivityLog([], 0, 10);
        $data['recent_changes'] = $activity['logs'];
        
        // Load view
        $this->response->setOutput($this->load->view('extension/module/pricepilot_dashboard', $data));
    }
    
    public function activityLog() {
        // Load logging service
        $this->load->model('extension/pricepilot/LoggingService');
        $loggingService = new LoggingService($this->registry);
        
        // Get filters from request
        $filters = [
            'product_id' => $this->request->get['product_id'] ?? null,
            'date_from' => $this->request->get['date_from'] ?? null,
            'date_to' => $this->request->get['date_to'] ?? null,
            'changed_by' => $this->request->get['changed_by'] ?? null
        ];
        
        // Get pagination parameters
        $page = $this->request->get['page'] ?? 1;
        $limit = 50;
        $start = ($page - 1) * $limit;
        
        // Get activity log
        $result = $loggingService->getActivityLog($filters, $start, $limit);
        
        $data['logs'] = $result['logs'];
        $data['total'] = $result['total'];
        $data['page'] = $page;
        $data['total_pages'] = ceil($result['total'] / $limit);
        
        // Load view
        $this->response->setOutput($this->load->view('extension/module/pricepilot_activity_log', $data));
    }
}
```

### Cron Job for Log Cleanup

```php
// File: admin/controller/extension/module/pricepilot_cron.php
class ControllerExtensionModulePricepilotCron extends Controller {
    public function cleanLogs() {
        // Load logging service
        $this->load->model('extension/pricepilot/LoggingService');
        $loggingService = new LoggingService($this->registry);
        
        // Get retention period from config (default 90 days)
        $daysToKeep = $this->config->get('module_pricepilot_log_retention') ?? 90;
        
        // Clean old logs
        $deletedCount = $loggingService->cleanOldLogs($daysToKeep);
        
        // Log the cleanup
        $this->log->write("PricePilot: Cleaned {$deletedCount} old log entries");
    }
}
```

**Cron Configuration:**
```bash
# Run daily at 2 AM
0 2 * * * /usr/bin/php /path/to/opencart/admin/index.php?route=extension/module/pricepilot_cron/cleanLogs
```

## Security Considerations

### Sensitive Data Redaction

The service automatically redacts sensitive fields from logged request data:
- `api_token`
- `password`
- `secret`
- `token`

These fields are replaced with `[REDACTED]` in the logs.

### Request Data Size Limiting

Request payloads are truncated to 10KB to prevent:
- Excessive database storage
- Potential DoS attacks through large payloads
- Performance degradation

### SQL Injection Prevention

All database queries use proper escaping and parameterization to prevent SQL injection attacks.

## Performance Optimization

### Efficient Queries

- Uses indexed columns for filtering
- Implements pagination to limit result sets
- Aggregates statistics in single queries
- Avoids N+1 query problems

### Asynchronous Logging (Optional)

For high-traffic scenarios, consider:
- Queue log entries for background processing
- Batch insert multiple log entries
- Use separate database connection for logging

### Database Maintenance

Regular maintenance is essential:
- Run `cleanOldLogs()` daily via cron job
- Monitor table sizes and growth rates
- Optimize indexes periodically
- Archive old logs before deletion

## Troubleshooting

### Logs Not Being Created

1. Check database tables exist:
   ```sql
   SHOW TABLES LIKE 'oc_pricepilot_%';
   ```

2. Check table permissions:
   ```sql
   SHOW GRANTS FOR 'opencart_user'@'localhost';
   ```

3. Check OpenCart error log for database errors

### Slow Query Performance

1. Verify indexes exist:
   ```sql
   SHOW INDEX FROM oc_pricepilot_activity_log;
   SHOW INDEX FROM oc_pricepilot_api_logs;
   ```

2. Analyze query performance:
   ```sql
   EXPLAIN SELECT * FROM oc_pricepilot_activity_log WHERE product_id = 123;
   ```

3. Run log cleanup to reduce table size

### High Database Storage Usage

1. Check table sizes:
   ```sql
   SELECT 
       table_name,
       ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
   FROM information_schema.TABLES
   WHERE table_schema = 'opencart'
   AND table_name LIKE 'oc_pricepilot_%';
   ```

2. Reduce retention period
3. Run cleanup more frequently
4. Archive old logs before deletion

## Testing

### Unit Tests

Test each method with valid and invalid inputs:

```php
// Test price change logging
$result = $loggingService->logPriceChange(123, 99.99, 89.99, 'API', 0);
$this->assertTrue($result);

// Test activity log retrieval
$result = $loggingService->getActivityLog(['product_id' => 123], 0, 50);
$this->assertIsArray($result);
$this->assertArrayHasKey('logs', $result);
$this->assertArrayHasKey('total', $result);

// Test statistics generation
$stats = $loggingService->getApiStatistics('today');
$this->assertIsArray($stats);
$this->assertArrayHasKey('total_requests', $stats);
```

### Integration Tests

Test logging during actual operations:

```php
// Test logging during price update
$oldPrice = $this->getProductPrice(123);
$this->updateProductPrice(123, 89.99);
$loggingService->logPriceChange(123, $oldPrice, 89.99, 'API', 0);

// Verify log was created
$result = $loggingService->getActivityLog(['product_id' => 123], 0, 1);
$this->assertEquals(1, count($result['logs']));
$this->assertEquals(89.99, $result['logs'][0]['new_price']);
```

## Requirements Satisfied

- ✅ **Requirement 6.1**: Records endpoint path, HTTP method, and timestamp
- ✅ **Requirement 6.2**: Records client IP address and request payload
- ✅ **Requirement 6.3**: Records HTTP status code and response time
- ✅ **Requirement 6.4**: Records failed authentication attempts
- ✅ **Requirement 6.5**: Stores logs in pricepilot_api_logs table
- ✅ **Requirement 6.6**: Provides cleanup mechanism for old logs

## Related Documentation

- [Database Schema](DATABASE_SCHEMA.md)
- [Service Base Class](README.md)
- [API Controller Integration](../../controller/api/pricepilot.php)
- [Admin Dashboard](../../../../../admin/controller/extension/module/pricepilot.php)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review OpenCart error logs
3. Check database table structure
4. Verify service initialization
5. Test with demo script: `php logging-demo.php`
