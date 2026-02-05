import DOMPurify from 'isomorphic-dompurify';
import { z } from 'zod';

/**
 * Content security measures for documentation system
 * 
 * This module provides:
 * - User-generated content sanitization (feedback comments)
 * - HTML escaping for rendered Markdown
 * - Input validation schemas
 * - CSP header configuration
 * 
 * @module lib/documentation/security
 */

/**
 * Sanitize user-generated content (feedback comments)
 * 
 * Removes all HTML tags and potentially dangerous content while preserving
 * plain text. This is used for feedback comments and other user inputs.
 * 
 * @param input - Raw user input
 * @returns Sanitized plain text
 */
export function sanitizeUserContent(input: string): string {
    if (!input) return '';

    // Remove all HTML tags and scripts
    const sanitized = DOMPurify.sanitize(input, {
        ALLOWED_TAGS: [], // No HTML tags allowed
        ALLOWED_ATTR: [], // No attributes allowed
        KEEP_CONTENT: true, // Keep text content
    });

    // Trim whitespace and limit length
    return sanitized.trim().slice(0, 5000);
}

/**
 * Sanitize HTML content for safe rendering
 * 
 * Used for rendering Markdown-generated HTML. Allows safe HTML tags
 * while removing dangerous elements like scripts and event handlers.
 * 
 * @param html - HTML content from Markdown parser
 * @returns Sanitized HTML safe for rendering
 */
export function sanitizeHtmlContent(html: string): string {
    if (!html) return '';

    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
            // Text formatting
            'p', 'br', 'strong', 'em', 'u', 's', 'del', 'ins', 'mark',
            // Headings
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            // Lists
            'ul', 'ol', 'li',
            // Links and images
            'a', 'img',
            // Code
            'code', 'pre', 'kbd', 'samp', 'var',
            // Tables
            'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
            // Quotes and blocks
            'blockquote', 'q', 'cite',
            // Divs and spans for styling
            'div', 'span',
            // Details/summary for collapsible sections
            'details', 'summary',
            // Definition lists
            'dl', 'dt', 'dd',
            // Horizontal rule
            'hr',
        ],
        ALLOWED_ATTR: [
            'href', 'src', 'alt', 'title', 'class', 'id',
            'width', 'height', 'align', 'colspan', 'rowspan',
            'data-language', 'data-line-numbers',
        ],
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
        ALLOW_DATA_ATTR: false,
        ALLOW_UNKNOWN_PROTOCOLS: false,
    });
}

/**
 * Escape HTML entities in text
 * 
 * Converts special characters to HTML entities to prevent XSS.
 * Use this for displaying user input as plain text.
 * 
 * @param text - Text to escape
 * @returns HTML-escaped text
 */
export function escapeHtml(text: string): string {
    if (!text) return '';

    const htmlEntities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
    };

    return text.replace(/[&<>"'/]/g, (char) => htmlEntities[char] || char);
}

/**
 * Validation schemas for API inputs
 */
export const documentationValidationSchemas = {
    // Document slug validation
    slug: z.string()
        .min(1, 'Slug is required')
        .max(255, 'Slug must be less than 255 characters')
        .regex(/^[a-z0-9-\/]+$/, 'Slug must contain only lowercase letters, numbers, hyphens, and slashes'),

    // Document type validation
    type: z.enum(['tenant', 'admin']),

    // Search query validation
    searchQuery: z.string()
        .min(1, 'Search query is required')
        .max(500, 'Search query must be less than 500 characters')
        .trim(),

    // Category validation
    category: z.string()
        .min(1, 'Category is required')
        .max(100, 'Category must be less than 100 characters')
        .regex(/^[a-z0-9-]+$/, 'Category must contain only lowercase letters, numbers, and hyphens')
        .optional(),

    // Tags validation
    tags: z.array(z.string().max(50))
        .max(10, 'Maximum 10 tags allowed')
        .optional(),

    // Feedback rating validation
    rating: z.number()
        .int('Rating must be an integer')
        .min(1, 'Rating must be at least 1')
        .max(5, 'Rating must be at most 5'),

    // Feedback comment validation
    comment: z.string()
        .max(5000, 'Comment must be less than 5000 characters')
        .optional()
        .transform((val) => val ? sanitizeUserContent(val) : undefined),

    // Document ID validation
    documentId: z.string()
        .uuid('Invalid document ID format'),

    // Pagination validation
    pagination: z.object({
        limit: z.number()
            .int('Limit must be an integer')
            .min(1, 'Limit must be at least 1')
            .max(100, 'Limit must be at most 100')
            .default(20),
        offset: z.number()
            .int('Offset must be an integer')
            .min(0, 'Offset must be non-negative')
            .default(0),
    }),
};

/**
 * Validate API input against schema
 * 
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validation result with parsed data or errors
 */
export function validateInput<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string[]> } {
    const result = schema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    // Format Zod errors into a more user-friendly structure
    const errors: Record<string, string[]> = {};
    result.error.issues.forEach((err: any) => {
        const path = err.path.join('.');
        if (!errors[path]) {
            errors[path] = [];
        }
        errors[path].push(err.message);
    });

    return { success: false, errors };
}

/**
 * Content Security Policy headers for documentation pages
 * 
 * These headers help prevent XSS attacks by controlling what resources
 * can be loaded and executed on documentation pages.
 */
export const documentationCSPHeaders = {
    'Content-Security-Policy': [
        // Default: only allow same-origin
        "default-src 'self'",
        // Scripts: allow same-origin and inline scripts (needed for Next.js)
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        // Styles: allow same-origin and inline styles
        "style-src 'self' 'unsafe-inline'",
        // Images: allow same-origin and data URIs (for diagrams)
        "img-src 'self' data: https:",
        // Fonts: allow same-origin
        "font-src 'self' data:",
        // Connect: allow same-origin (for API calls)
        "connect-src 'self'",
        // Frame: disallow embedding
        "frame-ancestors 'none'",
        // Base URI: restrict to same-origin
        "base-uri 'self'",
        // Form actions: restrict to same-origin
        "form-action 'self'",
    ].join('; '),
    // Additional security headers
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

/**
 * Apply CSP headers to a response
 * 
 * @param headers - Headers object to modify
 */
export function applyCSPHeaders(headers: Headers): void {
    Object.entries(documentationCSPHeaders).forEach(([key, value]) => {
        headers.set(key, value);
    });
}

/**
 * Validate and sanitize feedback submission
 * 
 * @param data - Raw feedback data
 * @returns Validated and sanitized feedback or validation errors
 */
export function validateFeedback(data: {
    documentId: string;
    rating: number;
    comment?: string;
}): { success: true; data: typeof data } | { success: false; errors: Record<string, string[]> } {
    const schema = z.object({
        documentId: documentationValidationSchemas.documentId,
        rating: documentationValidationSchemas.rating,
        comment: documentationValidationSchemas.comment,
    });

    return validateInput(schema, data);
}

/**
 * Validate search parameters
 * 
 * @param params - Raw search parameters
 * @returns Validated search parameters or validation errors
 */
export function validateSearchParams(params: {
    q: string;
    type?: string;
    category?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
}): { success: true; data: typeof params } | { success: false; errors: Record<string, string[]> } {
    const schema = z.object({
        q: documentationValidationSchemas.searchQuery,
        type: documentationValidationSchemas.type.optional(),
        category: documentationValidationSchemas.category,
        tags: documentationValidationSchemas.tags,
        limit: z.number().optional(),
        offset: z.number().optional(),
    });

    return validateInput(schema, params);
}
