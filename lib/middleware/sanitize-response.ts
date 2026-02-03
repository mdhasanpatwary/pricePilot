/**
 * Response Sanitization Middleware
 * 
 * Sanitizes API responses to prevent XSS attacks by escaping or sanitizing
 * user-generated content before sending it to the client.
 * 
 * @module lib/middleware/sanitize-response
 */

import {
    escapeHtml,
    sanitizeProductDescription,
    sanitizeUrl
} from '@/lib/utils/sanitize';

/**
 * Sanitizes a product object by escaping HTML in text fields
 * and sanitizing URLs
 * 
 * @param product - The product object to sanitize
 * @returns Sanitized product object
 */
export function sanitizeProduct(product: any): any {
    if (!product) return product;

    return {
        ...product,
        title: product.title ? escapeHtml(product.title) : product.title,
        name: product.name ? escapeHtml(product.name) : product.name,
        sku: product.sku ? escapeHtml(product.sku) : product.sku,
        description: product.description
            ? sanitizeProductDescription(product.description)
            : product.description,
        brand: product.brand ? escapeHtml(product.brand) : product.brand,
        model: product.model ? escapeHtml(product.model) : product.model,
        category: product.category ? escapeHtml(product.category) : product.category,
        url: product.url ? sanitizeUrl(product.url) : product.url,
        imageUrl: product.imageUrl ? sanitizeUrl(product.imageUrl) : product.imageUrl,
        image: product.image ? sanitizeUrl(product.image) : product.image,
    };
}

/**
 * Sanitizes an array of products
 * 
 * @param products - Array of products to sanitize
 * @returns Array of sanitized products
 */
export function sanitizeProducts(products: any[]): any[] {
    if (!Array.isArray(products)) return products;
    return products.map(sanitizeProduct);
}

/**
 * Sanitizes a competitor product object
 * 
 * @param competitor - The competitor product to sanitize
 * @returns Sanitized competitor product
 */
export function sanitizeCompetitorProduct(competitor: any): any {
    if (!competitor) return competitor;

    const sanitized = sanitizeProduct(competitor);

    // Additional competitor-specific fields
    return {
        ...sanitized,
        siteName: competitor.siteName ? escapeHtml(competitor.siteName) : competitor.siteName,
        siteUrl: competitor.siteUrl ? sanitizeUrl(competitor.siteUrl) : competitor.siteUrl,
    };
}

/**
 * Sanitizes a product match object including both user and competitor products
 * 
 * @param match - The product match to sanitize
 * @returns Sanitized product match
 */
export function sanitizeProductMatch(match: any): any {
    if (!match) return match;

    return {
        ...match,
        userProduct: match.userProduct ? sanitizeProduct(match.userProduct) : match.userProduct,
        competitorProduct: match.competitorProduct
            ? sanitizeCompetitorProduct(match.competitorProduct)
            : match.competitorProduct,
        product: match.product ? sanitizeProduct(match.product) : match.product,
        competitor: match.competitor
            ? sanitizeCompetitorProduct(match.competitor)
            : match.competitor,
    };
}

/**
 * Sanitizes a notification object
 * 
 * @param notification - The notification to sanitize
 * @returns Sanitized notification
 */
export function sanitizeNotificationData(notification: any): any {
    if (!notification) return notification;

    return {
        ...notification,
        title: notification.title ? escapeHtml(notification.title) : notification.title,
        message: notification.message ? escapeHtml(notification.message) : notification.message,
        link: notification.link ? sanitizeUrl(notification.link) : notification.link,
    };
}

/**
 * Sanitizes a site object
 * 
 * @param site - The site to sanitize
 * @returns Sanitized site
 */
export function sanitizeSite(site: any): any {
    if (!site) return site;

    return {
        ...site,
        name: site.name ? escapeHtml(site.name) : site.name,
        baseUrl: site.baseUrl ? sanitizeUrl(site.baseUrl) : site.baseUrl,
        url: site.url ? sanitizeUrl(site.url) : site.url,
    };
}

/**
 * Sanitizes audit log details
 * 
 * @param log - The audit log to sanitize
 * @returns Sanitized audit log
 */
export function sanitizeAuditLog(log: any): any {
    if (!log) return log;

    return {
        ...log,
        action: log.action ? escapeHtml(log.action) : log.action,
        userEmail: log.userEmail ? escapeHtml(log.userEmail) : log.userEmail,
        product: log.product ? sanitizeProduct(log.product) : log.product,
    };
}

/**
 * Generic sanitization function that handles different data types
 * 
 * @param data - The data to sanitize
 * @param type - The type of data (product, competitor, match, notification, site, audit)
 * @returns Sanitized data
 */
export function sanitizeApiResponse(data: any, type?: string): any {
    if (!data) return data;

    // Handle arrays
    if (Array.isArray(data)) {
        switch (type) {
            case 'product':
                return sanitizeProducts(data);
            case 'competitor':
                return data.map(sanitizeCompetitorProduct);
            case 'match':
                return data.map(sanitizeProductMatch);
            case 'notification':
                return data.map(sanitizeNotificationData);
            case 'site':
                return data.map(sanitizeSite);
            case 'audit':
                return data.map(sanitizeAuditLog);
            default:
                return data.map((item: any) => sanitizeApiResponse(item));
        }
    }

    // Handle objects
    if (typeof data === 'object') {
        switch (type) {
            case 'product':
                return sanitizeProduct(data);
            case 'competitor':
                return sanitizeCompetitorProduct(data);
            case 'match':
                return sanitizeProductMatch(data);
            case 'notification':
                return sanitizeNotificationData(data);
            case 'site':
                return sanitizeSite(data);
            case 'audit':
                return sanitizeAuditLog(data);
            default:
                // Generic object sanitization
                const sanitized: any = {};
                for (const [key, value] of Object.entries(data)) {
                    if (typeof value === 'string') {
                        sanitized[key] = escapeHtml(value);
                    } else if (typeof value === 'object') {
                        sanitized[key] = sanitizeApiResponse(value);
                    } else {
                        sanitized[key] = value;
                    }
                }
                return sanitized;
        }
    }

    return data;
}
