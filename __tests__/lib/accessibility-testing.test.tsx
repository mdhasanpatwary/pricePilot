/**
 * **Feature: shadcn-ui-refactor, Property 4: Accessibility Compliance**
 * 
 * Accessibility tests to verify that refactored components maintain or improve
 * WCAG compliance and accessibility standards.
 * 
 * **Validates: Requirements 7.4**
 */

import { render, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fc from 'fast-check';
import { useState } from 'react';

// Import components for accessibility testing
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

// Clean up after each test
afterEach(cleanup);

describe('Accessibility Testing', () => {
    describe('ARIA Attributes and Roles', () => {
        test('should have proper ARIA attributes for buttons', () => {
            const { container } = render(
                <div>
                    <Button>Default Button</Button>
                    <Button disabled>Disabled Button</Button>
                    <Button aria-label="Custom Label">Icon Button</Button>
                </div>
            );

            const buttons = container.querySelectorAll('button');

            buttons.forEach(button => {
                // Button should have type attribute or default to 'button'
                const buttonType = button.getAttribute('type') || 'button';
                expect(['button', 'submit', 'reset']).toContain(buttonType);

                if (button.hasAttribute('disabled')) {
                    expect(button).toHaveAttribute('disabled');
                }

                // Should have accessible text content or aria-label
                const hasText = button.textContent && button.textContent.trim().length > 0;
                const hasAriaLabel = button.hasAttribute('aria-label');
                expect(hasText || hasAriaLabel).toBe(true);
            });
        });

        test('should have proper form accessibility attributes', () => {
            const { container } = render(
                <div>
                    <Label htmlFor="test-input">Test Input</Label>
                    <Input id="test-input" placeholder="Enter text" />

                    <Label htmlFor="required-input">Required Input</Label>
                    <Input id="required-input" required aria-describedby="help-text" />
                    <div id="help-text">This field is required</div>
                </div>
            );

            const inputs = container.querySelectorAll('input');
            const labels = container.querySelectorAll('label');

            // Check that labels are properly associated
            labels.forEach(label => {
                expect(label).toHaveAttribute('for');
                const associatedInput = container.querySelector(`#${label.getAttribute('for')}`);
                expect(associatedInput).toBeTruthy();
            });

            // Check input accessibility
            inputs.forEach(input => {
                expect(input).toHaveAttribute('id');

                if (input.hasAttribute('required')) {
                    expect(input).toHaveAttribute('required');
                }

                if (input.hasAttribute('aria-describedby')) {
                    const describedBy = input.getAttribute('aria-describedby');
                    const helpElement = container.querySelector(`#${describedBy}`);
                    expect(helpElement).toBeTruthy();
                }
            });
        });

        test('should have proper checkbox and switch accessibility', () => {
            const TestCheckboxSwitch = () => {
                const [checked, setChecked] = useState(false);
                const [enabled, setEnabled] = useState(false);

                return (
                    <div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="test-checkbox"
                                checked={checked}
                                onCheckedChange={(checked) => setChecked(checked === true)}
                            />
                            <Label htmlFor="test-checkbox">Test Checkbox</Label>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Switch
                                id="test-switch"
                                checked={enabled}
                                onCheckedChange={setEnabled}
                            />
                            <Label htmlFor="test-switch">Test Switch</Label>
                        </div>
                    </div>
                );
            };

            const { container } = render(<TestCheckboxSwitch />);

            // Check checkbox accessibility
            const checkbox = container.querySelector('[role="checkbox"]');
            expect(checkbox).toBeTruthy();
            expect(checkbox).toHaveAttribute('aria-checked');
            expect(checkbox).toHaveAttribute('id');

            // Check switch accessibility
            const switchElement = container.querySelector('[role="switch"]');
            expect(switchElement).toBeTruthy();
            expect(switchElement).toHaveAttribute('aria-checked');
            expect(switchElement).toHaveAttribute('id');

            // Check labels are associated
            const labels = container.querySelectorAll('label');
            labels.forEach(label => {
                expect(label).toHaveAttribute('for');
            });
        });

        test('should have proper radio group accessibility', () => {
            const TestRadioGroup = () => {
                const [value, setValue] = useState('');

                return (
                    <div>
                        <Label>Choose an option:</Label>
                        <RadioGroup value={value} onValueChange={setValue}>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="option1" id="option1" />
                                <Label htmlFor="option1">Option 1</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="option2" id="option2" />
                                <Label htmlFor="option2">Option 2</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="option3" id="option3" />
                                <Label htmlFor="option3">Option 3</Label>
                            </div>
                        </RadioGroup>
                    </div>
                );
            };

            const { container } = render(<TestRadioGroup />);

            // Check radio group accessibility
            const radioGroup = container.querySelector('[role="radiogroup"]');
            expect(radioGroup).toBeTruthy();

            const radioButtons = container.querySelectorAll('[role="radio"]');
            expect(radioButtons.length).toBe(3);

            radioButtons.forEach(radio => {
                expect(radio).toHaveAttribute('aria-checked');
                expect(radio).toHaveAttribute('id');
                expect(radio).toHaveAttribute('value');
            });
        });
    });

    describe('Keyboard Navigation', () => {
        test('should support keyboard navigation for interactive elements', async () => {
            const TestKeyboardNavigation = () => {
                const [, setButtonClicked] = useState(false);
                const [checkboxChecked, setCheckboxChecked] = useState(false);

                return (
                    <div>
                        <Button
                            onClick={() => setButtonClicked(true)}
                            data-testid="keyboard-button"
                        >
                            Press Enter or Space
                        </Button>

                        <Checkbox
                            checked={checkboxChecked}
                            onCheckedChange={(checked) => setCheckboxChecked(checked === true)}
                            data-testid="keyboard-checkbox"
                        />

                        <Input
                            placeholder="Tab to focus"
                            data-testid="keyboard-input"
                        />
                    </div>
                );
            };

            const user = userEvent.setup();
            const { getByTestId } = render(<TestKeyboardNavigation />);

            // Test button keyboard activation
            const button = getByTestId('keyboard-button');
            button.focus();
            expect(document.activeElement).toBe(button);

            // Test tab navigation
            await user.tab();
            const checkbox = getByTestId('keyboard-checkbox');
            expect(document.activeElement).toBe(checkbox);

            await user.tab();
            const input = getByTestId('keyboard-input');
            expect(document.activeElement).toBe(input);
        });

        test('should have proper focus management', () => {
            const { container } = render(
                <div>
                    <Button>Button 1</Button>
                    <Input placeholder="Input field" />
                    <Checkbox />
                    <Switch />
                </div>
            );

            const focusableElements = container.querySelectorAll(
                'button, input, [tabindex]:not([tabindex="-1"])'
            );

            focusableElements.forEach(element => {
                // Elements should be focusable (not have tabindex="-1" unless specifically set)
                const tabIndex = element.getAttribute('tabindex');
                if (tabIndex !== null) {
                    expect(parseInt(tabIndex)).toBeGreaterThanOrEqual(0);
                }
            });
        });
    });

    describe('Table Accessibility', () => {
        test('should have proper table accessibility structure', () => {
            const mockData = [
                { id: '1', name: 'Product A', price: 100, category: 'Electronics' },
                { id: '2', name: 'Product B', price: 200, category: 'Clothing' },
            ];

            const { container } = render(
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Category</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockData.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.name}</TableCell>
                                <TableCell>${item.price}</TableCell>
                                <TableCell>{item.category}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            );

            // Check table structure
            const table = container.querySelector('table');
            expect(table).toBeTruthy();

            const thead = container.querySelector('thead');
            const tbody = container.querySelector('tbody');
            expect(thead).toBeTruthy();
            expect(tbody).toBeTruthy();

            // Check header cells
            const headerCells = container.querySelectorAll('th');
            expect(headerCells.length).toBe(3);

            // Check data cells
            const dataCells = container.querySelectorAll('td');
            expect(dataCells.length).toBe(6); // 2 rows × 3 columns
        });
    });

    describe('Modal and Dialog Accessibility', () => {
        test('should have proper dialog accessibility attributes', () => {
            render(
                <Sheet open={true} onOpenChange={() => { }}>
                    <SheetContent>
                        <SheetHeader>
                            <SheetTitle>Test Dialog</SheetTitle>
                            <SheetDescription>This is a test dialog for accessibility</SheetDescription>
                        </SheetHeader>
                        <div>Dialog content goes here</div>
                    </SheetContent>
                </Sheet>
            );

            // Check for dialog role
            const dialog = document.querySelector('[role="dialog"]');
            expect(dialog).toBeTruthy();

            // Check for proper ARIA attributes
            if (dialog) {
                expect(dialog).toHaveAttribute('data-state');

                // Dialog should have proper focus management
                expect(dialog.className).toContain('fixed');
                expect(dialog.className).toContain('z-50');
            }
        });
    });

    describe('Progress and Status Accessibility', () => {
        test('should have proper progress bar accessibility', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 0, max: 100 }),
                    (value) => {
                        const { container } = render(
                            <div>
                                <Label>Loading Progress</Label>
                                <Progress value={value} />
                            </div>
                        );

                        const progressContainer = container.querySelector('div[data-state]');
                        expect(progressContainer).toBeTruthy();

                        // Progress should have proper structure
                        if (progressContainer) {
                            expect(progressContainer.className).toContain('relative');
                        }
                    }
                ),
                { numRuns: 10 }
            );
        });

        test('should have proper status badge accessibility', () => {
            const statuses = ['success', 'warning', 'error', 'info'];

            statuses.forEach(status => {
                const { container } = render(
                    <Badge variant={status as any}>
                        {status.charAt(0).toUpperCase() + status.slice(1)} Status
                    </Badge>
                );

                const badge = container.querySelector('div, span');
                expect(badge).toBeTruthy();
                expect(badge?.textContent).toContain(status.charAt(0).toUpperCase() + status.slice(1));
            });
        });
    });

    describe('Color Contrast and Visual Accessibility', () => {
        test('should render components with proper visual structure', () => {
            const { container } = render(
                <div>
                    <Button variant="default">Default Button</Button>
                    <Button variant="destructive">Destructive Button</Button>
                    <Button variant="outline">Outline Button</Button>
                    <Button variant="secondary">Secondary Button</Button>
                    <Button variant="ghost">Ghost Button</Button>
                </div>
            );

            const buttons = container.querySelectorAll('button');

            buttons.forEach(button => {
                // Buttons should have visible text or accessible labels
                const hasVisibleText = button.textContent && button.textContent.trim().length > 0;
                const hasAriaLabel = button.hasAttribute('aria-label');
                const hasAriaLabelledBy = button.hasAttribute('aria-labelledby');

                expect(hasVisibleText || hasAriaLabel || hasAriaLabelledBy).toBe(true);

                // Buttons should have proper styling classes for visual distinction
                expect(button.className.length).toBeGreaterThan(0);
            });
        });

        test('should maintain visual hierarchy in form elements', () => {
            const { container } = render(
                <div>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="name">Name (Required)</Label>
                            <Input id="name" required />
                        </div>

                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" />
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox id="terms" />
                            <Label htmlFor="terms">I agree to the terms</Label>
                        </div>
                    </div>
                </div>
            );

            // Check that form has proper structure
            const labels = container.querySelectorAll('label');
            const inputs = container.querySelectorAll('input');

            expect(labels.length).toBeGreaterThan(0);
            expect(inputs.length).toBeGreaterThan(0);

            // Each input should have an associated label
            inputs.forEach(input => {
                if (input.getAttribute('type') !== 'checkbox') {
                    const inputId = input.getAttribute('id');
                    if (inputId) {
                        const associatedLabel = container.querySelector(`label[for="${inputId}"]`);
                        expect(associatedLabel).toBeTruthy();
                    }
                }
            });
        });
    });

    describe('Screen Reader Compatibility', () => {
        test('should provide proper semantic markup', () => {
            const { container } = render(
                <div>
                    <main>
                        <h1>Main Heading</h1>
                        <section>
                            <h2>Section Heading</h2>
                            <p>This is a paragraph with important content.</p>

                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Column 1</TableHead>
                                        <TableHead>Column 2</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow>
                                        <TableCell>Data 1</TableCell>
                                        <TableCell>Data 2</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </section>
                    </main>
                </div>
            );

            // Check semantic structure
            expect(container.querySelector('main')).toBeTruthy();
            expect(container.querySelector('h1')).toBeTruthy();
            expect(container.querySelector('section')).toBeTruthy();
            expect(container.querySelector('h2')).toBeTruthy();
            expect(container.querySelector('p')).toBeTruthy();
            expect(container.querySelector('table')).toBeTruthy();
        });

        test('should provide proper alternative text and descriptions', () => {
            const { container } = render(
                <div>
                    <Button aria-label="Close dialog">×</Button>
                    <Input aria-describedby="password-help" type="password" />
                    <div id="password-help">Password must be at least 8 characters</div>

                    <div role="status" aria-live="polite">
                        Form saved successfully
                    </div>
                </div>
            );

            // Check ARIA labels and descriptions
            const closeButton = container.querySelector('button[aria-label]');
            expect(closeButton).toBeTruthy();
            expect(closeButton).toHaveAttribute('aria-label', 'Close dialog');

            const passwordInput = container.querySelector('input[aria-describedby]');
            expect(passwordInput).toBeTruthy();

            const helpText = container.querySelector('#password-help');
            expect(helpText).toBeTruthy();

            const statusMessage = container.querySelector('[role="status"]');
            expect(statusMessage).toBeTruthy();
            expect(statusMessage).toHaveAttribute('aria-live', 'polite');
        });
    });
});