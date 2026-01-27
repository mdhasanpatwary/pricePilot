/**
 * React hooks for accessibility features
 */

import { useEffect, useRef, useCallback } from 'react';
import {
    announceToScreenReader,
    FocusTrap,
    KeyboardShortcutManager,
    generateAriaId,
} from '@/lib/utils/accessibility-enhancements';

/**
 * Hook for screen reader announcements
 */
export function useAnnouncement() {
    return useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
        announceToScreenReader(message, priority);
    }, []);
}

/**
 * Hook for focus trap in modals
 */
export function useFocusTrap(isActive: boolean) {
    const containerRef = useRef<HTMLDivElement>(null);
    const focusTrapRef = useRef<FocusTrap | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        if (isActive) {
            focusTrapRef.current = new FocusTrap(containerRef.current);
            focusTrapRef.current.activate();
        }

        return () => {
            if (focusTrapRef.current) {
                focusTrapRef.current.deactivate();
                focusTrapRef.current = null;
            }
        };
    }, [isActive]);

    return containerRef;
}

/**
 * Hook for keyboard shortcuts
 */
export function useKeyboardShortcuts(
    shortcuts: Array<{
        key: string;
        callback: () => void;
        modifier?: 'ctrl' | 'alt' | 'shift';
    }>,
    enabled: boolean = true
) {
    const managerRef = useRef<KeyboardShortcutManager | null>(null);

    useEffect(() => {
        if (!enabled) return;

        managerRef.current = new KeyboardShortcutManager();

        shortcuts.forEach(({ key, callback, modifier }) => {
            managerRef.current?.register(key, callback, modifier);
        });

        managerRef.current.activate();

        return () => {
            managerRef.current?.deactivate();
            managerRef.current = null;
        };
    }, [shortcuts, enabled]);
}

/**
 * Hook for generating stable ARIA IDs
 */
export function useAriaId(prefix: string = 'aria'): string {
    const [id] = useState(() => generateAriaId(prefix));
    return id;
}

/**
 * Hook for managing focus on mount
 */
export function useFocusOnMount(shouldFocus: boolean = true) {
    const ref = useRef<HTMLElement>(null);

    useEffect(() => {
        if (shouldFocus && ref.current) {
            // Small delay to ensure DOM is ready
            setTimeout(() => {
                ref.current?.focus();
            }, 100);
        }
    }, [shouldFocus]);

    return ref;
}

/**
 * Hook for announcing loading states
 */
export function useLoadingAnnouncement(isLoading: boolean, context: string) {
    const announce = useAnnouncement();
    const previousLoadingRef = useRef(isLoading);

    useEffect(() => {
        if (previousLoadingRef.current !== isLoading) {
            if (isLoading) {
                announce(`Loading ${context}`, 'polite');
            } else {
                announce(`${context} loaded`, 'polite');
            }
            previousLoadingRef.current = isLoading;
        }
    }, [isLoading, context, announce]);
}

/**
 * Hook for announcing errors
 */
export function useErrorAnnouncement(error: string | null, context?: string) {
    const announce = useAnnouncement();
    const previousErrorRef = useRef(error);

    useEffect(() => {
        if (error && error !== previousErrorRef.current) {
            const message = context ? `Error in ${context}: ${error}` : `Error: ${error}`;
            announce(message, 'assertive');
            previousErrorRef.current = error;
        }
    }, [error, context, announce]);
}

/**
 * Hook for announcing success messages
 */
export function useSuccessAnnouncement(success: string | null, context?: string) {
    const announce = useAnnouncement();
    const previousSuccessRef = useRef(success);

    useEffect(() => {
        if (success && success !== previousSuccessRef.current) {
            const message = context ? `Success in ${context}: ${success}` : `Success: ${success}`;
            announce(message, 'polite');
            previousSuccessRef.current = success;
        }
    }, [success, context, announce]);
}

/**
 * Hook for live region updates
 */
export function useLiveRegion(message: string | null, priority: 'polite' | 'assertive' = 'polite') {
    const announce = useAnnouncement();

    useEffect(() => {
        if (message) {
            announce(message, priority);
        }
    }, [message, priority, announce]);
}

/**
 * Hook for roving tabindex (for lists and grids)
 */
export function useRovingTabIndex(itemCount: number) {
    const [activeIndex, setActiveIndex] = useState(0);

    const handleKeyDown = useCallback((e: React.KeyboardEvent, _index: number) => {
        switch (e.key) {
            case 'ArrowDown':
            case 'ArrowRight':
                e.preventDefault();
                setActiveIndex((prev) => (prev + 1) % itemCount);
                break;
            case 'ArrowUp':
            case 'ArrowLeft':
                e.preventDefault();
                setActiveIndex((prev) => (prev - 1 + itemCount) % itemCount);
                break;
            case 'Home':
                e.preventDefault();
                setActiveIndex(0);
                break;
            case 'End':
                e.preventDefault();
                setActiveIndex(itemCount - 1);
                break;
        }
    }, [itemCount]);

    return {
        activeIndex,
        setActiveIndex,
        handleKeyDown,
        getTabIndex: (index: number) => (index === activeIndex ? 0 : -1),
    };
}

// Add missing import
import { useState } from 'react';
