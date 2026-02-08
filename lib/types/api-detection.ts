/**
 * Types for Hidden API Detection Strategy
 * 
 * This module defines TypeScript interfaces for the API detection system
 * that discovers and utilizes hidden API endpoints on competitor websites.
 */

/**
 * Configuration options for API detection
 */
export interface DetectionOptions {
    /** Maximum detection time in milliseconds (default: 30000) */
    timeout: number;
    /** Number of pages to analyze for API patterns (default: 3) */
    maxPages: number;
    /** Minimum confidence score to accept an API (0-100, default: 70) */
    minConfidence: number;
}

/**
 * Discovered API pattern with all metadata needed for extraction
 */
export interface APIPattern {
    /** Unique identifier */
    id: string;
    /** Tenant ID for multi-tenancy */
    tenantId: string;
    /** Competitor website ID */
    competitorWebsiteId: string;
    /** API endpoint URL */
    url: string;
    /** HTTP method (GET, POST, etc.) */
    method: string;
    /** HTTP headers required for the request */
    headers: Record<string, string>;
    /** Query parameters */
    queryParams: Record<string, string>;
    /** Request body template for POST requests */
    bodyTemplate?: string;
    /** Response format (json or xml) */
    responseFormat: 'json' | 'xml';
    /** JSONPath or XPath to product data in response */
    dataPath: string;
    /** Field mappings from API response to standard Product_Data */
    fieldMappings: FieldMapping[];
    /** Confidence score (0-100) based on validation */
    confidenceScore: number;
    /** Pagination pattern if detected */
    paginationPattern?: PaginationPattern;
    /** Number of successful extractions */
    successCount: number;
    /** Number of failed extractions */
    failureCount: number;
    /** Last time this pattern was used */
    lastUsedAt?: Date;
    /** When this pattern was created */
    createdAt: Date;
    /** When this pattern was last updated */
    updatedAt: Date;
}

/**
 * Mapping from API response field to standard product field
 */
export interface FieldMapping {
    /** Field name in API response */
    sourceField: string;
    /** Standard field name (sku, name, price, brand, model, etc.) */
    targetField: string;
    /** Optional transformation function name */
    transform?: string;
}

/**
 * Validation result for a discovered API endpoint
 */
export interface ValidationResult {
    /** Whether the API is valid and usable */
    isValid: boolean;
    /** Confidence score (0-100) */
    confidenceScore: number;
    /** List of validation errors */
    errors: string[];
    /** Sample data from validation request */
    sampleData?: any;
}

/**
 * Filter criteria for network request interception
 */
export interface RequestFilter {
    /** Resource types to capture (xhr, fetch, document, etc.) */
    resourceTypes: string[];
    /** URL patterns to capture */
    urlPatterns: RegExp[];
    /** URL patterns to exclude (analytics, ads, etc.) */
    excludePatterns: RegExp[];
}

/**
 * Captured network request with full metadata
 */
export interface CapturedRequest {
    /** Unique identifier */
    id: string;
    /** Request URL */
    url: string;
    /** HTTP method */
    method: string;
    /** Request headers */
    headers: Record<string, string>;
    /** Request body (for POST requests) */
    requestBody?: string;
    /** HTTP response status code */
    responseStatus: number;
    /** Response headers */
    responseHeaders: Record<string, string>;
    /** Response body */
    responseBody: string;
    /** Response content type */
    responseType: string;
    /** Request timestamp */
    timestamp: number;
    /** Request duration in milliseconds */
    duration: number;
}

/**
 * Pagination pattern detected in API
 */
export interface PaginationPattern {
    /** Type of pagination */
    type: 'offset' | 'page' | 'cursor';
    /** Parameter name for pagination (e.g., 'page', 'offset', 'cursor') */
    paramName: string;
    /** Starting value for pagination */
    startValue: number | string;
    /** Increment value for offset/page pagination */
    increment?: number;
    /** JSONPath to total pages in response */
    totalPagesPath?: string;
    /** JSONPath to hasMore boolean in response */
    hasMorePath?: string;
}

/**
 * Options for product extraction
 */
export interface ExtractionOptions {
    /** Maximum number of products to extract */
    maxProducts?: number;
    /** Maximum number of pages to follow */
    maxPages?: number;
    /** Request timeout in milliseconds */
    timeout?: number;
}

/**
 * Extracted product data in normalized format
 */
export interface Product {
    /** External product ID from competitor site */
    externalId?: string;
    /** Product SKU */
    sku?: string;
    /** Product name */
    name: string;
    /** Brand name */
    brand?: string;
    /** Model number */
    model?: string;
    /** Current price */
    price: number;
    /** Currency code */
    currency?: string;
    /** Product URL */
    url?: string;
    /** Image URL */
    imageUrl?: string;
    /** Stock availability */
    inStock?: boolean;
    /** Additional metadata */
    metadata?: Record<string, any>;
}

/**
 * Options for scraping a website
 */
export interface ScrapeOptions {
    /** Force re-detection even if cached pattern exists */
    forceDetection?: boolean;
    /** Only use API extraction, fail if not available */
    useAPIOnly?: boolean;
    /** Maximum number of products to extract */
    maxProducts?: number;
}

/**
 * Result of a scraping operation
 */
export interface ScrapeResult {
    /** Extracted products */
    products: Product[];
    /** Extraction method used (api or html) */
    method: 'api' | 'html';
    /** API pattern used (if applicable) */
    apiPattern?: APIPattern;
    /** Time spent on detection (if applicable) */
    detectionTime?: number;
    /** Time spent on extraction */
    extractionTime: number;
    /** List of errors encountered */
    errors: string[];
}

/**
 * Metrics for API detection and extraction
 */
export interface DetectionMetrics {
    /** Competitor website ID */
    competitorWebsiteId: string;
    /** Total detection attempts */
    detectionAttempts: number;
    /** Successful detections */
    successfulDetections: number;
    /** Average detection time in milliseconds */
    averageDetectionTime: number;
    /** API extraction success rate (0-1) */
    apiExtractionSuccessRate: number;
    /** Fallback rate (0-1) */
    fallbackRate: number;
    /** Last detection timestamp */
    lastDetectionAt: Date;
}

/**
 * API endpoint discovered during detection
 */
export interface APIEndpoint {
    /** Endpoint URL */
    url: string;
    /** HTTP method */
    method: string;
    /** Request headers */
    headers: Record<string, string>;
    /** Query parameters */
    queryParams: Record<string, string>;
    /** Request body (for POST) */
    requestBody?: string;
    /** Response format */
    responseFormat: 'json' | 'xml';
    /** Sample response data */
    sampleResponse: any;
}
