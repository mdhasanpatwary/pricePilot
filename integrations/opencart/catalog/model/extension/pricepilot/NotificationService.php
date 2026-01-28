<?php
/**
 * PricePilot Notification Service
 * Path: catalog/model/extension/pricepilot/NotificationService.php
 * 
 * Admin notification system for alerting administrators about sync failures,
 * security events, and important system events. Supports both email notifications
 * and in-dashboard notifications with configurable notification types.
 * 
 * Features:
 * - Email notifications for critical events
 * - In-dashboard notification display
 * - Configurable notification types (failure, security, info)
 * - Notification history tracking
 * - Email template support
 * - Notification preferences management
 * 
 * Notification Types:
 * - failure: Bulk update failures, webhook delivery failures
 * - security: Authentication failures, suspicious activity
 * - info: General information, system updates
 * 
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5
 * 
 * @package PricePilot
 * @subpackage Services
 */

require_once __DIR__ . '/Service.php';

class NotificationService extends Service {
    
    /**
     * Notification types
     */
    const TYPE_FAILURE = 'failure';
    const TYPE_SECURITY = 'security';
    const TYPE_INFO = 'info';
    
    /**
     * Notification priorities
     */
    const PRIORITY_LOW = 1;
    const PRIORITY_MEDIUM = 2;
    const PRIORITY_HIGH = 3;
    const PRIORITY_CRITICAL = 4;
    
    /**
     * Send email notification to configured admin email
     * 
     * Sends an email notification to the administrator about important
     * events such as bulk update failures or security alerts.
     * 
     * @param string $subject Email subject line
     * @param string $message Email message body
     * @param string $type Notification type (failure, security, info)
     * @param int $priority Priority level (1-4)
     * @return bool True if email sent successfully, false otherwise
     */
    public function sendEmailNotification($subject, $message, $type = self::TYPE_INFO, $priority = self::PRIORITY_MEDIUM) {
        try {
            // Check if email notifications are enabled for this type
            if (!$this->isNotificationEnabled($type, 'email')) {
                $this->logMessage("Email notifications disabled for type: {$type}", 'info');
                return false;
            }
            
            // Get admin email from configuration
            $adminEmail = $this->getAdminEmail();
            
            if (empty($adminEmail)) {
                $this->logMessage("Admin email not configured, cannot send notification", 'warning');
                return false;
            }
            
            // Build email content with template
            $emailContent = $this->buildEmailTemplate($subject, $message, $type, $priority);
            
            // Load OpenCart mail class
            $mail = new Mail($this->config->get('config_mail_engine'));
            $mail->parameter = $this->config->get('config_mail_parameter');
            $mail->smtp_hostname = $this->config->get('config_mail_smtp_hostname');
            $mail->smtp_username = $this->config->get('config_mail_smtp_username');
            $mail->smtp_password = html_entity_decode($this->config->get('config_mail_smtp_password'), ENT_QUOTES, 'UTF-8');
            $mail->smtp_port = $this->config->get('config_mail_smtp_port');
            $mail->smtp_timeout = $this->config->get('config_mail_smtp_timeout');
            
            // Set email details
            $mail->setTo($adminEmail);
            $mail->setFrom($this->config->get('config_email'));
            $mail->setSender($this->config->get('config_name'));
            $mail->setSubject('[PricePilot] ' . $subject);
            $mail->setHtml($emailContent);
            
            // Send email
            $mail->send();
            
            $this->logMessage("Email notification sent to {$adminEmail}: {$subject}", 'info');
            
            // Also create dashboard notification
            $this->createDashboardNotification($subject, $message, $type, $priority);
            
            return true;
            
        } catch (Exception $e) {
            $this->logMessage("Failed to send email notification: " . $e->getMessage(), 'error');
            return false;
        }
    }
    
    /**
     * Create in-dashboard notification for admin panel
     * 
     * Creates a notification entry that will be displayed in the admin
     * dashboard for administrator review.
     * 
     * @param string $title Notification title
     * @param string $message Notification message
     * @param string $type Notification type (failure, security, info)
     * @param int $priority Priority level (1-4)
     * @return bool True if notification created successfully, false otherwise
     */
    public function createDashboardNotification($title, $message, $type = self::TYPE_INFO, $priority = self::PRIORITY_MEDIUM) {
        try {
            // Validate notification type
            if (!in_array($type, [self::TYPE_FAILURE, self::TYPE_SECURITY, self::TYPE_INFO])) {
                $type = self::TYPE_INFO;
            }
            
            // Validate priority
            if ($priority < self::PRIORITY_LOW || $priority > self::PRIORITY_CRITICAL) {
                $priority = self::PRIORITY_MEDIUM;
            }
            
            // Create notification table if it doesn't exist
            $this->ensureNotificationTableExists();
            
            // Insert notification
            $sql = "INSERT INTO " . $this->getTableName('pricepilot_notifications') . " 
                    (title, message, type, priority, is_read, date_added) 
                    VALUES (
                        '" . $this->escape($title) . "',
                        '" . $this->escape($message) . "',
                        '" . $this->escape($type) . "',
                        " . (int)$priority . ",
                        0,
                        '" . $this->getCurrentTimestamp() . "'
                    )";
            
            $this->query($sql);
            
            $this->logMessage("Dashboard notification created: {$title}", 'info');
            
            return true;
            
        } catch (Exception $e) {
            $this->logMessage("Failed to create dashboard notification: " . $e->getMessage(), 'error');
            return false;
        }
    }
    
