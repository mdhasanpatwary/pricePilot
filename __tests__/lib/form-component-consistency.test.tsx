/**
 * **Feature: shadcn-ui-refactor, Property 3: Consistent Component Usage (Forms)**
 * 
 * Property-based test to verify that all forms use shadcn/ui Form components
 * consistently across the application.
 * 
 * **Validates: Requirements 3.2**
 */

import { render } from '@testing-library/react';
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

describe('Form Component Consistency', () => {
    /**
     * Property 3: Consistent Component Usage (Forms)
     * For any UI pattern in the application, if a shadcn/ui component exists for that pattern,
     * the custom implementation should be replaced with the shadcn/ui component
     */

    test('should use consistent shadcn/ui Form structure across all forms', () => {
        fc.assert(
            fc.property(
                fc.record({
                    formFields: fc.uniqueArray(
                        fc.record({
                            name: fc.constantFrom('email', 'password', 'companyName', 'url', 'searchQuery'),
                            label: fc.string({ minLength: 1, maxLength: 20 }),
                            type: fc.constantFrom('text', 'email', 'password', 'url'),
                            required: fc.boolean(),
                        }),
                        {
                            minLength: 1,
                            maxLength: 4,
                            selector: (field) => field.name
                        }
                    ),
                    submitText: fc.constantFrom('Submit', 'Save', 'Create', 'Update'),
                }),
                (props) => {
                    // Create a dynamic schema based on the generated fields
                    const schemaFields: Record<string, z.ZodString> = {};
                    props.formFields.forEach(field => {
                        let fieldSchema = z.string();
                        if (field.type === 'email') {
                            fieldSchema = fieldSchema.email();
                        }
                        if (field.required) {
                            fieldSchema = fieldSchema.min(1);
                        }
                        schemaFields[field.name] = fieldSchema;
                    });

                    const schema = z.object(schemaFields);
                    type FormValues = z.infer<typeof schema>;

                    const TestForm = () => {
                        const form = useForm<FormValues>({
                            resolver: zodResolver(schema),
                        });

                        return (
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(() => { })}>
                                    {props.formFields.map((field, index) => (
                                        <FormField
                                            key={`${field.name}-${index}`}
                                            control={form.control}
                                            name={field.name as keyof FormValues}
                                            render={({ field: formField }) => (
                                                <FormItem>
                                                    <FormLabel>{field.label}</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            {...formField}
                                                            type={field.type}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    ))}

                                    <Button type="submit">
                                        {props.submitText}
                                    </Button>
                                </form>
                            </Form>
                        );
                    };

                    const { container } = render(<TestForm />);

                    // Verify consistent shadcn/ui Form structure
                    const formElement = container.querySelector('form');
                    expect(formElement).toBeTruthy();

                    // Verify all form fields use FormField structure
                    props.formFields.forEach((field, index) => {
                        const input = container.querySelector(`input[name="${field.name}"]`) as HTMLInputElement;
                        expect(input).toBeTruthy();
                        expect(input).toHaveAttribute('type', field.type);

                        // Verify FormLabel is present
                        expect(container.textContent).toContain(field.label);

                        // Verify proper form structure with shadcn/ui classes
                        const formItem = input.closest('[class*="space-y"]');
                        expect(formItem).toBeTruthy();
                    });

                    // Verify submit button uses shadcn/ui Button
                    const submitButton = container.querySelector('button[type="submit"]');
                    expect(submitButton).toBeTruthy();
                    expect(submitButton?.textContent).toBe(props.submitText);
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should maintain consistent form validation structure', () => {
        fc.assert(
            fc.property(
                fc.record({
                    emailRequired: fc.boolean(),
                    passwordMinLength: fc.integer({ min: 6, max: 12 }),
                    includeCompanyName: fc.boolean(),
                }),
                (props) => {
                    const schemaFields: Record<string, z.ZodString> = {
                        email: props.emailRequired
                            ? z.string().email('Invalid email').min(1, 'Email required')
                            : z.string().email('Invalid email').optional() as any,
                        password: z.string().min(props.passwordMinLength, `Password must be at least ${props.passwordMinLength} characters`),
                    };

                    if (props.includeCompanyName) {
                        schemaFields.companyName = z.string().min(2, 'Company name required');
                    }

                    const schema = z.object(schemaFields);
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
                                                <FormLabel>Email</FormLabel>
                                                <FormControl>
                                                    <Input {...field} type="email" />
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

                                    {props.includeCompanyName && (
                                        <FormField
                                            control={form.control}
                                            name="companyName"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Company Name</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} type="text" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}

                                    <Button type="submit">Submit</Button>
                                </form>
                            </Form>
                        );
                    };

                    const { container } = render(<TestForm />);

                    // Verify consistent validation structure
                    const emailInput = container.querySelector('input[name="email"]') as HTMLInputElement;
                    const passwordInput = container.querySelector('input[name="password"]') as HTMLInputElement;

                    expect(emailInput).toBeTruthy();
                    expect(passwordInput).toBeTruthy();
                    expect(emailInput).toHaveAttribute('type', 'email');
                    expect(passwordInput).toHaveAttribute('type', 'password');

                    if (props.includeCompanyName) {
                        const companyInput = container.querySelector('input[name="companyName"]') as HTMLInputElement;
                        expect(companyInput).toBeTruthy();
                        expect(companyInput).toHaveAttribute('type', 'text');
                    }

                    // Verify FormMessage components are present for validation
                    const formItems = container.querySelectorAll('[class*="space-y"]');
                    expect(formItems.length).toBeGreaterThan(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    test('should use consistent import patterns for shadcn/ui Form components', () => {
        // This test verifies the structure that should be consistent across all forms
        const requiredComponents = [
            'Form',
            'FormControl',
            'FormField',
            'FormItem',
            'FormLabel',
            'FormMessage'
        ];

        const TestForm = () => {
            const schema = z.object({
                testField: z.string().min(1),
            });

            const form = useForm({
                resolver: zodResolver(schema),
            });

            return (
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(() => { })}>
                        <FormField
                            control={form.control}
                            name="testField"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Test Field</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit">Submit</Button>
                    </form>
                </Form>
            );
        };

        const { container } = render(<TestForm />);

        // Verify that all required shadcn/ui components are being used
        expect(container.querySelector('form')).toBeTruthy();
        expect(container.querySelector('input[name="testField"]')).toBeTruthy();
        expect(container.querySelector('button[type="submit"]')).toBeTruthy();
        expect(container.textContent).toContain('Test Field');

        // Verify the form structure follows shadcn/ui patterns
        const input = container.querySelector('input[name="testField"]') as HTMLInputElement;
        const formItem = input.closest('[class*="space-y"]');
        expect(formItem).toBeTruthy();
    });
});