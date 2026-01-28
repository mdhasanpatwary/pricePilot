<?php
/**
 * PricePilot OpenCart Plugin Database Uninstaller
 * 
 * This script removes all PricePilot database tables.
 * 
 * ⚠️ WARNING: This will permanently delete all PricePilot data!
 * Make sure to backup your database before running this script.
 * 
 * Usage:
 * 1. Upload this file to your OpenCart root directory
 * 2. Access it via browser: http://yourstore.com/uninstall.php
 * 3. Confirm the uninstallation
 * 4. Delete this file after successful uninstallation
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

// Tables to drop
$tables = [
    'pricepilot_activity_log',
    'pricepilot_api_logs',
    'pricepilot_product_mapping',
    'pricepilot_webhooks',
    'pricepilot_queue',
    'pricepilot_price_backups'
];

// Check if confirmation is provided
$confirmed = isset($_GET['confirm']) && $_GET['confirm'] === 'yes';

echo "<!DOCTYPE html>
<html>
<head>
    <title>PricePilot Database Uninstaller</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        h1 { color: #d32f2f; }
        .success { color: green; padding: 10px; background: #e8f5e9; margin: 10px 0; border-radius: 4px; }
        .error { color: red; padding: 10px; background: #ffebee; margin: 10px 0; border-radius: 4px; }
        .warning { color: #f57c00; padding: 15px; background: #fff3e0; margin: 10px 0; border-radius: 4px; border-left: 4px solid #f57c00; }
        .info { color: #666; padding: 10px; background: #f5f5f5; margin: 10px 0; border-radius: 4px; }
        .table-list { padding: 10px; background: #fafafa; margin: 10px 0; border-radius: 4px; }
        .button { display: inline-block; padding: 12px 24px; margin: 10px 5px; text-decoration: none; border-radius: 4px; font-weight: bold; }
        .button-danger { background: #d32f2f; color: white; }
        .button-danger:hover { background: #b71c1c; }
        .button-safe { background: #757575; color: white; }
        .button-safe:hover { background: #616161; }
    </style>
</head>
<body>
    <h1>⚠️ PricePilot Database Uninstaller</h1>
";

if (!$confirmed) {
    // Show confirmation page
    echo "<div class='warning'>";
    echo "<h2>⚠️ WARNING: This action cannot be undone!</h2>";
    echo "<p>This script will permanently delete all PricePilot database tables and their data:</p>";
    echo "</div>";
    
    echo "<div class='table-list'>";
    echo "<h3>Tables to be deleted:</h3>";
    echo "<ul>";
    foreach ($tables as $table) {
        // Check if table exists
        $result = $db->query("SHOW TABLES LIKE '{$table}'");
        $exists = $result && $result->num_rows > 0;
        
        if ($exists) {
            // Get row count
            $count_result = $db->query("SELECT COUNT(*) as count FROM {$table}");
            $count = $count_result ? $count_result->fetch_assoc()['count'] : 0;
            echo "<li><strong>{$table}</strong> - {$count} records</li>";
        } else {
            echo "<li><strong>{$table}</strong> - <em>does not exist</em></li>";
        }
    }
    echo "</ul>";
    echo "</div>";
    
    echo "<div class='warning'>";
    echo "<h3>Before proceeding:</h3>";
    echo "<ul>";
    echo "<li>✓ Backup your database</li>";
    echo "<li>✓ Export any data you need to keep</li>";
    echo "<li>✓ Ensure you have a way to restore if needed</li>";
    echo "</ul>";
    echo "</div>";
    
    echo "<div style='text-align: center; margin-top: 30px;'>";
    echo "<a href='?confirm=yes' class='button button-danger' onclick='return confirm(\"Are you absolutely sure? This will delete all PricePilot data!\");'>Yes, Delete All Tables</a>";
    echo "<a href='javascript:history.back()' class='button button-safe'>Cancel</a>";
    echo "</div>";
    
} else {
    // Perform uninstallation
    echo "<div class='info'>";
    echo "<h2>Uninstalling PricePilot Database Tables...</h2>";
    echo "</div>";
    
    $dropped = [];
    $errors = [];
    
    foreach ($tables as $table) {
        echo "<div class='info'>Dropping table: <strong>{$table}</strong>...</div>";
        
        if ($db->query("DROP TABLE IF EXISTS {$table}")) {
            $dropped[] = $table;
            echo "<div class='success'>✓ Successfully dropped: {$table}</div>";
        } else {
            $error = "Error dropping {$table}: " . $db->error;
            $errors[] = $error;
            echo "<div class='error'>✗ {$error}</div>";
        }
    }
    
    // Summary
    echo "<hr>";
    echo "<h2>Uninstallation Summary</h2>";
    echo "<div class='info'>";
    echo "<strong>Total tables:</strong> " . count($tables) . "<br>";
    echo "<strong>Successfully dropped:</strong> " . count($dropped) . "<br>";
    echo "<strong>Failed:</strong> " . count($errors) . "<br>";
    echo "</div>";
    
    if (count($errors) === 0) {
        echo "<div class='success'>";
        echo "<h3>✓ Uninstallation completed successfully!</h3>";
        echo "<p>All PricePilot database tables have been removed.</p>";
        echo "<p><strong>Next steps:</strong></p>";
        echo "<ul>";
        echo "<li>Delete this uninstall.php file from your server</li>";
        echo "<li>Remove the PricePilot plugin files if desired</li>";
        echo "<li>Clear the OpenCart modification cache</li>";
        echo "</ul>";
        echo "</div>";
        
        echo "<div class='warning'>";
        echo "<strong>⚠ Security Warning:</strong> Please delete this uninstall.php file immediately!";
        echo "</div>";
    } else {
        echo "<div class='error'>";
        echo "<h3>Uninstallation completed with errors</h3>";
        echo "<p>Some tables could not be dropped. Please check the errors above.</p>";
        echo "</div>";
    }
    
    // Verify tables were dropped
    echo "<hr>";
    echo "<h2>Verification</h2>";
    echo "<div class='info'>";
    
    $remaining = 0;
    foreach ($tables as $table) {
        $result = $db->query("SHOW TABLES LIKE '{$table}'");
        if ($result && $result->num_rows > 0) {
            echo "✗ Table <strong>{$table}</strong> still exists<br>";
            $remaining++;
        } else {
            echo "✓ Table <strong>{$table}</strong> removed<br>";
        }
    }
    
    if ($remaining === 0) {
        echo "<br><strong>All tables successfully removed!</strong>";
    } else {
        echo "<br><strong>Warning: {$remaining} table(s) still exist</strong>";
    }
    
    echo "</div>";
}

$db->close();

echo "</body></html>";