    /**
     * Get recent notifications for dashboard display
     * 
     * Retrieves recent notifications with filtering by type, read status,
     * and priority for display in the admin dashboard.
     * 
     * @param array $filters Filter criteria:
     *   - 'type' (string): Filter by notification type
     *   - 'is_read' (bool): Filter by read status
     *   - 'priority' (int): Filter by minimum priority
     * @param int $limit Number of notifications to return (default: 10)
     * @return array Array of notification records
     */
    public function getRecentNotifications($filters = [], $limit = 10) {
        try {
            // Ensure table exists
            $this->ensureNotificationTableExists();
            
            // Build WHERE clause
            $where = [];
            
            if (!empty($filters['type'])) {
                $where[] = "type = '" . $this->escape($filters['type']) . "'";
            }
            
            if (isset($filters['is_read'])) {
                $where[] = "is_read = " . (int)$filters['is_read'];
            }
            
            if (!empty($filters['priority'])) {
                $where[] = "priority >= " . (int)$filters['priority'];
            }
            
            $whereClause = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";
            
            // Get notifications
            $sql = "SELECT * 
                    FROM " . $this->getTableName('pricepilot_notifications') . " 
                    {$whereClause}
                    ORDER BY priority DESC, date_added DESC 
                    LIMIT " . (int)$limit;
            
            $result = $this->query($sql);
            
            return $result->rows;
            
        } catch (Exception $e) {
            $this->logMessage("Failed to retrieve notifications: " . $e->getMessage(), 'error');
            return [];
        }
    }
    
    /**
     * Mark notification as read
     * 
     * @param int $notificationId Notification ID to mark as read
     * @return bool True if marked successfully, false otherwise
     */
    public function markAsRead($notificationId) {
        try {
            $sql = "UPDATE " . $this->getTableName('pricepilot_notifications') . " 
                    SET is_read = 1 
                    WHERE notification_id = " . (int)$notificationId;
            
            $this->query($sql);
            
            return true;
            
        } catch (Exception $e) {
            $this->logMessage("Failed to mark notification as read: " . $e->getMessage(), 'error');
            return false;
        }
    }
    
    /**
     * Mark all notifications as read
     * 
     * @return bool True if marked successfully, false otherwise
     */
    public function markAllAsRead() {
        try {
            $sql = "UPDATE " . $this->getTableName('pricepilot_notifications') . " 
                    SET is_read = 1 
                    WHERE is_read = 0";
            
            $this->query($sql);
            
            return true;
            
        } catch (Exception $e) {
            $this->logMessage("Failed to mark all notifications as read: " . $e->getMessage(), 'error');
            return false;
        }
    }
    
    /**
     * Get unread notification count
     * 
     * @return int Number of unread notifications
     */
    public function getUnreadCount() {
        try {
            $this->ensureNotificationTableExists();
            
            $sql = "SELECT COUNT(*) as count 
                    FROM " . $this->getTableName('pricepilot_notifications') . " 
                    WHERE is_read = 0";
            
            $result = $this->query($sql);
            
            return (int)$result->row['count'];
            
        } catch (Exception $e) {
            $this->logMessage("Failed to get unread count: " . $e->getMessage(), 'error');
            return 0;
        }
    }
    
    /**
     * Delete old notifications for retention management
     * 
     * @param int $daysToKeep Number of days to retain notifications (default: 30)
     * @return int Number of notifications deleted
     */
    public function cleanOldNotifications($daysToKeep = 30) {
        try {
            $sql = "DELETE FROM " . $this->getTableName('pricepilot_notifications') . " 
                    WHERE date_added < DATE_SUB(NOW(), INTERVAL " . (int)$daysToKeep . " DAY)";
            
            $this->query($sql);
            
            $deletedCount = $this->db->countAffected();
            
            $this->logMessage("Cleaned {$deletedCount} old notifications (older than {$daysToKeep} days)", 'info');
            
            return $deletedCount;
            
        } catch (Exception $e) {
            $this->logMessage("Failed to clean old notifications: " . $e->getMessage(), 'error');
            return 0;
        }
    }
    
    /**
     * Check if notification type is enabled
     * 
     * @param string $type Notification type
     * @param string $channel Notification channel (email, dashboard)
     * @return bool True if enabled, false otherwise
     */
    private function isNotificationEnabled($type, $channel = 'email') {
        // Get configuration key
        $configKey = "module_pricepilot_notify_{$type}_{$channel}";
        
        // Check if explicitly disabled
        $enabled = $this->getConfig($configKey, true);
        
        // Also check general notification setting
        $generalEnabled = $this->getConfig('module_pricepilot_notify_enabled', true);
        
        return $generalEnabled && $enabled;
    }
    
