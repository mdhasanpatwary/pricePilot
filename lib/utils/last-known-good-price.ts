/**
 * Last Known Good Price Utilities
 * 
 * Utilities for handling last known good price display and staleness detection.
 * 
 * Requirements: 14.2, 14.3, 14.4, 14.5
 */

/**
 * Calculate the age of a price in milliseconds
 * 
 * @param priceTimestamp - Timestamp when price was recorded
 * @returns Age in milliseconds
 */
export function calculatePriceAge(priceTimestamp: Date): number {
    return Date.now() - priceTimestamp.getTime();
}

/**
 * Format price age as human-readable string
 * 
 * Examples:
 * - "2 minutes ago"
 * - "3 hours ago"
 * - "2 days ago"
 * - "1 week ago"
 * 
 * Requirements: 14.2
 * 
 * @param priceTimestamp - Timestamp when price was recorded
 * @returns Human-readable age string
 */
export function formatPriceAge(priceTimestamp: Date): string {
    const ageMs = calculatePriceAge(priceTimestamp);
    const ageMinutes = Math.floor(ageMs / (1000 * 60));
    const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const ageWeeks = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 7));

    if (ageMinutes < 1) {
        return 'just now';
    } else if (ageMinutes < 60) {
        return `${ageMinutes} ${ageMinutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (ageHours < 24) {
        return `${ageHours} ${ageHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (ageDays < 7) {
        return `${ageDays} ${ageDays === 1 ? 'day' : 'days'} ago`;
    } else {
        return `${ageWeeks} ${ageWeeks === 1 ? 'week' : 'weeks'} ago`;
    }
}

/**
 * Check if a price is stale based on configured threshold
 * 
 * Default staleness threshold is 7 days (604800000 ms).
 * 
 * Requirements: 14.3, 14.5
 * 
 * @param priceTimestamp - Timestamp when price was recorded
 * @param stalenessThresholdMs - Staleness threshold in milliseconds (default: 7 days)
 * @returns True if price is stale
 */
export function isPriceStale(
    priceTimestamp: Date,
    stalenessThresholdMs?: number
): boolean {
    // Use provided threshold or default to 7 days
    const threshold = stalenessThresholdMs ?? 7 * 24 * 60 * 60 * 1000;
    const ageMs = calculatePriceAge(priceTimestamp);
    return ageMs > threshold;
}

/**
 * Get staleness indicator text
 * 
 * Returns appropriate indicator text based on price age:
 * - "Fresh" if less than 1 day old
 * - "Recent" if 1-3 days old
 * - "Aging" if 3-7 days old
 * - "Stale" if more than 7 days old
 * 
 * Requirements: 14.3
 * 
 * @param priceTimestamp - Timestamp when price was recorded
 * @returns Staleness indicator text
 */
export function getStalenessIndicator(priceTimestamp: Date): string {
    const ageMs = calculatePriceAge(priceTimestamp);
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    if (ageDays < 1) {
        return 'Fresh';
    } else if (ageDays < 3) {
        return 'Recent';
    } else if (ageDays < 7) {
        return 'Aging';
    } else {
        return 'Stale';
    }
}

/**
 * Get staleness indicator color class
 * 
 * Returns appropriate Tailwind color class based on price age.
 * 
 * @param priceTimestamp - Timestamp when price was recorded
 * @returns Tailwind color class
 */
export function getStalenessColorClass(priceTimestamp: Date): string {
    const ageMs = calculatePriceAge(priceTimestamp);
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    if (ageDays < 1) {
        return 'text-success'; // Green
    } else if (ageDays < 3) {
        return 'text-primary'; // Blue
    } else if (ageDays < 7) {
        return 'text-warning'; // Yellow/Amber
    } else {
        return 'text-danger'; // Red
    }
}

/**
 * Product with last known good price
 */
export interface ProductWithLastKnownGood {
    id: string;
    currentPrice: number | null;
    lastKnownGoodPrice: number | null;
    lastKnownGoodPriceAt: Date | null;
    lastKnownGoodCurrency: string | null;
}

/**
 * Get display price for a product
 * 
 * Returns the current price if available, otherwise returns the last known good price.
 * 
 * Requirements: 14.2
 * 
 * @param product - Product with last known good price fields
 * @returns Display price and metadata
 */
export function getDisplayPrice(product: ProductWithLastKnownGood): {
    price: number | null;
    currency: string;
    isLastKnownGood: boolean;
    age?: string;
    isStale?: boolean;
} {
    // If current price is available, use it
    if (product.currentPrice !== null && product.currentPrice > 0) {
        return {
            price: product.currentPrice,
            currency: 'USD', // Default currency
            isLastKnownGood: false,
        };
    }

    // Fall back to last known good price
    if (
        product.lastKnownGoodPrice !== null &&
        product.lastKnownGoodPrice > 0 &&
        product.lastKnownGoodPriceAt
    ) {
        return {
            price: product.lastKnownGoodPrice,
            currency: product.lastKnownGoodCurrency || 'USD',
            isLastKnownGood: true,
            age: formatPriceAge(product.lastKnownGoodPriceAt),
            isStale: isPriceStale(product.lastKnownGoodPriceAt),
        };
    }

    // No price available
    return {
        price: null,
        currency: 'USD',
        isLastKnownGood: false,
    };
}
