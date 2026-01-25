/**
 * **Feature: shadcn-ui-refactor, Property 3: Consistent Component Usage (Drawers/Modals)**
 * 
 * Property-based test to verify that drawer and modal components use shadcn/ui Sheet
 * components consistently across the application.
 * 
 * **Validates: Requirements 3.4**
 */

import { render, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';

// Import the actual drawer components to test their consistency
import BulkUpdateDrawer from '@/components/dashboard/bulk-update-drawer';
import ProductDetailDrawer from '@/components/dashboard/product-detail-drawer';
import ProductComparisonDrawer from '@/components/dashboard/product-comparison-drawer';

// Clean up after each test to prevent DOM pollution
afterEach(() => {
    cleanup();
    // Clean up any portaled content
    document.body.innerHTML = '';
});

describe('Drawer/Modal Component Consistency', () => {
    /**
     * Property 3: Consistent Component Usage (Drawers/Modals)
     * For any UI pattern in the application, if a shadcn/ui component exists for that pattern,
     * the custom implementation should be replaced with the shadcn/ui component
     */

    test('should use shadcn/ui Sheet components consistently', () => {
        fc.assert(
            fc.property(
                fc.record({
                    isOpen: fc.boolean(),
                    title: fc.string({ minLength: 1, maxLength: 50 }),
                    description: fc.string({ minLength: 1, maxLength: 100 }),
                }),
                (props) => {
                    const testId = `consistent-drawer-${props.isOpen ? 'open' : 'closed'}`;

                    const TestDrawer = () => (
                        <Sheet open={props.isOpen} onOpenChange={() => { }}>
                            <SheetContent data-testid={testId}>
                                <SheetHeader>
                                    <SheetTitle>{props.title}</SheetTitle>
                                    <SheetDescription>{props.description}</SheetDescription>
                                </SheetHeader>
                                <div>Consistent drawer content</div>
                            </SheetContent>
                        </Sheet>
                    );

                    render(<TestDrawer />);

                    // Check that the drawer uses proper shadcn/ui structure only when open
                    // Since Sheet uses portals, check in document.body instead of container
                    const dialogElement = document.body.querySelector('[role="dialog"]');

                    if (props.isOpen) {
                        // When open, should have dialog element with proper attributes
                        expect(dialogElement).toBeTruthy();
                        if (dialogElement) {
                            expect(dialogElement).toHaveAttribute('data-state');
                            expect(dialogElement.className).toContain('fixed');
                            expect(dialogElement.className).toContain('z-50');
                        }
                    } else {
                        // When closed, dialog element should not be present
                        expect(dialogElement).toBeFalsy();
                    }

                    cleanup();
                    document.body.innerHTML = '';
                }
            ),
            { numRuns: 25 }
        );
    });

    test('BulkUpdateDrawer should use shadcn/ui Sheet component structure', () => {
        const mockProps = {
            open: true, // Test with open state to verify structure
            onOpenChange: jest.fn(),
            selectedCount: 5,
            onExecute: jest.fn(),
        };

        render(<BulkUpdateDrawer {...mockProps} />);

        // Check that it renders a Sheet component (dialog role) when open
        // Since Sheet uses portals, check in document.body
        const dialogElement = document.body.querySelector('[role="dialog"]');
        expect(dialogElement).toBeTruthy();

        // Check for shadcn/ui specific classes
        if (dialogElement) {
            expect(dialogElement.className).toContain('fixed');
            expect(dialogElement.className).toContain('z-50');
            expect(dialogElement).toHaveAttribute('data-state');
        }

        cleanup();
        document.body.innerHTML = '';

        // Test with closed state
        render(<BulkUpdateDrawer {...mockProps} open={false} />);

        // When closed, the component should not render dialog
        const closedDialogElement = document.body.querySelector('[role="dialog"]');
        expect(closedDialogElement).toBeFalsy();
    });

    test('ProductDetailDrawer should use shadcn/ui Sheet component structure', () => {
        const mockProduct = {
            id: '1',
            title: 'Test Product',
            sku: 'TEST-001',
            yourPrice: 100,
            status: 'GREEN' as const,
            inStock: true,
            brand: 'Test Brand',
            category: 'Test Category',
            allMatches: [],
        };

        const mockProps = {
            open: true,
            onOpenChange: jest.fn(),
            product: mockProduct,
            currency: 'USD',
        };

        render(<ProductDetailDrawer {...mockProps} />);

        // Check that it renders a Sheet component (dialog role)
        const dialogElement = document.body.querySelector('[role="dialog"]');
        expect(dialogElement).toBeTruthy();

        // Check for shadcn/ui specific classes
        if (dialogElement) {
            expect(dialogElement.className).toContain('fixed');
            expect(dialogElement.className).toContain('z-50');
            expect(dialogElement).toHaveAttribute('data-state');
        }
    });

    test('ProductComparisonDrawer should use shadcn/ui Sheet component structure', () => {
        const mockProducts = [
            {
                id: '1',
                title: 'Test Product 1',
                sku: 'TEST-001',
                yourPrice: 100,
                status: 'GREEN' as const,
                inStock: true,
                brand: 'Test Brand',
                category: 'Test Category',
                specifications: { feature1: 'value1' },
            },
        ];

        const mockProps = {
            products: mockProducts,
            isOpen: true,
            onClose: jest.fn(),
            currency: 'USD',
        };

        render(<ProductComparisonDrawer {...mockProps} />);

        // Check that it renders a Sheet component (dialog role)
        const dialogElement = document.body.querySelector('[role="dialog"]');
        expect(dialogElement).toBeTruthy();

        // Check for shadcn/ui specific classes
        if (dialogElement) {
            expect(dialogElement.className).toContain('fixed');
            expect(dialogElement.className).toContain('z-50');
            expect(dialogElement).toHaveAttribute('data-state');
        }
    });

    test('should maintain consistent Sheet component structure across configurations', () => {
        fc.assert(
            fc.property(
                fc.record({
                    side: fc.constantFrom('left', 'right', 'top', 'bottom'),
                    hasHeader: fc.boolean(),
                }),
                (props) => {
                    const testId = `structure-drawer-${props.side}-${props.hasHeader ? 'header' : 'no-header'}`;

                    const TestConsistentDrawer = () => (
                        <Sheet open={true} onOpenChange={() => { }}>
                            <SheetContent
                                side={props.side as any}
                                data-testid={testId}
                            >
                                {props.hasHeader && (
                                    <SheetHeader>
                                        <SheetTitle>Consistent Title</SheetTitle>
                                        <SheetDescription>Consistent Description</SheetDescription>
                                    </SheetHeader>
                                )}
                                <div>Main content area</div>
                            </SheetContent>
                        </Sheet>
                    );

                    render(<TestConsistentDrawer />);

                    // Check for consistent shadcn/ui attributes
                    const dialogElement = document.body.querySelector('[role="dialog"]');
                    expect(dialogElement).toBeTruthy();

                    if (dialogElement) {
                        // All Sheet components should have these consistent attributes
                        expect(dialogElement).toHaveAttribute('data-state', 'open');
                        expect(dialogElement.className).toContain('fixed');
                        expect(dialogElement.className).toContain('z-50');
                        // Note: Some classes may vary based on theme/configuration
                        // Focus on core structural classes that should always be present
                    }

                    cleanup();
                    document.body.innerHTML = '';
                }
            ),
            { numRuns: 20 }
        );
    });

    test('should ensure all drawer components follow shadcn/ui patterns', () => {
        // Test that all drawer components use the same base structure
        const drawerComponents = [
            {
                name: 'BulkUpdateDrawer',
                component: BulkUpdateDrawer,
                props: {
                    open: true,
                    onOpenChange: jest.fn(),
                    selectedCount: 3,
                    onExecute: jest.fn(),
                },
            },
            {
                name: 'ProductDetailDrawer',
                component: ProductDetailDrawer,
                props: {
                    open: true,
                    onOpenChange: jest.fn(),
                    product: {
                        id: '1',
                        title: 'Test Product',
                        sku: 'TEST-001',
                        yourPrice: 100,
                        status: 'GREEN' as const,
                        inStock: true,
                        brand: 'Test Brand',
                        category: 'Test Category',
                        allMatches: [],
                    },
                },
            },
            {
                name: 'ProductComparisonDrawer',
                component: ProductComparisonDrawer,
                props: {
                    products: [{
                        id: '1',
                        title: 'Test Product',
                        sku: 'TEST-001',
                        yourPrice: 100,
                        status: 'GREEN' as const,
                        inStock: true,
                        brand: 'Test Brand',
                        category: 'Test Category',
                        specifications: {},
                    }],
                    isOpen: true,
                    onClose: jest.fn(),
                    currency: 'USD',
                },
            },
        ];

        drawerComponents.forEach(({ name, component: Component, props }) => {
            render(<Component {...props} />);

            // Each drawer should use shadcn/ui Sheet structure
            const dialogElement = document.body.querySelector('[role="dialog"]');
            expect(dialogElement).toBeTruthy();

            if (dialogElement) {
                // Consistent shadcn/ui attributes across all drawers
                expect(dialogElement).toHaveAttribute('data-state');
                expect(dialogElement.className).toContain('fixed');
                expect(dialogElement.className).toContain('z-50');
            }

            cleanup();
            document.body.innerHTML = '';
        });
    });
});