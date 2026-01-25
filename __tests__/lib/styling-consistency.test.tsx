/**
 * Property-based tests for styling consistency
 * **Feature: shadcn-ui-refactor, Property 6: Styling Consistency**
 * **Validates: Requirements 5.3, 5.4, 5.5**
 */

import { render } from '@testing-library/react';
import * as fc from 'fast-check';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FilterButton } from '@/components/ui/filter-button';
import { StatusIndicator, ActionStatus, ConnectionStatus, PriceStatus } from '@/components/ui/status-indicator';
import {
    getStatusBadgeVariant,
    BADGE_VARIANTS,
    BUTTON_VARIANTS
} from '@/lib/utils/variant-helpers';
import {
    componentStylePresets,
    customShadows,
    glowEffects,
    premiumGradients
} from '@/lib/utils/custom-styling';
import {
    getInteractiveStyles,
    commonInteractiveStyles
} from '@/lib/utils/interactive-styles';

describe('Styling Consistency Property Tests', () => {
    describe('Status Indicator Consistency', () => {
        it('should maintain consistent Badge variants for all status types', () => {
            /**
             * **Feature: shadcn-ui-refactor, Property 6: Styling Consistency**
             * For any status string, the status indicator should use consistent shadcn/ui Badge variants
             * and preserve existing success, warning, and error color schemes
             */
            fc.assert(
                fc.property(
                    fc.constantFrom('RED', 'GREEN', 'NEUTRAL', 'COMP_OOS', 'NOT_FOUND', 'ACTIVE', 'INACTIVE', 'ERROR', 'WARNING', 'SUCCESS', 'INFO'),
                    (status) => {
                        const variant = getStatusBadgeVariant(status);

                        // Should always return a valid Badge variant
                        expect(Object.values(BADGE_VARIANTS)).toContain(variant);

                        // Should preserve color scheme mapping
                        const expectedMappings: Record<string, string> = {
                            'RED': 'destructive',
                            'GREEN': 'success',
                            'ERROR': 'destructive',
                            'SUCCESS': 'success',
                            'WARNING': 'warning',
                            'COMP_OOS': 'warning'
                        };

                        if (expectedMappings[status]) {
                            expect(variant).toBe(expectedMappings[status]);
                        }

                        // Test that StatusIndicator renders with correct variant
                        const { container } = render(
                            <StatusIndicator status={status} />
                        );

                        const badgeElement = container.querySelector('[class*="inline-flex"]');
                        expect(badgeElement).toBeInTheDocument();
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should render specialized status components consistently', () => {
            /**
             * **Feature: shadcn-ui-refactor, Property 6: Styling Consistency**
             * For any specialized status component, it should maintain consistent styling patterns
             */
            fc.assert(
                fc.property(
                    fc.constantFrom('APPROVE', 'REJECT', 'UPDATE', 'DELETE'),
                    fc.constantFrom('ACTIVE', 'INACTIVE', 'ERROR', 'CONNECTING'),
                    fc.constantFrom('RED', 'GREEN', 'NEUTRAL', 'COMP_OOS', 'NOT_FOUND'),
                    (action, connectionStatus, priceStatus) => {
                        // Test ActionStatus consistency
                        const { container: actionContainer } = render(
                            <ActionStatus action={action} />
                        );
                        const actionBadge = actionContainer.querySelector('[class*="inline-flex"]');
                        expect(actionBadge).toBeInTheDocument();
                        expect(actionBadge).toHaveClass('font-bold', 'uppercase', 'tracking-wider');

                        // Test ConnectionStatus consistency
                        const { container: connectionContainer } = render(
                            <ConnectionStatus status={connectionStatus as any} />
                        );
                        const connectionBadge = connectionContainer.querySelector('[class*="inline-flex"]');
                        expect(connectionBadge).toBeInTheDocument();

                        // Test PriceStatus consistency
                        const { container: priceContainer } = render(
                            <PriceStatus status={priceStatus as any} />
                        );
                        const priceBadge = priceContainer.querySelector('[class*="inline-flex"]');
                        expect(priceBadge).toBeInTheDocument();
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    describe('Interactive Element Consistency', () => {
        it('should apply consistent hover and focus states across components', () => {
            /**
             * **Feature: shadcn-ui-refactor, Property 6: Styling Consistency**
             * For any interactive element, hover and focus states should be consistent
             * and use shadcn/ui interaction patterns
             */
            fc.assert(
                fc.property(
                    fc.constantFrom('button', 'subtle', 'navigation', 'input', 'destructive'),
                    fc.boolean(),
                    fc.boolean(),
                    (variant, includeHover, includeFocus) => {
                        const styles = getInteractiveStyles(variant as any, {
                            includeHover,
                            includeFocus
                        });

                        // Should always include base transition styles
                        expect(styles).toContain('transition');

                        // Should include hover styles when requested
                        if (includeHover) {
                            expect(styles).toMatch(/hover:/);
                        }

                        // Should include focus styles when requested
                        if (includeFocus) {
                            expect(styles).toMatch(/focus:/);
                        }

                        // Should not be empty
                        expect(styles.trim()).not.toBe('');
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should maintain consistent FilterButton styling', () => {
            /**
             * **Feature: shadcn-ui-refactor, Property 6: Styling Consistency**
             * For any FilterButton configuration, styling should be consistent with status indicators
             */
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 20 }),
                    fc.string({ minLength: 1, maxLength: 20 }),
                    fc.integer({ min: 0, max: 1000 }),
                    fc.constantFrom('RED', 'GREEN', 'NEUTRAL', 'COMP_OOS', 'NOT_FOUND', 'ALL'),
                    fc.boolean(),
                    (segment, label, count, status, isActive) => {
                        const mockOnClick = jest.fn();

                        const { container } = render(
                            <FilterButton
                                segment={segment}
                                label={label}
                                count={count}
                                status={status as any}
                                isActive={isActive}
                                onClick={mockOnClick}
                            />
                        );

                        const button = container.querySelector('button');
                        expect(button).toBeInTheDocument();

                        // Should have consistent button styling
                        expect(button).toHaveClass('px-3', 'py-1.5', 'rounded-md', 'text-[10px]', 'font-bold', 'uppercase', 'tracking-wider');

                        // Should have interactive styles
                        expect(button?.className).toMatch(/transition/);

                        // Should show status dot for non-ALL statuses
                        if (status !== 'ALL') {
                            const dot = container.querySelector('.w-1\\.5.h-1\\.5.rounded-full');
                            expect(dot).toBeInTheDocument();
                        }
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    describe('Custom Styling Extensions', () => {
        it('should provide consistent custom styling utilities', () => {
            /**
             * **Feature: shadcn-ui-refactor, Property 6: Styling Consistency**
             * For any custom styling extension, it should follow shadcn/ui extension patterns
             * and preserve unique visual elements
             */
            fc.assert(
                fc.property(
                    fc.constantFrom('premiumButton', 'glassCard', 'statusIndicator', 'floatingButton', 'heroBackground', 'modalOverlay'),
                    (presetName) => {
                        const preset = componentStylePresets[presetName as keyof typeof componentStylePresets];

                        // Should not be empty
                        expect(preset.trim()).not.toBe('');

                        // Should not contain invalid characters that would break CSS
                        expect(preset).not.toMatch(/[<>{}]/);

                        // Should be a string of reasonable length
                        expect(preset.length).toBeGreaterThan(0);
                        expect(preset.length).toBeLessThan(1000);

                        // Premium button should have gradient and glow
                        if (presetName === 'premiumButton') {
                            expect(preset).toMatch(/bg-gradient|shadow/);
                        }

                        // Glass card should have backdrop blur
                        if (presetName === 'glassCard') {
                            expect(preset).toMatch(/backdrop-blur/);
                        }

                        // Status indicator should have pulse animation
                        if (presetName === 'statusIndicator') {
                            expect(preset).toMatch(/animate-pulse/);
                        }
                    }
                ),
                { numRuns: 50 }
            );
        });

        it('should maintain consistent shadow and glow effects', () => {
            /**
             * **Feature: shadcn-ui-refactor, Property 6: Styling Consistency**
             * For any shadow or glow effect, it should provide consistent visual depth
             */
            fc.assert(
                fc.property(
                    fc.constantFrom('soft', 'elevated', 'overlay', 'primaryGlow', 'successGlow', 'warningGlow', 'destructiveGlow'),
                    fc.constantFrom('primary', 'success', 'warning', 'destructive', 'subtle'),
                    (shadowType, glowType) => {
                        const shadow = customShadows[shadowType as keyof typeof customShadows];
                        const glow = glowEffects[glowType as keyof typeof glowEffects];

                        // Shadows should contain shadow classes
                        expect(shadow).toMatch(/shadow/);

                        // Glows should contain shadow classes (with or without color)
                        expect(glow).toMatch(/shadow/);

                        // Colored glows should have color notation
                        if (glowType !== 'subtle') {
                            expect(glow).toMatch(/shadow.*\//);
                        }

                        // Should not be empty
                        expect(shadow.trim()).not.toBe('');
                        expect(glow.trim()).not.toBe('');
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    describe('Component Integration', () => {
        it('should maintain styling consistency when components are combined', () => {
            /**
             * **Feature: shadcn-ui-refactor, Property 6: Styling Consistency**
             * For any combination of styled components, the overall styling should remain consistent
             */
            fc.assert(
                fc.property(
                    fc.constantFrom('default', 'secondary', 'success', 'warning', 'destructive', 'outline'),
                    fc.constantFrom('default', 'secondary', 'outline', 'ghost', 'link', 'destructive'),
                    fc.string({ minLength: 1, maxLength: 10 }),
                    (badgeVariant, buttonVariant, statusText) => {
                        const { container } = render(
                            <div>
                                <Badge variant={badgeVariant as any}>{statusText}</Badge>
                                <Button variant={buttonVariant as any}>Action</Button>
                                <StatusIndicator status={statusText} />
                            </div>
                        );

                        // All components should render
                        const badge = container.querySelector('[class*="inline-flex"][class*="rounded-full"]');
                        const button = container.querySelector('button[class*="inline-flex"]');
                        const statusIndicator = container.querySelector('[class*="inline-flex"][class*="font-bold"]');

                        expect(badge).toBeInTheDocument();
                        expect(button).toBeInTheDocument();
                        expect(statusIndicator).toBeInTheDocument();

                        // Should have consistent spacing and typography
                        expect(badge).toHaveClass('px-2.5', 'py-0.5', 'text-xs', 'font-semibold');
                    }
                ),
                { numRuns: 30 }
            );
        });
    });

    describe('Accessibility and Visual Hierarchy', () => {
        it('should maintain proper contrast and visual hierarchy', () => {
            /**
             * **Feature: shadcn-ui-refactor, Property 6: Styling Consistency**
             * For any styled component, it should maintain proper visual hierarchy and accessibility
             */
            fc.assert(
                fc.property(
                    fc.constantFrom('success', 'warning', 'destructive'),
                    fc.constantFrom('sm', 'default', 'lg'),
                    (variant, size) => {
                        const { container } = render(
                            <StatusIndicator
                                status={variant.toUpperCase()}
                                size={size as any}
                            />
                        );

                        const indicator = container.querySelector('[class*="inline-flex"]');
                        expect(indicator).toBeInTheDocument();

                        // Should have proper text sizing based on size prop
                        if (size === 'sm') {
                            expect(indicator).toHaveClass('text-[9px]');
                        } else if (size === 'default') {
                            expect(indicator).toHaveClass('text-[10px]');
                        } else if (size === 'lg') {
                            expect(indicator).toHaveClass('text-xs');
                        }

                        // Should maintain font weight for readability
                        expect(indicator).toHaveClass('font-bold');
                    }
                ),
                { numRuns: 50 }
            );
        });
    });
});