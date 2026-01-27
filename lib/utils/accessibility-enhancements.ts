/**
 * Enhanced accessibility utilities for admin dashboard components
 * Implements WCAG 2.1 AA compliance with focus management and screen reader support
 */

/**
 * Announce message to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
        if (announcement.parentNode === document.body) {
            document.body.removeChild(announcement);
        }
    }, 1000);
}

/**
 * Focus trap for modals and dialogs
 */
export class FocusTrap {
    private container: HTMLElement;
    private previousFocus: HTMLElement | null = null;
    private focusableElements: HTMLElement[] = [];

    constructor(container: HTMLElement) {
        this.container = container;
    }

    activate() {
        // Store current focus
        this.previousFocus = document.activeElement as HTMLElement;

        // Get all focusable elements
        this.focusableElements = this.getFocusableElements();

        // Focus first element
        if (this.focusableElements.length > 0) {
            this.focusableElements[0].focus();
        }

        // Add keyboard listener
        this.container.addEventListener('keydown', this.handleKeyDown);
    }

    deactivate() {
        // Remove keyboard listener
        this.container.removeEventListener('keydown', this.handleKeyDown);

        // Restore previous focus
        if (this.previousFocus) {
            this.previousFocus.focus();
        }
    }

    private getFocusableElements(): HTMLElement[] {
        const selector = [
            'a[href]',
            'button:not([disabled])',
            'textarea:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
        ].join(',');

        return Array.from(this.container.querySelectorAll(selector)) as HTMLElement[];
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        const firstElement = this.focusableElements[0];
        const lastElement = this.focusableElements[this.focusableElements.length - 1];

        if (e.shiftKey) {
            // Shift + Tab
            if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            }
        } else {
            // Tab
            if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    };
}

/**
 * Keyboard navigation helper
 */
export class KeyboardNavigationHelper {
    private items: HTMLElement[];
    private currentIndex: number = 0;
    private onSelect?: (index: number) => void;

    constructor(items: HTMLElement[], onSelect?: (index: number) => void) {
        this.items = items;
        this.onSelect = onSelect;
    }

    handleKeyDown(e: KeyboardEvent) {
        switch (e.key) {
            case 'ArrowDown':
            case 'ArrowRight':
                e.preventDefault();
                this.moveNext();
                break;
            case 'ArrowUp':
            case 'ArrowLeft':
                e.preventDefault();
                this.movePrevious();
                break;
            case 'Home':
                e.preventDefault();
                this.moveToFirst();
                break;
            case 'End':
                e.preventDefault();
                this.moveToLast();
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (this.onSelect) {
                    this.onSelect(this.currentIndex);
                }
                break;
        }
    }

    private moveNext() {
        this.currentIndex = (this.currentIndex + 1) % this.items.length;
        this.focusCurrent();
    }

    private movePrevious() {
        this.currentIndex = (this.currentIndex - 1 + this.items.length) % this.items.length;
        this.focusCurrent();
    }

    private moveToFirst() {
        this.currentIndex = 0;
        this.focusCurrent();
    }

    private moveToLast() {
        this.currentIndex = this.items.length - 1;
        this.focusCurrent();
    }

    private focusCurrent() {
        this.items[this.currentIndex]?.focus();
    }
}

/**
 * Generate unique ID for ARIA relationships
 */
let idCounter = 0;
export function generateAriaId(prefix: string = 'aria'): string {
    return `${prefix}-${Date.now()}-${idCounter++}`;
}

/**
 * Get ARIA label for status indicators
 */
export function getStatusAriaLabel(status: string, context?: string): string {
    const statusText = status.replace(/_/g, ' ');
    return context ? `${context}: ${statusText}` : statusText;
}

/**
 * Get ARIA label for metric cards
 */
export function getMetricAriaLabel(title: string, value: string | number, trend?: { value: number; isPositive: boolean }): string {
    let label = `${title}: ${value}`;

    if (trend) {
        const direction = trend.isPositive ? 'increased' : 'decreased';
        label += `, ${direction} by ${Math.abs(trend.value).toFixed(1)} percent`;
    }

    return label;
}

/**
 * Get ARIA label for progress indicators
 */
