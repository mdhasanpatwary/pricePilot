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
        if (empty($current_token)) {
            $current_token = bin2hex(random_bytes(32));
            $this->model_setting_setting->editSetting('module_pricepilot', [
                'module_pricepilot_token' => $current_token,
                'module_pricepilot_status' => 1
            ]);
        }
        $data['module_pricepilot_token'] = $current_token;

        if (isset($this->request->post['module_pricepilot_status'])) {
            $data['module_pricepilot_status'] = $this->request->post['module_pricepilot_status'];
        } else {
            $data['module_pricepilot_status'] = $this->config->get('module_pricepilot_status');
        }

        $data['action'] = $this->url->link('extension/module/pricepilot', 'user_token=' . $this->session->data['user_token'], true);
        $data['cancel'] = $this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=module', true);
        $data['user_token'] = $this->session->data['user_token'];

        $data['header'] = $this->load->controller('common/header');
        $data['column_left'] = $this->load->controller('common/column_left');
        $data['footer'] = $this->load->controller('common/footer');

        $this->response->setOutput($this->load->view('extension/module/pricepilot', $data));
    }

    protected function validate() {
        if (!$this->user->hasPermission('modify', 'extension/module/pricepilot')) {
            $this->error['warning'] = 'Permission Denied!';
        }
        return !$this->error;
    }
}
