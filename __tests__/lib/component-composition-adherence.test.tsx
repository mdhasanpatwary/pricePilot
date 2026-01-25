/**
 * Property-based tests for component composition adherence
 * **Feature: shadcn-ui-refactor, Property 8: Component Composition Adherence**
 * **Validates: Requirements 6.3, 6.5**
 */

import * as fc from 'fast-check';
import fs from 'fs';
import { glob } from 'glob';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Import components to test
import { FilterButton } from '@/components/ui/filter-button';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { ThemeToggle } from '@/components/theme-toggle';
import AnnouncementBanner from '@/components/announcement-banner';
import { Notification } from '@/components/ui/notification';
import { SearchInput } from '@/components/ui/search-input';
import Callout from '@/components/docs/callout';
import CodeBlock from '@/components/docs/code-block';

describe('Component Composition Adherence Property Tests', () => {
    const SHADCN_UI_BASE_COMPONENTS = [
        'Button', 'Card', 'Badge', 'Input', 'Sheet', 'Dialog', 'Form'
    ];

    const REUSABLE_COMPONENTS = [
        'FilterButton', 'StatusIndicator', 'ThemeToggle', 'AnnouncementBanner',
        'Notification', 'SearchInput', 'Callout', 'CodeBlock'
    ];

    async function getComponentFiles(): Promise<string[]> {
        const patterns = [
            'components/**/*.{ts,tsx}',
            '!components/ui/badge.tsx',
            '!components/ui/button.tsx',
            '!components/ui/card.tsx',
            '!components/ui/input.tsx',
            '!components/ui/sheet.tsx',
            '!components/ui/dialog.tsx',
            '!components/ui/form.tsx'
        ];

        const files: string[] = [];
        for (const pattern of patterns) {
            const matches = await glob(pattern, { ignore: ['node_modules/**', '.next/**'] });
            files.push(...matches);
        }
        return files;
    }

    function extendsBaseComponent(content: string): boolean {
        const importRegex = /import\s+.*from\s+['"]@\/components\/ui\/[^'"]+['"]/g;
        const imports = content.match(importRegex) || [];

        return imports.some(imp =>
            SHADCN_UI_BASE_COMPONENTS.some(component =>
                imp.toLowerCase().includes(component.toLowerCase())
            )
        );
    }

    function followsProperPropExtension(content: string): boolean {
        const interfaceExtensionRegex = /interface\s+\w+Props\s+extends\s+.*Props/g;
        const omitPatternRegex = /Omit<.*Props,\s*['"]/g;
        const reactComponentPropsRegex = /React\.ComponentProps</g;
        const reactHTMLAttributesRegex = /React\.HTMLAttributes</g;
        const reactInputAttributesRegex = /React\.InputHTMLAttributes</g;
        const reactButtonAttributesRegex = /React\.ButtonHTMLAttributes</g;

        return interfaceExtensionRegex.test(content) ||
            omitPatternRegex.test(content) ||
            reactComponentPropsRegex.test(content) ||
            reactHTMLAttributesRegex.test(content) ||
            reactInputAttributesRegex.test(content) ||
            reactButtonAttributesRegex.test(content);
    }

    function usesForwardRefWhenNeeded(content: string): boolean {
        const extendsInputOrButton = /extends\s+.*(?:Input|Button)Props/.test(content);
        const usesForwardRef = /React\.forwardRef|forwardRef/.test(content);
        const isClassComponent = /class\s+\w+\s+extends/.test(content);

        return !extendsInputOrButton || usesForwardRef || isClassComponent;
    }

    test('property: reusable components extend shadcn/ui base components', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(...REUSABLE_COMPONENTS),
                async (componentName) => {
                    const files = await getComponentFiles();
                    const componentFile = files.find(file =>
                        file.toLowerCase().includes(componentName.toLowerCase())
                    );

                    if (componentFile) {
                        const content = fs.readFileSync(componentFile, 'utf-8');
                        expect(extendsBaseComponent(content)).toBe(true);
                    }
                }
            ),
            { numRuns: 50 }
        );
    });

    test('property: components follow proper prop extension patterns', async () => {
        const files = await getComponentFiles();

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf-8');

            if (content.includes('Props') && content.includes('interface')) {
                expect(followsProperPropExtension(content)).toBe(true);
            }
        }
    });

    test('property: components use forwardRef when extending input components', async () => {
        const files = await getComponentFiles();

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf-8');
            expect(usesForwardRefWhenNeeded(content)).toBe(true);
        }
    });

    test('FilterButton extends Button functionality', () => {
        const mockOnClick = jest.fn();

        render(
            <FilterButton
                segment="test-segment"
                label="Test Label"
                isActive={false}
                onClick={mockOnClick}
            />
        );

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        expect(button).toHaveTextContent('Test Label');
    });

    test('StatusIndicator extends Badge functionality', () => {
        render(
            <StatusIndicator
                status="GREEN"
                label="Test Status"
            />
        );

        const element = screen.getByText('Test Status');
        expect(element).toBeInTheDocument();
    });

    test('ThemeToggle extends Button functionality', async () => {
        render(<ThemeToggle />);

        await waitFor(() => {
            const button = screen.getByRole('button');
            expect(button).toBeInTheDocument();
            expect(button).toHaveAttribute('aria-label', 'Toggle theme');
        });
    });

    test('Notification extends Card functionality', () => {
        render(
            <Notification
                title="Test Notification Title"
                message="Test notification message"
                type="info"
            />
        );

        expect(screen.getByText('Test Notification Title')).toBeInTheDocument();
        expect(screen.getByText('Test notification message')).toBeInTheDocument();
    });

    test('SearchInput extends Input functionality', () => {
        const mockOnValueChange = jest.fn();

        render(
            <SearchInput
                value="test value"
                onValueChange={mockOnValueChange}
                placeholder="Test search placeholder"
            />
        );

        const input = screen.getByPlaceholderText('Test search placeholder');
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue('test value');
    });

    test('AnnouncementBanner uses Button components', async () => {
        const mockGetItem = jest.fn().mockReturnValue(null);
        const mockSetItem = jest.fn();
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: mockGetItem,
                setItem: mockSetItem,
            },
            writable: true,
        });

        render(
            <AnnouncementBanner
                id="test-banner-id"
                message="Test announcement message"
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Test announcement message')).toBeInTheDocument();
        });

        const dismissButton = screen.getByLabelText('Dismiss announcement');
        expect(dismissButton).toBeInTheDocument();
    });

    test('Callout uses Badge for type indication', () => {
        render(
            <Callout type="info" title="Test Callout Title">
                Test callout content
            </Callout>
        );

        expect(screen.getByText('Test Callout Title')).toBeInTheDocument();
        expect(screen.getByText('Test callout content')).toBeInTheDocument();
        expect(screen.getByText('info')).toBeInTheDocument();
    });

    test('CodeBlock uses Button for copy functionality', () => {
        render(
            <CodeBlock
                code="console.log('test code');"
                language="javascript"
            />
        );

        expect(screen.getByText("console.log('test code');")).toBeInTheDocument();

        const copyButton = screen.getByTitle('Copy to clipboard');
        expect(copyButton).toBeInTheDocument();
    });

    test('should maintain component API compatibility', async () => {
        const files = await getComponentFiles();

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf-8');

            if (content.includes('export interface')) {
                expect(content).toMatch(/export interface \w+Props/);
            }

            if (content.includes('React.forwardRef')) {
                expect(content).toMatch(/React\.forwardRef<[^>]+>/);
            }
        }
    });

    test('should use consistent component naming patterns', async () => {
        const files = await getComponentFiles();

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf-8');

            const exportMatches = content.match(/export (?:function|const) (\w+)/g);
            if (exportMatches) {
                exportMatches.forEach(match => {
                    const componentName = match.split(' ').pop();
                    if (componentName && componentName !== 'default') {
                        expect(componentName[0]).toBe(componentName[0].toUpperCase());
                    }
                });
            }
        }
    });
});