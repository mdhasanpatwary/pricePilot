import { Page } from 'playwright';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

export interface CaptchaSolveRequest {
    type: 'recaptcha_v2' | 'recaptcha_v3' | 'hcaptcha' | 'turnstile';
    siteKey: string;
    pageUrl: string;
    action?: string; // For reCAPTCHA v3
    minScore?: number; // For reCAPTCHA v3
}

export interface CaptchaSolveResult {
    success: boolean;
    token?: string;
    solveTime: number; // milliseconds
    cost: number; // credits used
    error?: string;
}

export interface CaptchaSolverOptions {
    apiKey: string;
    pollingInterval?: number; // Default: 5000ms
    timeout?: number; // Default: 120000ms
    apiBaseUrl?: string; // Default: https://2captcha.com
}

export interface CaptchaSolverStats {
    totalSolves: number;
    successfulSolves: number;
    failedSolves: number;
    avgSolveTime: number;
    totalCost: number;
    solvesByType: Record<string, number>;
}

/**
 * CaptchaSolver integrates with 2Captcha API to solve captcha challenges automatically.
 * Supports reCAPTCHA v2, reCAPTCHA v3, hCaptcha, and Turnstile.
 */
export class CaptchaSolver {
    private apiKey: string;
    private pollingInterval: number;
    private timeout: number;
    private apiBaseUrl: string;
    private stats: CaptchaSolverStats;

    constructor(options: CaptchaSolverOptions) {
        this.apiKey = options.apiKey;
        this.pollingInterval = options.pollingInterval ?? 5000;
        this.timeout = options.timeout ?? 120000;
        this.apiBaseUrl = options.apiBaseUrl ?? 'https://2captcha.com';

        this.stats = {
            totalSolves: 0,
            successfulSolves: 0,
            failedSolves: 0,
            avgSolveTime: 0,
            totalCost: 0,
            solvesByType: {}
        };
    }

    /**
     * Solve a captcha challenge using 2Captcha API.
     * Submits the challenge and polls for the solution with exponential backoff.
     * 
     * @param request - Captcha solve request with type, site key, and page URL
     * @param site - Site domain for tracking purposes
     * @returns Solve result with success status, token, solve time, and cost
     * 
     * @example
     * ```typescript
     * const solver = new CaptchaSolver({ apiKey: 'your-api-key' });
     * const result = await solver.solveCaptcha({
     *   type: 'recaptcha_v2',
     *   siteKey: '6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-',
     *   pageUrl: 'https://example.com'
     * }, 'example.com');
     * if (result.success) {
     *   console.log('Captcha solved:', result.token);
     * }
     * ```
     */
    async solveCaptcha(request: CaptchaSolveRequest, site?: string): Promise<CaptchaSolveResult> {
        const startTime = Date.now();
        this.stats.totalSolves++;

        // Track solves by type
        if (!this.stats.solvesByType[request.type]) {
            this.stats.solvesByType[request.type] = 0;
        }
        this.stats.solvesByType[request.type]++;

        try {
            logger.info(`Submitting ${request.type} captcha to 2Captcha`, {
                siteKey: request.siteKey,
                pageUrl: request.pageUrl
            });

            // Submit captcha to 2Captcha
            const taskId = await this.submitCaptcha(request);

            if (!taskId) {
                const error = 'Failed to submit captcha to 2Captcha';
                logger.error(error);
                this.stats.failedSolves++;

                // Record failed attempt in database
                await this.recordSolveAttempt(site || request.pageUrl, request.type, false, Date.now() - startTime, 0, error);

                return {
                    success: false,
                    solveTime: Date.now() - startTime,
                    cost: 0,
                    error
                };
            }

            logger.info(`Captcha submitted, task ID: ${taskId}`);

            // Poll for solution
            const solution = await this.pollForSolution(taskId, startTime);

            if (solution.success && solution.token) {
                const solveTime = Date.now() - startTime;
                this.stats.successfulSolves++;

                // Update average solve time
                const totalSolveTime = this.stats.avgSolveTime * (this.stats.successfulSolves - 1) + solveTime;
                this.stats.avgSolveTime = totalSolveTime / this.stats.successfulSolves;

                // Estimate cost (2Captcha pricing varies by captcha type)
                const cost = this.estimateCost(request.type);
                this.stats.totalCost += cost;

                logger.info(`Captcha solved successfully in ${solveTime}ms`, {
                    type: request.type,
                    cost
                });

                // Record successful attempt in database
                await this.recordSolveAttempt(site || request.pageUrl, request.type, true, solveTime, cost);

                return {
                    success: true,
                    token: solution.token,
                    solveTime,
                    cost
                };
            } else {
                this.stats.failedSolves++;
                logger.error('Failed to solve captcha', { error: solution.error });

                // Record failed attempt in database
                await this.recordSolveAttempt(site || request.pageUrl, request.type, false, Date.now() - startTime, 0, solution.error);

                return {
                    success: false,
                    solveTime: Date.now() - startTime,
                    cost: 0,
                    error: solution.error
                };
            }
        } catch (error) {
            this.stats.failedSolves++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Error solving captcha', { error: errorMessage });

            // Record failed attempt in database
            await this.recordSolveAttempt(site || request.pageUrl, request.type, false, Date.now() - startTime, 0, errorMessage);

            return {
                success: false,
                solveTime: Date.now() - startTime,
                cost: 0,
                error: errorMessage
            };
        }
    }

