/**
 * XSS Prevention Utilities
 * 
 * This module provides functions to sanitize and escape user-generated content
 * to prevent Cross-Site Scripting (XSS) attacks.
 * 
 * @module lib/utils/sanitize
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Configuration for allowed HTML tags and attributes
 * This is a restrictive whitelist approach for maximum security
 */
const ALLOWED_TAGS = [
    'b',
    'i',
    'em',
    'strong',
    'a',
    'p',
    'br',
    'ul',
    'ol',
    'li',
    'span',
    'div',
];

const ALLOWED_ATTR = [
    'href',
    'target',
    'rel',
    'class',
];

/**
 * Sanitizes HTML content by removing potentially dangerous elements and attributes
 * while preserving safe formatting tags.
 * 
 * Uses DOMPurify with a strict whitelist of allowed tags and attributes.
 * 
 * @param dirty - The potentially unsafe HTML string to sanitize
 * @returns Sanitized HTML string safe for rendering
 * 
 * @example
 * ```typescript
 * const userInput = '<script>alert("XSS")</script><p>Safe content</p>';
 * const safe = sanitizeHtml(userInput);
 * // Returns: '<p>Safe content</p>'
 * ```
 */
export function sanitizeHtml(dirty: string): string {
    if (!dirty || typeof dirty !== 'string') {
        return '';
    }

    return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        ALLOW_DATA_ATTR: false,
        ALLOW_UNKNOWN_PROTOCOLS: false,
        SAFE_FOR_TEMPLATES: true,
    });
}

/**
 * Escapes HTML special characters to prevent XSS attacks.
 * 
 * This function converts potentially dangerous characters into their HTML entity equivalents,
 * making them safe to display as plain text in HTML contexts.
 * 
 * @param text - The text to escape
 * @returns Escaped text safe for HTML rendering
 * 
 * @example
 * ```typescript
 * const userInput = '<script>alert("XSS")</script>';
 * const safe = escapeHtml(userInput);
 * // Returns: '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
 * ```
 */
export function escapeHtml(text: string): string {
    if (!text || typeof text !== 'string') {
        return '';
    }

    const htmlEscapeMap: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
    };

    return text.replace(/[&<>"'/]/g, (char) => htmlEscapeMap[char]);
}

/**
 * Sanitizes product descriptions with a more permissive set of tags
 * suitable for e-commerce content.
 * 
 * @param dirty - The product description HTML to sanitize
 * @returns Sanitized product description
 * 
 * @example
 * ```typescript
 * const description = '<h2>Product Features</h2><ul><li>Feature 1</li></ul>';
 * const safe = sanitizeProductDescription(description);
 * ```
 */
export function sanitizeProductDescription(dirty: string): string {
    if (!dirty || typeof dirty !== 'string') {
        return '';
    }

    return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: [
            ...ALLOWED_TAGS,
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'table',
            'thead',
            'tbody',
            'tr',
            'th',
            'td',
            'img',
        ],
        ALLOWED_ATTR: [
            ...ALLOWED_ATTR,
            'src',
            'alt',
            'width',
            'height',
            'title',
        ],
        ALLOW_DATA_ATTR: false,
        ALLOW_UNKNOWN_PROTOCOLS: false,
        SAFE_FOR_TEMPLATES: true,
    });
}

/**
 * Sanitizes user notification content with minimal formatting
 * 
 * @param dirty - The notification content to sanitize
 * @returns Sanitized notification content
 * 
 * @example
 * ```typescript
 * const notification = 'Price updated for <b>Product Name</b>';
 * const safe = sanitizeNotification(notification);
 * ```
 */
export function sanitizeNotification(dirty: string): string {
    if (!dirty || typeof dirty !== 'string') {
        return '';
    }

    return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'],
        ALLOWED_ATTR: [],
        ALLOW_DATA_ATTR: false,
        ALLOW_UNKNOWN_PROTOCOLS: false,
        SAFE_FOR_TEMPLATES: true,
    });
}

/**
 * Strips all HTML tags from a string, leaving only plain text
 * 
 * @param html - The HTML string to strip
 * @returns Plain text with all HTML removed
 * 
 * @example
 * ```typescript
 * const html = '<p>Hello <b>World</b></p>';
 * const text = stripHtml(html);
 * // Returns: 'Hello World'
 * ```
 */
export function stripHtml(html: string): string {
    if (!html || typeof html !== 'string') {
        return '';
    }

    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
    });
}

/**
 * Sanitizes URL to prevent javascript: and data: protocol attacks
 * 
 * @param url - The URL to sanitize
 * @returns Sanitized URL or empty string if invalid
 * 
 * @example
 * ```typescript
 * const url = 'javascript:alert("XSS")';
 * const safe = sanitizeUrl(url);
 * // Returns: ''
 * 
 * const validUrl = 'https://example.com';
 * const safe2 = sanitizeUrl(validUrl);
 * // Returns: 'https://example.com'
 * ```
 */
export function sanitizeUrl(url: string): string {
    if (!url || typeof url !== 'string') {
        return '';
    }

    // Remove whitespace
    const trimmed = url.trim();

    // Check for dangerous protocols
    const dangerousProtocols = /^(javascript|data|vbscript|file):/i;
    if (dangerousProtocols.test(trimmed)) {
        return '';
    }

    // Allow http, https, mailto, and relative URLs
    const safeProtocols = /^(https?:|mailto:|\/|\.\/|\.\.\/)/i;
    if (!safeProtocols.test(trimmed) && trimmed.includes(':')) {
        return '';
    }

    return trimmed;
}

/**
 * Sanitizes JSON data by escaping HTML in string values
 * Useful for sanitizing API responses before rendering
 * 
 * @param data - The data object to sanitize
 * @returns Sanitized data object
 * 
 * @example
 * ```typescript
 * const data = {
 *   name: '<script>alert("XSS")</script>',
 *   description: 'Safe text',
 *   nested: { value: '<b>Bold</b>' }
 * };
 * const safe = sanitizeJsonData(data);
 * ```
 */
export function sanitizeJsonData<T>(data: T): T {
    if (data === null || data === undefined) {
        return data;
    }

    if (typeof data === 'string') {
        return escapeHtml(data) as T;
    }

    if (Array.isArray(data)) {
        return data.map((item) => sanitizeJsonData(item)) as T;
    }

    if (typeof data === 'object') {
        const sanitized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
            sanitized[key] = sanitizeJsonData(value);
        }
        return sanitized as T;
    }

    return data;
}
