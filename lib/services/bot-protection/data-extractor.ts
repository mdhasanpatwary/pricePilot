/**
 * Data Extractor Service
 * 
 * Extracts price data from HTML responses using configured CSS selectors
 * with fallback regex extraction and price validation.
 */

import * as cheerio from 'cheerio';

/**
 * Configuration for price extraction selectors
 */
export interface SelectorConfig {
    /** CSS selectors for price extraction in priority order */
    priceSelectors: string[];
    /** Optional CSS selector for currency */
    currencySelector?: string;
    /** Optional regex pattern for fallback extraction */
    fallbackRegex?: string;
}

/**
 * Result of price extraction attempt
 */
export interface ExtractionResult {
    /** Whether extraction was successful */
    success: boolean;
    /** Extracted price value */
    price?: number;
    /** Extracted currency code */
    currency?: string;
    /** Raw extracted value before parsing */
    rawValue?: string;
    /** Which selector was used successfully */
    selectorUsed?: string;
    /** Confidence score (0-100) */
    confidence: number;
    /** Error message if extraction failed */
    error?: string;
}

/**
 * DataExtractor class
 * 
 * Extracts and validates price data from HTML responses
 */
export class DataExtractor {
    /**
     * Extract price from HTML using configured selectors
     * 
     * @param html - HTML content to parse
     * @param selectors - Selector configuration
     * @returns Extraction result with price and metadata
     */
    extractPrice(html: string, selectors: SelectorConfig): ExtractionResult {
        if (!html || html.trim().length === 0) {
            return {
                success: false,
                confidence: 0,
                error: 'Empty HTML content'
            };
        }

        if (!selectors.priceSelectors || selectors.priceSelectors.length === 0) {
            return {
                success: false,
                confidence: 0,
                error: 'No price selectors configured'
            };
        }

        // Load HTML with cheerio
        const $ = cheerio.load(html);

        // Try each CSS selector in priority order
        for (let i = 0; i < selectors.priceSelectors.length; i++) {
            const selector = selectors.priceSelectors[i];

            try {
                const element = $(selector);

                if (element.length > 0) {
                    const rawValue = element.first().text().trim();

                    if (rawValue) {
                        const price = this.parsePrice(rawValue);

                        if (price !== null && this.validatePrice(price)) {
                            // Extract currency if selector provided
                            let currency: string | undefined;
                            if (selectors.currencySelector) {
                                const currencyElement = $(selectors.currencySelector);
                                if (currencyElement.length > 0) {
                                    currency = currencyElement.first().text().trim();
                                }
                            }

                            // If no currency selector, try to extract from price text
                            if (!currency) {
                                currency = this.extractCurrency(rawValue);
                            }

                            // Calculate confidence based on multiple factors
                            const confidence = this.calculateExtractionConfidence(price, i, 'selector');

                            return {
                                success: true,
                                price,
                                currency,
                                rawValue,
                                selectorUsed: selector,
                                confidence
                            };
                        }
                    }
                }
            } catch (error) {
                // Continue to next selector if this one fails
                continue;
            }
        }

        // Try fallback regex if all selectors failed
        if (selectors.fallbackRegex) {
            try {
                const regex = new RegExp(selectors.fallbackRegex, 'i');
                const match = html.match(regex);

                if (match && match[0]) {
                    const rawValue = match[0];
                    const price = this.parsePrice(rawValue);

                    if (price !== null && this.validatePrice(price)) {
                        const currency = this.extractCurrency(rawValue);

                        // Calculate confidence for regex extraction
                        const confidence = this.calculateExtractionConfidence(price, 0, 'regex');

                        return {
                            success: true,
                            price,
                            currency,
                            rawValue,
                            selectorUsed: 'regex',
                            confidence
                        };
                    }
                }
            } catch (error) {
                // Regex failed, fall through to failure
            }
        }

        return {
            success: false,
            confidence: 0,
            error: 'No price found with configured selectors'
        };
    }

    /**
     * Parse price string to number
     * 
     * Handles various formats:
     * - $99.99
     * - 99,99 €
     * - USD 99.99
     * - 1,234.56
     * 
     * @param priceText - Raw price text
     * @returns Parsed price number or null if invalid
     */
    private parsePrice(priceText: string): number | null {
        if (!priceText) {
            return null;
        }

        // Remove common currency symbols and text
        let cleaned = priceText
            .replace(/[$£€¥₹₽]/g, '')
            .replace(/USD|EUR|GBP|CAD|AUD|JPY|CNY|INR|RUB/gi, '')
            .trim();

        // Handle different decimal separators
        // If there are multiple commas and dots, determine which is decimal
        const commaCount = (cleaned.match(/,/g) || []).length;
        const dotCount = (cleaned.match(/\./g) || []).length;

        if (commaCount > 0 && dotCount > 0) {
            // Both present - last one is decimal separator
            const lastComma = cleaned.lastIndexOf(',');
            const lastDot = cleaned.lastIndexOf('.');

            if (lastComma > lastDot) {
                // Comma is decimal separator (European format)
                cleaned = cleaned.replace(/\./g, '').replace(',', '.');
            } else {
                // Dot is decimal separator (US format)
                cleaned = cleaned.replace(/,/g, '');
            }
        } else if (commaCount > 0) {
            // Only commas - could be thousands separator or decimal
            if (commaCount === 1) {
                const parts = cleaned.split(',');
                if (parts[1] && parts[1].length === 2) {
                    // Likely decimal separator (e.g., "99,99")
                    cleaned = cleaned.replace(',', '.');
                } else {
                    // Likely thousands separator (e.g., "1,234")
                    cleaned = cleaned.replace(/,/g, '');
                }
            } else {
                // Multiple commas - thousands separators
                cleaned = cleaned.replace(/,/g, '');
            }
        }

        // Remove any remaining non-numeric characters except dot
        cleaned = cleaned.replace(/[^\d.]/g, '');

        // Parse to float
        const price = parseFloat(cleaned);

        return isNaN(price) ? null : price;
    }

