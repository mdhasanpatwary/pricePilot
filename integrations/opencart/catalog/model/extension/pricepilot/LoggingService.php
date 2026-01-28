<?php
/**
 * PricePilot Logging Service
 * Path: catalog/model/extension/pricepilot/LoggingService.php
 * 
 * Comprehensive activity and API request logging service for audit trails,
 * monitoring, and debugging. Logs all price changes and API interactions
 * to dedicated database tables with filtering and statistics capabilities.
 * 
 * Features:
 * - Price change activity logging with product details
 * - API request/response logging with performance metrics
 * - Flexible filtering and pagination for log retrieval
 * - Statistics generation for dashboard displays
 * - Automatic log retention management
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 * 
 * @package PricePilot
 * @subpackage Services
 */

require_once __DIR__ . '/Service.php';

class LoggingService extends Service {
    
    /**
     * Log a price change to the activity log
     * 
     * Records all price changes with product details, old/new prices,
     * and the source of the change for audit trail purposes.
     * 
     * @param int $productId Product ID that was updated
     * @param float $oldPrice Previous price value
     * @param float $newPrice New price value
     * @param string $changedBy Source of change (API, Admin, System, etc.)
     * @param int|null $storeId Store ID (null for default store)
     * @return bool True if logged successfully, false otherwise
     */
    public function logPriceChange($productId, $oldPrice, $newPrice, $changedBy = 'API', $storeId = null) {
        try {
            // Get product name for the log entry
            $productName = $this->getProductName($productId);
            
            // Default to store 0 if not specified
            if ($storeId === null) {
                $storeId = 0;
            }
            
            // Prepare SQL with escaped values
            $sql = "INSERT INTO " . $this->getTableName('pricepilot_activity_log') . " 
                    (product_id, product_name, old_price, new_price, changed_by, store_id, date_added) 
                    VALUES (
                        " . (int)$productId . ",
                        '" . $this->escape($productName) . "',
                        " . (float)$oldPrice . ",
                        " . (float)$newPrice . ",
                        '" . $this->escape($changedBy) . "',
                        " . (int)$storeId . ",
                        '" . $this->getCurrentTimestamp() . "'
                    )";
            
            $this->query($sql);
            
            return true;
        } catch (Exception $e) {
            $this->logMessage("Failed to log price change for product {$productId}: " . $e->getMessage(), 'error');
            return false;
        }
    }
    
    /**
     * Log an API request with response details
     * 
     * Records all API requests including endpoint, method, IP address,
     * request payload, response code, and response time for monitoring
     * and debugging purposes.
     * 
     * @param string $endpoint API endpoint path (e.g., '/api/pricepilot/update')
     * @param string $method HTTP method (GET, POST, PUT, DELETE)
     * @param string $ip Client IP address
     * @param string|null $requestData Request payload (JSON or serialized)
     * @param int $responseCode HTTP response status code
     * @param float $responseTime Response time in seconds
     * @return bool True if logged successfully, false otherwise
     */
    public function logApiRequest($endpoint, $method, $ip, $requestData, $responseCode, $responseTime) {
        try {
            // Sanitize request data (limit size and remove sensitive info)
            $sanitizedData = $this->sanitizeRequestData($requestData);
            
            // Prepare SQL with escaped values
            $sql = "INSERT INTO " . $this->getTableName('pricepilot_api_logs') . " 
                    (endpoint, method, ip_address, request_data, response_code, response_time, date_added) 
                    VALUES (
                        '" . $this->escape($endpoint) . "',
                        '" . $this->escape($method) . "',
                        '" . $this->escape($ip) . "',
                        " . ($sanitizedData ? "'" . $this->escape($sanitizedData) . "'" : "NULL") . ",
                        " . (int)$responseCode . ",
                        " . (float)$responseTime . ",
                        '" . $this->getCurrentTimestamp() . "'
                    )";
            
            $this->query($sql);
            
            return true;
        } catch (Exception $e) {
            $this->logMessage("Failed to log API request to {$endpoint}: " . $e->getMessage(), 'error');
            return false;
        }
    }
    
