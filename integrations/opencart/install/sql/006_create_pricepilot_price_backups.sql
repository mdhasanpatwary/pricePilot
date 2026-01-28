-- Migration: Create pricepilot_price_backups table
-- Purpose: Store price backups for restoration capability
-- Requirements: 31.5

CREATE TABLE IF NOT EXISTS `pricepilot_price_backups` (
    `backup_id` varchar(36) NOT NULL,
    `backup_data` longtext NOT NULL,
    `product_count` int(11) NOT NULL,
    `created_by` varchar(100) NOT NULL,
    `date_added` datetime NOT NULL,
    PRIMARY KEY (`backup_id`),
    KEY `idx_date_added` (`date_added`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;