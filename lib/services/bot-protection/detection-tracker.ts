/**
 * Detection Tracker for Bot Protection Handling
 * 
 * Tracks consecutive detection failures to increase confidence scores.
 * Implements Requirement 1.8
 */

import { ProtectionType } from './detection-engine';

interface DetectionHistory {
    competitorWebsiteId: string;
    protectionType: ProtectionType;
    consecutiveCount: number;
    lastDetectedAt: Date;
}

/**
 * Tracks detection history to improve confidence scores
 * for consecutive failures with the same protection type
 */
export class DetectionTracker {
    private history: Map<string, DetectionHistory> = new Map();

    // Time window for considering detections as consecutive (5 minutes)
    private static readonly CONSECUTIVE_WINDOW_MS = 5 * 60 * 1000;

    /**
     * Record a detection and get the adjusted confidence score
     * Requirement 1.8: Increase confidence for multiple consecutive failures
     * 
     * @param competitorWebsiteId - ID of the competitor website
     * @param protectionType - Type of protection detected
     * @param baseConfidence - Base confidence score from detection engine
     * @returns Adjusted confidence score
     */
    recordDetection(
        competitorWebsiteId: string,
        protectionType: ProtectionType,
        baseConfidence: number
    ): number {
        const key = `${competitorWebsiteId}:${protectionType}`;
        const now = new Date();
        const existing = this.history.get(key);

        let consecutiveCount = 1;

        if (existing) {
            const timeSinceLastDetection = now.getTime() - existing.lastDetectedAt.getTime();

            // If within consecutive window, increment count
            if (timeSinceLastDetection <= DetectionTracker.CONSECUTIVE_WINDOW_MS) {
                consecutiveCount = existing.consecutiveCount + 1;
            }
        }

        // Update history
        this.history.set(key, {
            competitorWebsiteId,
            protectionType,
            consecutiveCount,
            lastDetectedAt: now,
        });

        // Calculate adjusted confidence
        // Each consecutive detection adds 5% confidence, up to 100%
        const consecutiveBonus = Math.min((consecutiveCount - 1) * 5, 20);
        const adjustedConfidence = Math.min(baseConfidence + consecutiveBonus, 100);

        return adjustedConfidence;
    }

    /**
     * Record a successful scrape (resets consecutive count)
     * 
     * @param competitorWebsiteId - ID of the competitor website
     */
    recordSuccess(competitorWebsiteId: string): void {
        // Clear all detection history for this site on success
        const keysToDelete: string[] = [];

        this.history.forEach((value, key) => {
            if (value.competitorWebsiteId === competitorWebsiteId) {
                keysToDelete.push(key);
            }
        });

        keysToDelete.forEach(key => this.history.delete(key));
    }

    /**
     * Get consecutive failure count for a site and protection type
     * 
     * @param competitorWebsiteId - ID of the competitor website
     * @param protectionType - Type of protection
     * @returns Consecutive failure count
     */
    getConsecutiveCount(
        competitorWebsiteId: string,
        protectionType: ProtectionType
    ): number {
        const key = `${competitorWebsiteId}:${protectionType}`;
        const existing = this.history.get(key);

        if (!existing) {
            return 0;
        }

        const now = new Date();
        const timeSinceLastDetection = now.getTime() - existing.lastDetectedAt.getTime();

        // Only count if within consecutive window
        if (timeSinceLastDetection <= DetectionTracker.CONSECUTIVE_WINDOW_MS) {
            return existing.consecutiveCount;
        }

        return 0;
    }

    /**
     * Clear old history entries (cleanup)
     * Should be called periodically to prevent memory leaks
     */
    cleanup(): void {
        const now = new Date();
        const keysToDelete: string[] = [];

        this.history.forEach((value, key) => {
            const age = now.getTime() - value.lastDetectedAt.getTime();
            // Remove entries older than 1 hour
            if (age > 60 * 60 * 1000) {
                keysToDelete.push(key);
            }
        });

        keysToDelete.forEach(key => this.history.delete(key));
    }

    /**
     * Get all detection history (for debugging/monitoring)
     */
    getHistory(): DetectionHistory[] {
        return Array.from(this.history.values());
    }
}

// Singleton instance
let trackerInstance: DetectionTracker | null = null;

/**
 * Get the singleton DetectionTracker instance
 */
export function getDetectionTracker(): DetectionTracker {
    if (!trackerInstance) {
        trackerInstance = new DetectionTracker();
    }
    return trackerInstance;
}
