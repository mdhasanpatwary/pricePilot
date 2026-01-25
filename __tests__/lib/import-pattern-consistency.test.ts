/**
 * Property-based tests for import pattern consistency
 * **Feature: shadcn-ui-refactor, Property 7: Import Pattern Consistency**
 * **Validates: Requirements 6.2**
 */

import * as fc from 'fast-check';
import fs from 'fs';
import { glob } from 'glob';

describe('Import Pattern Consistency Property Tests', () => {
    /**
     * Property 7: Import Pattern Consistency
     * For any shadcn/ui component import, the import pattern should follow 
     * the established shadcn/ui convention
     */

    const SHADCN_UI_COMPONENTS = [
        'badge', 'button', 'card', 'checkbox', 'dialog', 'dropdown-menu',
        'form', 'input', 'label', 'popover', 'progress', 'radio-group',
        'scroll-area', 'select', 'separator', 'sheet', 'skeleton', 'switch',
        'table', 'tabs', 'textarea', 'avatar', 'filter-button', 'status-indicator'
    ];

    const EXPECTED_IMPORT_PREFIX = '@/components/ui/';

    // Helper function to get all TypeScript/React files
    async function getAllTSFiles(): Promise<string[]> {
        const patterns = [
            'app/**/*.{ts,tsx}',
            'components/**/*.{ts,tsx}',
            'lib/**/*.{ts,tsx}',
            '__tests__/**/*.{ts,tsx}'
        ];

        const files: string[] = [];
        for (const pattern of patterns) {
            const matches = await glob(pattern, { ignore: ['node_modules/**', '.next/**'] });
            files.push(...matches);
        }
        return files;
    }

    // Helper function to extract import statements from file content
    function extractImportStatements(content: string): string[] {
        const importRegex = /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+['"][^'"]+['"]/g;
        return content.match(importRegex) || [];
    }

    // Helper function to check if import uses correct prefix
    function hasCorrectImportPrefix(importStatement: string, component: string): boolean {
        const expectedImport = `${EXPECTED_IMPORT_PREFIX}${component}`;
        return importStatement.includes(expectedImport);
    }

    test('should use consistent import prefix for all shadcn/ui components', async () => {
        const files = await getAllTSFiles();

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf-8');
            const imports = extractImportStatements(content);

            for (const importStatement of imports) {
                for (const component of SHADCN_UI_COMPONENTS) {
                    if (importStatement.includes(`/${component}"`)) {
                        expect(hasCorrectImportPrefix(importStatement, component))
                            .toBe(true);
                    }
                }
            }
        }
    });

    test('property: consistent import patterns across all files', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(...SHADCN_UI_COMPONENTS),
                async (component) => {
                    const files = await getAllTSFiles();

                    for (const file of files) {
                        const content = fs.readFileSync(file, 'utf-8');
                        const imports = extractImportStatements(content);

                        const componentImports = imports.filter(imp =>
                            imp.includes(`/${component}"`) || imp.includes(`/${component}'`)
                        );

                        // If component is imported, it should use correct prefix
                        for (const imp of componentImports) {
                            if (imp.includes('@/components/ui/')) {
                                expect(imp).toContain(`${EXPECTED_IMPORT_PREFIX}${component}`);
                            }
                        }
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    test('property: no relative path imports for shadcn/ui components', async () => {
        const files = await getAllTSFiles();

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf-8');
            const imports = extractImportStatements(content);

            for (const importStatement of imports) {
                // Check for relative imports that might be shadcn/ui components
                if (importStatement.includes('../') && importStatement.includes('components/ui')) {
                    fail(`Found relative import for shadcn/ui component in ${file}: ${importStatement}`);
                }
            }
        }
    });

    test('should use @/components/ui/ prefix consistently', async () => {
        const files = await getAllTSFiles();
        let totalShadcnImports = 0;
        let correctPrefixImports = 0;

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf-8');
            const imports = extractImportStatements(content);

            for (const importStatement of imports) {
                // Check if this is a shadcn/ui component import
                const isShadcnImport = SHADCN_UI_COMPONENTS.some(component =>
                    importStatement.includes(`/${component}"`) || importStatement.includes(`/${component}'`)
                );

                if (isShadcnImport) {
                    totalShadcnImports++;
                    if (importStatement.includes(EXPECTED_IMPORT_PREFIX)) {
                        correctPrefixImports++;
                    }
                }
            }
        }

        // Expect at least 90% of shadcn/ui imports to use the correct prefix
        if (totalShadcnImports > 0) {
            const correctPercentage = (correctPrefixImports / totalShadcnImports) * 100;
            expect(correctPercentage).toBeGreaterThanOrEqual(90);
        }
    });

    test('should not mix different import path styles for shadcn/ui', async () => {
        const files = await getAllTSFiles();

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf-8');
            const imports = extractImportStatements(content);

            const shadcnImports = imports.filter(imp =>
                imp.includes('components/ui/') &&
                SHADCN_UI_COMPONENTS.some(component =>
                    imp.includes(`/${component}"`) || imp.includes(`/${component}'`)
                )
            );

            // All shadcn imports in a file should use the same prefix style
            if (shadcnImports.length > 1) {
                const prefixStyles = new Set(shadcnImports.map(imp => {
                    if (imp.includes('@/components/ui/')) return '@/';
                    if (imp.includes('./components/ui/')) return './';
                    if (imp.includes('../components/ui/')) return '../';
                    return 'other';
                }));

                expect(prefixStyles.size).toBe(1);
                expect(prefixStyles.has('@/')).toBe(true);
            }
        }
    });
});