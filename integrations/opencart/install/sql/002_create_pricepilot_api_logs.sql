-- Migration: Create pricepilot_api_logs table
-- Purpose: Log all API requests and responses for monitoring and debugging
-- Requirements: 31.2

CREATE TABLE IF NOT EXISTS `pricepilot_api_logs` (
    `log_id` int(11) NOT NULL AUTO_INCREMENT,
    `endpoint` varchar(255) NOT NULL,
    `method` varchar(10) NOT NULL,
    `ip_address` varchar(45) NOT NULL,
    `request_data` text,
    `response_code` int(3) NOT NULL,
    `response_time` decimal(10, 4) NOT NULL,
    `date_added` datetime NOT NULL,
    PRIMARY KEY (`log_id`),
    KEY `idx_date_added` (`date_added`),
    KEY `idx_ip_address` (`ip_address`),
    KEY `idx_endpoint` (`endpoint`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;