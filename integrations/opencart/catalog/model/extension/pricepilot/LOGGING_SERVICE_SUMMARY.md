# LoggingService Implementation Summary

## Overview

The LoggingService provides comprehensive activity and API request logging capabilities for the PricePilot OpenCart plugin. It records all price changes and API interactions to dedicated database tables, enabling audit trails, monitoring, debugging, and compliance with data retention policies.

## Implementation Status

✅ **COMPLETED** - Task 8.1: Create LoggingService class

## Features Implemented

### 1. Price Change Logging (`logPriceChange`)
- Records all price changes with complete audit trail
- Captures old and new price values
- Tracks the source of change (API, Admin, System, etc.)
- Stores product name for easy reference
- Supports multi-store installations
- Automatic timestamp recording

**Usage Example:**
```php
$loggingService = new LoggingService($registry);
$loggingService->logPriceChange(
    123,        // product_id
    99.99,      // old_price
    89.99,      // new_price
    'API',      // changed_by
    0           // store_id
);
```

### 2. API Request Logging (`logApiRequest`)
- Logs all API endpoint accesses
- Records HTTP method and client IP address
- Captures request payload (sanitized)
- Tracks response status codes
- Measures response time for performance monitoring
- Automatic sensitive data redaction

**Usage Example:**
```php
$startTime = microtime(true);
// ... process API request ...
$responseTime = microtime(true) - $startTime;

$loggingService->logApiRequest(
    '/api/pricepilot/update',  // endpoint
    'POST',                     // method
    '192.168.1.1',             // ip
    json_encode($requestData),  // request_data
    200,                        // response_code
    $responseTime               // response_time
);
```

### 3. Activity Log Retrieval (`getActivityLog`)
- Flexible filtering by multiple criteria
- Pagination support for large datasets
- Returns total count for pagination UI
- Sorted by date (newest first)

**Supported Filters:**
- `product_id`: Filter by specific product
- `date_from`: Start date (Y-m-d format)
- `date_to`: End date (Y-m-d format)
- `changed_by`: Filter by change source
- `store_id`: Filter by store

**Usage Example:**
```php
$result = $loggingService->getActivityLog([
    'product_id' => 123,
    'date_from' => '2024-01-01',
    'date_to' => '2024-01-31',
    'changed_by' => 'API'
], 0, 50);

// Returns: ['logs' => [...], 'total' => 150]
```

### 4. API Statistics (`getApiStatistics`)
- Comprehensive statistics for dashboard displays
- Request counts and success/error rates
- Average response time calculation
- Top endpoints by request count
- Status code distribution

**Supported Periods:**
- `today`: Current day only
- `week`: Last 7 days
- `month`: Last 30 days
- `all`: All time

**Usage Example:**
```php
$stats = $loggingService->getApiStatistics('today');

// Returns:
// [
//   'total_requests' => 1500,
//   'success_count' => 1450,
//   'error_count' => 50,
//   'avg_response_time' => 0.0234,
//   'by_endpoint' => [...],
//   'by_status' => [...]
// ]
```

### 5. Log Retention Management (`cleanOldLogs`)
- Automatic cleanup of old log entries
- Configurable retention period
- Cleans both activity and API logs
- Returns count of deleted entries
- Logs cleanup operations

**Usage Example:**
```php
// Clean logs older than 90 days
$deletedCount = $loggingService->cleanOldLogs(90);
echo "Deleted {$deletedCount} old log entries";
```

## Database Tables

### pricepilot_activity_log
Stores price change history:
- `log_id`: Primary key
- `product_id`: Product that was updated
- `product_name`: Product name at time of change
- `old_price`: Previous price value
- `new_price`: New price value
- `changed_by`: Source of change (API, Admin, etc.)
- `store_id`: Store identifier
- `date_added`: Timestamp of change

**Indexes:**
- Primary key on `log_id`
- Index on `product_id` for product history queries
- Index on `date_added` for time-based queries
- Index on `store_id` for multi-store filtering

### pricepilot_api_logs
Stores API request/response data:
- `log_id`: Primary key
- `endpoint`: API endpoint path
- `method`: HTTP method (GET, POST, etc.)
- `ip_address`: Client IP address
- `request_data`: Request payload (sanitized)
- `response_code`: HTTP status code
- `response_time`: Response time in seconds
- `date_added`: Timestamp of request

**Indexes:**
- Primary key on `log_id`
- Index on `date_added` for time-based queries
- Index on `ip_address` for security analysis
- Index on `endpoint` for endpoint-specific queries

## Security Features

### 1. Sensitive Data Redaction
The service automatically redacts sensitive fields from logged request data:
- `api_token`
- `password`
- `secret`
- `token`

These fields are replaced with `[REDACTED]` in the logs.

### 2. Request Data Size Limiting
Request payloads are truncated to 10KB to prevent excessive database storage and potential DoS attacks through large payloads.

