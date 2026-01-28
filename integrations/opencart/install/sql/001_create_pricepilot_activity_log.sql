-- Migration: Create pricepilot_activity_log table
-- Purpose: Track all price changes made through the plugin
-- Requirements: 31.1

CREATE TABLE IF NOT EXISTS `pricepilot_activity_log` (
    `log_id` int(11) NOT NULL AUTO_INCREMENT,
    `product_id` int(11) NOT NULL,
    `product_name` varchar(255) NOT NULL,
    `old_price` decimal(15, 4) NOT NULL,
    `new_price` decimal(15, 4) NOT NULL,
    `changed_by` varchar(255) DEFAULT 'API',
    `store_id` int(11) DEFAULT 0,
    `date_added` datetime NOT NULL,
    PRIMARY KEY (`log_id`),
    KEY `idx_product_id` (`product_id`),
    KEY `idx_date_added` (`date_added`),
    KEY `idx_store_id` (`store_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;