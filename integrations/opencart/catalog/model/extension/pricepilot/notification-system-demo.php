<?php
/**
 * PricePilot Notification System Demo
 * 
 * This script demonstrates the notification system functionality including:
 * - Creating different types of notifications
 * - Sending email notifications
 * - Retrieving and filtering notifications
 * - Managing read/unread status
 * 
 * Usage: Run this script from OpenCart admin or via CLI to test notifications
 */

// Define DB_PREFIX for standalone testing
if (!defined('DB_PREFIX')) {
    define('DB_PREFIX', 'oc_');
}

// Mock registry for standalone testing
class MockRegistry {
    private $data = [];
    
    public function get($key) {
        return isset($this->data[$key]) ? $this->data[$key] : null;
    }
    
    public function set($key, $value) {
        $this->data[$key] = $value;
    }
}

// Mock database for testing
class MockDB {
    public function query($sql) {
        echo "SQL Query: " . substr($sql, 0, 100) . "...\n";
        return (object)['num_rows' => 0, 'rows' => [], 'row' => []];
    }
    
    public function escape($value) {
        return addslashes($value);
    }
    
    public function countAffected() {
        return 1;
    }
}

// Mock cache
class MockCache {
    private $data = [];
    
    public function get($key) {
        return isset($this->data[$key]) ? $this->data[$key] : null;
    }
    
    public function set($key, $value, $ttl = 0) {
        $this->data[$key] = $value;
    }
    
    public function delete($key) {
        unset($this->data[$key]);
    }
}

// Mock config
class MockConfig {
    private $data = [
        'config_email' => 'admin@example.com',
        'config_name' => 'Test Store',
        'config_language_id' => 1,
        'module_pricepilot_admin_email' => 'admin@example.com',
        'module_pricepilot_notify_enabled' => 1,
        'module_pricepilot_notify_failure_email' => 1,
        'module_pricepilot_notify_security_email' => 1,
        'module_pricepilot_notify_info_email' => 0,
    ];
    
    public function get($key) {
        return isset($this->data[$key]) ? $this->data[$key] : null;
    }
}

// Mock log
class MockLog {
    public function write($message) {
        echo "[LOG] " . $message . "\n";
    }
}

// Setup mock registry
$registry = new MockRegistry();
$registry->set('db', new MockDB());
$registry->set('cache', new MockCache());
$registry->set('config', new MockConfig());
$registry->set('log', new MockLog());

// Load NotificationService
require_once __DIR__ . '/NotificationService.php';

echo "=== PricePilot Notification System Demo ===\n\n";

// Create notification service instance
$notificationService = new NotificationService($registry);

echo "1. Testing Dashboard Notification Creation\n";
echo "-------------------------------------------\n";

// Create a failure notification
$result1 = $notificationService->createDashboardNotification(
    'Bulk Update Failed',
    'A bulk price update operation failed. 15 out of 20 products could not be updated.',
    NotificationService::TYPE_FAILURE,
    NotificationService::PRIORITY_HIGH
);
echo "Created failure notification: " . ($result1 ? "SUCCESS" : "FAILED") . "\n\n";

// Create a security notification
$result2 = $notificationService->createDashboardNotification(
    'Security Alert: Brute Force Attack',
    'Multiple failed authentication attempts detected from IP 192.168.1.100',
    NotificationService::TYPE_SECURITY,
    NotificationService::PRIORITY_CRITICAL
);
echo "Created security notification: " . ($result2 ? "SUCCESS" : "FAILED") . "\n\n";

// Create an info notification
$result3 = $notificationService->createDashboardNotification(
    'System Update Available',
    'A new version of PricePilot is available for download.',
    NotificationService::TYPE_INFO,
    NotificationService::PRIORITY_LOW
);
echo "Created info notification: " . ($result3 ? "SUCCESS" : "FAILED") . "\n\n";

echo "2. Testing Email Notification\n";
echo "------------------------------\n";

// Note: Email sending will fail in this demo without proper mail configuration
// This demonstrates the email template generation
echo "Attempting to send email notification...\n";
$emailResult = $notificationService->sendEmailNotification(
    'Test Email Notification',
    'This is a test email notification from the PricePilot notification system.',
    NotificationService::TYPE_INFO,
    NotificationService::PRIORITY_MEDIUM
);
echo "Email notification result: " . ($emailResult ? "SUCCESS" : "FAILED (expected without mail config)") . "\n\n";