    /**
     * Submit captcha to 2Captcha API and get task ID.
     * 
     * @param request - Captcha solve request
     * @returns Task ID for polling, or null if submission failed
     */
    private async submitCaptcha(request: CaptchaSolveRequest): Promise<string | null> {
        try {
            const params = new URLSearchParams({
                key: this.apiKey,
                json: '1'
            });

            // Add captcha-specific parameters
            switch (request.type) {
                case 'recaptcha_v2':
                    params.append('method', 'userrecaptcha');
                    params.append('googlekey', request.siteKey);
                    params.append('pageurl', request.pageUrl);
                    break;

                case 'recaptcha_v3':
                    params.append('method', 'userrecaptcha');
                    params.append('version', 'v3');
                    params.append('googlekey', request.siteKey);
                    params.append('pageurl', request.pageUrl);
                    if (request.action) {
                        params.append('action', request.action);
                    }
                    if (request.minScore) {
                        params.append('min_score', request.minScore.toString());
                    }
                    break;

                case 'hcaptcha':
                    params.append('method', 'hcaptcha');
                    params.append('sitekey', request.siteKey);
                    params.append('pageurl', request.pageUrl);
                    break;

                case 'turnstile':
                    params.append('method', 'turnstile');
                    params.append('sitekey', request.siteKey);
                    params.append('pageurl', request.pageUrl);
                    break;
            }

            const response = await fetch(`${this.apiBaseUrl}/in.php?${params.toString()}`);
            const data = await response.json();

            if (data.status === 1 && data.request) {
                return data.request; // Task ID
            } else {
                logger.error('2Captcha submission failed', { data });
                return null;
            }
        } catch (error) {
            logger.error('Error submitting captcha to 2Captcha', { error });
            return null;
        }
    }

    /**
     * Poll 2Captcha API for solution with exponential backoff.
     * 
     * @param taskId - Task ID from submission
     * @param startTime - Start time for timeout calculation
     * @returns Solution result with token or error
     */
    private async pollForSolution(
        taskId: string,
        startTime: number
    ): Promise<{ success: boolean; token?: string; error?: string }> {
        let attempts = 0;

        while (Date.now() - startTime < this.timeout) {
            attempts++;

            // Wait before polling (first attempt waits 5s, subsequent attempts wait pollingInterval)
            await new Promise(resolve => setTimeout(resolve, this.pollingInterval));

            try {
                const params = new URLSearchParams({
                    key: this.apiKey,
                    action: 'get',
                    id: taskId,
                    json: '1'
                });

                const response = await fetch(`${this.apiBaseUrl}/res.php?${params.toString()}`);
                const data = await response.json();

                if (data.status === 1 && data.request) {
                    // Solution ready
                    return {
                        success: true,
                        token: data.request
                    };
                } else if (data.request === 'CAPCHA_NOT_READY') {
                    // Still processing, continue polling
                    logger.info(`Captcha not ready yet, attempt ${attempts}`);
                    continue;
                } else {
                    // Error occurred
                    return {
                        success: false,
                        error: data.request || 'Unknown error from 2Captcha'
                    };
                }
            } catch (error) {
                logger.error('Error polling 2Captcha for solution', { error, attempt: attempts });
                // Continue polling on network errors
                continue;
            }
        }

        // Timeout reached
        return {
            success: false,
            error: `Timeout after ${this.timeout}ms`
        };
    }

