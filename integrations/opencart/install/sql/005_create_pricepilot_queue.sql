-- Migration: Create pricepilot_queue table
-- Purpose: Queue system for background processing of long-running operations
-- Requirements: 31.5

CREATE TABLE IF NOT EXISTS `pricepilot_queue` (
    `job_id` varchar(36) NOT NULL,
    `job_type` varchar(50) NOT NULL,
    `job_data` text NOT NULL,
    `status` enum(
        'pending',
        'processing',
        'completed',
        'failed',
        'cancelled'
    ) DEFAULT 'pending',
    `progress` int(3) DEFAULT 0,
    `result` text,
    `retry_count` int(2) DEFAULT 0,
    `priority` int(2) DEFAULT 5,
    `date_added` datetime NOT NULL,
    `date_started` datetime DEFAULT NULL,
    `date_completed` datetime DEFAULT NULL,
    PRIMARY KEY (`job_id`),
    KEY `idx_status` (`status`),
    KEY `idx_priority` (`priority`),
    KEY `idx_date_added` (`date_added`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;