    /**
     * Get admin email from configuration
     * 
     * @return string|null Admin email address or null if not configured
     */
    private function getAdminEmail() {
        // Try PricePilot-specific admin email first
        $adminEmail = $this->getConfig('module_pricepilot_admin_email');
        
        // Fall back to store email
        if (empty($adminEmail)) {
            $adminEmail = $this->config->get('config_email');
        }
        
        return $adminEmail;
    }
    
    /**
     * Build email template with notification content
     * 
     * @param string $subject Email subject
     * @param string $message Email message
     * @param string $type Notification type
     * @param int $priority Priority level
     * @return string HTML email content
     */
    private function buildEmailTemplate($subject, $message, $type, $priority) {
        // Get store name
        $storeName = $this->config->get('config_name');
        
        // Determine priority label and color
        $priorityLabels = [
            self::PRIORITY_LOW => ['label' => 'Low', 'color' => '#6c757d'],
            self::PRIORITY_MEDIUM => ['label' => 'Medium', 'color' => '#0d6efd'],
            self::PRIORITY_HIGH => ['label' => 'High', 'color' => '#fd7e14'],
            self::PRIORITY_CRITICAL => ['label' => 'Critical', 'color' => '#dc3545']
        ];
        
        $priorityInfo = $priorityLabels[$priority] ?? $priorityLabels[self::PRIORITY_MEDIUM];
        
        // Determine type label and icon
        $typeLabels = [
            self::TYPE_FAILURE => ['label' => 'Failure', 'icon' => '❌'],
            self::TYPE_SECURITY => ['label' => 'Security Alert', 'icon' => '🔒'],
            self::TYPE_INFO => ['label' => 'Information', 'icon' => 'ℹ️']
        ];
        
        $typeInfo = $typeLabels[$type] ?? $typeLabels[self::TYPE_INFO];
        
        // Build HTML email
        $html = '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #ffffff; padding: 20px; border: 1px solid #dee2e6; }
        .footer { background-color: #f8f9fa; padding: 15px; border-radius: 0 0 5px 5px; font-size: 12px; color: #6c757d; }
        .badge { display: inline-block; padding: 5px 10px; border-radius: 3px; color: white; font-size: 12px; font-weight: bold; }
        .priority { background-color: ' . $priorityInfo['color'] . '; }
        .type { margin-bottom: 15px; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin: 0;">' . $typeInfo['icon'] . ' PricePilot Notification</h2>
        </div>
        <div class="content">
            <div class="type">
                <strong>Type:</strong> ' . htmlspecialchars($typeInfo['label']) . ' | 
                <span class="badge priority">Priority: ' . htmlspecialchars($priorityInfo['label']) . '</span>
            </div>
            <h3>' . htmlspecialchars($subject) . '</h3>
            <p>' . nl2br(htmlspecialchars($message)) . '</p>
            <hr>
            <p><strong>Store:</strong> ' . htmlspecialchars($storeName) . '</p>
            <p><strong>Time:</strong> ' . date('Y-m-d H:i:s') . '</p>
        </div>
        <div class="footer">
            <p>This is an automated notification from PricePilot. Please do not reply to this email.</p>
            <p>To manage notification settings, visit your PricePilot admin panel.</p>
        </div>
    </div>
</body>
</html>';
        
        return $html;
    }
    
    /**
     * Ensure notification table exists in database
     * 
     * Creates the pricepilot_notifications table if it doesn't exist.
     * This allows the notification system to work even if the table
     * wasn't created during initial installation.
     * 
     * @return void
     */
    private function ensureNotificationTableExists() {
        try {
            $tableName = $this->getTableName('pricepilot_notifications');
            
            // Check if table exists
            $checkSql = "SHOW TABLES LIKE '{$tableName}'";
            $result = $this->query($checkSql);
            
            if ($result->num_rows > 0) {
                return; // Table already exists
            }
            
            // Create table
            $createSql = "CREATE TABLE IF NOT EXISTS `{$tableName}` (
                `notification_id` int(11) NOT NULL AUTO_INCREMENT,
                `title` varchar(255) NOT NULL,
                `message` text NOT NULL,
                `type` varchar(50) NOT NULL DEFAULT 'info',
                `priority` int(1) NOT NULL DEFAULT 2,
                `is_read` tinyint(1) NOT NULL DEFAULT 0,
                `date_added` datetime NOT NULL,
                PRIMARY KEY (`notification_id`),
                KEY `type` (`type`),
                KEY `is_read` (`is_read`),
                KEY `priority` (`priority`),
                KEY `date_added` (`date_added`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
            
            $this->query($createSql);
            
            $this->logMessage("Created pricepilot_notifications table", 'info');
            
        } catch (Exception $e) {
            $this->logMessage("Failed to ensure notification table exists: " . $e->getMessage(), 'error');
        }
    }
}
