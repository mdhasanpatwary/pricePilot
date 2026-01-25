/**
 * **Feature: shadcn-ui-refactor, Property 2: Functional Behavior Preservation (Forms)**
 * 
 * Property-based test to verify that form functionality is preserved when
 * refactoring from custom implementations to shadcn/ui Form components.
 * 
 * **Validates: Requirements 2.2, 2.3**
 */

import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fc from 'fast-check';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

describe('Form Functionality Preservation', () => {
    /**
     * Property 2: Functional Behavior Preservation (Forms)
     * For any component refactor, all existing event handlers, form validation, 
     * and user interactions should work identically to the original implementation
     */

    test('should preserve form validation and submission with valid data', async () => {
        const schema = z.object({
            email: z.string().email('Invalid email'),
            password: z.string().min(6, 'Password too short'),
        });

        type FormValues = z.infer<typeof schema>;

        let submittedData: FormValues | null = null;
        let submitCount = 0;

        const TestForm = () => {
            const form = useForm<FormValues>({
                resolver: zodResolver(schema),
            });

            const onSubmit = (data: FormValues) => {
                submittedData = data;
                submitCount++;
            };

            return (
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Password</FormLabel>
                                    <FormControl>
                                        <Input {...field} type="password" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Button type="submit">
                            Submit
                        </Button>
                    </form>
                </Form>
            );
        };

        const user = userEvent.setup();
        const { container } = render(<TestForm />);

        const emailInput = container.querySelector('input[name="email"]') as HTMLInputElement;
        const passwordInput = container.querySelector('input[name="password"]') as HTMLInputElement;
        const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;

        expect(emailInput).toBeTruthy();
        expect(passwordInput).toBeTruthy();
        expect(submitButton).toBeTruthy();

        await user.type(emailInput, 'test@example.com');
        await user.type(passwordInput, 'password123');
        await user.click(submitButton);

        await waitFor(() => {
            expect(submitCount).toBe(1);
            expect(submittedData).toEqual({
                email: 'test@example.com',
                password: 'password123',
            });
        }, { timeout: 2000 });
    });

    test('should preserve form accessibility and structure', () => {
        fc.assert(
            fc.property(
                fc.record({
                    emailLabel: fc.constantFrom('Email', 'Email Address'),
                    passwordLabel: fc.constantFrom('Password', 'User Password'),
                }),
                (props) => {
                    const schema = z.object({
                        email: z.string().email(),
                        password: z.string().min(1),
                    });

                    type FormValues = z.infer<typeof schema>;

                    const TestForm = () => {
                        const form = useForm<FormValues>({
                            resolver: zodResolver(schema),
                        });

                        return (
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(() => { })}>
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{props.emailLabel}</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{props.passwordLabel}</FormLabel>
                                                <FormControl>
                                                    <Input {...field} type="password" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <Button type="submit">
                                        Submit
                                    </Button>
                                </form>
                            </Form>
                        );
                    };

                    const { container } = render(<TestForm />);

                    const emailInput = container.querySelector('input[name="email"]') as HTMLInputElement;
                    const passwordInput = container.querySelector('input[name="password"]') as HTMLInputElement;

                    expect(container.textContent).toContain(props.emailLabel);
                    expect(container.textContent).toContain(props.passwordLabel);
                    expect(emailInput).toHaveAttribute('id');
                    expect(passwordInput).toHaveAttribute('id');
                    expect(emailInput).toHaveAttribute('name', 'email');
                    expect(passwordInput).toHaveAttribute('name', 'password');
                    expect(passwordInput).toHaveAttribute('type', 'password');
                    expect(emailInput).not.toHaveAttribute('disabled');
                    expect(passwordInput).not.toHaveAttribute('disabled');

                    const form = container.querySelector('form');
                    expect(form).toBeTruthy();
                    expect(form?.querySelector('button[type="submit"]')).toBeTruthy();
                }
            ),
            { numRuns: 100 }
        );
    });
});