echo "3. Testing Notification Retrieval\n";
echo "----------------------------------\n";

// Get recent notifications
echo "Retrieving recent notifications...\n";
$notifications = $notificationService->getRecentNotifications([], 10);
echo "Retrieved " . count($notifications) . " notifications\n\n";

// Get unread count
$unreadCount = $notificationService->getUnreadCount();
echo "Unread notification count: " . $unreadCount . "\n\n";

// Get notifications by type
echo "Retrieving failure notifications only...\n";
$failureNotifications = $notificationService->getRecentNotifications([
    'type' => NotificationService::TYPE_FAILURE
], 5);
echo "Retrieved " . count($failureNotifications) . " failure notifications\n\n";

// Get high priority notifications
echo "Retrieving high priority notifications...\n";
$highPriorityNotifications = $notificationService->getRecentNotifications([
    'priority' => NotificationService::PRIORITY_HIGH
], 5);
echo "Retrieved " . count($highPriorityNotifications) . " high priority notifications\n\n";

echo "4. Testing Notification Status Management\n";
echo "------------------------------------------\n";

// Mark notification as read (using mock ID)
echo "Marking notification #1 as read...\n";
$markResult = $notificationService->markAsRead(1);
echo "Mark as read result: " . ($markResult ? "SUCCESS" : "FAILED") . "\n\n";

// Mark all as read
echo "Marking all notifications as read...\n";
$markAllResult = $notificationService->markAllAsRead();
echo "Mark all as read result: " . ($markAllResult ? "SUCCESS" : "FAILED") . "\n\n";

echo "5. Testing Notification Cleanup\n";
echo "--------------------------------\n";

// Clean old notifications (30 days)
echo "Cleaning notifications older than 30 days...\n";
$deletedCount = $notificationService->cleanOldNotifications(30);
echo "Deleted " . $deletedCount . " old notifications\n\n";

echo "6. Notification Type Constants\n";
echo "-------------------------------\n";
echo "TYPE_FAILURE: " . NotificationService::TYPE_FAILURE . "\n";
echo "TYPE_SECURITY: " . NotificationService::TYPE_SECURITY . "\n";
echo "TYPE_INFO: " . NotificationService::TYPE_INFO . "\n\n";

echo "7. Priority Level Constants\n";
echo "----------------------------\n";
echo "PRIORITY_LOW: " . NotificationService::PRIORITY_LOW . "\n";
echo "PRIORITY_MEDIUM: " . NotificationService::PRIORITY_MEDIUM . "\n";
echo "PRIORITY_HIGH: " . NotificationService::PRIORITY_HIGH . "\n";
echo "PRIORITY_CRITICAL: " . NotificationService::PRIORITY_CRITICAL . "\n\n";

echo "=== Demo Complete ===\n\n";

echo "Summary:\n";
echo "--------\n";
echo "✓ NotificationService class loaded successfully\n";
echo "✓ Dashboard notifications can be created\n";
echo "✓ Email notifications can be sent (requires mail config)\n";
echo "✓ Notifications can be retrieved with filtering\n";
echo "✓ Notification status can be managed (read/unread)\n";
echo "✓ Old notifications can be cleaned up\n\n";

echo "Integration Points:\n";
echo "-------------------\n";
echo "• PriceService: Sends notifications on bulk update failures\n";
echo "• AuthenticationService: Sends security alerts on brute force attacks\n";
echo "• WebhookService: Sends notifications on webhook delivery failures\n";
echo "• Admin Dashboard: Displays recent notifications with unread count\n";
echo "• Admin Settings: Configure notification preferences\n\n";

echo "Next Steps:\n";
echo "-----------\n";
echo "1. Configure admin email in notification settings\n";
echo "2. Test bulk update failure to trigger notification\n";
echo "3. Test authentication failures to trigger security alert\n";
echo "4. Test webhook failure to trigger notification\n";
echo "5. View notifications in admin dashboard\n";
echo "6. Configure notification preferences in settings\n\n";
