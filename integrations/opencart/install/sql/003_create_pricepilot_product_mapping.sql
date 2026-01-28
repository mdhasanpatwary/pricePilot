-- Migration: Create pricepilot_product_mapping table
-- Purpose: Map OpenCart products to competitor products for price tracking
-- Requirements: 31.3

CREATE TABLE IF NOT EXISTS `pricepilot_product_mapping` (
    `mapping_id` int(11) NOT NULL AUTO_INCREMENT,
    `product_id` int(11) NOT NULL,
    `competitor_url` varchar(500) NOT NULL,
    `competitor_name` varchar(100) NOT NULL,
    `date_added` datetime NOT NULL,
    `date_modified` datetime NOT NULL,
    PRIMARY KEY (`mapping_id`),
    KEY `idx_product_id` (`product_id`),
    UNIQUE KEY `unique_product_competitor` (
        `product_id`,
        `competitor_url`
    )
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;