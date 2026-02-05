/**
 * Documentation Error Handling
 * 
 * Provides standardized error handling for documentation system including:
 * - Custom error classes
 * - Error formatting
 * - User-friendly error messages
 */

/**
 * Base documentation error class
 */
export class DocumentationError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode: number = 500,
        public details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'DocumentationError';
    }

    toJSON() {
        return {
            success: false,
            error: {
                code: this.code,
                message: this.message,
                details: this.details,
            },
        };
    }
}

/**
 * Access control errors
 */
export class UnauthorizedError extends DocumentationError {
    constructor(message: string = 'Authentication required', details?: Record<string, unknown>) {
        super(message, 'UNAUTHORIZED', 401, details);
        this.name = 'UnauthorizedError';
    }
}

export class ForbiddenError extends DocumentationError {
    constructor(message: string = 'Access forbidden', details?: Record<string, unknown>) {
        super(message, 'FORBIDDEN', 403, details);
        this.name = 'ForbiddenError';
    }
}

/**
 * Resource errors
 */
export class NotFoundError extends DocumentationError {
    constructor(resource: string = 'Resource', details?: Record<string, unknown>) {
        super(`${resource} not found`, 'NOT_FOUND', 404, details);
        this.name = 'NotFoundError';
    }
}

/**
 * Validation errors
 */
export class ValidationError extends DocumentationError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'VALIDATION_ERROR', 422, details);
        this.name = 'ValidationError';
    }
}

/**
 * Content errors
 */
export class ContentError extends DocumentationError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'CONTENT_ERROR', 400, details);
        this.name = 'ContentError';
    }
}

/**
 * Search errors
 */
export class SearchError extends DocumentationError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'SEARCH_ERROR', 503, details);
        this.name = 'SearchError';
    }
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: Error): string {
    if (error instanceof UnauthorizedError) {
        return 'Please log in to access this content.';
    }

    if (error instanceof ForbiddenError) {
        return 'You do not have permission to access this content. Please contact your administrator if you believe this is an error.';
    }

    if (error instanceof NotFoundError) {
        return 'The page you are looking for could not be found. It may have been moved or deleted.';
    }

    if (error instanceof ValidationError) {
        return 'The content contains validation errors. Please check the details and try again.';
    }

    if (error instanceof ContentError) {
        return 'There was a problem with the content. Please check the format and try again.';
    }

    if (error instanceof SearchError) {
        return 'Search is temporarily unavailable. Please try again in a few moments.';
    }

    return 'An unexpected error occurred. Please try again later.';
}

/**
 * Get suggested actions for error
 */
export function getSuggestedActions(error: Error): string[] {
    if (error instanceof UnauthorizedError) {
        return [
            'Log in to your account',
            'Check if your session has expired',
            'Contact support if you continue to have issues',
        ];
    }

    if (error instanceof ForbiddenError) {
        return [
            'Verify you have the correct permissions',
            'Contact your administrator to request access',
            'Return to the main documentation',
        ];
    }

    if (error instanceof NotFoundError) {
        return [
            'Check the URL for typos',
            'Use the search function to find what you need',
            'Browse the documentation table of contents',
            'Return to the documentation home page',
        ];
    }

    if (error instanceof ValidationError) {
        return [
            'Review the validation errors listed',
            'Check the content format and syntax',
            'Refer to the documentation style guide',
        ];
    }

    if (error instanceof ContentError) {
        return [
            'Verify the content format is correct',
            'Check for syntax errors in code blocks',
            'Ensure all required fields are present',
        ];
    }

    if (error instanceof SearchError) {
        return [
            'Wait a few moments and try again',
            'Browse popular documentation pages',
            'Use the table of contents to navigate',
        ];
    }

    return [
        'Refresh the page and try again',
        'Check your internet connection',
        'Contact support if the problem persists',
    ];
}

/**
 * Format error for API response
 */
export function formatErrorResponse(error: Error, requestId?: string) {
    const timestamp = new Date().toISOString();

    if (error instanceof DocumentationError) {
        return {
            success: false,
            error: {
                code: error.code,
                message: error.message,
                userMessage: getUserFriendlyMessage(error),
                suggestedActions: getSuggestedActions(error),
                details: error.details,
            },
            meta: {
                requestId: requestId || crypto.randomUUID(),
                timestamp,
            },
        };
    }

    // Generic error
    return {
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            userMessage: getUserFriendlyMessage(error),
            suggestedActions: getSuggestedActions(error),
        },
        meta: {
            requestId: requestId || crypto.randomUUID(),
            timestamp,
        },
    };
}

/**
 * Check if user has admin access
 */
export function checkAdminAccess(session: any): void {
    if (!session) {
        throw new UnauthorizedError('Authentication required for admin documentation', {
            requiredAuth: true,
            redirectTo: '/auth/login',
        });
    }

    const isAdmin = session.user?.isSuperAdmin || session.user?.role === 'admin';
    if (!isAdmin) {
        throw new ForbiddenError('Admin access required', {
            requiredRole: 'admin',
            userRole: session.user?.role || 'user',
        });
    }
}