    /**
     * Get activity log entries with filtering and pagination
     * 
     * Retrieves price change history with support for filtering by
     * date range, product ID, change source, and store ID.
     * 
     * @param array $filters Filter criteria:
     *   - 'product_id' (int): Filter by specific product
     *   - 'date_from' (string): Start date (Y-m-d format)
     *   - 'date_to' (string): End date (Y-m-d format)
     *   - 'changed_by' (string): Filter by change source
     *   - 'store_id' (int): Filter by store
     * @param int $start Pagination offset (default: 0)
     * @param int $limit Number of records to return (default: 50)
     * @return array ['logs' => array, 'total' => int]
     */
    public function getActivityLog($filters = [], $start = 0, $limit = 50) {
        try {
            // Build WHERE clause from filters
            $where = [];
            
            if (!empty($filters['product_id'])) {
                $where[] = "product_id = " . (int)$filters['product_id'];
            }
            
            if (!empty($filters['date_from'])) {
                $where[] = "DATE(date_added) >= '" . $this->escape($filters['date_from']) . "'";
            }
            
            if (!empty($filters['date_to'])) {
                $where[] = "DATE(date_added) <= '" . $this->escape($filters['date_to']) . "'";
            }
            
            if (!empty($filters['changed_by'])) {
                $where[] = "changed_by = '" . $this->escape($filters['changed_by']) . "'";
            }
            
            if (isset($filters['store_id'])) {
                $where[] = "store_id = " . (int)$filters['store_id'];
            }
            
            $whereClause = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";
            
            // Get total count
            $countSql = "SELECT COUNT(*) as total 
                        FROM " . $this->getTableName('pricepilot_activity_log') . " 
                        {$whereClause}";
            
            $countResult = $this->query($countSql);
            $total = (int)$countResult->row['total'];
            
            // Get log entries
            $sql = "SELECT * 
                    FROM " . $this->getTableName('pricepilot_activity_log') . " 
                    {$whereClause}
                    ORDER BY date_added DESC 
                    LIMIT " . (int)$start . ", " . (int)$limit;
            
            $result = $this->query($sql);
            
            return [
                'logs' => $result->rows,
                'total' => $total
            ];
        } catch (Exception $e) {
            $this->logMessage("Failed to retrieve activity log: " . $e->getMessage(), 'error');
            return [
                'logs' => [],
                'total' => 0
            ];
        }
    }
    
    /**
     * Get API usage statistics for dashboard
     * 
     * Calculates statistics including request counts, average response times,
     * error rates, and endpoint usage for the specified time period.
     * 
     * @param string $period Time period ('today', 'week', 'month', 'all')
     * @return array Statistics data:
     *   - 'total_requests' (int): Total number of requests
     *   - 'success_count' (int): Successful requests (2xx status)
     *   - 'error_count' (int): Failed requests (4xx, 5xx status)
     *   - 'avg_response_time' (float): Average response time in seconds
     *   - 'by_endpoint' (array): Request counts grouped by endpoint
     *   - 'by_status' (array): Request counts grouped by status code
     */
    public function getApiStatistics($period = 'today') {
        try {
            // Build date filter based on period
            $dateFilter = $this->getDateFilterForPeriod($period);
            
            // Get total requests
            $totalSql = "SELECT COUNT(*) as total 
                        FROM " . $this->getTableName('pricepilot_api_logs') . " 
                        {$dateFilter}";
            
            $totalResult = $this->query($totalSql);
            $totalRequests = (int)$totalResult->row['total'];
            
            // Get success/error counts
            $statusSql = "SELECT 
                            SUM(CASE WHEN response_code >= 200 AND response_code < 300 THEN 1 ELSE 0 END) as success_count,
                            SUM(CASE WHEN response_code >= 400 THEN 1 ELSE 0 END) as error_count
                        FROM " . $this->getTableName('pricepilot_api_logs') . " 
                        {$dateFilter}";
            
            $statusResult = $this->query($statusSql);
            $successCount = (int)$statusResult->row['success_count'];
            $errorCount = (int)$statusResult->row['error_count'];
            
            // Get average response time
            $avgTimeSql = "SELECT AVG(response_time) as avg_time 
                          FROM " . $this->getTableName('pricepilot_api_logs') . " 
                          {$dateFilter}";
            
            $avgTimeResult = $this->query($avgTimeSql);
            $avgResponseTime = (float)$avgTimeResult->row['avg_time'];
            
            // Get requests by endpoint
            $endpointSql = "SELECT endpoint, COUNT(*) as count 
                           FROM " . $this->getTableName('pricepilot_api_logs') . " 
                           {$dateFilter}
                           GROUP BY endpoint 
                           ORDER BY count DESC 
                           LIMIT 10";
            
            $endpointResult = $this->query($endpointSql);
            $byEndpoint = $endpointResult->rows;
            
            // Get requests by status code
            $statusCodeSql = "SELECT response_code, COUNT(*) as count 
                             FROM " . $this->getTableName('pricepilot_api_logs') . " 
                             {$dateFilter}
                             GROUP BY response_code 
                             ORDER BY count DESC";
            
            $statusCodeResult = $this->query($statusCodeSql);
            $byStatus = $statusCodeResult->rows;
            
            return [
                'total_requests' => $totalRequests,
                'success_count' => $successCount,
                'error_count' => $errorCount,
                'avg_response_time' => round($avgResponseTime, 4),
                'by_endpoint' => $byEndpoint,
                'by_status' => $byStatus
            ];
        } catch (Exception $e) {
            $this->logMessage("Failed to retrieve API statistics: " . $e->getMessage(), 'error');
            return [
                'total_requests' => 0,
                'success_count' => 0,
                'error_count' => 0,
                'avg_response_time' => 0,
                'by_endpoint' => [],
                'by_status' => []
            ];
        }
    }
    
