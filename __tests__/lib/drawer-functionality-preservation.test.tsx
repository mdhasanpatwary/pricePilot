/**
 * **Feature: shadcn-ui-refactor, Property 2: Functional Behavior Preservation (Drawers/Modals)**
 * 
 * Property-based test to verify that drawer and modal functionality is preserved when
 * refactoring from custom implementations to shadcn/ui Sheet components.
 * 
 * **Validates: Requirements 2.2**
 */

import { render, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fc from 'fast-check';

import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';

// Clean up after each test to prevent DOM pollution
afterEach(cleanup);

describe('Drawer/Modal Functionality Preservation', () => {
    /**
     * Property 2: Functional Behavior Preservation (Drawers/Modals)
     * For any component refactor, all existing event handlers, form validation, 
     * and user interactions should work identically to the original implementation
     */

    test('should preserve drawer open/close functionality', async () => {
        let closeCallCount = 0;

        const TestDrawer = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
            <Sheet open={open} onOpenChange={onClose}>
                <SheetContent data-testid="drawer-content">
                    <SheetHeader>
                        <SheetTitle>Test Drawer</SheetTitle>
                        <SheetDescription>Test drawer content</SheetDescription>
                    </SheetHeader>
                    <div>Drawer body content</div>
                </SheetContent>
            </Sheet>
        );

        const handleClose = () => {
            closeCallCount++;
        };

        const { rerender, getByTestId, queryByTestId } = render(
            <TestDrawer open={false} onClose={handleClose} />
        );

        // Initially closed - check that no drawer content exists
        expect(queryByTestId('drawer-content')).not.toBeInTheDocument();

        // Open drawer
        rerender(<TestDrawer open={true} onClose={handleClose} />);

        await waitFor(() => {
            const drawerContent = getByTestId('drawer-content');
            expect(drawerContent).toBeInTheDocument();
        });

        // Verify drawer content is accessible and has proper attributes
        const drawerContent = getByTestId('drawer-content');
        expect(drawerContent).toHaveAttribute('role', 'dialog');
        expect(drawerContent).toHaveAttribute('data-state', 'open');

        // Close drawer via escape key
        const user = userEvent.setup();
        await user.keyboard('{Escape}');

        await waitFor(() => {
            expect(closeCallCount).toBeGreaterThan(0);
        });
    });

    test('should preserve drawer structure and accessibility', () => {
        const TestDrawer = () => (
            <Sheet open={true} onOpenChange={() => { }}>
                <SheetContent data-testid="drawer-content">
                    <SheetHeader>
                        <SheetTitle>Test Drawer Title</SheetTitle>
                        <SheetDescription>Test drawer description</SheetDescription>
                    </SheetHeader>
                    <div data-testid="drawer-body">Test drawer body content</div>
                </SheetContent>
            </Sheet>
        );

        const { getByTestId, getByRole } = render(<TestDrawer />);

        // Check that the drawer structure exists using testid
        const drawerContent = getByTestId('drawer-content');
        expect(drawerContent).toBeInTheDocument();

        // Check that the dialog element exists using getByRole
        const dialogElement = getByRole('dialog');
        expect(dialogElement).toBeInTheDocument();

        // Check accessibility attributes
        expect(dialogElement).toHaveAttribute('data-state', 'open');
        expect(dialogElement.className).toContain('fixed');
        expect(dialogElement.className).toContain('z-50');

        // Check close button exists
        const closeButton = getByRole('button');
        expect(closeButton).toBeInTheDocument();
    });

    test('should preserve event handler functionality', async () => {
        let buttonClickCount = 0;
        let formSubmitCount = 0;

        const TestDrawerWithActions = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
            const handleButtonClick = () => {
                buttonClickCount++;
            };

            const handleFormSubmit = (e: React.FormEvent) => {
                e.preventDefault();
                formSubmitCount++;
            };

            return (
                <Sheet open={open} onOpenChange={onClose}>
                    <SheetContent data-testid="drawer-content">
                        <SheetHeader>
                            <SheetTitle>Action Drawer</SheetTitle>
                            <SheetDescription>Drawer with interactive elements</SheetDescription>
                        </SheetHeader>
                        <div>
                            <Button
                                onClick={handleButtonClick}
                                data-testid="action-button"
                            >
                                Click Me
                            </Button>
                            <form onSubmit={handleFormSubmit} data-testid="test-form">
                                <input type="text" name="test" />
                                <button type="submit" data-testid="submit-button">
                                    Submit
                                </button>
                            </form>
                        </div>
                    </SheetContent>
                </Sheet>
            );
        };

        const { getByTestId } = render(
            <TestDrawerWithActions open={true} onClose={() => { }} />
        );

        const user = userEvent.setup();

        // Test button click
        const actionButton = getByTestId('action-button');
        await user.click(actionButton);
        expect(buttonClickCount).toBe(1);

        // Test form submission
        const submitButton = getByTestId('submit-button');
        await user.click(submitButton);
        expect(formSubmitCount).toBe(1);

        // Test multiple interactions
        await user.click(actionButton);
        await user.click(actionButton);
        expect(buttonClickCount).toBe(3);
    });

    test('should preserve drawer rendering with different configurations', () => {
        fc.assert(
            fc.property(
                fc.record({
                    side: fc.constantFrom('left', 'right', 'top', 'bottom'),
                    hasTitle: fc.boolean(),
                }),
                (props) => {
                    const testId = `responsive-drawer-${props.side}-${props.hasTitle ? 'with' : 'without'}-title`;

                    const TestResponsiveDrawer = () => (
                        <div data-testid="test-container">
                            <Sheet open={true} onOpenChange={() => { }}>
                                <SheetContent
                                    side={props.side as any}
                                    data-testid={testId}
                                >
                                    <SheetHeader>
                                        {props.hasTitle && <SheetTitle>Responsive Drawer</SheetTitle>}
                                        <SheetDescription>Testing responsive behavior</SheetDescription>
                                    </SheetHeader>
                                    <div>Content that should be responsive</div>
                                </SheetContent>
                            </Sheet>
                        </div>
                    );

                    const { getByTestId, getByRole } = render(<TestResponsiveDrawer />);

                    // Check that the drawer renders with proper structure using testid
                    const drawerContent = getByTestId(testId);
                    expect(drawerContent).toBeInTheDocument();

                    // Check that the dialog element exists using getByRole
                    const dialogElement = getByRole('dialog');
                    expect(dialogElement).toBeInTheDocument();

                    // Check for shadcn/ui specific attributes
                    expect(dialogElement).toHaveAttribute('data-state', 'open');
                    expect(dialogElement.className).toContain('fixed');
                    expect(dialogElement.className).toContain('z-50');
                    expect(dialogElement.className).toContain('bg-background');

                    cleanup();
                }
            ),
            { numRuns: 20 }
        );
    });
});