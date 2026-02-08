/**
 * API Detection Progress Emitter
 * 
 * Provides real-time progress updates during API detection to prevent timeout assumptions
 * and give users visibility into the detection process.
 * 
 * Requirements: 5.5
 */

import { EventEmitter } from 'events';

export type ProgressEventType =
    | 'detection_started'
    | 'browser_launched'
    | 'page_navigated'
    | 'network_interception_started'
    | 'requests_captured'
    | 'pattern_analysis_started'
    | 'pattern_analysis_completed'
    | 'validation_started'
    | 'validation_completed'
    | 'detection_completed'
    | 'detection_failed';

export interface ProgressEvent {
    type: ProgressEventType;
    message: string;
    timestamp: Date;
    data?: Record<string, any>;
}

/**
 * API Detection Progress Emitter
 * 
 * Emits progress events during the detection phase to provide status updates
 */
export class ApiDetectionProgress extends EventEmitter {
    private competitorWebsiteId: string;
    private startTime: Date;

    constructor(competitorWebsiteId: string) {
        super();
        this.competitorWebsiteId = competitorWebsiteId;
        this.startTime = new Date();
    }

    /**
     * Emit a progress event
     * 
     * @param type - Event type
     * @param message - Human-readable message
     * @param data - Additional event data
     */
    emitProgress(type: ProgressEventType, message: string, data?: Record<string, any>): void {
        const event: ProgressEvent = {
            type,
            message,
            timestamp: new Date(),
            data: {
                ...data,
                competitorWebsiteId: this.competitorWebsiteId,
                elapsedMs: Date.now() - this.startTime.getTime(),
            },
        };

        this.emit('progress', event);
    }

    /**
     * Emit detection started event
     */
    detectionStarted(url: string): void {
        this.emitProgress('detection_started', `Starting API detection for ${url}`, { url });
    }

    /**
     * Emit browser launched event
     */
    browserLaunched(): void {
        this.emitProgress('browser_launched', 'Headless browser launched successfully');
    }

    /**
     * Emit page navigated event
     */
    pageNavigated(url: string, pageNumber: number): void {
        this.emitProgress('page_navigated', `Navigated to page ${pageNumber}`, {
            url,
            pageNumber,
        });
    }

    /**
     * Emit network interception started event
     */
    networkInterceptionStarted(): void {
        this.emitProgress(
            'network_interception_started',
            'Network interception started, capturing requests'
        );
    }

    /**
     * Emit requests captured event
     */
    requestsCaptured(count: number): void {
        this.emitProgress('requests_captured', `Captured ${count} network requests`, { count });
    }

    /**
     * Emit pattern analysis started event
     */
    patternAnalysisStarted(requestCount: number): void {
        this.emitProgress(
            'pattern_analysis_started',
            `Analyzing ${requestCount} requests for API patterns`,
            { requestCount }
        );
    }

    /**
     * Emit pattern analysis completed event
     */
    patternAnalysisCompleted(patternsFound: number): void {
        this.emitProgress(
            'pattern_analysis_completed',
            `Found ${patternsFound} potential API patterns`,
            { patternsFound }
        );
    }

    /**
     * Emit validation started event
     */
    validationStarted(patternCount: number): void {
        this.emitProgress(
            'validation_started',
            `Validating ${patternCount} API patterns`,
            { patternCount }
        );
    }

    /**
     * Emit validation completed event
     */
    validationCompleted(validatedCount: number, totalCount: number): void {
        this.emitProgress(
            'validation_completed',
            `Validated ${validatedCount} of ${totalCount} patterns`,
            { validatedCount, totalCount }
        );
    }

    /**
     * Emit detection completed event
     */
    detectionCompleted(discoveredApis: number): void {
        this.emitProgress(
            'detection_completed',
            `Detection completed, discovered ${discoveredApis} APIs`,
            { discoveredApis }
        );
    }

    /**
     * Emit detection failed event
     */
    detectionFailed(error: string): void {
        this.emitProgress('detection_failed', `Detection failed: ${error}`, { error });
    }

    /**
     * Get elapsed time since detection started
     */
    getElapsedTime(): number {
        return Date.now() - this.startTime.getTime();
    }
}

/**
 * Create a progress emitter for API detection
 * 
 * @param competitorWebsiteId - Competitor website ID
 * @returns Progress emitter instance
 */
export function createProgressEmitter(competitorWebsiteId: string): ApiDetectionProgress {
    return new ApiDetectionProgress(competitorWebsiteId);
}
