/**
 * Error Message Templates for PricePilot
 * 
 * This module provides user-friendly, non-technical error messages for all error types.
 * Messages follow these principles:
 * - Clear and concise
 * - No technical jargon
 * - Actionable guidance when possible
 * - Empathetic tone
 * - Consistent formatting
 */

/**
 * Template variables that can be used in error messages
 */
export interface MessageVariables {
    resourceType?: string;
    resourceId?: string;
    serviceName?: string;
    fieldName?: string;
    limit?: number;
    windowSeconds?: number;
    retryAfter?: number;
    requiredPermission?: string;
    conflictingResource?: string;
    [key: string]: any;
}

/**
 * Error message template with optional variables
 */
export interface ErrorMessageTemplate {
    /** User-friendly message shown to end users */
    userMessage: string;
    /** Optional actionable guidance */
    guidance?: string;
    /** Developer message for debugging (development only) */
    developerMessage?: string;
}

/**
 * Format a message template with variables
 */
export function formatMessage(template: string, variables?: MessageVariables): string {
    if (!variables) {
        return template;
    }

    let formatted = template;
    for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{${key}}`;
        formatted = formatted.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return formatted;
}

/**
 * Combine user message and guidance into a single message
 */
export function combineMessageWithGuidance(userMessage: string, guidance?: string): string {
    if (!guidance) {
        return userMessage;
    }
    return `${userMessage}. ${guidance}`;
}

/**
 * Default error message templates for all error types
 */
export const ERROR_MESSAGES = {
    // Validation Errors
    VALIDATION_ERROR: {
        userMessage: 'The information you provided is invalid',
        guidance: 'Please check the highlighted fields and try again',
        developerMessage: 'Input validation failed. Check the fields object for specific errors.',
    },

    // Not Found Errors
    NOT_FOUND: {
        userMessage: 'The requested {resourceType} could not be found',
        guidance: 'Please verify the ID and try again, or contact support if the problem persists',
        developerMessage: 'Resource not found in database. Check if the ID exists and is accessible to this tenant.',
    },

    // Authentication Errors
    UNAUTHORIZED: {
        userMessage: 'You need to sign in to access this resource',
        guidance: 'Please log in with your credentials and try again',
        developerMessage: 'Authentication required. Token is missing, invalid, or expired.',
    },

    // Authorization Errors
    FORBIDDEN: {
        userMessage: "You don't have permission to perform this action",
        guidance: 'Contact your administrator if you believe you should have access',
        developerMessage: 'User lacks required permissions. Check role and permission assignments.',
    },

    // Conflict Errors
    CONFLICT: {
        userMessage: 'This action conflicts with existing data',
        guidance: 'Please review your changes and try again',
        developerMessage: 'Resource conflict detected. Check for duplicate keys or concurrent modifications.',
    },

    // Rate Limit Errors
    RATE_LIMIT_EXCEEDED: {
        userMessage: 'You have made too many requests',
        guidance: 'Please wait a moment and try again',
        developerMessage: 'Rate limit exceeded. Client should implement exponential backoff.',
    },

    // External Service Errors
    EXTERNAL_SERVICE_ERROR: {
        userMessage: 'Unable to connect to {serviceName}',
        guidance: 'Please check your connection settings and try again',
        developerMessage: 'External API call failed. Check service status, credentials, and network connectivity.',
    },

    // Generic Internal Errors
    INTERNAL_ERROR: {
        userMessage: 'Something went wrong on our end',
        guidance: 'Please try again in a few moments. If the problem persists, contact support',
        developerMessage: 'Unexpected internal error. Check logs for stack trace and context.',
    },
} as const;

/**
 * Specific error messages for common scenarios
 */
export const SPECIFIC_MESSAGES = {
    // Product-related errors
    PRODUCT_NOT_FOUND: {
        userMessage: 'The product you are looking for could not be found',
        guidance: 'Please check the product ID or search for the product again',
    },

    PRODUCT_SYNC_FAILED: {
        userMessage: 'Unable to sync products from your website',
        guidance: 'Please verify your API token is valid and your website is accessible',
    },

    PRODUCT_UPDATE_FAILED: {
        userMessage: 'Unable to update product prices',
        guidance: 'Please check your connection and try again',
    },

    // Website/Integration errors
    WEBSITE_NOT_FOUND: {
        userMessage: 'The website configuration could not be found',
        guidance: 'Please reconnect your website in the settings',
    },

    WEBSITE_CONNECTION_FAILED: {
        userMessage: 'Unable to connect to your website',
        guidance: 'Please verify your website URL and API token are correct',
    },

    INVALID_API_TOKEN: {
        userMessage: 'Your API token is invalid or has expired',
        guidance: 'Please generate a new API token in your website settings',
    },

    // Competitor-related errors
    COMPETITOR_NOT_FOUND: {
        userMessage: 'The competitor website could not be found',
        guidance: 'Please check the competitor ID or add the competitor again',
    },

    SCRAPING_FAILED: {
        userMessage: 'Unable to retrieve prices from the competitor website',
        guidance: 'The website may be temporarily unavailable. We will retry automatically',
    },

    SCRAPING_BLOCKED: {
        userMessage: 'Access to the competitor website was blocked',
        guidance: 'This website may have anti-scraping measures. Please contact support',
    },

    // Matching errors
    MATCHING_FAILED: {
        userMessage: 'Unable to match products with competitors',
        guidance: 'Please try manual matching or contact support for assistance',
    },

    NO_MATCHES_FOUND: {
        userMessage: 'No matching products were found',
        guidance: 'Try adjusting your matching criteria or add products manually',
    },

    // Price update errors
    PRICE_BELOW_MINIMUM: {
        userMessage: 'The calculated price is below your minimum price threshold',
        guidance: 'Please adjust your pricing rules or minimum price settings',
    },

    PRICE_UPDATE_REJECTED: {
        userMessage: 'The price update was rejected by your website',
        guidance: 'Please check your website permissions and try again',
    },

    // Authentication/Session errors
    SESSION_EXPIRED: {
        userMessage: 'Your session has expired',
        guidance: 'Please sign in again to continue',
    },

    INVALID_CREDENTIALS: {
        userMessage: 'The email or password you entered is incorrect',
        guidance: 'Please check your credentials and try again',
    },

    ACCOUNT_LOCKED: {
        userMessage: 'Your account has been temporarily locked',
        guidance: 'Please contact support to unlock your account',
    },

    // Tenant/Subscription errors
    TENANT_NOT_FOUND: {
        userMessage: 'Your account could not be found',
        guidance: 'Please contact support for assistance',
    },

    SUBSCRIPTION_EXPIRED: {
        userMessage: 'Your subscription has expired',
        guidance: 'Please renew your subscription to continue using PricePilot',
    },

    FEATURE_NOT_AVAILABLE: {
        userMessage: 'This feature is not available on your current plan',
        guidance: 'Upgrade your subscription to access this feature',
    },

    // Data validation errors
    INVALID_EMAIL: {
        userMessage: 'Please enter a valid email address',
        guidance: 'Email should be in the format: name@example.com',
    },

    INVALID_URL: {
        userMessage: 'Please enter a valid website URL',
        guidance: 'URL should start with http:// or https://',
    },

    INVALID_PRICE: {
        userMessage: 'Please enter a valid price',
        guidance: 'Price must be a positive number',
    },

    REQUIRED_FIELD: {
        userMessage: 'This field is required',
        guidance: 'Please provide a value and try again',
    },

    // Network/Timeout errors
    NETWORK_TIMEOUT: {
        userMessage: 'The request took too long to complete',
        guidance: 'Please check your internet connection and try again',
    },

    NETWORK_ERROR: {
        userMessage: 'Unable to connect to the server',
        guidance: 'Please check your internet connection and try again',
    },

    // File/Upload errors
    FILE_TOO_LARGE: {
        userMessage: 'The file you selected is too large',
        guidance: 'Please select a file smaller than {maxSize}',
    },

    INVALID_FILE_TYPE: {
        userMessage: 'This file type is not supported',
        guidance: 'Please upload a file in one of these formats: {allowedTypes}',
    },

    // Database/System errors
    DATABASE_ERROR: {
        userMessage: 'Unable to save your changes',
        guidance: 'Please try again in a few moments',
    },

    SERVICE_UNAVAILABLE: {
        userMessage: 'The service is temporarily unavailable',
        guidance: 'We are working to restore service. Please try again shortly',
    },
} as const;

/**
 * Get error message template by error code
 */
export function getErrorMessage(
    errorCode: string,
    variables?: MessageVariables
): ErrorMessageTemplate {
    // Check specific messages first
    const specificMessage = SPECIFIC_MESSAGES[errorCode as keyof typeof SPECIFIC_MESSAGES];
    if (specificMessage) {
        return {
            userMessage: formatMessage(specificMessage.userMessage, variables),
            guidance: specificMessage.guidance ? formatMessage(specificMessage.guidance, variables) : undefined,
        };
    }

    // Fall back to generic messages
    const genericMessage = ERROR_MESSAGES[errorCode as keyof typeof ERROR_MESSAGES];
    if (genericMessage) {
        return {
            userMessage: formatMessage(genericMessage.userMessage, variables),
            guidance: genericMessage.guidance,
            developerMessage: genericMessage.developerMessage,
        };
    }

    // Ultimate fallback
    return {
        userMessage: 'An unexpected error occurred',
        guidance: 'Please try again in a few moments. If the problem persists, contact support',
        developerMessage: `Unknown error code: ${errorCode}`,
    };
}

/**
 * Get complete user message with guidance
 */
export function getUserMessage(
    errorCode: string,
    variables?: MessageVariables,
    includeGuidance: boolean = true
): string {
    const template = getErrorMessage(errorCode, variables);

    if (includeGuidance && template.guidance) {
        return combineMessageWithGuidance(template.userMessage, template.guidance);
    }

    return template.userMessage;
}

/**
 * Get developer message for debugging
 */
export function getDeveloperMessage(
    errorCode: string,
    variables?: MessageVariables
): string | undefined {
    const template = getErrorMessage(errorCode, variables);
    return template.developerMessage;
}

/**
 * Validation error field messages
 */
export const FIELD_VALIDATION_MESSAGES = {
    REQUIRED: 'This field is required',
    INVALID_EMAIL: 'Please enter a valid email address',
    INVALID_URL: 'Please enter a valid URL',
    INVALID_NUMBER: 'Please enter a valid number',
    INVALID_DATE: 'Please enter a valid date',
    TOO_SHORT: 'This value is too short (minimum: {min} characters)',
    TOO_LONG: 'This value is too long (maximum: {max} characters)',
    TOO_SMALL: 'This value is too small (minimum: {min})',
    TOO_LARGE: 'This value is too large (maximum: {max})',
    INVALID_FORMAT: 'This value has an invalid format',
    ALREADY_EXISTS: 'This value already exists',
    INVALID_CHOICE: 'Please select a valid option',
} as const;

/**
 * Get validation message for a field
 */
export function getFieldValidationMessage(
    validationType: keyof typeof FIELD_VALIDATION_MESSAGES,
    variables?: MessageVariables
): string {
    const template = FIELD_VALIDATION_MESSAGES[validationType];
    return formatMessage(template, variables);
}
