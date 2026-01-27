/**
 * API Client utility with retry logic, error handling, and graceful degradation
 */

import { toast } from "sonner";

export interface ApiClientOptions {
    retries?: number;
    retryDelay?: number;
    timeout?: number;
    showErrorToast?: boolean;
    showSuccessToast?: boolean;
    successMessage?: string;
}

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calculate exponential backoff delay
 */
const getBackoffDelay = (attempt: number, baseDelay: number): number => {
    return Math.min(baseDelay * Math.pow(2, attempt), 10000); // Max 10 seconds
};

/**
 * Check if error is retryable
 */
const isRetryableError = (error: any): boolean => {
    // Network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
        return true;
    }

    // HTTP status codes that should be retried
    if (error.status) {
        const retryableStatuses = [408, 429, 500, 502, 503, 504];
        return retryableStatuses.includes(error.status);
    }

    return false;
};

/**
 * Enhanced fetch with timeout support
 */
const fetchWithTimeout = async (
    url: string,
    options: RequestInit,
    timeout: number
): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
};

/**
 * API Client with retry logic and error handling
 */
export class ApiClient {
    private defaultOptions: ApiClientOptions = {
        retries: 2,
        retryDelay: 1000,
        timeout: 30000,
        showErrorToast: true,
        showSuccessToast: false,
    };

    /**
     * Make an API request with retry logic
     */
    async request<T = any>(
        url: string,
        options: RequestInit = {},
        clientOptions: ApiClientOptions = {}
    ): Promise<ApiResponse<T>> {
        const opts = { ...this.defaultOptions, ...clientOptions };
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= (opts.retries || 0); attempt++) {
            try {
                // Add delay for retries (exponential backoff)
                if (attempt > 0) {
                    const delay = getBackoffDelay(attempt - 1, opts.retryDelay || 1000);
                    await sleep(delay);
                }

                // Make the request with timeout
                const response = await fetchWithTimeout(
                    url,
                    {
                        ...options,
                        headers: {
                            "Content-Type": "application/json",
                            ...options.headers,
                        },
                    },
                    opts.timeout || 30000
                );

                // Parse response
                const data = await response.json();

                // Handle successful response
                if (response.ok && data.success !== false) {
                    if (opts.showSuccessToast && opts.successMessage) {
                        toast.success(opts.successMessage);
                    }
                    return {
                        success: true,
                        data: data.data || data,
                        message: data.message,
                    };
                }

                // Handle API error response
                const errorMessage = data.error || data.message || "Request failed";

                // Check if we should retry
                if (attempt < (opts.retries || 0) && isRetryableError({ status: response.status })) {
                    lastError = new Error(errorMessage);
                    continue;
                }

                // Show error toast
                if (opts.showErrorToast) {
                    toast.error(errorMessage);
                }

                return {
                    success: false,
                    error: errorMessage,
                };
            } catch (error) {
                lastError = error instanceof Error ? error : new Error("Unknown error");

                // Check if we should retry
                if (attempt < (opts.retries || 0) && isRetryableError(error)) {
                    continue;
                }

                // Final attempt failed
                const errorMessage =
                    error instanceof Error
                        ? error.message.includes("aborted")
                            ? "Request timeout"
                            : error.message
                        : "Network error";

                if (opts.showErrorToast) {
                    toast.error(errorMessage);
                }

                return {
                    success: false,
                    error: errorMessage,
                };
            }
        }

        // All retries exhausted
        const errorMessage = lastError?.message || "Request failed after retries";
        if (opts.showErrorToast) {
            toast.error(errorMessage);
        }

        return {
            success: false,
            error: errorMessage,
        };
    }

    /**
     * GET request
     */
    async get<T = any>(
        url: string,
        options: ApiClientOptions = {}
    ): Promise<ApiResponse<T>> {
        return this.request<T>(url, { method: "GET" }, options);
    }

    /**
     * POST request
     */
    async post<T = any>(
        url: string,
        body?: any,
        options: ApiClientOptions = {}
    ): Promise<ApiResponse<T>> {
        return this.request<T>(
            url,
            {
                method: "POST",
                body: body ? JSON.stringify(body) : undefined,
            },
            options
        );
    }

    /**
     * PUT request
     */
    async put<T = any>(
        url: string,
        body?: any,
        options: ApiClientOptions = {}
    ): Promise<ApiResponse<T>> {
        return this.request<T>(
            url,
            {
                method: "PUT",
                body: body ? JSON.stringify(body) : undefined,
            },
            options
        );
    }

    /**
     * PATCH request
     */
    async patch<T = any>(
        url: string,
        body?: any,
        options: ApiClientOptions = {}
    ): Promise<ApiResponse<T>> {
        return this.request<T>(
            url,
            {
                method: "PATCH",
                body: body ? JSON.stringify(body) : undefined,
            },
            options
        );
    }

    /**
     * DELETE request
     */
    async delete<T = any>(
        url: string,
        options: ApiClientOptions = {}
    ): Promise<ApiResponse<T>> {
        return this.request<T>(url, { method: "DELETE" }, options);
    }
}

// Export singleton instance
export const apiClient = new ApiClient();

/**
 * Hook for using API client in React components
 */
export function useApiClient() {
    return apiClient;
}