    /**
     * Clean old log entries for retention management
     * 
     * Deletes log entries older than the specified number of days
     * to manage database size and comply with retention policies.
     * 
     * @param int $daysToKeep Number of days to retain logs (default: 90)
     * @return int Number of log entries deleted
     */
    public function cleanOldLogs($daysToKeep = 90) {
        try {
            $deletedCount = 0;
            
            // Clean activity logs
            $activitySql = "DELETE FROM " . $this->getTableName('pricepilot_activity_log') . " 
                           WHERE date_added < DATE_SUB(NOW(), INTERVAL " . (int)$daysToKeep . " DAY)";
            
            $this->query($activitySql);
            $deletedCount += $this->db->countAffected();
            
            // Clean API logs
            $apiSql = "DELETE FROM " . $this->getTableName('pricepilot_api_logs') . " 
                      WHERE date_added < DATE_SUB(NOW(), INTERVAL " . (int)$daysToKeep . " DAY)";
            
            $this->query($apiSql);
            $deletedCount += $this->db->countAffected();
            
            $this->logMessage("Cleaned {$deletedCount} old log entries (older than {$daysToKeep} days)", 'info');
            
            return $deletedCount;
        } catch (Exception $e) {
            $this->logMessage("Failed to clean old logs: " . $e->getMessage(), 'error');
            return 0;
        }
    }
    
    /**
     * Get product name by ID
     * 
     * @param int $productId Product ID
     * @return string Product name or 'Unknown Product' if not found
     */
    private function getProductName($productId) {
        try {
            $sql = "SELECT name 
                    FROM " . $this->getTableName('product_description') . " 
                    WHERE product_id = " . (int)$productId . " 
                    AND language_id = " . (int)$this->config->get('config_language_id') . " 
                    LIMIT 1";
            
            $result = $this->query($sql);
            
            if ($result->num_rows > 0) {
                return $result->row['name'];
            }
            
            return 'Unknown Product';
        } catch (Exception $e) {
            return 'Unknown Product';
        }
    }
    
    /**
     * Sanitize request data for logging
     * 
     * Removes sensitive information and limits size to prevent
     * excessive database storage.
     * 
     * @param string|null $requestData Raw request data
     * @return string|null Sanitized request data
     */
    private function sanitizeRequestData($requestData) {
        if ($requestData === null) {
            return null;
        }
        
        // Limit size to 10KB
        $maxSize = 10240;
        if (strlen($requestData) > $maxSize) {
            $requestData = substr($requestData, 0, $maxSize) . '... [truncated]';
        }
        
        // Remove sensitive fields if JSON
        $decoded = json_decode($requestData, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            // Remove sensitive fields
            $sensitiveFields = ['api_token', 'password', 'secret', 'token'];
            foreach ($sensitiveFields as $field) {
                if (isset($decoded[$field])) {
                    $decoded[$field] = '[REDACTED]';
                }
            }
            $requestData = json_encode($decoded);
        }
        
        return $requestData;
    }
    
    /**
     * Get date filter SQL clause for period
     * 
     * @param string $period Time period ('today', 'week', 'month', 'all')
     * @return string SQL WHERE clause for date filtering
     */
    private function getDateFilterForPeriod($period) {
        switch ($period) {
            case 'today':
                return "WHERE DATE(date_added) = CURDATE()";
            
            case 'week':
                return "WHERE date_added >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
            
            case 'month':
                return "WHERE date_added >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
            
            case 'all':
            default:
                return "";
        }
    }
}
