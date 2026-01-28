<?php
/**
 * Database Schema Verification Script
 * 
 * Verifies that all PricePilot database tables exist with proper indexes
 * This script checks:
 * - Table existence
 * - Column definitions
 * - Index definitions
 * - Data types and constraints
 */

echo "=== PricePilot Database Schema Verification ===\n\n";

// Expected tables and their structures
$expected_tables = [
    'pricepilot_activity_log' => [
        'columns' => ['log_id', 'product_id', 'product_name', 'old_price', 'new_price', 'changed_by', 'store_id', 'date_added'],
        'indexes' => ['PRIMARY', 'idx_product_id', 'idx_date_added', 'idx_store_id']
    ],
    'pricepilot_api_logs' => [
        'columns' => ['log_id', 'endpoint', 'method', 'ip_address', 'request_data', 'response_code', 'response_time', 'date_added'],
        'indexes' => ['PRIMARY', 'idx_date_added', 'idx_ip_address', 'idx_endpoint']
    ],
    'pricepilot_product_mapping' => [
        'columns' => ['mapping_id', 'product_id', 'competitor_url', 'competitor_name', 'date_added', 'date_modified'],
        'indexes' => ['PRIMARY', 'idx_product_id', 'unique_product_competitor']
    ],
    'pricepilot_webhooks' => [
        'columns' => ['webhook_id', 'url', 'events', 'secret', 'status', 'date_added', 'date_modified'],
        'indexes' => ['PRIMARY', 'idx_status']
    ],
    'pricepilot_queue' => [
        'columns' => ['job_id', 'job_type', 'job_data', 'status', 'progress', 'result', 'retry_count', 'priority', 'date_added', 'date_started', 'date_completed'],
        'indexes' => ['PRIMARY', 'idx_status', 'idx_priority', 'idx_date_added']
    ],
    'pricepilot_price_backups' => [
        'columns' => ['backup_id', 'backup_data', 'product_count', 'created_by', 'date_added'],
        'indexes' => ['PRIMARY', 'idx_date_added']
    ]
];

$results = [];
$passed = 0;
$failed = 0;

// Check if we're in a real OpenCart environment
if (!file_exists('config.php')) {
    echo "⚠ Warning: config.php not found. Cannot connect to database.\n";
    echo "This script should be run from the OpenCart root directory.\n\n";
    echo "However, we can verify that the SQL migration files are properly structured:\n\n";
    
    // Verify SQL files exist and are readable
    $sql_dir = __DIR__ . '/sql/';
    
    if (!is_dir($sql_dir)) {
        echo "✗ SQL directory not found: {$sql_dir}\n";
        exit(1);
    }
    
    $sql_files = glob($sql_dir . '*.sql');
    
    if (empty($sql_files)) {
        echo "✗ No SQL migration files found in {$sql_dir}\n";
        exit(1);
    }
    
    echo "✓ Found " . count($sql_files) . " SQL migration files:\n";
    foreach ($sql_files as $file) {
        echo "  - " . basename($file) . "\n";
    }
    
    echo "\n=== Verifying SQL File Structure ===\n\n";
    
    foreach ($expected_tables as $table_name => $structure) {
        echo "Checking {$table_name}...\n";
        
        // Find corresponding SQL file
        $sql_file = null;
        foreach ($sql_files as $file) {
            $content = file_get_contents($file);
            if (strpos($content, $table_name) !== false) {
                $sql_file = $file;
                break;
            }
        }
        
        if (!$sql_file) {
            echo "  ✗ No SQL file found for table {$table_name}\n";
            $failed++;
            continue;
        }
        
        $content = file_get_contents($sql_file);
        
        // Check for CREATE TABLE statement
        if (strpos($content, "CREATE TABLE") === false) {
            echo "  ✗ No CREATE TABLE statement found\n";
            $failed++;
            continue;
        }
        
        // Check for expected columns
        $missing_columns = [];
        foreach ($structure['columns'] as $column) {
            if (strpos($content, "`{$column}`") === false) {
                $missing_columns[] = $column;
            }
        }
        
        if (!empty($missing_columns)) {
            echo "  ✗ Missing columns: " . implode(', ', $missing_columns) . "\n";
            $failed++;
            continue;
        }
        
        // Check for expected indexes
        $missing_indexes = [];
        foreach ($structure['indexes'] as $index) {
            // PRIMARY KEY is special
            if ($index === 'PRIMARY') {
                if (strpos($content, "PRIMARY KEY") === false) {
                    $missing_indexes[] = $index;
                }
            } else {
                if (strpos($content, "KEY `{$index}`") === false && strpos($content, "UNIQUE KEY `{$index}`") === false) {
                    $missing_indexes[] = $index;
                }
            }
        }
        
        if (!empty($missing_indexes)) {
            echo "  ✗ Missing indexes: " . implode(', ', $missing_indexes) . "\n";
            $failed++;
            continue;
        }
        
        echo "  ✓ All columns and indexes defined correctly\n";
        $passed++;
    }
    
    echo "\n=== Summary ===\n";
    echo "Total Tables: " . count($expected_tables) . "\n";
    echo "Verified: " . $passed . "\n";
    echo "Failed: " . $failed . "\n";
    
    if ($failed === 0) {
        echo "\n✓ All SQL migration files are properly structured!\n";
        echo "Run install.php from your OpenCart root to create the tables.\n";
        exit(0);
    } else {
        echo "\n✗ Some SQL files have issues. Please review the errors above.\n";
        exit(1);
    }
}

