/**
 * Custom hook for pagination
 * Optimizes rendering of large data sets
 */

import { useState, useMemo } from "react";

export interface PaginationOptions {
    initialPage?: number;
    pageSize?: number;
}

export interface PaginationResult<T> {
    currentPage: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
    paginatedData: T[];
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    goToPage: (page: number) => void;
    nextPage: () => void;
    previousPage: () => void;
    setPageSize: (size: number) => void;
}

/**
 * Hook for paginating data
 * @param data - Array of items to paginate
 * @param options - Pagination options
 * @returns Pagination state and controls
 */
export function usePagination<T>(
    data: T[],
    options: PaginationOptions = {}
): PaginationResult<T> {
    const { initialPage = 1, pageSize: initialPageSize = 10 } = options;

    const [currentPage, setCurrentPage] = useState(initialPage);
    const [pageSize, setPageSize] = useState(initialPageSize);

    // Calculate pagination values
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / pageSize);

    // Get paginated data
    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        return data.slice(startIndex, endIndex);
    }, [data, currentPage, pageSize]);

    // Navigation helpers
    const hasNextPage = currentPage < totalPages;
    const hasPreviousPage = currentPage > 1;

    const goToPage = (page: number) => {
        const validPage = Math.max(1, Math.min(page, totalPages));
        setCurrentPage(validPage);
    };

    const nextPage = () => {
        if (hasNextPage) {
            setCurrentPage((prev) => prev + 1);
        }
    };

    const previousPage = () => {
        if (hasPreviousPage) {
            setCurrentPage((prev) => prev - 1);
        }
    };

    const handleSetPageSize = (size: number) => {
        setPageSize(size);
        // Reset to first page when page size changes
        setCurrentPage(1);
    };

    return {
        currentPage,
        pageSize,
        totalPages,
        totalItems,
        paginatedData,
        hasNextPage,
        hasPreviousPage,
        goToPage,
        nextPage,
        previousPage,
        setPageSize: handleSetPageSize,
    };
}