    /**
     * Estimate cost for solving a captcha based on type.
     * Costs are approximate based on 2Captcha pricing.
     * 
     * @param type - Captcha type
     * @returns Estimated cost in USD
     */
    private estimateCost(type: string): number {
        const costs: Record<string, number> = {
            'recaptcha_v2': 0.002,    // $2 per 1000 captchas
            'recaptcha_v3': 0.002,    // $2 per 1000 captchas
            'hcaptcha': 0.002,        // $2 per 1000 captchas
            'turnstile': 0.002        // $2 per 1000 captchas
        };

        return costs[type] || 0.002;
    }

    /**
     * Get captcha solving statistics.
     * 
     * @returns Statistics including total solves, success rate, average solve time, and cost
     * 
     * @example
     * ```typescript
     * const stats = solver.getStats();
     * console.log(`Success rate: ${(stats.successfulSolves / stats.totalSolves * 100).toFixed(1)}%`);
     * console.log(`Average solve time: ${stats.avgSolveTime}ms`);
     * console.log(`Total cost: $${stats.totalCost.toFixed(4)}`);
     * ```
     */
    getStats(): CaptchaSolverStats {
        return { ...this.stats };
    }

    /**
     * Detect captcha type on a page.
     * Checks for reCAPTCHA v2, reCAPTCHA v3, hCaptcha, and Turnstile.
     * 
     * @param page - Playwright page object to check
     * @returns Captcha solve request if detected, null otherwise
     * 
     * @example
     * ```typescript
     * const captchaRequest = await solver.detectCaptchaType(page);
     * if (captchaRequest) {
     *   console.log(`Detected ${captchaRequest.type} captcha`);
     *   const result = await solver.solveCaptcha(captchaRequest);
     * }
     * ```
     */
    async detectCaptchaType(page: Page): Promise<CaptchaSolveRequest | null> {
        try {
            const pageUrl = page.url();

            // Check for Turnstile
            const turnstileData = await page.evaluate(() => {
                const turnstileElement = document.querySelector('.cf-turnstile') ||
                    document.querySelector('iframe[src*="turnstile"]') ||
                    document.querySelector('[id*="cf-turnstile"]');

                if (turnstileElement) {
                    const siteKey = turnstileElement.getAttribute('data-sitekey') ||
                        turnstileElement.getAttribute('data-site-key');
                    return siteKey ? { type: 'turnstile' as const, siteKey } : null;
                }
                return null;
            });

            if (turnstileData) {
                logger.info('Detected Turnstile captcha', { siteKey: turnstileData.siteKey });
                return {
                    type: turnstileData.type,
                    siteKey: turnstileData.siteKey,
                    pageUrl
                };
            }

            // Check for reCAPTCHA v2
            const recaptchaV2Data = await page.evaluate(() => {
                const recaptchaElement = document.querySelector('.g-recaptcha') ||
                    document.querySelector('iframe[src*="recaptcha/api2"]');

                if (recaptchaElement) {
                    const siteKey = recaptchaElement.getAttribute('data-sitekey') ||
                        recaptchaElement.getAttribute('data-site-key');
                    return siteKey ? { type: 'recaptcha_v2' as const, siteKey } : null;
                }
                return null;
            });

            if (recaptchaV2Data) {
                logger.info('Detected reCAPTCHA v2', { siteKey: recaptchaV2Data.siteKey });
                return {
                    type: recaptchaV2Data.type,
                    siteKey: recaptchaV2Data.siteKey,
                    pageUrl
                };
            }

            // Check for reCAPTCHA v3
            const recaptchaV3Data = await page.evaluate(() => {
                // reCAPTCHA v3 is typically loaded via script tag
                const scripts = Array.from(document.querySelectorAll('script'));
                const recaptchaScript = scripts.find(script =>
                    script.src.includes('recaptcha/api.js') ||
                    script.src.includes('recaptcha/enterprise.js')
                );

                if (recaptchaScript) {
                    const src = recaptchaScript.src;
                    const match = src.match(/render=([^&]+)/);
                    const siteKey = match ? match[1] : null;

                    // Try to find action from grecaptcha.execute calls
                    const action = (window as any).grecaptcha?.execute ? 'submit' : undefined;

                    return siteKey ? {
                        type: 'recaptcha_v3' as const,
                        siteKey,
                        action
                    } : null;
                }
                return null;
            });

            if (recaptchaV3Data) {
                logger.info('Detected reCAPTCHA v3', {
                    siteKey: recaptchaV3Data.siteKey,
                    action: recaptchaV3Data.action
                });
                return {
                    type: recaptchaV3Data.type,
                    siteKey: recaptchaV3Data.siteKey,
                    pageUrl,
                    action: recaptchaV3Data.action,
                    minScore: 0.5 // Default minimum score
                };
            }

            // Check for hCaptcha
            const hcaptchaData = await page.evaluate(() => {
                const hcaptchaElement = document.querySelector('.h-captcha') ||
                    document.querySelector('iframe[src*="hcaptcha"]') ||
                    document.querySelector('[data-hcaptcha-sitekey]');

                if (hcaptchaElement) {
                    const siteKey = hcaptchaElement.getAttribute('data-sitekey') ||
                        hcaptchaElement.getAttribute('data-hcaptcha-sitekey');
                    return siteKey ? { type: 'hcaptcha' as const, siteKey } : null;
                }
                return null;
            });

            if (hcaptchaData) {
                logger.info('Detected hCaptcha', { siteKey: hcaptchaData.siteKey });
                return {
                    type: hcaptchaData.type,
                    siteKey: hcaptchaData.siteKey,
                    pageUrl
                };
            }

            // No captcha detected
            return null;
        } catch (error) {
            logger.error('Error detecting captcha type', { error });
            return null;
        }
    }