    /**
     * Extract currency symbol or code from price text
     * 
     * @param priceText - Raw price text
     * @returns Currency code or symbol, or undefined
     */
    private extractCurrency(priceText: string): string | undefined {
        // Check for currency symbols
        if (priceText.includes('$')) return 'USD';
        if (priceText.includes('£')) return 'GBP';
        if (priceText.includes('€')) return 'EUR';
        if (priceText.includes('¥')) return 'JPY';
        if (priceText.includes('₹')) return 'INR';
        if (priceText.includes('₽')) return 'RUB';

        // Check for currency codes
        const currencyMatch = priceText.match(/\b(USD|EUR|GBP|CAD|AUD|JPY|CNY|INR|RUB)\b/i);
        if (currencyMatch) {
            return currencyMatch[1].toUpperCase();
        }

        return undefined;
    }

    /**
     * Validate that a price is reasonable and not fake
     * 
     * Rejects:
     * - Zero or negative prices ($0.00)
     * - Obvious fake values (999999.99, etc.)
     * - Prices outside reasonable range (> $1,000,000)
     * - Prices without proper decimal places (when expected)
     * 
     * @param price - Price to validate
     * @param requireDecimals - Whether to require decimal places (default: false)
     * @returns True if price is valid
     */
    validatePrice(price: number, requireDecimals: boolean = false): boolean {
        // Reject zero or negative (fake data indicator)
        if (price <= 0) {
            return false;
        }

        // Reject $0.00 explicitly (common fake value)
        if (price === 0.00) {
            return false;
        }

        // Reject obvious fake values
        const fakeValues = [
            999999.99,
            999999,
            9999.99,
            99999.99,
            888888.88,
            777777.77,
            666666.66,
            555555.55,
            444444.44,
            333333.33,
            222222.22,
            111111.11
        ];

        if (fakeValues.includes(price)) {
            return false;
        }

        // Reject prices that are suspiciously round and high
        // (e.g., exactly 10000, 50000, 100000)
        if (price >= 10000 && price % 10000 === 0) {
            return false;
        }

        // Reject unreasonably high prices (over $1 million)
        if (price > 1000000) {
            return false;
        }

        // Reject unreasonably low prices (less than $0.01)
        if (price < 0.01) {
            return false;
        }

        // Check for decimal places if required
        if (requireDecimals) {
            const hasDecimals = price % 1 !== 0;
            if (!hasDecimals && price > 10) {
                // Prices over $10 without decimals might be fake
                // But allow it as it could be legitimate
            }
        }

        // Reject prices that look like placeholder values
        // (all same digits: 111.11, 222.22, etc.)
        const priceStr = price.toString();
        const digits = priceStr.replace(/[^0-9]/g, '');
        if (digits.length >= 3) {
            const firstDigit = digits[0];
            const allSame = digits.split('').every(d => d === firstDigit);
            if (allSame && price > 10) {
                return false;
            }
        }

        // Reject prices with too many decimal places (likely parsing error)
        const decimalPlaces = (price.toString().split('.')[1] || '').length;
        if (decimalPlaces > 2) {
            return false;
        }

        return true;
    }

    /**
     * Calculate extraction confidence based on multiple factors
     * 
     * Factors:
     * - Selector priority (first selector = higher confidence)
     * - Price validation (valid price = higher confidence)
     * - Decimal places present (more realistic)
     * - Reasonable price range (not too high or low)
     * 
     * @param price - Extracted price
     * @param selectorIndex - Index of selector used (0 = first/best)
     * @param method - Extraction method ('selector' or 'regex')
     * @returns Confidence score (0-100)
     */
    calculateExtractionConfidence(
        price: number,
        selectorIndex: number,
        method: 'selector' | 'regex'
    ): number {
        let confidence = 100;

        // Reduce confidence based on selector priority
        if (method === 'selector') {
            confidence -= selectorIndex * 10;
        } else {
            // Regex extraction has lower base confidence
            confidence = 50;
        }

        // Reduce confidence for prices without decimals
        const hasDecimals = price % 1 !== 0;
        if (!hasDecimals && price > 10) {
            confidence -= 10;
        }

        // Reduce confidence for very high prices
        if (price > 10000) {
            confidence -= 5;
        }

        // Reduce confidence for very low prices
        if (price < 1) {
            confidence -= 5;
        }

        // Ensure confidence is within bounds
        return Math.max(0, Math.min(100, confidence));
    }
}
