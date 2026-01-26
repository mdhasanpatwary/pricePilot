import { Page } from 'playwright';
import { logger } from '@/lib/logger';

export interface ChallengeResult {
  detected: boolean;
  type: 'cloudflare' | 'turnstile' | 'recaptcha' | 'perimeter-x' | 'datadome' | 'unknown';
  solved: boolean;
  attempts: number;
  duration: number;
}

export interface ChallengeStats {
  site: string;
  challengeType: string;
  totalAttempts: number;
  successfulSolves: number;
  solveRate: number;
  avgSolveTime: number;
}

interface ChallengeAttempt {
  site: string;
  result: ChallengeResult;
  timestamp: Date;
}

export class ChallengeHandler {
  private attempts: ChallengeAttempt[] = [];
  private fallbackThreshold: number;

  constructor(options?: { fallbackThreshold?: number }) {
    this.fallbackThreshold = options?.fallbackThreshold ?? 0.3; // 30% solve rate threshold
  }

  /**
   * Detect if a challenge is present on the page.
   * Checks for various anti-bot challenges including Cloudflare, Turnstile, reCAPTCHA, PerimeterX, and DataDome.
   * 
   * @param page - Playwright page object to check
   * @returns Challenge detection result with type and detection status
   * 
   * @example
   * ```typescript
   * const result = await challengeHandler.detectChallenge(page);
   * if (result.detected) {
   *   console.log(`Challenge detected: ${result.type}`);
   * }
   * ```
   */
  async detectChallenge(page: Page): Promise<ChallengeResult> {
    const startTime = Date.now();

    try {
      // Check for Cloudflare challenge
      const cloudflareChallenge = await page.evaluate(() => {
        return !!(
          document.querySelector('.cf-challenge') ||
          document.querySelector('[id*="cf-challenge"]') ||
          document.body?.textContent?.includes('Checking your browser') ||
          document.body?.textContent?.includes('cf-browser-verification')
        );
      });

      if (cloudflareChallenge) {
        return {
          detected: true,
          type: 'cloudflare',
          solved: false,
          attempts: 0,
          duration: Date.now() - startTime
        };
      }

      // Check for Turnstile challenge
      const turnstileChallenge = await page.evaluate(() => {
        return !!(
          document.querySelector('.cf-turnstile') ||
          document.querySelector('iframe[src*="turnstile"]') ||
          document.querySelector('[id*="cf-turnstile"]')
        );
      });

      if (turnstileChallenge) {
        return {
          detected: true,
          type: 'turnstile',
          solved: false,
          attempts: 0,
          duration: Date.now() - startTime
        };
      }

      // Check for reCAPTCHA challenge
      const recaptchaChallenge = await page.evaluate(() => {
        return !!(
          document.querySelector('.g-recaptcha') ||
          document.querySelector('iframe[src*="recaptcha"]') ||
          document.querySelector('[id*="recaptcha"]') ||
          document.querySelector('.recaptcha')
        );
      });

      if (recaptchaChallenge) {
        return {
          detected: true,
          type: 'recaptcha',
          solved: false,
          attempts: 0,
          duration: Date.now() - startTime
        };
      }

      // Check for PerimeterX challenge
      const perimeterXChallenge = await page.evaluate(() => {
        const hasPxCookie = document.cookie.includes('_px');
        const hasPxElement = !!(
          document.querySelector('[id*="px-captcha"]') ||
          document.querySelector('.px-captcha') ||
          document.body?.textContent?.includes('PerimeterX')
        );
        return hasPxCookie || hasPxElement;
      });

      if (perimeterXChallenge) {
        return {
          detected: true,
          type: 'perimeter-x',
          solved: false,
          attempts: 0,
          duration: Date.now() - startTime
        };
      }

      // Check for DataDome challenge
      const datadomeChallenge = await page.evaluate(() => {
        const hasDatadomeCookie = document.cookie.includes('datadome');
        const hasDatadomeElement = !!(
          document.querySelector('[id*="datadome"]') ||
          document.querySelector('.datadome') ||
          document.body?.textContent?.includes('DataDome')
        );
        return hasDatadomeCookie || hasDatadomeElement;
      });

      if (datadomeChallenge) {
        return {
          detected: true,
          type: 'datadome',
          solved: false,
          attempts: 0,
          duration: Date.now() - startTime
        };
      }

      // No challenge detected
      return {
        detected: false,
        type: 'unknown',
        solved: true,
        attempts: 0,
        duration: Date.now() - startTime
      };
    } catch (error) {
      logger.error('Error detecting challenge:', { error });
      return {
        detected: false,
        type: 'unknown',
        solved: false,
        attempts: 0,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Wait for a challenge to complete with exponential backoff.
   * Uses exponential backoff timing: 2s, 4s, 8s, 16s, 30s (max).
   * 
   * @param page - Playwright page object with the challenge
   * @param maxWaitTime - Maximum time to wait in milliseconds (default: 60000)
   * @returns Challenge result with solve status and duration
   * 
   * @example
   * ```typescript
   * const result = await challengeHandler.waitForChallenge(page, 60000);
   * if (result.solved) {
   *   console.log(`Challenge solved in ${result.duration}ms`);
   * } else {
   *   console.log(`Challenge timeout after ${result.attempts} attempts`);
   * }
   * ```
   */
  async waitForChallenge(page: Page, maxWaitTime: number = 60000): Promise<ChallengeResult> {
    const startTime = Date.now();
    const backoffDelays = [2000, 4000, 8000, 16000, 30000]; // Exponential backoff in ms
    let attempts = 0;

    // First detect the challenge
    const initialDetection = await this.detectChallenge(page);

    if (!initialDetection.detected) {
      return {
        ...initialDetection,
        solved: true,
        attempts: 0,
        duration: Date.now() - startTime
      };
    }

    logger.info(`Challenge detected: ${initialDetection.type}, waiting for completion...`);

    // Wait for challenge to complete with exponential backoff
    for (const delay of backoffDelays) {
      attempts++;

      // Check if we've exceeded max wait time
      if (Date.now() - startTime > maxWaitTime) {
        logger.warn(`Challenge timeout after ${attempts} attempts`);
        return {
          detected: true,
          type: initialDetection.type,
          solved: false,
          attempts,
          duration: Date.now() - startTime
        };
      }

      // Wait for the backoff delay
      await new Promise(resolve => setTimeout(resolve, delay));

      // Check if challenge is still present
      try {
        const currentDetection = await this.detectChallenge(page);

        if (!currentDetection.detected) {
          logger.info(`Challenge solved after ${attempts} attempts`);
          return {
            detected: true,
            type: initialDetection.type,
            solved: true,
            attempts,
            duration: Date.now() - startTime
          };
        }

        // Also check if page has navigated (challenge might be solved)
        const url = page.url();
        if (!url.includes('challenge') && !url.includes('captcha')) {
          logger.info(`Challenge appears solved (page navigated) after ${attempts} attempts`);
          return {
            detected: true,
            type: initialDetection.type,
            solved: true,
            attempts,
            duration: Date.now() - startTime
          };
        }
      } catch (error) {
        logger.error(`Error checking challenge status on attempt ${attempts}:`, { error });
      }
    }

    // Max attempts reached
    logger.warn(`Challenge not solved after ${attempts} attempts`);
    return {
      detected: true,
      type: initialDetection.type,
      solved: false,
      attempts,
      duration: Date.now() - startTime
    };
  }

  /**
   * Record a challenge attempt for statistics.
   * Stores attempt data for solve rate calculation and fallback triggering.
   * 
   * @param site - Domain or site identifier
   * @param result - Challenge result to record
   * 
   * @example
   * ```typescript
   * const result = await challengeHandler.waitForChallenge(page);
   * challengeHandler.recordChallengeAttempt('example.com', result);
   * ```
   */
  recordChallengeAttempt(site: string, result: ChallengeResult): void {
    this.attempts.push({
      site,
      result,
      timestamp: new Date()
    });

    // Keep only last 1000 attempts to prevent memory issues
    if (this.attempts.length > 1000) {
      this.attempts = this.attempts.slice(-1000);
    }
  }

  /**
   * Get challenge statistics for a specific site.
   * Returns solve rates, attempt counts, and average solve times per challenge type.
   * 
   * @param site - Domain or site identifier
   * @returns Array of challenge statistics grouped by challenge type
   * 
   * @example
   * ```typescript
   * const stats = challengeHandler.getChallengeStats('example.com');
   * for (const stat of stats) {
   *   console.log(`${stat.challengeType}: ${(stat.solveRate * 100).toFixed(1)}% solve rate`);
   * }
   * ```
   */
  getChallengeStats(site: string): ChallengeStats[] {
    const siteAttempts = this.attempts.filter(a => a.site === site);

    if (siteAttempts.length === 0) {
      return [];
    }

    // Group by challenge type
    const statsByType = new Map<string, ChallengeStats>();

    for (const attempt of siteAttempts) {
      const type = attempt.result.type;

      if (!statsByType.has(type)) {
        statsByType.set(type, {
          site,
          challengeType: type,
          totalAttempts: 0,
          successfulSolves: 0,
          solveRate: 0,
          avgSolveTime: 0
        });
      }

      const stats = statsByType.get(type)!;
      stats.totalAttempts++;

      if (attempt.result.solved) {
        stats.successfulSolves++;
      }
    }

    // Calculate solve rates and average solve times
    const results: ChallengeStats[] = [];

    for (const stats of statsByType.values()) {
      stats.solveRate = stats.totalAttempts > 0
        ? stats.successfulSolves / stats.totalAttempts
        : 0;

      // Calculate average solve time for successful solves
      const successfulAttempts = siteAttempts.filter(
        a => a.result.type === stats.challengeType && a.result.solved
      );

      if (successfulAttempts.length > 0) {
        const totalTime = successfulAttempts.reduce(
          (sum, a) => sum + a.result.duration,
          0
        );
        stats.avgSolveTime = totalTime / successfulAttempts.length;
      }

      results.push(stats);
    }

    return results;
  }

  /**
   * Check if fallback strategy should be triggered based on solve rate.
   * Returns true if any challenge type has a solve rate below the configured threshold.
   * 
   * @param site - Domain or site identifier
   * @returns True if fallback should be triggered, false otherwise
   * 
   * @example
   * ```typescript
   * if (challengeHandler.shouldTriggerFallback('example.com')) {
   *   console.log('Solve rate too low, triggering fallback strategy');
   *   // Implement fallback logic (e.g., switch proxies, increase delays)
   * }
   * ```
   */
  shouldTriggerFallback(site: string): boolean {
    const stats = this.getChallengeStats(site);

    if (stats.length === 0) {
      return false;
    }

    // Check if any challenge type has a solve rate below threshold
    for (const stat of stats) {
      if (stat.totalAttempts >= 5 && stat.solveRate < this.fallbackThreshold) {
        logger.warn(
          `Fallback triggered for ${site}: ${stat.challengeType} solve rate ${stat.solveRate.toFixed(2)} below threshold ${this.fallbackThreshold}`
        );
        return true;
      }
    }

    return false;
  }
}
