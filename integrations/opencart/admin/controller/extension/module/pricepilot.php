<?php
class ControllerExtensionModulePricepilot extends Controller {
    private $error = array();

    public function index() {
        $this->load->language('extension/module/pricepilot');
        $this->document->setTitle('PricePilot');
        $this->load->model('setting/setting');

        if (($this->request->server['REQUEST_METHOD'] == 'POST') && $this->validate()) {
            $this->model_setting_setting->editSetting('module_pricepilot', $this->request->post);
            $this->session->data['success'] = 'Success: PricePilot settings updated!';
            $this->response->redirect($this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=module', true));
        }

        $data['heading_title'] = 'PricePilot';
        $data['text_edit'] = 'Configure PricePilot API';
        
        // Auto-Generate Token if Missing
        $current_token = $this->config->get('module_pricepilot_token');
        $token_created = $this->config->get('module_pricepilot_token_created');
        
        if (empty($current_token)) {
            $current_token = bin2hex(random_bytes(32));
            $token_created = date('Y-m-d H:i:s');
            $this->model_setting_setting->editSetting('module_pricepilot', [
                'module_pricepilot_token' => $current_token,
                'module_pricepilot_token_created' => $token_created,
                'module_pricepilot_status' => 1
            ]);
        }
        
        $data['module_pricepilot_token'] = $current_token;
        $data['module_pricepilot_token_created'] = $token_created ? $token_created : 'Unknown';

        if (isset($this->request->post['module_pricepilot_status'])) {
            $data['module_pricepilot_status'] = $this->request->post['module_pricepilot_status'];
        } else {
            $data['module_pricepilot_status'] = $this->config->get('module_pricepilot_status');
        }

        $data['action'] = $this->url->link('extension/module/pricepilot', 'user_token=' . $this->session->data['user_token'], true);
        $data['cancel'] = $this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=module', true);
        $data['user_token'] = $this->session->data['user_token'];
        
        // Add link to dashboard
        $data['dashboard_link'] = $this->url->link('extension/module/pricepilot/dashboard', 'user_token=' . $this->session->data['user_token'], true);
        
        // Add link to regenerate token
        $data['regenerate_token_link'] = $this->url->link('extension/module/pricepilot/regenerateToken', 'user_token=' . $this->session->data['user_token'], true);

        $data['header'] = $this->load->controller('common/header');
        $data['column_left'] = $this->load->controller('common/column_left');
        $data['footer'] = $this->load->controller('common/footer');

        $this->response->setOutput($this->load->view('extension/module/pricepilot', $data));
    }
    
    /**
     * Dashboard view with statistics
     * 
     * Displays comprehensive statistics including:
     * - Last sync timestamp
     * - Total product count
     * - Today's update count
     * - Recent price changes (10 most recent)
     * - API usage statistics
     * - Recent notifications (Requirement 20.3)
     * 
     * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 20.3
     */
    public function dashboard() {
        $this->load->language('extension/module/pricepilot');
        $this->document->setTitle('PricePilot Dashboard');
        
        // Load services
        require_once DIR_CATALOG . 'model/extension/pricepilot/LoggingService.php';
        require_once DIR_CATALOG . 'model/extension/pricepilot/ProductService.php';
        require_once DIR_CATALOG . 'model/extension/pricepilot/NotificationService.php';
        
        $loggingService = new LoggingService($this->registry);
        $productService = new ProductService($this->registry);
        $notificationService = new NotificationService($this->registry);
        
        $data['heading_title'] = 'PricePilot Dashboard';
        
        // Get last sync timestamp (most recent API log entry)
        $recentApiLogs = $loggingService->getActivityLog([], 0, 1);
        if (!empty($recentApiLogs['logs'])) {
            $data['last_sync'] = $recentApiLogs['logs'][0]['date_added'];
        } else {
            $data['last_sync'] = 'Never';
        }
        
        // Get total product count
        $productsData = $productService->getProducts([], 0, 1);
        $data['total_products'] = $productsData['total'];
        
        // Get today's update count
        $todayLogs = $loggingService->getActivityLog([
            'date_from' => date('Y-m-d'),
            'date_to' => date('Y-m-d')
        ], 0, 1);
        $data['today_updates'] = $todayLogs['total'];
        
        // Get 10 most recent price changes
        $recentChanges = $loggingService->getActivityLog([], 0, 10);
        $data['recent_changes'] = $recentChanges['logs'];
        
        // Get API usage statistics for today
        $apiStats = $loggingService->getApiStatistics('today');
        $data['api_stats'] = $apiStats;
        
        // Get recent notifications (Requirement 20.3)
        $data['notifications'] = $notificationService->getRecentNotifications([], 10);
        $data['unread_count'] = $notificationService->getUnreadCount();
        
        // Navigation links
        $data['config_link'] = $this->url->link('extension/module/pricepilot', 'user_token=' . $this->session->data['user_token'], true);
        $data['notification_settings_link'] = $this->url->link('extension/module/pricepilot/notificationSettings', 'user_token=' . $this->session->data['user_token'], true);
        $data['mark_all_read_link'] = $this->url->link('extension/module/pricepilot/markAllNotificationsRead', 'user_token=' . $this->session->data['user_token'], true);
        $data['user_token'] = $this->session->data['user_token'];
        
        $data['header'] = $this->load->controller('common/header');
        $data['column_left'] = $this->load->controller('common/column_left');
        $data['footer'] = $this->load->controller('common/footer');
        
        $this->response->setOutput($this->load->view('extension/module/pricepilot_dashboard', $data));
    }
    
    /**
     * Activity log viewer with filtering and pagination
     * 
     * Displays detailed price change history with support for:
     * - Date range filtering
     * - Product filtering
     * - Pagination (50 entries per page)
     * - CSV export functionality
     * 
     * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
     */
    public function activityLog() {
        $this->load->language('extension/module/pricepilot');
        $this->document->setTitle('PricePilot Activity Log');
        
        // Load services
        require_once DIR_CATALOG . 'model/extension/pricepilot/LoggingService.php';
        
        $loggingService = new LoggingService($this->registry);
        
        $data['heading_title'] = 'PricePilot Activity Log';
        
        // Handle CSV export
        if (isset($this->request->get['export']) && $this->request->get['export'] == 'csv') {
            $this->exportActivityLogCsv($loggingService);
            return;
        }
        
        // Build filters from request
        $filters = [];
        
        if (isset($this->request->get['filter_product_id']) && $this->request->get['filter_product_id'] !== '') {
            $filters['product_id'] = (int)$this->request->get['filter_product_id'];
            $data['filter_product_id'] = $filters['product_id'];
        } else {
            $data['filter_product_id'] = '';
        }
        
        if (isset($this->request->get['filter_date_from']) && $this->request->get['filter_date_from'] !== '') {
            $filters['date_from'] = $this->request->get['filter_date_from'];
            $data['filter_date_from'] = $filters['date_from'];
        } else {
            $data['filter_date_from'] = '';
        }
        
        if (isset($this->request->get['filter_date_to']) && $this->request->get['filter_date_to'] !== '') {
            $filters['date_to'] = $this->request->get['filter_date_to'];
            $data['filter_date_to'] = $filters['date_to'];
        } else {
            $data['filter_date_to'] = '';
        }
        
        if (isset($this->request->get['filter_changed_by']) && $this->request->get['filter_changed_by'] !== '') {
            $filters['changed_by'] = $this->request->get['filter_changed_by'];
            $data['filter_changed_by'] = $filters['changed_by'];
        } else {
            $data['filter_changed_by'] = '';
        }
        
        // Pagination
        $page = isset($this->request->get['page']) ? (int)$this->request->get['page'] : 1;
        $limit = 50; // 50 entries per page as per requirements
        $start = ($page - 1) * $limit;
        
        // Get activity log entries
        $result = $loggingService->getActivityLog($filters, $start, $limit);
        $data['logs'] = $result['logs'];
        $data['total'] = $result['total'];
        
        // Pagination data
        $pagination = new Pagination();
        $pagination->total = $result['total'];
        $pagination->page = $page;
        $pagination->limit = $limit;
        $pagination->url = $this->url->link('extension/module/pricepilot/activityLog', 'user_token=' . $this->session->data['user_token'] . $this->buildFilterUrl() . '&page={page}', true);
        $data['pagination'] = $pagination->render();
        
        // Results text
        $data['results'] = sprintf('Showing %d to %d of %d entries', 
            ($result['total']) ? ($start + 1) : 0,
            ((($start + $limit) < $result['total']) ? ($start + $limit) : $result['total']),
            $result['total']
        );
        
        // Navigation links
        $data['dashboard_link'] = $this->url->link('extension/module/pricepilot/dashboard', 'user_token=' . $this->session->data['user_token'], true);
        $data['config_link'] = $this->url->link('extension/module/pricepilot', 'user_token=' . $this->session->data['user_token'], true);
        $data['export_link'] = $this->url->link('extension/module/pricepilot/activityLog', 'user_token=' . $this->session->data['user_token'] . $this->buildFilterUrl() . '&export=csv', true);
        $data['filter_action'] = $this->url->link('extension/module/pricepilot/activityLog', 'user_token=' . $this->session->data['user_token'], true);
        $data['user_token'] = $this->session->data['user_token'];
        
        $data['header'] = $this->load->controller('common/header');
        $data['column_left'] = $this->load->controller('common/column_left');
        $data['footer'] = $this->load->controller('common/footer');
        
        $this->response->setOutput($this->load->view('extension/module/pricepilot_activity_log', $data));
    }
    
    /**
     * Export activity log to CSV
     * 
     * Exports filtered activity log entries to CSV format for download.
     * Applies the same filters as the activity log view.
     * 
     * @param LoggingService $loggingService Logging service instance
     */
    private function exportActivityLogCsv($loggingService) {
        // Build filters from request
        $filters = [];
        
        if (isset($this->request->get['filter_product_id']) && $this->request->get['filter_product_id'] !== '') {
            $filters['product_id'] = (int)$this->request->get['filter_product_id'];
        }
        
        if (isset($this->request->get['filter_date_from']) && $this->request->get['filter_date_from'] !== '') {
            $filters['date_from'] = $this->request->get['filter_date_from'];
        }
        
        if (isset($this->request->get['filter_date_to']) && $this->request->get['filter_date_to'] !== '') {
            $filters['date_to'] = $this->request->get['filter_date_to'];
        }
        
        if (isset($this->request->get['filter_changed_by']) && $this->request->get['filter_changed_by'] !== '') {
            $filters['changed_by'] = $this->request->get['filter_changed_by'];
        }
        
        // Get all matching entries (no pagination for export)
        $result = $loggingService->getActivityLog($filters, 0, 10000);
        
        // Set CSV headers
        header('Content-Type: text/csv');
        header('Content-Disposition: attachment; filename="pricepilot_activity_log_' . date('Y-m-d_His') . '.csv"');
        header('Pragma: no-cache');
        header('Expires: 0');
        
        // Open output stream
        $output = fopen('php://output', 'w');
        
        // Write CSV header
        fputcsv($output, ['Log ID', 'Product ID', 'Product Name', 'Old Price', 'New Price', 'Price Change', 'Changed By', 'Store ID', 'Date']);
        
        // Write data rows
        foreach ($result['logs'] as $log) {
            $priceChange = $log['new_price'] - $log['old_price'];
            fputcsv($output, [
                $log['log_id'],
                $log['product_id'],
                $log['product_name'],
                number_format($log['old_price'], 2),
                number_format($log['new_price'], 2),
                number_format($priceChange, 2),
                $log['changed_by'],
                $log['store_id'],
                $log['date_added']
            ]);
        }
        
        fclose($output);
        exit;
    }
    
    /**
     * Build filter URL parameters
     * 
     * Constructs URL query string from current filter values
     * for pagination and export links.
     * 
     * @return string URL query string with filter parameters
     */
    private function buildFilterUrl() {
        $url = '';
        
        if (isset($this->request->get['filter_product_id']) && $this->request->get['filter_product_id'] !== '') {
            $url .= '&filter_product_id=' . $this->request->get['filter_product_id'];
        }
        
        if (isset($this->request->get['filter_date_from']) && $this->request->get['filter_date_from'] !== '') {
            $url .= '&filter_date_from=' . $this->request->get['filter_date_from'];
        }
        
        if (isset($this->request->get['filter_date_to']) && $this->request->get['filter_date_to'] !== '') {
            $url .= '&filter_date_to=' . $this->request->get['filter_date_to'];
        }
        
        if (isset($this->request->get['filter_changed_by']) && $this->request->get['filter_changed_by'] !== '') {
            $url .= '&filter_changed_by=' . $this->request->get['filter_changed_by'];
        }
        
        return $url;
    }
    
    /**
     * Regenerate API token
     * 
     * Generates a new API token using AuthenticationService and updates
     * the configuration. The old token is immediately invalidated.
     * 
     * Returns JSON response with new token and creation timestamp.
     * 
     * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 4.1, 4.2, 4.3
     */
    public function regenerateToken() {
        $this->response->addHeader('Content-Type: application/json');
        
        // Check permissions
        if (!$this->user->hasPermission('modify', 'extension/module/pricepilot')) {
            $this->response->setOutput(json_encode([
                'success' => false,
                'error' => 'Permission denied',
                'details' => 'You do not have permission to regenerate the API token.'
            ]));
            return;
        }
        
        // Load AuthenticationService
        require_once DIR_CATALOG . 'model/extension/pricepilot/AuthenticationService.php';
        $authService = new AuthenticationService($this->registry);
        
        try {
            // Generate new token
            $newToken = $authService->generateToken();
            
            // Get current timestamp for token creation date
            $tokenCreated = date('Y-m-d H:i:s');
            
            // Load settings model
            $this->load->model('setting/setting');
            
            // Get current settings
            $settings = $this->model_setting_setting->getSetting('module_pricepilot');
            
            // Update token and creation date
            $settings['module_pricepilot_token'] = $newToken;
            $settings['module_pricepilot_token_created'] = $tokenCreated;
            
            // Save settings
            $this->model_setting_setting->editSetting('module_pricepilot', $settings);
            
            // Log the token regeneration
            $this->log->write('PricePilot: API token regenerated by user ' . $this->user->getUserName() . ' (ID: ' . $this->user->getId() . ')');
            
            // Return success response
            $this->response->setOutput(json_encode([
                'success' => true,
                'message' => 'Token regenerated successfully',
                'token' => $newToken,
                'token_created' => $tokenCreated,
                'warning' => 'The old token has been invalidated and will no longer work.'
            ]));
            
        } catch (Exception $e) {
            // Log error
            $this->log->write('PricePilot: Failed to regenerate token - ' . $e->getMessage());
            
            // Return error response
            $this->response->setOutput(json_encode([
                'success' => false,
                'error' => 'Token regeneration failed',
                'details' => $e->getMessage()
            ]));
        }
    }
    
    /**
     * Webhook list view
     * 
     * Displays all configured webhooks with their URLs, subscribed events,
     * and status. Provides links to add, edit, and delete webhooks.
     * 
     * Requirements: 9.5, 9.6
     */
    public function webhookList() {
        $this->load->language('extension/module/pricepilot');
        $this->document->setTitle('PricePilot Webhooks');
        
        $data['heading_title'] = 'PricePilot Webhooks';
        
        // Handle delete action
        if (isset($this->request->get['delete']) && $this->validate()) {
            $webhookId = (int)$this->request->get['delete'];
            $this->deleteWebhookById($webhookId);
            $this->session->data['success'] = 'Webhook deleted successfully!';
            $this->response->redirect($this->url->link('extension/module/pricepilot/webhookList', 'user_token=' . $this->session->data['user_token'], true));
        }
        
        // Get all webhooks from database
        $this->load->model('setting/setting');
        
        $sql = "SELECT webhook_id, url, events, secret, status, date_added, date_modified 
                FROM " . DB_PREFIX . "pricepilot_webhooks 
                ORDER BY webhook_id DESC";
        
        $result = $this->db->query($sql);
        
        $data['webhooks'] = [];
        
        foreach ($result->rows as $row) {
            $events = json_decode($row['events'], true);
            if (!is_array($events)) {
                $events = [];
            }
            
            $data['webhooks'][] = [
                'webhook_id' => $row['webhook_id'],
                'url' => $row['url'],
                'events' => $events,
                'events_display' => implode(', ', $events),
                'status' => (int)$row['status'],
                'status_text' => $row['status'] ? 'Active' : 'Inactive',
                'date_added' => $row['date_added'],
                'date_modified' => $row['date_modified'],
                'edit_link' => $this->url->link('extension/module/pricepilot/webhookEdit', 'user_token=' . $this->session->data['user_token'] . '&webhook_id=' . $row['webhook_id'], true),
                'delete_link' => $this->url->link('extension/module/pricepilot/webhookList', 'user_token=' . $this->session->data['user_token'] . '&delete=' . $row['webhook_id'], true)
            ];
        }
        
        // Navigation links
        $data['add_webhook_link'] = $this->url->link('extension/module/pricepilot/webhookAdd', 'user_token=' . $this->session->data['user_token'], true);
        $data['dashboard_link'] = $this->url->link('extension/module/pricepilot/dashboard', 'user_token=' . $this->session->data['user_token'], true);
        $data['config_link'] = $this->url->link('extension/module/pricepilot', 'user_token=' . $this->session->data['user_token'], true);
        $data['user_token'] = $this->session->data['user_token'];
        
        // Success/error messages
        if (isset($this->session->data['success'])) {
            $data['success'] = $this->session->data['success'];
            unset($this->session->data['success']);
        } else {
            $data['success'] = '';
        }
        
        if (isset($this->session->data['error'])) {
            $data['error'] = $this->session->data['error'];
            unset($this->session->data['error']);
        } else {
            $data['error'] = '';
        }
        
        $data['header'] = $this->load->controller('common/header');
        $data['column_left'] = $this->load->controller('common/column_left');
        $data['footer'] = $this->load->controller('common/footer');
        
        $this->response->setOutput($this->load->view('extension/module/pricepilot_webhooks', $data));
    }
    
    /**
     * Add new webhook
     * 
     * Displays form to create a new webhook configuration.
     * Validates URL and saves webhook to database.
     * 
     * Requirements: 9.5, 9.6
     */
    public function webhookAdd() {
        $this->load->language('extension/module/pricepilot');
        $this->document->setTitle('Add Webhook');
        
        // Load WebhookService for URL validation
        require_once DIR_CATALOG . 'model/extension/pricepilot/WebhookService.php';
        $webhookService = new WebhookService($this->registry);
        
        $data['heading_title'] = 'Add Webhook';
        $data['text_form'] = 'Add New Webhook';
        
        // Handle form submission
        if (($this->request->server['REQUEST_METHOD'] == 'POST') && $this->validateWebhookForm($webhookService)) {
            $this->saveWebhook();
            $this->session->data['success'] = 'Webhook added successfully!';
            $this->response->redirect($this->url->link('extension/module/pricepilot/webhookList', 'user_token=' . $this->session->data['user_token'], true));
        }
        
        // Prepare form data
        $data['webhook'] = [
            'webhook_id' => null,
            'url' => isset($this->request->post['url']) ? $this->request->post['url'] : '',
            'events' => isset($this->request->post['events']) ? $this->request->post['events'] : [],
            'secret' => isset($this->request->post['secret']) ? $this->request->post['secret'] : bin2hex(random_bytes(32)),
            'status' => isset($this->request->post['status']) ? (int)$this->request->post['status'] : 1
        ];
        
        // Available events
        $data['available_events'] = [
            'product.created' => 'Product Created',
            'product.updated' => 'Product Updated',
            'product.deleted' => 'Product Deleted',
            'price.changed' => 'Price Changed'
        ];
        
        // Error messages
        $data['error_url'] = isset($this->error['url']) ? $this->error['url'] : '';
        $data['error_events'] = isset($this->error['events']) ? $this->error['events'] : '';
        $data['error_warning'] = isset($this->error['warning']) ? $this->error['warning'] : '';
        
        // Navigation links
        $data['action'] = $this->url->link('extension/module/pricepilot/webhookAdd', 'user_token=' . $this->session->data['user_token'], true);
        $data['cancel'] = $this->url->link('extension/module/pricepilot/webhookList', 'user_token=' . $this->session->data['user_token'], true);
        $data['user_token'] = $this->session->data['user_token'];
        
        $data['header'] = $this->load->controller('common/header');
        $data['column_left'] = $this->load->controller('common/column_left');
        $data['footer'] = $this->load->controller('common/footer');
        
        $this->response->setOutput($this->load->view('extension/module/pricepilot_webhook_form', $data));
    }
    
    /**
     * Edit existing webhook
     * 
     * Displays form to edit an existing webhook configuration.
     * Validates URL and updates webhook in database.
     * 
     * Requirements: 9.5, 9.6
     */
    public function webhookEdit() {
        $this->load->language('extension/module/pricepilot');
        $this->document->setTitle('Edit Webhook');
        
        // Load WebhookService for URL validation
        require_once DIR_CATALOG . 'model/extension/pricepilot/WebhookService.php';
        $webhookService = new WebhookService($this->registry);
        
        $data['heading_title'] = 'Edit Webhook';
        $data['text_form'] = 'Edit Webhook';
        
        // Get webhook ID
        $webhookId = isset($this->request->get['webhook_id']) ? (int)$this->request->get['webhook_id'] : 0;
        
        if (!$webhookId) {
            $this->session->data['error'] = 'Invalid webhook ID';
            $this->response->redirect($this->url->link('extension/module/pricepilot/webhookList', 'user_token=' . $this->session->data['user_token'], true));
        }
        
        // Handle form submission
        if (($this->request->server['REQUEST_METHOD'] == 'POST') && $this->validateWebhookForm($webhookService)) {
            $this->saveWebhook($webhookId);
            $this->session->data['success'] = 'Webhook updated successfully!';
            $this->response->redirect($this->url->link('extension/module/pricepilot/webhookList', 'user_token=' . $this->session->data['user_token'], true));
        }
        
        // Load existing webhook data
        $webhook = $this->getWebhookById($webhookId);
        
        if (!$webhook) {
            $this->session->data['error'] = 'Webhook not found';
            $this->response->redirect($this->url->link('extension/module/pricepilot/webhookList', 'user_token=' . $this->session->data['user_token'], true));
        }
        
        // Prepare form data (POST data takes precedence for validation errors)
        $data['webhook'] = [
            'webhook_id' => $webhookId,
            'url' => isset($this->request->post['url']) ? $this->request->post['url'] : $webhook['url'],
            'events' => isset($this->request->post['events']) ? $this->request->post['events'] : $webhook['events'],
            'secret' => isset($this->request->post['secret']) ? $this->request->post['secret'] : $webhook['secret'],
            'status' => isset($this->request->post['status']) ? (int)$this->request->post['status'] : $webhook['status']
        ];
        
        // Available events
        $data['available_events'] = [
            'product.created' => 'Product Created',
            'product.updated' => 'Product Updated',
            'product.deleted' => 'Product Deleted',
            'price.changed' => 'Price Changed'
        ];
        
        // Error messages
        $data['error_url'] = isset($this->error['url']) ? $this->error['url'] : '';
        $data['error_events'] = isset($this->error['events']) ? $this->error['events'] : '';
        $data['error_warning'] = isset($this->error['warning']) ? $this->error['warning'] : '';
        
        // Navigation links
        $data['action'] = $this->url->link('extension/module/pricepilot/webhookEdit', 'user_token=' . $this->session->data['user_token'] . '&webhook_id=' . $webhookId, true);
        $data['cancel'] = $this->url->link('extension/module/pricepilot/webhookList', 'user_token=' . $this->session->data['user_token'], true);
        $data['user_token'] = $this->session->data['user_token'];
        
        $data['header'] = $this->load->controller('common/header');
        $data['column_left'] = $this->load->controller('common/column_left');
        $data['footer'] = $this->load->controller('common/footer');
        
        $this->response->setOutput($this->load->view('extension/module/pricepilot_webhook_form', $data));
    }
    
    /**
     * Delete webhook
     * 
     * Removes webhook configuration from database.
     * Called from webhookList with delete parameter.
     * 
     * Requirements: 9.5, 9.6
     */
    private function deleteWebhookById($webhookId) {
        $sql = "DELETE FROM " . DB_PREFIX . "pricepilot_webhooks 
                WHERE webhook_id = " . (int)$webhookId;
        
        $this->db->query($sql);
    }
    
    /**
     * Get webhook by ID
     * 
     * Retrieves webhook configuration from database.
     * 
     * @param int $webhookId Webhook ID
     * @return array|null Webhook data or null if not found
     */
    private function getWebhookById($webhookId) {
        $sql = "SELECT webhook_id, url, events, secret, status, date_added, date_modified 
                FROM " . DB_PREFIX . "pricepilot_webhooks 
                WHERE webhook_id = " . (int)$webhookId;
        
        $result = $this->db->query($sql);
        
        if ($result->num_rows > 0) {
            $row = $result->row;
            $events = json_decode($row['events'], true);
            if (!is_array($events)) {
                $events = [];
            }
            
            return [
                'webhook_id' => (int)$row['webhook_id'],
                'url' => $row['url'],
                'events' => $events,
                'secret' => $row['secret'],
                'status' => (int)$row['status'],
                'date_added' => $row['date_added'],
                'date_modified' => $row['date_modified']
            ];
        }
        
        return null;
    }
    
    /**
     * Save webhook to database
     * 
     * Inserts new webhook or updates existing webhook.
     * 
     * @param int|null $webhookId Webhook ID for update, null for insert
     */
    private function saveWebhook($webhookId = null) {
        $url = $this->db->escape($this->request->post['url']);
        $events = isset($this->request->post['events']) ? $this->request->post['events'] : [];
        $eventsJson = $this->db->escape(json_encode($events));
        $secret = $this->db->escape($this->request->post['secret']);
        $status = isset($this->request->post['status']) ? (int)$this->request->post['status'] : 1;
        $now = date('Y-m-d H:i:s');
        
        if ($webhookId) {
            // Update existing webhook
            $sql = "UPDATE " . DB_PREFIX . "pricepilot_webhooks 
                    SET url = '" . $url . "',
                        events = '" . $eventsJson . "',
                        secret = '" . $secret . "',
                        status = " . $status . ",
                        date_modified = '" . $now . "'
                    WHERE webhook_id = " . (int)$webhookId;
        } else {
            // Insert new webhook
            $sql = "INSERT INTO " . DB_PREFIX . "pricepilot_webhooks 
                    (url, events, secret, status, date_added, date_modified) 
                    VALUES (
                        '" . $url . "',
                        '" . $eventsJson . "',
                        '" . $secret . "',
                        " . $status . ",
                        '" . $now . "',
                        '" . $now . "'
                    )";
        }
        
        $this->db->query($sql);
    }
    
    /**
     * Validate webhook form data
     * 
     * Validates URL format and ensures at least one event is selected.
     * Uses WebhookService for URL validation.
     * 
     * @param WebhookService $webhookService Webhook service instance
     * @return bool True if valid, false otherwise
     */
    private function validateWebhookForm($webhookService) {
        // Check permissions
        if (!$this->user->hasPermission('modify', 'extension/module/pricepilot')) {
            $this->error['warning'] = 'Permission Denied!';
            return false;
        }
        
        // Validate URL
        if (empty($this->request->post['url'])) {
            $this->error['url'] = 'URL is required';
        } else {
            $validation = $webhookService->validateWebhookUrl($this->request->post['url']);
            if (!$validation['valid']) {
                $this->error['url'] = $validation['error'];
            }
        }
        
        // Validate events
        if (empty($this->request->post['events']) || !is_array($this->request->post['events'])) {
            $this->error['events'] = 'Please select at least one event';
        }
        
        return empty($this->error);
    }
    
    /**
     * Test API connection
     * 
     * Makes a test API request to verify endpoint accessibility,
     * token validity, and proper response handling.
     * 
     * Returns JSON response with success/failure status and details.
     * 
     * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
     */
    public function testConnection() {
        $this->response->addHeader('Content-Type: application/json');
        
        // Get current configuration
        $token = $this->config->get('module_pricepilot_token');
        
        // Check if token exists
        if (empty($token)) {
            $this->response->setOutput(json_encode([
                'success' => false,
                'error' => 'API token is not configured',
                'details' => 'Please save the configuration to generate an API token first.'
            ]));
            return;
        }
        
        // Build API endpoint URL
        // Use HTTPS if available, otherwise HTTP
        $protocol = (!empty($this->request->server['HTTPS']) && $this->request->server['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $this->request->server['HTTP_HOST'];
        $apiUrl = $protocol . '://' . $host . '/index.php?route=api/pricepilot&api_token=' . urlencode($token) . '&limit=1';
        
        // Initialize cURL
        $ch = curl_init();
        
        // Set cURL options
        curl_setopt($ch, CURLOPT_URL, $apiUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // For local testing
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false); // For local testing
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Accept: application/json',
            'User-Agent: PricePilot-OpenCart-Test/1.0'
        ]);
        
        // Execute request
        $startTime = microtime(true);
        $response = curl_exec($ch);
        $responseTime = round((microtime(true) - $startTime) * 1000, 2); // Convert to milliseconds
        
        // Get HTTP status code
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        // Check for cURL errors
        if (curl_errno($ch)) {
            $error = curl_error($ch);
            curl_close($ch);
            
            $this->response->setOutput(json_encode([
                'success' => false,
                'error' => 'Connection failed',
                'details' => 'Could not connect to API endpoint: ' . $error,
                'endpoint' => $apiUrl,
                'response_time' => $responseTime . 'ms'
            ]));
            return;
        }
        
        curl_close($ch);
        
        // Parse JSON response
        $jsonResponse = json_decode($response, true);
        
        // Check HTTP status code
        if ($httpCode !== 200) {
            $errorMessage = 'API returned HTTP ' . $httpCode;
            $errorDetails = 'Expected HTTP 200, received HTTP ' . $httpCode;
            
            // Try to extract error message from response
            if ($jsonResponse && isset($jsonResponse['error'])) {
                $errorDetails .= ': ' . $jsonResponse['error'];
            }
            
            $this->response->setOutput(json_encode([
                'success' => false,
                'error' => $errorMessage,
                'details' => $errorDetails,
                'endpoint' => $apiUrl,
                'http_code' => $httpCode,
                'response_time' => $responseTime . 'ms'
            ]));
            return;
        }
        
        // Validate JSON response structure
        if (!$jsonResponse) {
            $this->response->setOutput(json_encode([
                'success' => false,
                'error' => 'Invalid API response',
                'details' => 'API did not return valid JSON. Response: ' . substr($response, 0, 200),
                'endpoint' => $apiUrl,
                'http_code' => $httpCode,
                'response_time' => $responseTime . 'ms'
            ]));
            return;
        }
        
        // Check if response has expected structure (products array)
        if (!isset($jsonResponse['products']) || !is_array($jsonResponse['products'])) {
            $this->response->setOutput(json_encode([
                'success' => false,
                'error' => 'Unexpected API response format',
                'details' => 'API response does not contain expected "products" array',
                'endpoint' => $apiUrl,
                'http_code' => $httpCode,
                'response_time' => $responseTime . 'ms'
            ]));
            return;
        }
        
        // Success!
        $this->response->setOutput(json_encode([
            'success' => true,
            'message' => 'API connection successful',
            'details' => 'Successfully connected to API endpoint and received valid response',
            'endpoint' => $apiUrl,
            'http_code' => $httpCode,
            'response_time' => $responseTime . 'ms',
            'products_found' => isset($jsonResponse['total']) ? $jsonResponse['total'] : count($jsonResponse['products'])
        ]));
    }
    
    /**
     * Notification settings page
     * 
     * Allows configuration of notification preferences including:
     * - Email recipients
     * - Enabling/disabling notification types
     * - Notification channels (email, dashboard)
     * 
     * Requirements: 20.3, 20.4
     */
    public function notificationSettings() {
        $this->load->language('extension/module/pricepilot');
        $this->document->setTitle('PricePilot Notification Settings');
        $this->load->model('setting/setting');
        
        // Handle form submission
        if (($this->request->server['REQUEST_METHOD'] == 'POST') && $this->validateNotificationSettings()) {
            $this->model_setting_setting->editSetting('module_pricepilot', $this->request->post);
            $this->session->data['success'] = 'Notification settings updated successfully!';
            $this->response->redirect($this->url->link('extension/module/pricepilot/dashboard', 'user_token=' . $this->session->data['user_token'], true));
        }
        
        $data['heading_title'] = 'Notification Settings';
        
        // Get current settings
        $data['module_pricepilot_admin_email'] = $this->config->get('module_pricepilot_admin_email') ?: $this->config->get('config_email');
        $data['module_pricepilot_notify_enabled'] = $this->config->get('module_pricepilot_notify_enabled') !== null ? $this->config->get('module_pricepilot_notify_enabled') : 1;
        
        // Notification type settings
        $data['module_pricepilot_notify_failure_email'] = $this->config->get('module_pricepilot_notify_failure_email') !== null ? $this->config->get('module_pricepilot_notify_failure_email') : 1;
        $data['module_pricepilot_notify_security_email'] = $this->config->get('module_pricepilot_notify_security_email') !== null ? $this->config->get('module_pricepilot_notify_security_email') : 1;
        $data['module_pricepilot_notify_info_email'] = $this->config->get('module_pricepilot_notify_info_email') !== null ? $this->config->get('module_pricepilot_notify_info_email') : 0;
        
        $data['module_pricepilot_notify_failure_dashboard'] = $this->config->get('module_pricepilot_notify_failure_dashboard') !== null ? $this->config->get('module_pricepilot_notify_failure_dashboard') : 1;
        $data['module_pricepilot_notify_security_dashboard'] = $this->config->get('module_pricepilot_notify_security_dashboard') !== null ? $this->config->get('module_pricepilot_notify_security_dashboard') : 1;
        $data['module_pricepilot_notify_info_dashboard'] = $this->config->get('module_pricepilot_notify_info_dashboard') !== null ? $this->config->get('module_pricepilot_notify_info_dashboard') : 1;
        
        // Form action
        $data['action'] = $this->url->link('extension/module/pricepilot/notificationSettings', 'user_token=' . $this->session->data['user_token'], true);
        $data['cancel'] = $this->url->link('extension/module/pricepilot/dashboard', 'user_token=' . $this->session->data['user_token'], true);
        $data['user_token'] = $this->session->data['user_token'];
        
        // Error messages
        if (isset($this->error['warning'])) {
            $data['error_warning'] = $this->error['warning'];
        } else {
            $data['error_warning'] = '';
        }
        
        if (isset($this->error['email'])) {
            $data['error_email'] = $this->error['email'];
        } else {
            $data['error_email'] = '';
        }
        
        $data['header'] = $this->load->controller('common/header');
        $data['column_left'] = $this->load->controller('common/column_left');
        $data['footer'] = $this->load->controller('common/footer');
        
        $this->response->setOutput($this->load->view('extension/module/pricepilot_notification_settings', $data));
    }
    
    /**
     * Mark all notifications as read
     * 
     * Marks all unread notifications as read and redirects back to dashboard.
     */
    public function markAllNotificationsRead() {
        require_once DIR_CATALOG . 'model/extension/pricepilot/NotificationService.php';
        $notificationService = new NotificationService($this->registry);
        
        $notificationService->markAllAsRead();
        
        $this->session->data['success'] = 'All notifications marked as read';
        $this->response->redirect($this->url->link('extension/module/pricepilot/dashboard', 'user_token=' . $this->session->data['user_token'], true));
    }
    
    /**
     * Mark single notification as read (AJAX)
     * 
     * Marks a specific notification as read via AJAX request.
     */
    public function markNotificationRead() {
        $this->response->addHeader('Content-Type: application/json');
        
        if (!isset($this->request->post['notification_id'])) {
            $this->response->setOutput(json_encode([
                'success' => false,
                'error' => 'Notification ID is required'
            ]));
            return;
        }
        
        require_once DIR_CATALOG . 'model/extension/pricepilot/NotificationService.php';
        $notificationService = new NotificationService($this->registry);
        
        $notificationId = (int)$this->request->post['notification_id'];
        $success = $notificationService->markAsRead($notificationId);
        
        $this->response->setOutput(json_encode([
            'success' => $success
        ]));
    }
    
    /**
     * Validate notification settings form
     * 
     * @return bool True if valid, false otherwise
     */
    private function validateNotificationSettings() {
        if (!$this->user->hasPermission('modify', 'extension/module/pricepilot')) {
            $this->error['warning'] = 'Permission Denied!';
            return false;
        }
        
        // Validate email format if provided
        if (!empty($this->request->post['module_pricepilot_admin_email'])) {
            $email = $this->request->post['module_pricepilot_admin_email'];
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $this->error['email'] = 'Invalid email address format';
            }
        }
        
        return empty($this->error);
    }

    protected function validate() {
        if (!$this->user->hasPermission('modify', 'extension/module/pricepilot')) {
            $this->error['warning'] = 'Permission Denied!';
        }
        return !$this->error;
    }
}