### 3. SQL Injection Prevention
All database queries use proper escaping and parameterization to prevent SQL injection attacks.

## Performance Considerations

### 1. Efficient Queries
- Uses indexed columns for filtering
- Implements pagination to limit result sets
- Aggregates statistics in single queries
- Avoids N+1 query problems

### 2. Asynchronous Logging
For high-traffic scenarios, consider implementing asynchronous logging:
- Queue log entries for background processing
- Batch insert multiple log entries
- Use separate database connection for logging

### 3. Database Maintenance
Regular maintenance is essential:
- Run `cleanOldLogs()` daily via cron job
- Monitor table sizes and growth rates
- Optimize indexes periodically
- Archive old logs before deletion

## Integration Points

### 1. API Controller Integration
```php
// In API controller
$loggingService = new LoggingService($this->registry);

// Log API request
$startTime = microtime(true);
// ... process request ...
$responseTime = microtime(true) - $startTime;

$loggingService->logApiRequest(
    $this->request->get['route'],
    $this->request->server['REQUEST_METHOD'],
    $this->request->server['REMOTE_ADDR'],
    file_get_contents('php://input'),
    $this->response->getStatusCode(),
    $responseTime
);
```

### 2. Price Service Integration
```php
// In PriceService
$loggingService = new LoggingService($this->registry);

// Before updating price
$oldPrice = $this->getProductPrice($productId);

// Update price
$this->updateProductPrice($productId, $newPrice);

// Log the change
$loggingService->logPriceChange(
    $productId,
    $oldPrice,
    $newPrice,
    'API',
    $storeId
);
```

### 3. Admin Dashboard Integration
```php
// In admin controller
$loggingService = new LoggingService($this->registry);

// Get today's statistics
$stats = $loggingService->getApiStatistics('today');
$data['total_requests'] = $stats['total_requests'];
$data['error_rate'] = $stats['error_count'] / $stats['total_requests'] * 100;

// Get recent activity
$activity = $loggingService->getActivityLog([], 0, 10);
$data['recent_changes'] = $activity['logs'];
```

## Error Handling

The service implements comprehensive error handling:

1. **Database Errors**: Caught and logged, returns safe defaults
2. **Invalid Input**: Sanitized and validated before use
3. **Missing Products**: Returns 'Unknown Product' for missing product names
4. **JSON Parsing Errors**: Handles malformed JSON gracefully

All errors are logged to OpenCart's system log with the prefix `[PricePilot ERROR]`.

## Testing Recommendations

### Unit Tests
- Test each method with valid inputs
- Test error handling with invalid inputs
- Test filtering logic with various combinations
- Test statistics calculations with sample data
- Test log cleanup with different retention periods

### Integration Tests
- Test logging during actual API requests
- Test activity log during price updates
- Test statistics accuracy with real data
- Test cleanup with large datasets

### Performance Tests
- Test with large log tables (100,000+ entries)
- Test concurrent logging from multiple requests
- Test query performance with various filters
- Test cleanup performance with old data

## Maintenance Schedule

### Daily
- Monitor log growth rates
- Check for logging errors in system log

### Weekly
- Review API statistics for anomalies
- Check for failed logging attempts

### Monthly
- Run `cleanOldLogs(90)` to remove old entries
- Analyze log table sizes
- Review and optimize queries if needed

### Quarterly
- Archive old logs before deletion
- Review retention policies
- Optimize database indexes

## Requirements Satisfied

This implementation satisfies the following requirements:

- ✅ **Requirement 6.1**: Records endpoint path, HTTP method, and timestamp
- ✅ **Requirement 6.2**: Records client IP address and request payload
- ✅ **Requirement 6.3**: Records HTTP status code and response time
- ✅ **Requirement 6.4**: Records failed authentication attempts
- ✅ **Requirement 6.5**: Stores logs in pricepilot_api_logs table
- ✅ **Requirement 6.6**: Provides cleanup mechanism for old logs

## Next Steps

1. **Create unit tests** for LoggingService (Task 8.2 - optional)
2. **Integrate with API Controller** to log all API requests
3. **Integrate with PriceService** to log price changes
4. **Create admin dashboard views** to display statistics
5. **Set up cron job** for automatic log cleanup
6. **Implement log export** functionality for compliance

## Files Created

1. `LoggingService.php` - Main service implementation
2. `LOGGING_SERVICE_SUMMARY.md` - This documentation file

## Dependencies

- Base `Service` class for common functionality
- OpenCart database connection
- OpenCart cache system
- OpenCart configuration system
- Database tables: `pricepilot_activity_log`, `pricepilot_api_logs`

## Version History

- **v1.0.0** (2024-01-28) - Initial implementation
  - All core methods implemented
  - Comprehensive error handling
  - Security features (data redaction, size limiting)
  - Documentation completed