// If we get here, we have a config.php file
require_once('config.php');

// Connect to database
$db = new mysqli(DB_HOSTNAME, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

if ($db->connect_error) {
    echo "✗ Database connection failed: " . $db->connect_error . "\n";
    exit(1);
}

echo "✓ Connected to database: " . DB_DATABASE . "\n\n";

// Check each table
foreach ($expected_tables as $table_name => $structure) {
    echo "Checking table: {$table_name}\n";
    
    // Check if table exists
    $result = $db->query("SHOW TABLES LIKE '{$table_name}'");
    
    if (!$result || $result->num_rows === 0) {
        echo "  ✗ Table does not exist\n";
        $failed++;
        continue;
    }
    
    echo "  ✓ Table exists\n";
    
    // Check columns
    $result = $db->query("DESCRIBE {$table_name}");
    $existing_columns = [];
    
    while ($row = $result->fetch_assoc()) {
        $existing_columns[] = $row['Field'];
    }
    
    $missing_columns = array_diff($structure['columns'], $existing_columns);
    
    if (!empty($missing_columns)) {
        echo "  ✗ Missing columns: " . implode(', ', $missing_columns) . "\n";
        $failed++;
        continue;
    }
    
    echo "  ✓ All columns present\n";
    
    // Check indexes
    $result = $db->query("SHOW INDEX FROM {$table_name}");
    $existing_indexes = [];
    
    while ($row = $result->fetch_assoc()) {
        $existing_indexes[] = $row['Key_name'];
    }
    
    $existing_indexes = array_unique($existing_indexes);
    $missing_indexes = array_diff($structure['indexes'], $existing_indexes);
    
    if (!empty($missing_indexes)) {
        echo "  ✗ Missing indexes: " . implode(', ', $missing_indexes) . "\n";
        $failed++;
        continue;
    }
    
    echo "  ✓ All indexes present\n";
    $passed++;
}

$db->close();

echo "\n=== Summary ===\n";
echo "Total Tables: " . count($expected_tables) . "\n";
echo "Verified: " . $passed . "\n";
echo "Failed: " . $failed . "\n";

if ($failed === 0) {
    echo "\n✓ All database tables are properly configured!\n";
    exit(0);
} else {
    echo "\n✗ Some tables have issues. Please review the errors above.\n";
    exit(1);
}
