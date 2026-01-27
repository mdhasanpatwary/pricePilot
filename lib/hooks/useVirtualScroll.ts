/**
 * Custom hook for virtual scrolling
 * Optimizes rendering of long lists by only rendering visible items
 */

import { useState, useEffect, useRef, useMemo } from "react";

export interface VirtualScrollOptions {
    itemHeight: number;
    containerHeight: number;
    overscan?: number; // Number of items to render outside viewport
}

export interface VirtualScrollResult {
    virtualItems: Array<{
        index: number;
        start: number;
        size: number;
    }>;
    totalHeight: number;
    scrollToIndex: (index: number) => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Hook for virtual scrolling
 * @param itemCount - Total number of items
 * @param options - Virtual scroll options
 * @returns Virtual scroll state and controls
 */
export function useVirtualScroll(
    itemCount: number,
    options: VirtualScrollOptions
): VirtualScrollResult {
    const { itemHeight, containerHeight, overscan = 3 } = options;

    const [scrollTop, setScrollTop] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Calculate visible range
    const { virtualItems, totalHeight } = useMemo(() => {
        const totalHeight = itemCount * itemHeight;
        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
        const endIndex = Math.min(
            itemCount - 1,
            Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
        );

        const virtualItems = [];
        for (let i = startIndex; i <= endIndex; i++) {
            virtualItems.push({
                index: i,
                start: i * itemHeight,
                size: itemHeight,
            });
        }

        return { startIndex, endIndex, virtualItems, totalHeight };
    }, [itemCount, itemHeight, containerHeight, scrollTop, overscan]);

    // Handle scroll events
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            setScrollTop(container.scrollTop);
        };

        container.addEventListener("scroll", handleScroll, { passive: true });
        return () => container.removeEventListener("scroll", handleScroll);
    }, []);

    // Scroll to specific index
    const scrollToIndex = (index: number) => {
        const container = containerRef.current;
        if (!container) return;

        const targetScrollTop = index * itemHeight;
        container.scrollTop = targetScrollTop;
    };

    return {
        virtualItems,
        totalHeight,
        scrollToIndex,
        containerRef,
    };
}
