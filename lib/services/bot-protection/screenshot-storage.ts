/**
 * Screenshot Storage Service
 * 
 * Handles storage and retrieval of screenshots from scraping attempts.
 * Supports local file storage and S3-compatible storage.
 * 
 * Requirements: 8.3, 8.5
 */

import { writeFile, mkdir, unlink, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Screenshot storage configuration
 */
export interface ScreenshotStorageConfig {
    storageType: 'local' | 's3';
    localPath?: string;
    s3Bucket?: string;
    s3Region?: string;
    s3AccessKeyId?: string;
    s3SecretAccessKey?: string;
}

/**
 * Screenshot Storage Service
 * 
 * Provides abstraction for storing and retrieving screenshots.
 * Currently implements local file storage with S3 support planned.
 */
export class ScreenshotStorage {
    private config: ScreenshotStorageConfig;
    // private baseUrl: string; // Reserved for future use with URL generation

    constructor(config?: Partial<ScreenshotStorageConfig>) {
        this.config = {
            storageType: config?.storageType || 'local',
            localPath: config?.localPath || join(process.cwd(), 'storage', 'screenshots'),
        };

        // Base URL for accessing screenshots (reserved for future use)
        // this.baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    }

    /**
     * Store a screenshot
     * 
     * @param screenshot - Screenshot buffer
     * @param scrapeAttemptId - Scrape attempt ID for filename
     * @returns URL to access the screenshot
     */
    async storeScreenshot(screenshot: Buffer, scrapeAttemptId: string): Promise<string> {
        if (this.config.storageType === 'local') {
            return this.storeScreenshotLocal(screenshot, scrapeAttemptId);
        } else if (this.config.storageType === 's3') {
            return this.storeScreenshotS3(screenshot, scrapeAttemptId);
        }

        throw new Error(`Unsupported storage type: ${this.config.storageType}`);
    }

    /**
     * Retrieve a screenshot
     * 
     * @param url - Screenshot URL
     * @returns Screenshot buffer
     */
    async retrieveScreenshot(url: string): Promise<Buffer> {
        if (this.config.storageType === 'local') {
            return this.retrieveScreenshotLocal(url);
        } else if (this.config.storageType === 's3') {
            return this.retrieveScreenshotS3(url);
        }

        throw new Error(`Unsupported storage type: ${this.config.storageType}`);
    }

    /**
     * Delete a screenshot
     * 
     * @param url - Screenshot URL
     */
    async deleteScreenshot(url: string): Promise<void> {
        if (this.config.storageType === 'local') {
            return this.deleteScreenshotLocal(url);
        } else if (this.config.storageType === 's3') {
            return this.deleteScreenshotS3(url);
        }

        throw new Error(`Unsupported storage type: ${this.config.storageType}`);
    }

    /**
     * Delete screenshots older than specified days
     * 
     * @param days - Number of days to retain
     * @returns Number of screenshots deleted
     */
    async deleteOldScreenshots(days: number): Promise<number> {
        if (this.config.storageType === 'local') {
            return this.deleteOldScreenshotsLocal(days);
        } else if (this.config.storageType === 's3') {
            return this.deleteOldScreenshotsS3(days);
        }

        return 0;
    }

    /**
     * Store screenshot locally
     */
    private async storeScreenshotLocal(screenshot: Buffer, scrapeAttemptId: string): Promise<string> {
        const storagePath = this.config.localPath!;

        // Ensure storage directory exists
        if (!existsSync(storagePath)) {
            await mkdir(storagePath, { recursive: true });
        }

        const filename = `${scrapeAttemptId}.png`;
        const filepath = join(storagePath, filename);

        await writeFile(filepath, screenshot);

        // Return URL path (not full filesystem path)
        return `/api/screenshots/${filename}`;
    }

    /**
     * Retrieve screenshot from local storage
     */
    private async retrieveScreenshotLocal(url: string): Promise<Buffer> {
        const filename = url.split('/').pop();
        if (!filename) {
            throw new Error('Invalid screenshot URL');
        }

        const filepath = join(this.config.localPath!, filename);
        return readFile(filepath);
    }

    /**
     * Delete screenshot from local storage
     */
    private async deleteScreenshotLocal(url: string): Promise<void> {
        const filename = url.split('/').pop();
        if (!filename) {
            return;
        }

        const filepath = join(this.config.localPath!, filename);

        try {
            await unlink(filepath);
        } catch (error) {
            // Ignore if file doesn't exist
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }
    }

    /**
     * Delete old screenshots from local storage
     */
    private async deleteOldScreenshotsLocal(_days: number): Promise<number> {
        // This would require reading directory and checking file timestamps
        // For now, return 0 as this is typically handled by the cleanup job
        // which deletes based on database records
        return 0;
    }

    /**
     * Store screenshot in S3 (placeholder for future implementation)
     */
    private async storeScreenshotS3(_screenshot: Buffer, _scrapeAttemptId: string): Promise<string> {
        // TODO: Implement S3 storage using AWS SDK
        throw new Error('S3 storage not yet implemented');
    }

    /**
     * Retrieve screenshot from S3 (placeholder for future implementation)
     */
    private async retrieveScreenshotS3(_url: string): Promise<Buffer> {
        // TODO: Implement S3 retrieval using AWS SDK
        throw new Error('S3 storage not yet implemented');
    }

    /**
     * Delete screenshot from S3 (placeholder for future implementation)
     */
    private async deleteScreenshotS3(_url: string): Promise<void> {
        // TODO: Implement S3 deletion using AWS SDK
        throw new Error('S3 storage not yet implemented');
    }

    /**
     * Delete old screenshots from S3 (placeholder for future implementation)
     */
    private async deleteOldScreenshotsS3(_days: number): Promise<number> {
        // TODO: Implement S3 cleanup using AWS SDK
        throw new Error('S3 storage not yet implemented');
    }
}
