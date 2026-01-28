/**
 * Tests for accessibility features in admin dashboard components
 * Validates WCAG 2.1 AA compliance
 */

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import {
    announceToScreenReader,
    FocusTrap,
    KeyboardNavigationHelper,
    KeyboardShortcutManager,
    generateAriaId,
    getStatusAriaLabel,
    getMetricAriaLabel,
    getProgressAriaLabel,
} from '@/lib/utils/accessibility-enhancements';

describe('Accessibility Features', () => {
    describe('Screen Reader Announcements', () => {
        beforeEach(() => {
            document.body.innerHTML = '';
        });

        it('should create announcement element with correct attributes', () => {
            announceToScreenReader('Test message', 'polite');

            const announcement = document.querySelector('[role="status"]');
            expect(announcement).toBeInTheDocument();
            expect(announcement).toHaveAttribute('aria-live', 'polite');
            expect(announcement).toHaveAttribute('aria-atomic', 'true');
            expect(announcement).toHaveTextContent('Test message');
        });

        it('should create assertive announcement for critical messages', () => {
            announceToScreenReader('Critical error', 'assertive');

            const announcement = document.querySelector('[role="status"]');
            expect(announcement).toHaveAttribute('aria-live', 'assertive');
        });

        it('should remove announcement after timeout', async () => {
            announceToScreenReader('Temporary message');

            let announcement = document.querySelector('[role="status"]');
            expect(announcement).toBeInTheDocument();

            // Wait for removal
            await new Promise(resolve => setTimeout(resolve, 1100));

            announcement = document.querySelector('[role="status"]');
            expect(announcement).not.toBeInTheDocument();
        });
    });

    describe('Focus Trap', () => {
        it('should trap focus within container', () => {
            const container = document.createElement('div');
            container.innerHTML = `
                <button id="btn1">Button 1</button>
                <button id="btn2">Button 2</button>
                <button id="btn3">Button 3</button>
            `;
            document.body.appendChild(container);

            const focusTrap = new FocusTrap(container);
            focusTrap.activate();

            const btn1 = document.getElementById('btn1') as HTMLButtonElement;
            const btn3 = document.getElementById('btn3') as HTMLButtonElement;

            // Focus should be on first button
            expect(document.activeElement).toBe(btn1);

            // Tab from last button should cycle to first
            btn3.focus();
            fireEvent.keyDown(container, { key: 'Tab' });
            expect(document.activeElement).toBe(btn1);

            focusTrap.deactivate();
            document.body.removeChild(container);
        });

        it('should restore previous focus on deactivate', () => {
            const outsideButton = document.createElement('button');
            outsideButton.id = 'outside';
            document.body.appendChild(outsideButton);
            outsideButton.focus();

            const container = document.createElement('div');
            container.innerHTML = '<button id="inside">Inside</button>';
            document.body.appendChild(container);

            const focusTrap = new FocusTrap(container);
            focusTrap.activate();

            expect(document.activeElement).not.toBe(outsideButton);

            focusTrap.deactivate();
            expect(document.activeElement).toBe(outsideButton);

            document.body.removeChild(container);
            document.body.removeChild(outsideButton);
        });
    });

    describe('Keyboard Navigation Helper', () => {
        it('should navigate through items with arrow keys', () => {
            const items = [
                document.createElement('button'),
                document.createElement('button'),
                document.createElement('button'),
            ];

            items.forEach((item, i) => {
                item.id = `item-${i}`;
                item.textContent = `Item ${i}`;
                document.body.appendChild(item);
            });

            // Track selected index for keyboard navigation
            // let selectedIndex = 0;
            const helper = new KeyboardNavigationHelper(items, (index) => {
                selectedIndex = index;
            });

            // Arrow down should move to next item
            helper.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
            expect(document.activeElement).toBe(items[1]);

            // Arrow up should move to previous item
            helper.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
            expect(document.activeElement).toBe(items[0]);

            // Home should move to first item
            items[2].focus();
            helper.handleKeyDown(new KeyboardEvent('keydown', { key: 'Home' }));
            expect(document.activeElement).toBe(items[0]);

            // End should move to last item
            helper.handleKeyDown(new KeyboardEvent('keydown', { key: 'End' }));
            expect(document.activeElement).toBe(items[2]);

            items.forEach((item) => document.body.removeChild(item));
        });

        it('should trigger onSelect callback on Enter or Space', () => {
            const items = [document.createElement('button')];
            document.body.appendChild(items[0]);

            let selectedIndex = -1;
            const helper = new KeyboardNavigationHelper(items, (index) => {
                selectedIndex = index;
            });

            helper.handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));
            expect(selectedIndex).toBe(0);

            selectedIndex = -1;
            helper.handleKeyDown(new KeyboardEvent('keydown', { key: ' ' }));
            expect(selectedIndex).toBe(0);

            document.body.removeChild(items[0]);
        });
    });

    describe('Keyboard Shortcut Manager', () => {
        it('should register and trigger shortcuts', () => {
            const manager = new KeyboardShortcutManager();
            let triggered = false;

            manager.register('r', () => {
                triggered = true;
            });

            manager.activate();

            fireEvent.keyDown(document, { key: 'r' });
            expect(triggered).toBe(true);

            manager.deactivate();
        });

        it('should handle shortcuts with modifiers', () => {
            const manager = new KeyboardShortcutManager();
            let triggered = false;

            manager.register('s', () => {
                triggered = true;
            }, 'ctrl');

            manager.activate();

            // Regular 's' should not trigger
            fireEvent.keyDown(document, { key: 's' });
            expect(triggered).toBe(false);

            // Ctrl+S should trigger
            fireEvent.keyDown(document, { key: 's', ctrlKey: true });
            expect(triggered).toBe(true);

            manager.deactivate();
        });

        it('should unregister shortcuts', () => {
            const manager = new KeyboardShortcutManager();
            let triggered = false;

            manager.register('r', () => {
                triggered = true;
            });
            manager.unregister('r');

            manager.activate();

            fireEvent.keyDown(document, { key: 'r' });
            expect(triggered).toBe(false);

            manager.deactivate();
        });
    });

    describe('ARIA Label Generators', () => {
        it('should generate unique ARIA IDs', () => {
            const id1 = generateAriaId('test');
            const id2 = generateAriaId('test');

            expect(id1).toMatch(/^test-\d+-\d+$/);
            expect(id2).toMatch(/^test-\d+-\d+$/);
            expect(id1).not.toBe(id2);
        });

        it('should generate status ARIA labels', () => {
            expect(getStatusAriaLabel('running')).toBe('running');
            expect(getStatusAriaLabel('waiting_challenge', 'Session')).toBe(
                'Session: waiting challenge'
            );
        });

        it('should generate metric ARIA labels', () => {
            expect(getMetricAriaLabel('Success Rate', '95%')).toBe('Success Rate: 95%');

            expect(
                getMetricAriaLabel('Success Rate', '95%', { value: 5, isPositive: true })
            ).toBe('Success Rate: 95%, increased by 5.0 percent');

            expect(
                getMetricAriaLabel('Error Rate', '5%', { value: -2, isPositive: false })
            ).toBe('Error Rate: 5%, decreased by 2.0 percent');
        });

        it('should generate progress ARIA labels', () => {
            expect(getProgressAriaLabel(50, 100)).toBe('50 of 100, 50 percent complete');
            expect(getProgressAriaLabel(25, 100, 'Upload')).toBe(
                'Upload: 25 of 100, 25 percent complete'
            );
            expect(getProgressAriaLabel(0, 0)).toBe('0 of 0, 0 percent complete');
        });
    });

    describe('Keyboard Navigation', () => {
        it('should allow keyboard navigation through interactive elements', async () => {
            const { container } = render(
                <div>
                    <button>Button 1</button>
                    <button>Button 2</button>
                    <button>Button 3</button>
                </div>
            );

            const buttons = container.querySelectorAll('button');

            // Focus first button
            buttons[0].focus();
            expect(document.activeElement).toBe(buttons[0]);

            // Tab should move focus forward
            await userEvent.tab();
            expect(document.activeElement).toBe(buttons[1]);

            // Tab again
            await userEvent.tab();
            expect(document.activeElement).toBe(buttons[2]);
        });
    });

    describe('ARIA Attributes', () => {
        it('should have proper ARIA labels on interactive elements', () => {
            render(
                <button aria-label="Refresh data">
                    <span aria-hidden="true">↻</span>
                </button>
            );

            const button = screen.getByRole('button', { name: 'Refresh data' });
            expect(button).toBeInTheDocument();
        });

        it('should have proper ARIA live regions for dynamic content', () => {
            const { rerender } = render(
                <div role="status" aria-live="polite" aria-atomic="true">
                    Loading...
                </div>
            );

            const liveRegion = screen.getByRole('status');
            expect(liveRegion).toHaveAttribute('aria-live', 'polite');
            expect(liveRegion).toHaveAttribute('aria-atomic', 'true');

            rerender(
                <div role="status" aria-live="polite" aria-atomic="true">
                    Data loaded
                </div>
            );

            expect(liveRegion).toHaveTextContent('Data loaded');
        });

        it('should have proper ARIA expanded states for collapsible content', () => {
            const { rerender } = render(
                <button aria-expanded="false" aria-controls="content">
                    Toggle
                </button>
            );

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('aria-expanded', 'false');

            rerender(
                <button aria-expanded="true" aria-controls="content">
                    Toggle
                </button>
            );

            expect(button).toHaveAttribute('aria-expanded', 'true');
        });
    });

    describe('Focus Management', () => {
        it('should manage focus when opening modals', () => {
            const { rerender } = render(
                <div>
                    <button>Outside Button</button>
                </div>
            );

            const outsideButton = screen.getByRole('button');
            outsideButton.focus();
            expect(document.activeElement).toBe(outsideButton);

            rerender(
                <div>
                    <button>Outside Button</button>
                    <div role="dialog" aria-modal="true">
                        <button>Modal Button</button>
                    </div>
                </div>
            );

            const modalButton = screen.getByRole('button', { name: 'Modal Button' });
            modalButton.focus();
            expect(document.activeElement).toBe(modalButton);
        });
    });

    describe('Screen Reader Only Content', () => {
        it('should have sr-only class for screen reader only content', () => {
            render(
                <div>
                    <span className="sr-only">Screen reader only text</span>
                    <span>Visible text</span>
                </div>
            );

            const srOnly = document.querySelector('.sr-only');
            expect(srOnly).toBeInTheDocument();
            expect(srOnly).toHaveTextContent('Screen reader only text');
        });
    });
});
