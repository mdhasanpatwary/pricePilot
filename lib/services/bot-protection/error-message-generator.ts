/**
 * Error Message Generator
 * 
 * Generates user-friendly error messages for bot protection failures
 * with actionable suggestions based on protection type.
 * 
 * Requirements: 10.1, 10.2
 */

export enum ProtectionType {
    IP_BLOCK = 'ip_block',
    RATE_LIMIT = 'rate_limit',
    CAPTCHA = 'captcha',
    FAKE_DATA = 'fake_data',
    REDIRECT_BLOCK = 'redirect_block',
    DELAYED_RESPONSE = 'delayed_response',
    EMPTY_RESPONSE = 'empty_response',
    JAVASCRIPT_CHALLENGE = 'javascript_challenge',
    UNKNOWN = 'unknown'
}

export interface ErrorMessage {
    title: string;
    message: string;
    suggestions: string[];
    severity: 'info' | 'warning' | 'error';
    canRetry: boolean;
    requiresManualIntervention: boolean;
}

export class ErrorMessageGenerator {
    /**
     * Generate user-friendly error message for a protection type
     */
    static generateMessage(
        protectionType: ProtectionType,
        competitorSiteName: string,
        lastSuccessfulScrape?: Date
    ): ErrorMessage {
        switch (protectionType) {
            case ProtectionType.IP_BLOCK:
                return this.generateIpBlockMessage(competitorSiteName, lastSuccessfulScrape);

            case ProtectionType.RATE_LIMIT:
                return this.generateRateLimitMessage(competitorSiteName);

            case ProtectionType.CAPTCHA:
                return this.generateCaptchaMessage(competitorSiteName);

            case ProtectionType.FAKE_DATA:
                return this.generateFakeDataMessage(competitorSiteName);

            case ProtectionType.REDIRECT_BLOCK:
                return this.generateRedirectBlockMessage(competitorSiteName);

            case ProtectionType.DELAYED_RESPONSE:
                return this.generateDelayedResponseMessage(competitorSiteName);

            case ProtectionType.EMPTY_RESPONSE:
                return this.generateEmptyResponseMessage(competitorSiteName);

            case ProtectionType.JAVASCRIPT_CHALLENGE:
                return this.generateJavaScriptChallengeMessage(competitorSiteName);

            case ProtectionType.UNKNOWN:
            default:
                return this.generateUnknownErrorMessage(competitorSiteName);
        }
    }

    /**
     * Generate message for IP blocking
     */
    private static generateIpBlockMessage(
        siteName: string,
        lastSuccessfulScrape?: Date
    ): ErrorMessage {
        const timeSinceSuccess = lastSuccessfulScrape
            ? this.formatTimeSince(lastSuccessfulScrape)
            : null;

        return {
            title: 'IP Address Blocked',
            message: `${siteName} is currently blocking our IP addresses. ${timeSinceSuccess
                    ? `Last successful price check was ${timeSinceSuccess}.`
                    : 'We have not been able to retrieve prices recently.'
                }`,
            suggestions: [
                'Our system will automatically retry with different IP addresses',
                'Price checks will resume once the block is lifted',
                timeSinceSuccess
                    ? 'You can view the last known price in the meantime'
                    : 'You may manually enter the current price if needed',
                'This is a temporary issue that typically resolves within a few hours'
            ],
            severity: 'warning',
            canRetry: true,
            requiresManualIntervention: false
        };
    }

    /**
     * Generate message for rate limiting
     */
    private static generateRateLimitMessage(siteName: string): ErrorMessage {
        return {
            title: 'Rate Limit Reached',
            message: `${siteName} has temporarily rate-limited our requests. We're checking prices too frequently for their system.`,
            suggestions: [
                'Our system will automatically slow down requests to this site',
                'Price checks will resume after a brief delay',
                'This is a normal protective measure by the competitor site',
                'No action is required on your part'
            ],
            severity: 'info',
            canRetry: true,
            requiresManualIntervention: false
        };
    }

    /**
     * Generate message for CAPTCHA challenges
     */
    private static generateCaptchaMessage(siteName: string): ErrorMessage {
        return {
            title: 'CAPTCHA Challenge Detected',
            message: `${siteName} is requiring human verification (CAPTCHA) to access their prices. This prevents automated price checking.`,
            suggestions: [
                'Manual price entry is recommended for this product',
                'CAPTCHA challenges cannot be automatically bypassed',
                'You can manually visit the competitor site to check the current price',
                'Consider contacting support if this persists across multiple products'
            ],
            severity: 'error',
            canRetry: false,
            requiresManualIntervention: true
        };
    }

    /**
     * Generate message for fake data detection
     */
    private static generateFakeDataMessage(siteName: string): ErrorMessage {
        return {
            title: 'Suspicious Price Data',
            message: `${siteName} returned suspicious or placeholder price data (e.g., $0.00 or $999,999.99). This may be a bot protection measure.`,
            suggestions: [
                'Our system will retry with a different scraping method',
                'The site may be serving fake data to automated systems',
                'If retries fail, manual price entry is recommended',
                'This typically resolves when using browser-based scraping'
            ],
            severity: 'warning',
            canRetry: true,
            requiresManualIntervention: false
        };
    }

