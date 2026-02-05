/**
 * Staleness Configuration Service
 * 
 * Manages configurable staleness thresholds for last known good prices.
 * 
 * Requirements: 14.4, 14.5
 */

import { SystemConfigService } from '@/lib/config';
import { prisma } from '@/lib/prisma';

/**
 * Default staleness threshold in milliseconds (7 days)
 */
export const DEFAULT_STALENESS_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * System config key for staleness threshold
 */
export const STALENESS_THRESHOLD_CONFIG_KEY = 'SCRAPING_STALENESS_THRESHOLD_DAYS';

/**
 * Get staleness threshold in milliseconds
 * 
 * Retrieves the configured staleness threshold from system config.
 * Falls back to default (7 days) if not configured.
 * 
 * Requirements: 14.4
 * 
 * @returns Staleness threshold in milliseconds
 */
export async function getStalenessThresholdMs(): Promise<number> {
    const thresholdDays = await SystemConfigService.get<number>(
        STALENESS_THRESHOLD_CONFIG_KEY,
        7 // Default: 7 days
    );

    return thresholdDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds
}

/**
 * Set staleness threshold
 * 
 * Updates the staleness threshold configuration.
 * 
 * Requirements: 14.4
 * 
 * @param thresholdDays - Staleness threshold in days
 */
export async function setStalenessThreshold(thresholdDays: number): Promise<void> {
    if (thresholdDays < 1) {
        throw new Error('Staleness threshold must be at least 1 day');
    }

    if (thresholdDays > 90) {
        throw new Error('Staleness threshold cannot exceed 90 days');
    }

    await prisma.systemConfig.upsert({
        where: { key: STALENESS_THRESHOLD_CONFIG_KEY },
        create: {
            key: STALENESS_THRESHOLD_CONFIG_KEY,
            value: thresholdDays.toString(),
            type: 'number',
            description: 'Number of days before a last known good price is considered stale',
        },
        update: {
            value: thresholdDays.toString(),
            updatedAt: new Date(),
        },
    });
}

/**
 * Initialize staleness threshold config if not exists
 * 
 * Creates the default staleness threshold configuration if it doesn't exist.
 */
export async function initializeStalenessConfig(): Promise<void> {
    const existing = await prisma.systemConfig.findUnique({
        where: { key: STALENESS_THRESHOLD_CONFIG_KEY },
    });

    if (!existing) {
        await prisma.systemConfig.create({
            data: {
                key: STALENESS_THRESHOLD_CONFIG_KEY,
                value: '7',
                type: 'number',
                description: 'Number of days before a last known good price is considered stale',
            },
        });
    }
}

/**
 * Staleness configuration interface
 */
export interface StalenessConfig {
    thresholdDays: number;
    thresholdMs: number;
}

/**
 * Get complete staleness configuration
 * 
 * Requirements: 14.4
 * 
 * @returns Staleness configuration
 */
export async function getStalenessConfig(): Promise<StalenessConfig> {
    const thresholdDays = await SystemConfigService.get<number>(
        STALENESS_THRESHOLD_CONFIG_KEY,
        7
    );

    return {
        thresholdDays,
        thresholdMs: thresholdDays * 24 * 60 * 60 * 1000,
    };
}