    /**
     * Inject captcha solution token into the page.
     * Handles different captcha types (reCAPTCHA, hCaptcha, Turnstile).
     * 
     * @param page - Playwright page object
     * @param token - Solution token from 2Captcha
     * @param type - Captcha type
     * 
     * @example
     * ```typescript
     * const result = await solver.solveCaptcha(captchaRequest);
     * if (result.success && result.token) {
     *   await solver.injectSolution(page, result.token, captchaRequest.type);
     *   // Wait for page to process the solution
     *   await page.waitForTimeout(2000);
     * }
     * ```
     */
    async injectSolution(page: Page, token: string, type: string): Promise<void> {
        try {
            logger.info(`Injecting ${type} solution token`);

            switch (type) {
                case 'recaptcha_v2':
                    await page.evaluate((token) => {
                        // Set the response in the textarea
                        const textarea = document.querySelector('#g-recaptcha-response') as HTMLTextAreaElement;
                        if (textarea) {
                            textarea.value = token;
                            textarea.style.display = 'block';
                        }

                        // Trigger callback if it exists
                        if ((window as any).grecaptcha && (window as any).grecaptcha.getResponse) {
                            const callback = (window as any).___grecaptcha_cfg?.clients?.[0]?.callback;
                            if (callback && typeof callback === 'function') {
                                callback(token);
                            }
                        }
                    }, token);
                    break;

                case 'recaptcha_v3':
                    await page.evaluate((token) => {
                        // For reCAPTCHA v3, we need to set the token in the hidden input
                        const input = document.querySelector('input[name="g-recaptcha-response"]') as HTMLInputElement;
                        if (input) {
                            input.value = token;
                        }

                        // Also try to trigger any registered callbacks
                        if ((window as any).grecaptcha && (window as any).grecaptcha.execute) {
                            // The token is typically used automatically by the form submission
                            // We just need to ensure it's available
                            (window as any).__recaptcha_token = token;
                        }
                    }, token);
                    break;

                case 'hcaptcha':
                    await page.evaluate((token) => {
                        // Set the response in the textarea
                        const textarea = document.querySelector('textarea[name="h-captcha-response"]') as HTMLTextAreaElement;
                        if (textarea) {
                            textarea.value = token;
                        }

                        // Also set in the data attribute
                        const hcaptchaElement = document.querySelector('.h-captcha');
                        if (hcaptchaElement) {
                            hcaptchaElement.setAttribute('data-hcaptcha-response', token);
                        }

                        // Trigger callback if it exists
                        if ((window as any).hcaptcha) {
                            const callback = (window as any).hcaptcha.callback;
                            if (callback && typeof callback === 'function') {
                                callback(token);
                            }
                        }
                    }, token);
                    break;

                case 'turnstile':
                    await page.evaluate((token) => {
                        // Set the response in the hidden input
                        const input = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
                        if (input) {
                            input.value = token;
                        }

                        // Also try to find and set in any turnstile-specific elements
                        const turnstileElement = document.querySelector('.cf-turnstile');
                        if (turnstileElement) {
                            turnstileElement.setAttribute('data-response', token);
                        }

                        // Trigger callback if it exists
                        if ((window as any).turnstile) {
                            const callback = (window as any).turnstile.callback;
                            if (callback && typeof callback === 'function') {
                                callback(token);
                            }
                        }
                    }, token);
                    break;

                default:
                    logger.warn(`Unknown captcha type for injection: ${type}`);
            }

            logger.info(`Successfully injected ${type} solution token`);
        } catch (error) {
            logger.error('Error injecting captcha solution', { error, type });
            throw error;
        }
    }