    /**
     * Generate message for redirect blocking
     */
    private static generateRedirectBlockMessage(siteName: string): ErrorMessage {
        return {
            title: 'Access Redirected',
            message: `${siteName} is redirecting our requests to a different page, preventing access to product prices.`,
            suggestions: [
                'Our system will retry with different access methods',
                'The site may be detecting automated access',
                'This is often resolved by using browser-based scraping',
                'Manual verification may be needed if the issue persists'
            ],
            severity: 'warning',
            canRetry: true,
            requiresManualIntervention: false
        };
    }

    /**
     * Generate message for delayed responses
     */
    private static generateDelayedResponseMessage(siteName: string): ErrorMessage {
        return {
            title: 'Slow Response Time',
            message: `${siteName} is taking too long to respond. The site may be experiencing issues or deliberately slowing down automated requests.`,
            suggestions: [
                'Our system will retry with adjusted timeout settings',
                'This may be temporary site performance issues',
                'If this persists, the site may be under heavy load',
                'Price checks will continue automatically'
            ],
            severity: 'info',
            canRetry: true,
            requiresManualIntervention: false
        };
    }

    /**
     * Generate message for empty responses
     */
    private static generateEmptyResponseMessage(siteName: string): ErrorMessage {
        return {
            title: 'No Price Data Found',
            message: `${siteName} returned a response, but we couldn't find any price information. The page structure may have changed.`,
            suggestions: [
                'Our system will retry with alternative extraction methods',
                'The site may have updated their page layout',
                'If this persists, the price selector configuration may need updating',
                'Contact support if this affects multiple products from this site'
            ],
            severity: 'warning',
            canRetry: true,
            requiresManualIntervention: false
        };
    }

    /**
     * Generate message for JavaScript challenges
     */
    private static generateJavaScriptChallengeMessage(siteName: string): ErrorMessage {
        return {
            title: 'JavaScript Challenge Detected',
            message: `${siteName} requires JavaScript execution to verify visitors. This is a common bot protection technique.`,
            suggestions: [
                'Our system will automatically switch to browser-based scraping',
                'This method can handle JavaScript challenges',
                'Price checks may take slightly longer with this method',
                'No action is required on your part'
            ],
            severity: 'info',
            canRetry: true,
            requiresManualIntervention: false
        };
    }

    /**
     * Generate message for unknown errors
     */
    private static generateUnknownErrorMessage(siteName: string): ErrorMessage {
        return {
            title: 'Unable to Check Price',
            message: `We encountered an unexpected issue while checking prices on ${siteName}.`,
            suggestions: [
                'Our system will automatically retry the price check',
                'This may be a temporary connectivity issue',
                'If this persists, please contact support',
                'You can manually enter the price in the meantime'
            ],
            severity: 'warning',
            canRetry: true,
            requiresManualIntervention: false
        };
    }

    /**
     * Format time since last successful scrape
     */
    private static formatTimeSince(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMinutes = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMinutes < 1) {
            return 'just now';
        } else if (diffMinutes < 60) {
            return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        } else if (diffDays < 7) {
            return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    /**
     * Generate a short summary message for display in tables/lists
     */
    static generateShortMessage(protectionType: ProtectionType): string {
        switch (protectionType) {
            case ProtectionType.IP_BLOCK:
                return 'IP blocked - retrying with different addresses';
            case ProtectionType.RATE_LIMIT:
                return 'Rate limited - will retry shortly';
            case ProtectionType.CAPTCHA:
                return 'CAPTCHA required - manual entry needed';
            case ProtectionType.FAKE_DATA:
                return 'Suspicious data detected - retrying';
            case ProtectionType.REDIRECT_BLOCK:
                return 'Access redirected - retrying with different method';
            case ProtectionType.DELAYED_RESPONSE:
                return 'Slow response - retrying';
            case ProtectionType.EMPTY_RESPONSE:
                return 'No price found - retrying with different method';
            case ProtectionType.JAVASCRIPT_CHALLENGE:
                return 'JavaScript challenge - switching to browser mode';
            case ProtectionType.UNKNOWN:
            default:
                return 'Unable to check price - retrying';
        }
    }

    /**
     * Get icon name for protection type (for UI display)
     */
    static getIconName(protectionType: ProtectionType): string {
        switch (protectionType) {
            case ProtectionType.IP_BLOCK:
                return 'shield-alert';
            case ProtectionType.RATE_LIMIT:
                return 'clock';
            case ProtectionType.CAPTCHA:
                return 'lock';
            case ProtectionType.FAKE_DATA:
                return 'alert-triangle';
            case ProtectionType.REDIRECT_BLOCK:
                return 'corner-up-right';
            case ProtectionType.DELAYED_RESPONSE:
                return 'hourglass';
            case ProtectionType.EMPTY_RESPONSE:
                return 'file-x';
            case ProtectionType.JAVASCRIPT_CHALLENGE:
                return 'code';
            case ProtectionType.UNKNOWN:
            default:
                return 'help-circle';
        }
    }

    /**
     * Get color class for protection type severity
     */
    static getSeverityColor(protectionType: ProtectionType): string {
        const message = this.generateMessage(protectionType, '');
        switch (message.severity) {
            case 'error':
                return 'text-red-600 dark:text-red-400';
            case 'warning':
                return 'text-yellow-600 dark:text-yellow-400';
            case 'info':
            default:
                return 'text-blue-600 dark:text-blue-400';
        }
    }
}
