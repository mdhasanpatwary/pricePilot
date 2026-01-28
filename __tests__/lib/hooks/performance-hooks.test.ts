/**
 * Tests for performance optimization hooks
 */

import { renderHook, act } from "@testing-library/react";
import { useDebounce, useDebouncedCallback } from "@/lib/hooks/useDebounce";
import { usePagination } from "@/lib/hooks/usePagination";
import { useVirtualScroll } from "@/lib/hooks/useVirtualScroll";

describe("Performance Optimization Hooks", () => {
    describe("useDebounce", () => {
        it("should debounce value changes", async () => {
            jest.useFakeTimers();

            const { result, rerender } = renderHook(
                ({ value }) => useDebounce(value, 300),
                { initialProps: { value: "initial" } }
            );

            expect(result.current).toBe("initial");

            // Change value rapidly
            rerender({ value: "change1" });
            rerender({ value: "change2" });
            rerender({ value: "final" });

            // Should still be initial before delay
            expect(result.current).toBe("initial");

            // Fast-forward time
            act(() => {
                jest.advanceTimersByTime(300);
            });

            // Should now be the final value
            expect(result.current).toBe("final");

            jest.useRealTimers();
        });

        it("should use custom delay", async () => {
            jest.useFakeTimers();

            const { result, rerender } = renderHook(
                ({ value }) => useDebounce(value, 500),
                { initialProps: { value: "initial" } }
            );

            rerender({ value: "changed" });

            act(() => {
                jest.advanceTimersByTime(300);
            });

            // Should not have changed yet
            expect(result.current).toBe("initial");

            act(() => {
                jest.advanceTimersByTime(200);
            });

            // Should have changed after 500ms
            expect(result.current).toBe("changed");

            jest.useRealTimers();
        });
    });

    describe("useDebouncedCallback", () => {
        it("should debounce callback execution", () => {
            jest.useFakeTimers();

            const callback = jest.fn();
            const { result } = renderHook(() => useDebouncedCallback(callback, 300));

            // Call multiple times rapidly
            act(() => {
                result.current("call1");
                result.current("call2");
                result.current("call3");
            });

            // Should not have been called yet
            expect(callback).not.toHaveBeenCalled();

            // Fast-forward time
            act(() => {
                jest.advanceTimersByTime(300);
            });

            // Should have been called once with last arguments
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith("call3");

            jest.useRealTimers();
        });
    });

    describe("usePagination", () => {
        const testData = Array.from({ length: 50 }, (_, i) => ({
            id: i,
            name: `Item ${i}`,
        }));

        it("should paginate data correctly", () => {
            const { result } = renderHook(() =>
                usePagination(testData, { pageSize: 10 })
            );

            expect(result.current.currentPage).toBe(1);
            expect(result.current.totalPages).toBe(5);
            expect(result.current.totalItems).toBe(50);
            expect(result.current.paginatedData).toHaveLength(10);
            expect(result.current.paginatedData[0].id).toBe(0);
        });

        it("should navigate to next page", () => {
            const { result } = renderHook(() =>
                usePagination(testData, { pageSize: 10 })
            );

            act(() => {
                result.current.nextPage();
            });

            expect(result.current.currentPage).toBe(2);
            expect(result.current.paginatedData[0].id).toBe(10);
        });

        it("should navigate to previous page", () => {
            const { result } = renderHook(() =>
                usePagination(testData, { pageSize: 10, initialPage: 2 })
            );

            act(() => {
                result.current.previousPage();
            });

            expect(result.current.currentPage).toBe(1);
            expect(result.current.paginatedData[0].id).toBe(0);
        });

        it("should go to specific page", () => {
            const { result } = renderHook(() =>
                usePagination(testData, { pageSize: 10 })
            );

            act(() => {
                result.current.goToPage(3);
            });

            expect(result.current.currentPage).toBe(3);
            expect(result.current.paginatedData[0].id).toBe(20);
        });

        it("should change page size", () => {
            const { result } = renderHook(() =>
                usePagination(testData, { pageSize: 10 })
            );

            act(() => {
                result.current.setPageSize(25);
            });

            expect(result.current.pageSize).toBe(25);
            expect(result.current.totalPages).toBe(2);
            expect(result.current.paginatedData).toHaveLength(25);
            expect(result.current.currentPage).toBe(1); // Should reset to page 1
        });

        it("should handle navigation boundaries", () => {
            const { result } = renderHook(() =>
                usePagination(testData, { pageSize: 10 })
            );

            // Try to go before first page
            act(() => {
                result.current.goToPage(0);
            });
            expect(result.current.currentPage).toBe(1);

            // Try to go after last page
            act(() => {
                result.current.goToPage(10);
            });
            expect(result.current.currentPage).toBe(5);
        });

        it("should indicate navigation availability", () => {
            const { result } = renderHook(() =>
                usePagination(testData, { pageSize: 10 })
            );

            expect(result.current.hasPreviousPage).toBe(false);
            expect(result.current.hasNextPage).toBe(true);

            act(() => {
                result.current.goToPage(5);
            });

            expect(result.current.hasPreviousPage).toBe(true);
            expect(result.current.hasNextPage).toBe(false);
        });
    });

    describe("useVirtualScroll", () => {
        it("should calculate visible items correctly", () => {
            const { result } = renderHook(() =>
                useVirtualScroll(100, {
                    itemHeight: 50,
                    containerHeight: 500,
                    overscan: 2,
                })
            );

            expect(result.current.totalHeight).toBe(5000); // 100 * 50
            expect(result.current.virtualItems.length).toBeGreaterThan(0);
            expect(result.current.virtualItems.length).toBeLessThan(100);
        });

        it("should provide container ref", () => {
            const { result } = renderHook(() =>
                useVirtualScroll(100, {
                    itemHeight: 50,
                    containerHeight: 500,
                })
            );

            expect(result.current.containerRef).toBeDefined();
            expect(result.current.containerRef.current).toBeNull(); // Not attached to DOM
        });

        it("should calculate correct item positions", () => {
            const { result } = renderHook(() =>
                useVirtualScroll(100, {
                    itemHeight: 50,
                    containerHeight: 500,
                    overscan: 0,
                })
            );

            const firstItem = result.current.virtualItems[0];
            expect(firstItem.index).toBe(0);
            expect(firstItem.start).toBe(0);
            expect(firstItem.size).toBe(50);
        });
    });
});
