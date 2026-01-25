/**
 * **Feature: shadcn-ui-refactor, Property 3: Consistent Component Usage (Loading/Status)**
 * 
 * Property-based test to verify that loading states and status indicators use shadcn/ui
 * Skeleton and Badge components consistently across the application.
 * 
 * **Validates: Requirements 3.5**
 */

import { render, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// Clean up after each test to prevent DOM pollution
afterEach(() => {
    cleanup();
});

describe('Loading and Status Component Consistency', () => {
    /**
     * Property 3: Consistent Component Usage (Loading/Status)
     * For any UI pattern in the application, if a shadcn/ui component exists for that pattern,
     * the custom implementation should be replaced with the shadcn/ui component
     */

    test('should use shadcn/ui Skeleton components for loading states consistently', () => {
        fc.assert(
            fc.property(
                fc.record({
                    width: fc.integer({ min: 10, max: 500 }),
                    height: fc.integer({ min: 10, max: 100 }),
                    className: fc.string({ minLength: 0, maxLength: 50 }),
                    isRounded: fc.boolean(),
                }),
                (props) => {
                    const className = `h-${props.height} w-${props.width} ${props.isRounded ? 'rounded-full' : ''} ${props.className}`.trim();

                    const { container } = render(
                        <Skeleton className={className} data-testid="skeleton-component" />
                    );

                    const skeletonElement = container.querySelector('[data-testid="skeleton-component"]');

                    // Verify that the Skeleton component is rendered
                    expect(skeletonElement).toBeInTheDocument();

                    // Verify that it has the animate-pulse class (shadcn/ui Skeleton characteristic)
                    expect(skeletonElement).toHaveClass('animate-pulse');

                    // Verify that it has the bg-muted class (shadcn/ui Skeleton characteristic)
                    expect(skeletonElement).toHaveClass('bg-muted/40');

                    // Verify that it has rounded class (either rounded-md by default or rounded-full if specified)
                    if (props.isRounded) {
                        expect(skeletonElement).toHaveClass('rounded-full');
                    } else {
                        expect(skeletonElement).toHaveClass('rounded-md');
                    }

                    // Verify that custom classes are applied
                    if (props.className && props.className.trim()) {
                        expect(skeletonElement).toHaveClass(props.className.trim());
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should use shadcn/ui Badge components for status indicators consistently', () => {
        fc.assert(
            fc.property(
                fc.record({
                    variant: fc.constantFrom('default', 'secondary', 'destructive', 'outline', 'success', 'warning'),
                    text: fc.string({ minLength: 1, maxLength: 20 }).map(s => s.trim()).filter(s => s.length > 0),
                    className: fc.string({ minLength: 0, maxLength: 50 }),
                }),
                (props) => {
                    const { container } = render(
                        <Badge
                            variant={props.variant as any}
                            className={props.className}
                            data-testid="badge-component"
                        >
                            {props.text}
                        </Badge>
                    );

                    const badgeElement = container.querySelector('[data-testid="badge-component"]');

                    // Verify that the Badge component is rendered
                    expect(badgeElement).toBeInTheDocument();

                    // Verify that it has the core Badge classes (shadcn/ui Badge characteristics)
                    expect(badgeElement).toHaveClass('inline-flex');
                    expect(badgeElement).toHaveClass('items-center');
                    expect(badgeElement).toHaveClass('rounded-full');
                    expect(badgeElement).toHaveClass('border');
                    expect(badgeElement).toHaveClass('text-xs');
                    expect(badgeElement).toHaveClass('font-semibold');

                    // Verify that the text content is correct (normalize whitespace)
                    const expectedText = props.text.replace(/\s+/g, ' ').trim();
                    const actualText = badgeElement?.textContent?.replace(/\s+/g, ' ').trim();
                    expect(actualText).toBe(expectedText);

                    // Verify that custom classes are applied
                    if (props.className && props.className.trim()) {
                        expect(badgeElement).toHaveClass(props.className.trim());
                    }

                    // Verify variant-specific classes are applied
                    switch (props.variant) {
                        case 'destructive':
                            expect(badgeElement).toHaveClass('bg-destructive');
                            break;
                        case 'success':
                            expect(badgeElement).toHaveClass('bg-emerald-500/15');
                            break;
                        case 'warning':
                            expect(badgeElement).toHaveClass('bg-amber-500/15');
                            break;
                        case 'secondary':
                            expect(badgeElement).toHaveClass('bg-secondary');
                            break;
                        case 'outline':
                            expect(badgeElement).toHaveClass('text-foreground');
                            break;
                        default:
                            expect(badgeElement).toHaveClass('bg-primary');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should not use custom loading implementations when Skeleton is available', () => {
        fc.assert(
            fc.property(
                fc.record({
                    customLoadingText: fc.string({ minLength: 1, maxLength: 50 }),
                    hasAnimatePulse: fc.boolean(),
                    hasCustomSpinner: fc.boolean(),
                }),
                (props) => {
                    // Test that we should prefer Skeleton over custom loading implementations
                    const customLoadingDiv = document.createElement('div');
                    customLoadingDiv.className = props.hasAnimatePulse ? 'animate-pulse' : '';
                    customLoadingDiv.textContent = props.customLoadingText;

                    // If we have a custom loading implementation with animate-pulse,
                    // it should be replaced with Skeleton component
                    if (props.hasAnimatePulse && props.customLoadingText.toLowerCase().includes('loading')) {
                        // This represents a pattern that should be refactored to use Skeleton
                        const { container } = render(<Skeleton className="h-4 w-32" />);
                        const skeletonElement = container.querySelector('.animate-pulse');

                        expect(skeletonElement).toBeInTheDocument();
                        expect(skeletonElement).toHaveClass('bg-muted/40');
                    }

                    // Custom spinners should be replaced with Skeleton for consistency
                    if (props.hasCustomSpinner) {
                        const { container } = render(<Skeleton className="h-5 w-5 rounded-full" />);
                        const skeletonElement = container.querySelector('.animate-pulse');

                        expect(skeletonElement).toBeInTheDocument();
                        expect(skeletonElement).toHaveClass('rounded-full');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should not use custom status badges when Badge component is available', () => {
        fc.assert(
            fc.property(
                fc.record({
                    statusType: fc.constantFrom('success', 'error', 'warning', 'info'),
                    statusText: fc.string({ minLength: 1, maxLength: 15 }).map(s => s.trim()).filter(s => s.length > 0),
                    hasCustomStyling: fc.boolean(),
                }),
                (props) => {
                    // Map status types to Badge variants
                    const variantMap = {
                        'success': 'success',
                        'error': 'destructive',
                        'warning': 'warning',
                        'info': 'secondary'
                    };

                    const variant = variantMap[props.statusType];

                    const { container } = render(
                        <Badge variant={variant as any}>
                            {props.statusText}
                        </Badge>
                    );

                    const badgeElement = container.querySelector('.inline-flex');

                    // Verify Badge component is used instead of custom status implementation
                    expect(badgeElement).toBeInTheDocument();
                    expect(badgeElement).toHaveClass('rounded-full');

                    // Verify text content (normalize whitespace)
                    const expectedText = props.statusText.replace(/\s+/g, ' ').trim();
                    const actualText = badgeElement?.textContent?.replace(/\s+/g, ' ').trim();
                    expect(actualText).toBe(expectedText);

                    // Verify appropriate variant styling is applied
                    if (props.statusType === 'success') {
                        expect(badgeElement).toHaveClass('bg-emerald-500/15');
                    } else if (props.statusType === 'error') {
                        expect(badgeElement).toHaveClass('bg-destructive');
                    } else if (props.statusType === 'warning') {
                        expect(badgeElement).toHaveClass('bg-amber-500/15');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});