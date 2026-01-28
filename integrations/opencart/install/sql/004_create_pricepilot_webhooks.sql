-- Migration: Create pricepilot_webhooks table
-- Purpose: Store webhook configurations for real-time event notifications
-- Requirements: 31.4

CREATE TABLE IF NOT EXISTS `pricepilot_webhooks` (
    `webhook_id` int(11) NOT NULL AUTO_INCREMENT,
    `url` varchar(500) NOT NULL,
    `events` text NOT NULL,
    `secret` varchar(64) NOT NULL,
    `status` tinyint(1) DEFAULT 1,
    `date_added` datetime NOT NULL,
    `date_modified` datetime NOT NULL,
    PRIMARY KEY (`webhook_id`),
    KEY `idx_status` (`status`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;