<?php
/**
 * PricePilot Base Service Class
 * Path: catalog/model/extension/pricepilot/Service.php
 * 
 * Base class for all PricePilot service classes providing common dependencies
 * and utility methods. All service classes should extend this base class.
 * 
 * @property-read Registry $registry OpenCart registry object
 * @property-read DB\MySQLi $db Database connection
 * @property-read Cache $cache Cache system
 * @property-read Config $config Configuration system
 * @property-read Loader $load Model/language loader
 * @property-read Log $log Logging system
 * @property-read Request $request HTTP request object
 * @property-read Response $response HTTP response object
 */
abstract class Service {
    /**
     * @var Registry OpenCart registry containing all system dependencies
     */
    protected $registry;
    
    /**
     * @var DB\MySQLi Database connection instance
     */
    protected $db;
    
    /**
     * @var Cache Cache system instance
     */
    protected $cache;
    
    /**
     * @var Config Configuration system instance
     */
    protected $config;
    
    /**
     * @var Loader Model and language loader instance
     */
    protected $load;
    
    /**
     * @var Log Logging system instance
     */
    protected $log;
    
    /**
     * @var Request HTTP request object
     */
    protected $request;
    
    /**
     * @var Response HTTP response object
     */
    protected $response;
    
    /**
     * Constructor - Initializes service with OpenCart registry
     * 
     * @param Registry $registry OpenCart registry object containing all dependencies
     */
    public function __construct($registry) {
        $this->registry = $registry;
        $this->db = $registry->get('db');
        $this->cache = $registry->get('cache');
        $this->config = $registry->get('config');
        $this->load = $registry->get('load');
        $this->log = $registry->get('log');
        $this->request = $registry->get('request');
        $this->response = $registry->get('response');
    }
    
    /**
     * Magic getter for accessing registry properties
     * Allows accessing any registry property via $this->propertyName
     * 
     * @param string $key Property name to retrieve from registry
     * @return mixed Property value from registry
     */
    public function __get($key) {
        return $this->registry->get($key);
    }
    
    /**
     * Get configuration value with optional default
     * 
     * @param string $key Configuration key (e.g., 'module_pricepilot_token')
     * @param mixed $default Default value if key not found
     * @return mixed Configuration value or default
     */
    protected function getConfig($key, $default = null) {
        $value = $this->config->get($key);
        return ($value !== null) ? $value : $default;
    }
    
    /**
     * Get cached value or execute callback and cache result
     * 
     * @param string $key Cache key
     * @param callable $callback Function to execute if cache miss
     * @param int $ttl Time to live in seconds (default: 300 = 5 minutes)
     * @return mixed Cached or computed value
     */
    protected function getCached($key, callable $callback, $ttl = 300) {
        $cached = $this->cache->get($key);
        
        if ($cached !== null && $cached !== false) {
            return $cached;
        }
        
        $value = $callback();
        $this->cache->set($key, $value, $ttl);
        
        return $value;
    }
    
    /**
     * Invalidate cache by key or pattern
     * 
     * @param string $key Cache key to delete
     * @return void
     */
    protected function invalidateCache($key) {
        $this->cache->delete($key);
    }
    
    /**
     * Execute database query with error handling
     * 
     * @param string $sql SQL query to execute
     * @return \stdClass Query result object
     * @throws Exception If query fails
     */
    protected function query($sql) {
        try {
            return $this->db->query($sql);
        } catch (Exception $e) {
            $this->log->write('PricePilot Service Query Error: ' . $e->getMessage());
            throw $e;
        }
    }
    
    /**
     * Escape string for database query
     * 
     * @param string $value Value to escape
     * @return string Escaped value
     */
    protected function escape($value) {
        return $this->db->escape($value);
    }
    
    /**
     * Log message to system log
     * 
     * @param string $message Log message
     * @param string $level Log level (info, warning, error)
     * @return void
     */
    protected function logMessage($message, $level = 'info') {
        $prefix = strtoupper($level);
        $this->log->write("[PricePilot {$prefix}] {$message}");
    }
    
    /**
     * Load OpenCart model
     * 
     * @param string $model Model path (e.g., 'catalog/product')
     * @return void
     */
    protected function loadModel($model) {
        $this->load->model($model);
    }
    
    /**
     * Get current timestamp in MySQL format
     * 
     * @return string Current timestamp (Y-m-d H:i:s)
     */
    protected function getCurrentTimestamp() {
        return date('Y-m-d H:i:s');
    }
    
    /**
     * Get database table name with prefix
     * 
     * @param string $table Table name without prefix
     * @return string Table name with DB_PREFIX
     */
    protected function getTableName($table) {
        return DB_PREFIX . $table;
    }
    
    /**
     * Begin database transaction
     * 
     * @return void
     */
    protected function beginTransaction() {
        $this->db->query("START TRANSACTION");
    }
    
    /**
     * Commit database transaction
     * 
     * @return void
     */
    protected function commit() {
        $this->db->query("COMMIT");
    }
    
    /**
     * Rollback database transaction
     * 
     * @return void
     */
    protected function rollback() {
        $this->db->query("ROLLBACK");
    }
    
    /**
     * Check if a value is empty (null, empty string, or empty array)
     * 
     * @param mixed $value Value to check
     * @return bool True if empty, false otherwise
     */
    protected function isEmpty($value) {
        return $value === null || $value === '' || (is_array($value) && empty($value));
    }
    
    /**
     * Sanitize input value
     * 
     * @param mixed $value Value to sanitize
     * @param string $type Expected type (string, int, float, bool)
     * @return mixed Sanitized value
     */
    protected function sanitize($value, $type = 'string') {
        switch ($type) {
            case 'int':
                return (int)$value;
            case 'float':
                return (float)$value;
            case 'bool':
                return (bool)$value;
            case 'string':
            default:
                return is_string($value) ? trim($value) : $value;
        }
    }
}
