/**
 * Utilities for graceful degradation when data is missing or APIs fail
 */

/**
 * Provide fallback value when data is missing
 */
export function withFallback<T>(value: T | null | undefined, fallback: T): T {
    return value ?? fallback;
}

/**
 * Safely access nested properties with fallback
 */
export function safeGet<T>(
    obj: any,
    path: string,
    fallback: T
): T {
    const keys = path.split(".");
    let result = obj;

    for (const key of keys) {
        if (result == null || typeof result !== "object") {
            return fallback;
        }
        result = result[key];
    }

    return result ?? fallback;
}

/**
 * Format number with fallback for invalid values
 */
export function safeNumber(
    value: any,
    fallback: number = 0,
    decimals?: number
): number {
    const num = Number(value);
    if (isNaN(num) || !isFinite(num)) {
        return fallback;
    }
    return decimals !== undefined ? Number(num.toFixed(decimals)) : num;
}

/**
 * Format percentage with fallback
 */
export function safePercentage(
    value: any,
    fallback: number = 0,
    decimals: number = 1
): string {
    const num = safeNumber(value, fallback, decimals);
    return `${num}%`;
}

/**
 * Format date with fallback
 */
export function safeDate(
    value: any,
    fallback: string = "N/A"
): string {
    try {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            return fallback;
        }
        return date.toLocaleString();
    } catch {
        return fallback;
    }
}

/**
 * Format relative time with fallback
 */
export function safeRelativeTime(
    value: any,
    fallback: string = "N/A"
): string {
    try {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            return fallback;
        }

        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    } catch {
        return fallback;
    }
}

/**
 * Ensure array with fallback
 */
export function safeArray<T>(value: any, fallback: T[] = []): T[] {
    if (Array.isArray(value)) {
        return value;
    }
    return fallback;
}

/**
 * Ensure string with fallback
 */
export function safeString(value: any, fallback: string = ""): string {
    if (typeof value === "string") {
        return value;
    }
    if (value == null) {
        return fallback;
    }
    return String(value);
}

/**
 * Truncate string with ellipsis
 */
export function truncate(
    value: string,
    maxLength: number,
    ellipsis: string = "..."
): string {
    if (value.length <= maxLength) {
        return value;
    }
    return value.slice(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * Format file size with fallback
 */
export function safeFileSize(
    bytes: any,
    fallback: string = "0 B"
): string {
    const num = safeNumber(bytes, 0);
    if (num === 0) return fallback;

    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(num) / Math.log(1024));
    const size = num / Math.pow(1024, i);

    return `${size.toFixed(2)} ${units[i]}`;
}

/**
 * Format duration in milliseconds to human readable
 */
export function safeDuration(
    ms: any,
    fallback: string = "0ms"
): string {
    const num = safeNumber(ms, 0);
    if (num === 0) return fallback;

    if (num < 1000) return `${num}ms`;
    if (num < 60000) return `${(num / 1000).toFixed(1)}s`;
    if (num < 3600000) return `${(num / 60000).toFixed(1)}m`;
    return `${(num / 3600000).toFixed(1)}h`;
}

/**
 * Provide empty state message based on context
 */
export function getEmptyStateMessage(
    context: "sessions" | "metrics" | "proxies" | "errors" | "generic",
    customMessage?: string
): string {
    if (customMessage) return customMessage;

    const messages = {
        sessions: "No active sessions found",
        metrics: "No metrics data available",
        proxies: "No proxy data available",
        errors: "No errors detected",
        generic: "No data available",
    };

    return messages[context];
}

/**
 * Check if data is empty/missing
 */
export function isEmpty(value: any): boolean {
    if (value == null) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "object") return Object.keys(value).length === 0;
    if (typeof value === "string") return value.trim().length === 0;
    return false;
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: {
        maxRetries?: number;
        initialDelay?: number;
        maxDelay?: number;
        onRetry?: (attempt: number, error: Error) => void;
    } = {}
): Promise<T> {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 10000,
        onRetry,
    } = options;

    let lastError: Error;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error("Unknown error");

            if (attempt < maxRetries - 1) {
                const delay = Math.min(
                    initialDelay * Math.pow(2, attempt),
                    maxDelay
                );

                if (onRetry) {
                    onRetry(attempt + 1, lastError);
                }

                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError!;
}

/**
 * Cache wrapper with TTL
 */
export class CacheWithTTL<T> {
    private cache = new Map<string, { value: T; expiry: number }>();

    set(key: string, value: T, ttlMs: number): void {
        this.cache.set(key, {
            value,
            expiry: Date.now() + ttlMs,
        });
    }

    get(key: string): T | null {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    has(key: string): boolean {
        return this.get(key) !== null;
    }

    clear(): void {
        this.cache.clear();
    }

    delete(key: string): void {
        this.cache.delete(key);
    }
}
