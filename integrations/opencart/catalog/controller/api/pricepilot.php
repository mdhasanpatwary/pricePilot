<?php
/**
 * PricePilot OpenCart API Controller
 * Path: catalog/controller/api/pricepilot.php
 */
class ControllerApiPricepilot extends Controller {
    public function index() {
        $this->load->language('api/pricepilot');

        $json = array();

        if (!isset($this->request->get['api_token']) || $this->request->get['api_token'] !== $this->config->get('module_pricepilot_token')) {
            $json['error'] = 'Invalid API Token';
        } else {
            $this->load->model('catalog/product');
            $this->load->model('catalog/category');
            $this->load->model('catalog/manufacturer');

            $filter_data = array(
                'start' => (isset($this->request->get['start'])) ? (int)$this->request->get['start'] : 0,
                'limit' => (isset($this->request->get['limit'])) ? (int)$this->request->get['limit'] : 100
            );

            $results = $this->model_catalog_product->getProducts($filter_data);

            foreach ($results as $result) {
                // Get manufacturer (brand) name
                $manufacturer = '';
                if (!empty($result['manufacturer_id'])) {
                    $manufacturer_info = $this->model_catalog_manufacturer->getManufacturer($result['manufacturer_id']);
                    if ($manufacturer_info) {
                        $manufacturer = $manufacturer_info['name'];
                    }
                }

                // Get product image
                $image = '';
                if (!empty($result['image'])) {
                    $image = $this->config->get('config_url') . 'image/' . $result['image'];
                }

                // Get category
                $category = '';
                $categories = $this->model_catalog_product->getCategories($result['product_id']);
                if (!empty($categories)) {
                    $category_info = $this->model_catalog_category->getCategory($categories[0]['category_id']);
                    if ($category_info) {
                        $category = $category_info['name'];
                    }
                }

                // Get special price if available
                $special = $this->model_catalog_product->getProductSpecial($result['product_id']);

                $json['products'][] = array(
                    'product_id'   => $result['product_id'],
                    'name'         => $result['name'],
                    'model'        => $result['model'],
                    'sku'          => $result['sku'],
                    'price'        => $result['price'],
                    'special'      => $special ? $special : null,
                    'quantity'     => $result['quantity'],
                    'status'       => $result['status'],
                    'manufacturer' => $manufacturer,
                    'image'        => $image,
                    'category'     => $category
                );
            }
        }

        $this->response->addHeader('Content-Type: application/json');
        $this->response->setOutput(json_encode($json));
    }

    public function update() {
        $json = array();

        if (!isset($this->request->get['api_token']) || $this->request->get['api_token'] !== $this->config->get('module_pricepilot_token')) {
            $json['error'] = 'Invalid API Token';
        } else {
            $post_data = json_decode(file_get_contents('php://input'), true);

            if (isset($post_data['product_id']) && isset($post_data['price'])) {
                $this->db->query("UPDATE " . DB_PREFIX . "product SET price = '" . (float)$post_data['price'] . "', date_modified = NOW() WHERE product_id = '" . (int)$post_data['product_id'] . "'");

                $this->cache->delete('product');

                $json['success'] = 'Price updated successfully';
            } else {
                $json['error'] = 'Missing product_id or price';
            }
        }

        $this->response->addHeader('Content-Type: application/json');
        $this->response->setOutput(json_encode($json));
    }
}
