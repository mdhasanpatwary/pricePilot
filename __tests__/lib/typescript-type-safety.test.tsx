/**
 * Property-based test for TypeScript type safety
 * **Feature: shadcn-ui-refactor, Property 5: TypeScript Type Safety**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
 */

import * as fc from 'fast-check';
import {
    ButtonVariant,
    BadgeVariant,
    ButtonSize,
    isValidButtonVariant,
    isValidBadgeVariant,
    EnhancedButtonProps,
    EnhancedBadgeProps,
    EnhancedInputProps,
    ButtonClickHandler,
    InputChangeHandler,
    SelectChangeHandler
} from '@/lib/types/shadcn-ui';
import {
    validateButtonVariant,
    validateBadgeVariant,
    getStatusBadgeVariant,
    getActionButtonVariant,
    BUTTON_VARIANTS,
    BADGE_VARIANTS,
    BUTTON_SIZES,
    safeVariantProps
} from '@/lib/utils/variant-helpers';

// Generators for valid component props
const buttonVariantArb = fc.constantFrom(...Object.values(BUTTON_VARIANTS));
const badgeVariantArb = fc.constantFrom(...Object.values(BADGE_VARIANTS));
const buttonSizeArb = fc.constantFrom(...Object.values(BUTTON_SIZES));

