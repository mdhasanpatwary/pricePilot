/**
 * Accessibility utilities for dashboard components
 * Ensures WCAG 2.1 AA compliance
 */

/**
 * Get accessible status text for health indicators
 */
export function getHealthStatusText(status: 'healthy' | 'degraded' | 'critical'): string {
    switch (status) {
        case 'healthy':
            return 'Status: Healthy - Operating normally';
        case 'degraded':
            return 'Status: Degraded - Performance issues detected';
        case 'critical':
            return 'Status: Critical - Immediate attention required';
        default:
            return 'Status: Unknown';
    }
}

/**
 * Get accessible text for success rate indicators
 */
export function getSuccessRateText(rate: number): string {
    if (rate >= 80) {
        return `Success rate: ${rate.toFixed(1)}% - Excellent performance`;
    } else if (rate >= 60) {
        return `Success rate: ${rate.toFixed(1)}% - Good performance`;
    } else {
        return `Success rate: ${rate.toFixed(1)}% - Poor performance, needs attention`;
    }
}

/**
 * Get accessible text for block rate indicators
 */
export function getBlockRateText(rate: number): string {
    if (rate <= 10) {
        return `Block rate: ${rate.toFixed(1)}% - Excellent, minimal blocking`;
    } else if (rate <= 30) {
        return `Block rate: ${rate.toFixed(1)}% - Acceptable level`;
    } else {
        return `Block rate: ${rate.toFixed(1)}% - High, requires attention`;
    }
}

/**
 * Get accessible text for response time indicators
 */
export function getResponseTimeText(ms: number): string {
    if (ms < 1000) {
        return `Response time: ${ms}ms - Fast`;
    } else if (ms < 3000) {
        return `Response time: ${ms}ms - Normal`;
    } else {
        return `Response time: ${ms}ms - Slow`;
    }
}

/**
 * Get accessible text for challenge solve rate
 */
export function getChallengeSolveRateText(rate: number): string {
    if (rate >= 80) {
        return `Challenge solve rate: ${rate.toFixed(1)}% - Excellent`;
    } else if (rate >= 60) {
        return `Challenge solve rate: ${rate.toFixed(1)}% - Good`;
    } else {
        return `Challenge solve rate: ${rate.toFixed(1)}% - Poor, challenges affecting performance`;
    }
}

/**
 * Get accessible text for severity levels
 */
export function getSeverityText(severity: 'critical' | 'warning' | 'info'): string {
    switch (severity) {
        case 'critical':
            return 'Severity: Critical - Immediate action required';
        case 'warning':
            return 'Severity: Warning - Attention recommended';
        case 'info':
            return 'Severity: Informational';
        default:
            return 'Severity: Unknown';
    }
}

/**
 * Get accessible text for proxy health status
 */
export function getProxyHealthText(isHealthy: boolean, successRate: number): string {
    if (isHealthy) {
        return `Proxy is healthy with ${successRate.toFixed(1)}% success rate`;
    } else {
        return `Proxy is unhealthy with ${successRate.toFixed(1)}% success rate - requires attention`;
    }
}

/**
 * Get accessible text for session status
 */
export function getSessionStatusText(status: 'running' | 'waiting_challenge' | 'completed' | 'failed'): string {
    switch (status) {
        case 'running':
            return 'Session status: Running - Active scraping in progress';
        case 'waiting_challenge':
            return 'Session status: Waiting for challenge - Anti-bot challenge detected';
        case 'completed':
            return 'Session status: Completed - Scraping finished successfully';
        case 'failed':
            return 'Session status: Failed - Scraping encountered errors';
        default:
            return 'Session status: Unknown';
    }
}

/**
 * Format keyboard shortcut hint
 */
export function formatKeyboardHint(key: string, modifier?: 'ctrl' | 'alt' | 'shift'): string {
    if (modifier) {
        return `Press ${modifier} + ${key}`;
    }
    return `Press ${key}`;
}

/**
 * Get ARIA live region politeness level based on severity
 */
export function getAriaLiveLevel(severity: 'critical' | 'warning' | 'info'): 'assertive' | 'polite' | 'off' {
    switch (severity) {
        case 'critical':
            return 'assertive';
        case 'warning':
        case 'info':
            return 'polite';
        default:
            return 'off';
    }
}