export function getProgressAriaLabel(current: number, total: number, context?: string): string {
    const percentage = total > 0 ? ((current / total) * 100).toFixed(0) : 0;
    const base = `${current} of ${total}, ${percentage} percent complete`;
    return context ? `${context}: ${base}` : base;
}

/**
 * Get ARIA label for time-based information
 */
export function getTimeAriaLabel(date: Date, context?: string): string {
    const timeString = date.toLocaleString();
    return context ? `${context}: ${timeString}` : timeString;
}

/**
 * Skip to content link helper
 */
export function createSkipLink(targetId: string, text: string = 'Skip to main content'): HTMLAnchorElement {
    const link = document.createElement('a');
    link.href = `#${targetId}`;
    link.textContent = text;
    link.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded';
    return link;
}

/**
 * Manage focus for dynamic content updates
 */
export function manageFocusForUpdate(
    containerRef: HTMLElement | null,
    message: string,
    shouldFocus: boolean = false
) {
    if (!containerRef) return;

    // Announce update
    announceToScreenReader(message);

    // Optionally move focus
    if (shouldFocus) {
        const firstFocusable = containerRef.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
    }
}

/**
 * Create accessible loading state
 */
export function createLoadingAnnouncement(isLoading: boolean, context: string): string {
    return isLoading ? `Loading ${context}` : `${context} loaded`;
}

/**
 * Create accessible error announcement
 */
export function createErrorAnnouncement(error: string, context?: string): string {
    return context ? `Error in ${context}: ${error}` : `Error: ${error}`;
}

/**
 * Create accessible success announcement
 */
export function createSuccessAnnouncement(message: string, context?: string): string {
    return context ? `Success in ${context}: ${message}` : `Success: ${message}`;
}

/**
 * Keyboard shortcut manager
 */
export class KeyboardShortcutManager {
    private shortcuts: Map<string, () => void> = new Map();

    register(key: string, callback: () => void, modifier?: 'ctrl' | 'alt' | 'shift') {
        const shortcutKey = modifier ? `${modifier}+${key}` : key;
        this.shortcuts.set(shortcutKey.toLowerCase(), callback);
    }

    unregister(key: string, modifier?: 'ctrl' | 'alt' | 'shift') {
        const shortcutKey = modifier ? `${modifier}+${key}` : key;
        this.shortcuts.delete(shortcutKey.toLowerCase());
    }

    handleKeyDown = (e: KeyboardEvent) => {
        let shortcutKey = e.key.toLowerCase();

        if (e.ctrlKey || e.metaKey) {
            shortcutKey = `ctrl+${shortcutKey}`;
        } else if (e.altKey) {
            shortcutKey = `alt+${shortcutKey}`;
        } else if (e.shiftKey && e.key.length === 1) {
            shortcutKey = `shift+${shortcutKey}`;
        }

        const callback = this.shortcuts.get(shortcutKey);
        if (callback) {
            e.preventDefault();
            callback();
        }
    };

    activate() {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    deactivate() {
        document.removeEventListener('keydown', this.handleKeyDown);
    }
}

/**
 * Accessible table navigation
 */
export function setupTableNavigation(tableElement: HTMLTableElement) {
    const cells = Array.from(tableElement.querySelectorAll('td, th')) as HTMLElement[];

    cells.forEach((cell, index) => {
        cell.setAttribute('tabindex', index === 0 ? '0' : '-1');

        cell.addEventListener('keydown', (e) => {
            const currentRow = cell.parentElement;
            const currentCellIndex = Array.from(currentRow?.children || []).indexOf(cell);

            let targetCell: HTMLElement | null = null;

            switch (e.key) {
                case 'ArrowRight':
                    targetCell = cell.nextElementSibling as HTMLElement;
                    break;
                case 'ArrowLeft':
                    targetCell = cell.previousElementSibling as HTMLElement;
                    break;
                case 'ArrowDown':
                    const nextRow = currentRow?.nextElementSibling;
                    targetCell = nextRow?.children[currentCellIndex] as HTMLElement;
                    break;
                case 'ArrowUp':
                    const prevRow = currentRow?.previousElementSibling;
                    targetCell = prevRow?.children[currentCellIndex] as HTMLElement;
                    break;
            }

            if (targetCell) {
                e.preventDefault();
                targetCell.focus();
            }
        });
    });
}
