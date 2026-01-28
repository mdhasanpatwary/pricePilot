<?php
/**
 * PricePilot OpenCart Plugin Database Installer
 * 
 * This script creates all required database tables for the PricePilot plugin.
 * It should be run once during plugin installation.
 * 
 * Usage:
 * 1. Upload this file to your OpenCart root directory
 * 2. Access it via browser: http://yourstore.com/install.php
 * 3. Delete this file after successful installation
 * 
 * Requirements: OpenCart 3.x or 4.x
 */

// Load OpenCart configuration
require_once('config.php');

// Database connection
$db = new mysqli(DB_HOSTNAME, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

if ($db->connect_error) {
    die("Database connection failed: " . $db->connect_error);
}

// Set charset
$db->set_charset('utf8mb4');

// Migration files directory
$sql_dir = __DIR__ . '/sql/';

// Get all SQL migration files
$migrations = glob($sql_dir . '*.sql');
sort($migrations); // Execute in order

$results = [];
$errors = [];

echo "<!DOCTYPE html>
<html>
<head>
    <title>PricePilot Database Installer</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        h1 { color: #333; }
        .success { color: green; padding: 10px; background: #e8f5e9; margin: 10px 0; border-radius: 4px; }
        .error { color: red; padding: 10px; background: #ffebee; margin: 10px 0; border-radius: 4px; }
        .info { color: #666; padding: 10px; background: #f5f5f5; margin: 10px 0; border-radius: 4px; }
        .migration { padding: 8px; margin: 5px 0; border-left: 3px solid #2196F3; background: #f9f9f9; }
        .warning { color: orange; padding: 10px; background: #fff3e0; margin: 10px 0; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>PricePilot Database Installer</h1>
";

if (empty($migrations)) {
    echo "<div class='error'>No migration files found in {$sql_dir}</div>";
} else {
    echo "<div class='info'>Found " . count($migrations) . " migration(s) to execute</div>";
    
    foreach ($migrations as $migration_file) {
        $filename = basename($migration_file);
        echo "<div class='migration'><strong>Executing:</strong> {$filename}</div>";
        
        // Read SQL file
        $sql = file_get_contents($migration_file);
        
        if ($sql === false) {
            $error = "Failed to read migration file: {$filename}";
            $errors[] = $error;
            echo "<div class='error'>{$error}</div>";
            continue;
        }
        
        // Replace DB_PREFIX placeholder if exists
        $sql = str_replace('{{DB_PREFIX}}', DB_PREFIX, $sql);
        
        // Execute SQL
        if ($db->multi_query($sql)) {
            do {
                // Store first result set
                if ($result = $db->store_result()) {
                    $result->free();
                }
            } while ($db->more_results() && $db->next_result());
            
            $results[] = $filename;
            echo "<div class='success'>✓ Successfully executed: {$filename}</div>";
        } else {
            $error = "Error executing {$filename}: " . $db->error;
            $errors[] = $error;
            echo "<div class='error'>✗ {$error}</div>";
        }
    }
}

// Summary
echo "<hr>";
echo "<h2>Installation Summary</h2>";
echo "<div class='info'>";
echo "<strong>Total migrations:</strong> " . count($migrations) . "<br>";
echo "<strong>Successful:</strong> " . count($results) . "<br>";
echo "<strong>Failed:</strong> " . count($errors) . "<br>";
echo "</div>";

if (count($errors) === 0) {
    echo "<div class='success'>";
    echo "<h3>✓ Installation completed successfully!</h3>";
    echo "<p>All database tables have been created. You can now:</p>";
    echo "<ul>";
    echo "<li>Delete this install.php file from your server</li>";
    echo "<li>Configure the PricePilot plugin in your OpenCart admin panel</li>";
    echo "<li>Start using the API endpoints</li>";
    echo "</ul>";
    echo "</div>";
    
    echo "<div class='warning'>";
    echo "<strong>⚠ Security Warning:</strong> Please delete this install.php file immediately after installation!";
    echo "</div>";
} else {
    echo "<div class='error'>";
    echo "<h3>Installation completed with errors</h3>";
    echo "<p>Some migrations failed. Please check the errors above and:</p>";
    echo "<ul>";
    echo "<li>Verify your database credentials in config.php</li>";
    echo "<li>Ensure your database user has CREATE TABLE permissions</li>";
    echo "<li>Check for any existing tables with the same names</li>";
    echo "<li>Review the SQL files for syntax errors</li>";
    echo "</ul>";
    echo "</div>";
}

// Verify tables were created
echo "<hr>";
echo "<h2>Database Verification</h2>";

$tables_to_check = [
    'pricepilot_activity_log',
    'pricepilot_api_logs',
    'pricepilot_product_mapping',
    'pricepilot_webhooks',
    'pricepilot_queue',
    'pricepilot_price_backups'
];

echo "<div class='info'>";
foreach ($tables_to_check as $table) {
    $result = $db->query("SHOW TABLES LIKE '{$table}'");
    if ($result && $result->num_rows > 0) {
        echo "✓ Table <strong>{$table}</strong> exists<br>";
    } else {
        echo "✗ Table <strong>{$table}</strong> NOT found<br>";
    }
}
echo "</div>";

$db->close();

echo "</body></html>";
