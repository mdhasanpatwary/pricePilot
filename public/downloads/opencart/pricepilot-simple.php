<?php
/**
 * PricePilot Simple API for OpenCart
 * 
 * Upload this file to: /api/pricepilot.php
 * 
 * Usage:
 * GET  /api/pricepilot.php?api_token=YOUR_TOKEN&action=products
 * POST /api/pricepilot.php?api_token=YOUR_TOKEN&action=update
 */

// Load OpenCart
define('VERSION', '3.0.0.0');
require_once('../config.php');
require_once(DIR_SYSTEM . 'startup.php');

// Start registry
$registry = new Registry();
$registry->set('request', new Request());
$registry->set('response', new Response());

// Database
$db = new DB(DB_DRIVER, DB_HOSTNAME, DB_USERNAME, DB_PASSWORD, DB_DATABASE, DB_PORT);
$registry->set('db', $db);

// Get API token from request
$token = isset($_GET['api_token']) ? $_GET['api_token'] : '';
$action = isset($_GET['action']) ? $_GET['action'] : 'products';

// Validate token
$query = $db->query("SELECT * FROM " . DB_PREFIX . "api WHERE token = '" . $db->escape($token) . "' AND status = 1");

if (!$query->num_rows) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Invalid API token']);
    exit;
}

// Handle actions
if ($action === 'products') {
    // Get products
    $start = isset($_GET['start']) ? (int)$_GET['start'] : 0;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
    
    if ($limit > 1000) $limit = 1000;
    
    $products = [];
    $result = $db->query("
        SELECT 
            p.product_id, 
            pd.name, 
            p.model, 
            p.sku, 
            p.price, 
            p.quantity, 
            p.status, 
            p.image,
            p.manufacturer_id,
            m.name as manufacturer
        FROM " . DB_PREFIX . "product p
        LEFT JOIN " . DB_PREFIX . "product_description pd ON p.product_id = pd.product_id
        LEFT JOIN " . DB_PREFIX . "manufacturer m ON p.manufacturer_id = m.manufacturer_id
        WHERE pd.language_id = 1
        LIMIT " . (int)$start . ", " . (int)$limit . "
    ");
    
    foreach ($result->rows as $row) {
        $image_url = null;
        if ($row['image']) {
            $image_url = HTTP_SERVER . 'image/' . $row['image'];
        }
        
        $products[] = [
            'product_id' => (int)$row['product_id'],
            'name' => $row['name'],
            'model' => $row['model'] ?: '',
            'sku' => $row['sku'] ?: '',
            'price' => number_format((float)$row['price'], 4, '.', ''),
            'quantity' => (int)$row['quantity'],
            'status' => (int)$row['status'],
            'manufacturer' => $row['manufacturer'] ?: '',
            'manufacturer_id' => (int)$row['manufacturer_id'],
            'image' => $image_url
        ];
    }
    
    // Get total count
    $total_result = $db->query("SELECT COUNT(*) as total FROM " . DB_PREFIX . "product");
    $total = $total_result->row['total'];
    
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'products' => $products,
        'total' => (int)$total,
        'start' => $start,
        'limit' => $limit
    ]);
    
} elseif ($action === 'update') {
    // Update product price
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (!isset($data['product_id']) || !isset($data['price'])) {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error' => 'Missing product_id or price'
        ]);
        exit;
    }
    
    $product_id = (int)$data['product_id'];
    $price = (float)$data['price'];
    
    if ($price < 0) {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error' => 'Price must be non-negative'
        ]);
        exit;
    }
    
    // Get old price
    $old_price_result = $db->query("SELECT price FROM " . DB_PREFIX . "product WHERE product_id = " . (int)$product_id);
    
    if (!$old_price_result->num_rows) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error' => 'Product not found'
        ]);
        exit;
    }
    
    $old_price = $old_price_result->row['price'];
    
    // Update price
    $db->query("UPDATE " . DB_PREFIX . "product SET price = '" . (float)$price . "' WHERE product_id = " . (int)$product_id);
    
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'message' => 'Price updated successfully',
        'product_id' => $product_id,
        'old_price' => number_format((float)$old_price, 4, '.', ''),
        'new_price' => number_format((float)$price, 4, '.', '')
    ]);
    
} else {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => 'Invalid action. Use: products or update'
    ]);
}