describe('TypeScript Type Safety Property Tests', () => {
    describe('Variant Type Safety', () => {
        it('should validate button variants correctly', () => {
            fc.assert(
                fc.property(fc.string(), (variant) => {
                    const result = validateButtonVariant(variant);

                    // Result should always be a valid ButtonVariant
                    expect(isValidButtonVariant(result)).toBe(true);

                    // If input was valid, result should match input
                    if (isValidButtonVariant(variant)) {
                        expect(result).toBe(variant);
                    } else {
                        // If input was invalid, should fallback to default
                        expect(result).toBe('default');
                    }
                }),
                { numRuns: 100 }
            );
        });

        it('should validate badge variants correctly', () => {
            fc.assert(
                fc.property(fc.string(), (variant) => {
                    const result = validateBadgeVariant(variant);

                    expect(isValidBadgeVariant(result)).toBe(true);

                    if (isValidBadgeVariant(variant)) {
                        expect(result).toBe(variant);
                    } else {
                        expect(result).toBe('default');
                    }
                }),
                { numRuns: 100 }
            );
        });

        it('should map status strings to valid badge variants', () => {
            fc.assert(
                fc.property(fc.string(), (status) => {
                    const variant = getStatusBadgeVariant(status);

                    // Result should always be a valid BadgeVariant
                    expect(isValidBadgeVariant(variant)).toBe(true);

                    // Should be one of the expected variants
                    expect(Object.values(BADGE_VARIANTS)).toContain(variant);
                }),
                { numRuns: 100 }
            );
        });

        it('should map action strings to valid button variants', () => {
            fc.assert(
                fc.property(fc.string(), (action) => {
                    const variant = getActionButtonVariant(action);

                    // Result should always be a valid ButtonVariant
                    expect(isValidButtonVariant(variant)).toBe(true);

                    // Should be one of the expected variants
                    expect(Object.values(BUTTON_VARIANTS)).toContain(variant);
                }),
                { numRuns: 100 }
            );
        });

        it('should safely validate variant props with fallbacks', () => {
            fc.assert(
                fc.property(
                    fc.option(fc.string()),
                    fc.constantFrom(...Object.values(BUTTON_VARIANTS)),
                    (variant, fallback) => {
                        const validVariants = Object.values(BUTTON_VARIANTS);
                        const result = safeVariantProps(variant, validVariants, fallback);

                        // Result should always be a valid variant
                        expect(validVariants).toContain(result);

                        // If input was valid, should return input; otherwise fallback
                        if (variant && validVariants.includes(variant as ButtonVariant)) {
                            expect(result).toBe(variant);
                        } else {
                            expect(result).toBe(fallback);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Type Interface Compliance', () => {
        it('should accept valid EnhancedButtonProps', () => {
            fc.assert(
                fc.property(
                    fc.option(buttonVariantArb),
                    fc.option(buttonSizeArb),
                    fc.boolean(),
                    fc.option(fc.string()),
                    fc.option(fc.boolean()),
                    (variant, size, disabled, className, loading) => {
                        // This validates TypeScript compilation - if this compiles, types are correct
                        const props: EnhancedButtonProps = {
                            variant,
                            size,
                            disabled,
                            className: className || undefined,
                            loading,
                            onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
                                // Type-safe event handler
                                expect(event.type).toBe('click');
                            }
                        };

                        // Verify props are properly typed
                        expect(typeof props).toBe('object');
                        if (variant) expect(isValidButtonVariant(variant)).toBe(true);
                        if (size) expect(Object.values(BUTTON_SIZES)).toContain(size);
                    }
                ),
                { numRuns: 50 }
            );
        });

        it('should accept valid EnhancedBadgeProps', () => {
            fc.assert(
                fc.property(
                    fc.option(badgeVariantArb),
                    fc.option(fc.string()),
                    fc.option(fc.string()),
                    (variant, className, iconText) => {
                        const props: EnhancedBadgeProps = {
                            variant,
                            className: className || undefined,
                            icon: iconText ? iconText : undefined
                        };

                        expect(typeof props).toBe('object');
                        if (variant) expect(isValidBadgeVariant(variant)).toBe(true);
                    }
                ),
                { numRuns: 50 }
            );
        });

        it('should accept valid EnhancedInputProps', () => {
            fc.assert(
                fc.property(
                    fc.option(fc.string()),
                    fc.option(fc.string()),
                    fc.boolean(),
                    fc.option(fc.string()),
                    (label, error, loading, helperText) => {
                        const props: EnhancedInputProps = {
                            label: label || undefined,
                            error: error || undefined,
                            loading,
                            helperText: helperText || undefined,
                            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                                // Type-safe event handler
                                expect(typeof event.target.value).toBe('string');
                            }
                        };

                        expect(typeof props).toBe('object');
                        expect(typeof props.loading).toBe('boolean');
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    describe('Event Handler Type Safety', () => {
        it('should provide type-safe button click handlers', () => {
            fc.assert(
                fc.property(fc.string(), (buttonText) => {
                    let eventReceived: React.MouseEvent<HTMLButtonElement> | null = null;

                    const handler: ButtonClickHandler = (event) => {
                        eventReceived = event;
                        // TypeScript should enforce correct event type
                        expect(event.currentTarget).toBeDefined();
                        expect(event.type).toBeDefined();
                    };

                    // Simulate event object
                    const mockEvent = {
                        type: 'click',
                        currentTarget: document.createElement('button'),
                        preventDefault: jest.fn(),
                        stopPropagation: jest.fn()
                    } as unknown as React.MouseEvent<HTMLButtonElement>;

                    handler(mockEvent);
                    expect(eventReceived).toBe(mockEvent);
                }),
                { numRuns: 30 }
            );
        });

        it('should provide type-safe input change handlers', () => {
            fc.assert(
                fc.property(fc.string(), (inputValue) => {
                    let eventReceived: React.ChangeEvent<HTMLInputElement> | null = null;

                    const handler: InputChangeHandler = (event) => {
                        eventReceived = event;
                        expect(event.target.value).toBeDefined();
                    };

                    // Simulate event object
                    const mockEvent = {
                        type: 'change',
                        target: { value: inputValue },
                        currentTarget: document.createElement('input')
                    } as unknown as React.ChangeEvent<HTMLInputElement>;

                    handler(mockEvent);
                    expect(eventReceived).toBe(mockEvent);
                    expect(eventReceived?.target.value).toBe(inputValue);
                }),
                { numRuns: 30 }
            );
        });

        it('should provide type-safe select change handlers', () => {
            fc.assert(
                fc.property(fc.string(), (selectedValue) => {
                    let valueReceived: string | null = null;

                    const handler: SelectChangeHandler<string> = (value) => {
                        valueReceived = value;
                        expect(typeof value).toBe('string');
                    };

                    handler(selectedValue);
                    expect(valueReceived).toBe(selectedValue);
                }),
                { numRuns: 30 }
            );
        });
    });

    describe('Variant Constants Type Safety', () => {
        it('should ensure variant constants are properly typed', () => {
            // This test validates that our variant constants maintain type safety
            const buttonVariants: ButtonVariant[] = Object.values(BUTTON_VARIANTS);
            const badgeVariants: BadgeVariant[] = Object.values(BADGE_VARIANTS);
            const buttonSizes: ButtonSize[] = Object.values(BUTTON_SIZES);

            // All button variants should be valid
            buttonVariants.forEach(variant => {
                expect(isValidButtonVariant(variant)).toBe(true);
            });

            // All badge variants should be valid
            badgeVariants.forEach(variant => {
                expect(isValidBadgeVariant(variant)).toBe(true);
            });

            // All button sizes should be valid
            buttonSizes.forEach(size => {
                expect(['default', 'sm', 'lg', 'icon']).toContain(size);
            });

            // Constants should match expected values
            expect(BUTTON_VARIANTS.PRIMARY).toBe('default');
            expect(BUTTON_VARIANTS.SECONDARY).toBe('secondary');
            expect(BUTTON_VARIANTS.OUTLINE).toBe('outline');
            expect(BUTTON_VARIANTS.GHOST).toBe('ghost');
            expect(BUTTON_VARIANTS.LINK).toBe('link');
            expect(BUTTON_VARIANTS.DESTRUCTIVE).toBe('destructive');

            expect(BADGE_VARIANTS.DEFAULT).toBe('default');
            expect(BADGE_VARIANTS.SECONDARY).toBe('secondary');
            expect(BADGE_VARIANTS.SUCCESS).toBe('success');
            expect(BADGE_VARIANTS.WARNING).toBe('warning');
            expect(BADGE_VARIANTS.DESTRUCTIVE).toBe('destructive');
            expect(BADGE_VARIANTS.OUTLINE).toBe('outline');

            expect(BUTTON_SIZES.SMALL).toBe('sm');
            expect(BUTTON_SIZES.DEFAULT).toBe('default');
            expect(BUTTON_SIZES.LARGE).toBe('lg');
            expect(BUTTON_SIZES.ICON).toBe('icon');
        });

        it('should maintain type safety across variant transformations', () => {
            fc.assert(
                fc.property(
                    fc.string(),
                    fc.constantFrom(...Object.values(BUTTON_VARIANTS)),
                    (input, fallback) => {
                        // Test the complete type safety chain
                        const validated = validateButtonVariant(input);
                        const isValid = isValidButtonVariant(validated);
                        const safeVariant = safeVariantProps(input, Object.values(BUTTON_VARIANTS), fallback);

                        // All results should maintain type safety
                        expect(isValid).toBe(true);
                        expect(Object.values(BUTTON_VARIANTS)).toContain(validated);
                        expect(Object.values(BUTTON_VARIANTS)).toContain(safeVariant);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Component Prop Type Validation', () => {
        it('should validate component props maintain type constraints', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        variant: fc.option(buttonVariantArb),
                        size: fc.option(buttonSizeArb),
                        disabled: fc.boolean(),
                        loading: fc.option(fc.boolean())
                    }),
                    (props) => {
                        // This test ensures TypeScript compilation succeeds with valid props
                        const buttonProps: Partial<EnhancedButtonProps> = {
                            ...props,
                            onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
                                expect(event.type).toBeDefined();
                            }
                        };

                        // Verify type constraints are maintained
                        if (buttonProps.variant) {
                            expect(isValidButtonVariant(buttonProps.variant)).toBe(true);
                        }

                        if (buttonProps.size) {
                            expect(Object.values(BUTTON_SIZES)).toContain(buttonProps.size);
                        }

                        expect(typeof buttonProps.disabled).toBe('boolean');
                    }
                ),
                { numRuns: 50 }
            );
        });
    });
});