    /**
     * Record a captcha solve attempt in the database.
     * Tracks solve time, success rate, and cost per captcha type.
     * 
     * @param site - Site domain
     * @param captchaType - Type of captcha
     * @param success - Whether the solve was successful
     * @param solveTime - Time taken to solve in milliseconds
     * @param cost - Cost of solving in USD
     * @param errorMessage - Error message if solve failed
     */
    private async recordSolveAttempt(
        site: string,
        captchaType: string,
        success: boolean,
        solveTime: number,
        cost: number,
        errorMessage?: string
    ): Promise<void> {
        try {
            await prisma.captchaSolveAttempt.create({
                data: {
                    site,
                    captchaType,
                    success,
                    solveTime,
                    cost,
                    errorMessage
                }
            });
        } catch (error) {
            logger.error('Error recording captcha solve attempt', { error });
            // Don't throw - we don't want to fail the solve operation if recording fails
        }
    }

    /**
     * Get captcha solve statistics from the database.
     * Returns solve rates, average solve times, and total costs per captcha type.
     * 
     * @param site - Optional site filter
     * @param timeRange - Time range for statistics ('1h', '24h', '7d')
     * @returns Statistics including solve rates and costs per captcha type
     * 
     * @example
     * ```typescript
     * const stats = await solver.getCaptchaStats('example.com', '24h');
     * for (const stat of stats) {
     *   console.log(`${stat.captchaType}: ${(stat.solveRate * 100).toFixed(1)}% solve rate`);
     *   console.log(`Average solve time: ${stat.avgSolveTime}ms`);
     *   console.log(`Total cost: $${stat.totalCost.toFixed(4)}`);
     * }
     * ```
     */
    async getCaptchaStats(site?: string, timeRange: '1h' | '24h' | '7d' = '24h'): Promise<Array<{
        captchaType: string;
        totalAttempts: number;
        successfulSolves: number;
        failedSolves: number;
        solveRate: number;
        avgSolveTime: number;
        totalCost: number;
    }>> {
        try {
            // Calculate time threshold
            const now = new Date();
            const timeThresholds = {
                '1h': new Date(now.getTime() - 60 * 60 * 1000),
                '24h': new Date(now.getTime() - 24 * 60 * 60 * 1000),
                '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            };
            const threshold = timeThresholds[timeRange];

            // Build where clause
            const where: any = {
                timestamp: {
                    gte: threshold
                }
            };
            if (site) {
                where.site = site;
            }

            // Get all attempts
            const attempts = await prisma.captchaSolveAttempt.findMany({
                where
            });

            // Group by captcha type
            const statsByType = new Map<string, {
                captchaType: string;
                totalAttempts: number;
                successfulSolves: number;
                failedSolves: number;
                solveRate: number;
                avgSolveTime: number;
                totalCost: number;
            }>();

            for (const attempt of attempts) {
                if (!statsByType.has(attempt.captchaType)) {
                    statsByType.set(attempt.captchaType, {
                        captchaType: attempt.captchaType,
                        totalAttempts: 0,
                        successfulSolves: 0,
                        failedSolves: 0,
                        solveRate: 0,
                        avgSolveTime: 0,
                        totalCost: 0
                    });
                }

                const stats = statsByType.get(attempt.captchaType)!;
                stats.totalAttempts++;

                if (attempt.success) {
                    stats.successfulSolves++;
                } else {
                    stats.failedSolves++;
                }

                stats.totalCost += attempt.cost;
            }

            // Calculate rates and averages
            const results: Array<{
                captchaType: string;
                totalAttempts: number;
                successfulSolves: number;
                failedSolves: number;
                solveRate: number;
                avgSolveTime: number;
                totalCost: number;
            }> = [];

            for (const stats of statsByType.values()) {
                stats.solveRate = stats.totalAttempts > 0
                    ? stats.successfulSolves / stats.totalAttempts
                    : 0;

                // Calculate average solve time for successful solves
                const successfulAttempts = attempts.filter(
                    (a) => a.captchaType === stats.captchaType && a.success
                );

                if (successfulAttempts.length > 0) {
                    const totalTime = successfulAttempts.reduce(
                        (sum: number, a) => sum + a.solveTime,
                        0
                    );
                    stats.avgSolveTime = totalTime / successfulAttempts.length;
                }

                results.push(stats);
            }

            return results;
        } catch (error) {
            logger.error('Error getting captcha stats from database', { error });
            return [];
        }
    }
}
