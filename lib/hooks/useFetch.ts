/**
 * Custom hook for data fetching with retry logic, caching, and error handling
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient, ApiClientOptions } from "@/lib/utils/api-client";

export interface UseFetchOptions extends ApiClientOptions {
    enabled?: boolean;
    refetchInterval?: number;
    cacheTime?: number;
    onSuccess?: (data: any) => void;
    onError?: (error: string) => void;
}

export interface UseFetchResult<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    isSuccess: boolean;
    isError: boolean;
}

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();

export function useFetch<T = any>(
    url: string | null,
    options: UseFetchOptions = {}
): UseFetchResult<T> {
    const {
        enabled = true,
        refetchInterval,
        cacheTime = 0,
        onSuccess,
        onError,
        ...apiOptions
    } = options;

    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState<boolean>(false);
    const [isError, setIsError] = useState<boolean>(false);

    const isMountedRef = useRef(true);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchData = useCallback(async () => {
        if (!url || !enabled) return;

        // Check cache
        if (cacheTime > 0) {
            const cached = cache.get(url);
            if (cached && Date.now() - cached.timestamp < cacheTime) {
                setData(cached.data);
                setLoading(false);
                setError(null);
                setIsSuccess(true);
                setIsError(false);
                return;
            }
        }

        setLoading(true);
        setError(null);
        setIsError(false);

        try {
            const response = await apiClient.get<T>(url, {
                ...apiOptions,
                showErrorToast: false, // Handle toast in hook
            });

            if (!isMountedRef.current) return;

            if (response.success && response.data) {
                setData(response.data);
                setIsSuccess(true);
                setIsError(false);

                // Update cache
                if (cacheTime > 0) {
                    cache.set(url, {
                        data: response.data,
                        timestamp: Date.now(),
                    });
                }

                if (onSuccess) {
                    onSuccess(response.data);
                }
            } else {
                const errorMsg = response.error || "Failed to fetch data";
                setError(errorMsg);
                setIsSuccess(false);
                setIsError(true);

                if (onError) {
                    onError(errorMsg);
                }
            }
        } catch (err) {
            if (!isMountedRef.current) return;

            const errorMsg = err instanceof Error ? err.message : "Network error";
            setError(errorMsg);
            setIsSuccess(false);
            setIsError(true);

            if (onError) {
                onError(errorMsg);
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [url, enabled, cacheTime, apiOptions, onSuccess, onError]);

    // Initial fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Setup refetch interval
    useEffect(() => {
        if (refetchInterval && enabled && url) {
            intervalRef.current = setInterval(fetchData, refetchInterval);
            return () => {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                }
            };
        }
        return undefined;
    }, [refetchInterval, enabled, url, fetchData]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    return {
        data,
        loading,
        error,
        refetch: fetchData,
        isSuccess,
        isError,
    };
}

/**
 * Clear all cached data
 */
export function clearFetchCache() {
    cache.clear();
}

/**
 * Clear specific cached entry
 */
export function clearFetchCacheEntry(url: string) {
    cache.delete(url);
}
