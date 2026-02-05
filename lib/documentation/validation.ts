/**
 * Documentation Content Validation
 * 
 * Provides comprehensive validation for documentation content including:
 * - Markdown syntax validation
 * - Frontmatter field validation
 * - Mermaid diagram syntax validation
 * - Internal link validation
 */

import { extractFrontmatter, extractInternalLinks, validateInternalLinks, ParserError } from './parser';
import { documentationService } from './service';

/**
 * Validation error types
 */
export enum ValidationErrorType {
    MARKDOWN_SYNTAX = 'MARKDOWN_SYNTAX',
    FRONTMATTER_MISSING = 'FRONTMATTER_MISSING',
    FRONTMATTER_INVALID = 'FRONTMATTER_INVALID',
    MERMAID_SYNTAX = 'MERMAID_SYNTAX',
    BROKEN_LINK = 'BROKEN_LINK',
}

/**
 * Validation error details
 */
export interface ValidationError {
    type: ValidationErrorType;
    message: string;
    line?: number;
    column?: number;
    field?: string;
    details?: Record<string, unknown>;
}

/**
 * Validation result
 */
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
}

/**
 * Validate Markdown syntax
 * Checks for common Markdown syntax errors
 */
export function validateMarkdownSyntax(content: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const lines = content.split('\n');

    // Check for unclosed code blocks
    let codeBlockOpen = false;
    let codeBlockLine = 0;

    lines.forEach((line, index) => {
        const lineNumber = index + 1;

        // Check for code block markers
        if (line.trim().startsWith('```')) {
            if (codeBlockOpen) {
                codeBlockOpen = false;
            } else {
                codeBlockOpen = true;
                codeBlockLine = lineNumber;
            }
        }

        // Check for unclosed inline code
        const backtickCount = (line.match(/`/g) || []).length;
        if (backtickCount % 2 !== 0) {
            // Check if it's not part of a code block marker
            if (!line.trim().startsWith('```')) {
                errors.push({
                    type: ValidationErrorType.MARKDOWN_SYNTAX,
                    message: 'Unclosed inline code (backtick)',
                    line: lineNumber,
                });
            }
        }

        // Check for malformed links
        const linkMatches = line.match(/\[([^\]]*)\]\(([^)]*)\)/g);
        if (linkMatches) {
            linkMatches.forEach((match) => {
                // Check for empty link text
                if (match.match(/\[\s*\]/)) {
                    errors.push({
                        type: ValidationErrorType.MARKDOWN_SYNTAX,
                        message: 'Empty link text',
                        line: lineNumber,
                    });
                }
                // Check for empty link URL
                if (match.match(/\(\s*\)/)) {
                    errors.push({
                        type: ValidationErrorType.MARKDOWN_SYNTAX,
                        message: 'Empty link URL',
                        line: lineNumber,
                    });
                }
            });
        }

        // Check for unclosed brackets
        const openBrackets = (line.match(/\[/g) || []).length;
        const closeBrackets = (line.match(/\]/g) || []).length;
        const openParens = (line.match(/\(/g) || []).length;
        const closeParens = (line.match(/\)/g) || []).length;

        // Only flag if there's a clear mismatch (not in code blocks)
        if (!line.trim().startsWith('```') && !codeBlockOpen) {
            if (openBrackets !== closeBrackets) {
                errors.push({
                    type: ValidationErrorType.MARKDOWN_SYNTAX,
                    message: 'Mismatched square brackets',
                    line: lineNumber,
                });
            }
            if (openParens !== closeParens) {
                errors.push({
                    type: ValidationErrorType.MARKDOWN_SYNTAX,
                    message: 'Mismatched parentheses',
                    line: lineNumber,
                });
            }
        }
    });

    // Check if code block is still open at end of file
    if (codeBlockOpen) {
        errors.push({
            type: ValidationErrorType.MARKDOWN_SYNTAX,
            message: 'Unclosed code block',
            line: codeBlockLine,
        });
    }

    return errors;
}

/**
 * Validate required frontmatter fields
 * Checks that all required fields are present and valid
 */
export function validateFrontmatter(content: string): ValidationError[] {
    const errors: ValidationError[] = [];

    try {
        // This will throw ParserError if frontmatter is invalid
        extractFrontmatter(content);
    } catch (error) {
        if (error instanceof ParserError) {
            errors.push({
                type: error.code === 'INVALID_FRONTMATTER'
                    ? ValidationErrorType.FRONTMATTER_INVALID
                    : ValidationErrorType.FRONTMATTER_MISSING,
                message: error.message,
                field: error.details?.field as string,
                details: error.details,
            });
        } else if (error instanceof Error) {
            errors.push({
                type: ValidationErrorType.FRONTMATTER_MISSING,
                message: `Frontmatter error: ${error.message}`,
            });
        }
    }

    return errors;
}

/**
 * Validate Mermaid diagram syntax
 * Checks for common Mermaid syntax errors
 */
export function validateMermaidDiagrams(content: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const lines = content.split('\n');

    let inMermaidBlock = false;
    let mermaidStartLine = 0;
    let mermaidContent: string[] = [];

    lines.forEach((line, index) => {
        const lineNumber = index + 1;

        // Check for Mermaid code block start
        if (line.trim() === '```mermaid') {
            inMermaidBlock = true;
            mermaidStartLine = lineNumber;
            mermaidContent = [];
        } else if (inMermaidBlock && line.trim() === '```') {
            // End of Mermaid block - validate content
            inMermaidBlock = false;

            if (mermaidContent.length === 0) {
                errors.push({
                    type: ValidationErrorType.MERMAID_SYNTAX,
                    message: 'Empty Mermaid diagram',
                    line: mermaidStartLine,
                });
            } else {
                // Basic Mermaid syntax validation
                const firstLine = mermaidContent[0].trim();
                const validDiagramTypes = [
                    'graph',
                    'flowchart',
                    'sequenceDiagram',
                    'classDiagram',
                    'stateDiagram',
                    'erDiagram',
                    'gantt',
                    'pie',
                    'journey',
                    'gitGraph',
                ];

                const hasValidType = validDiagramTypes.some((type) =>
                    firstLine.startsWith(type)
                );

                if (!hasValidType) {
                    errors.push({
                        type: ValidationErrorType.MERMAID_SYNTAX,
                        message: `Invalid Mermaid diagram type. Expected one of: ${validDiagramTypes.join(', ')}`,
                        line: mermaidStartLine + 1,
                    });
                }

                // Check for common syntax errors
                mermaidContent.forEach((mermaidLine, mermaidIndex) => {
                    // Check for unclosed quotes
                    const quoteCount = (mermaidLine.match(/"/g) || []).length;
                    if (quoteCount % 2 !== 0) {
                        errors.push({
                            type: ValidationErrorType.MERMAID_SYNTAX,
                            message: 'Unclosed quote in Mermaid diagram',
                            line: mermaidStartLine + mermaidIndex + 1,
                        });
                    }

                    // Check for unclosed brackets
                    const openBrackets = (mermaidLine.match(/\[/g) || []).length;
                    const closeBrackets = (mermaidLine.match(/\]/g) || []).length;
                    if (openBrackets !== closeBrackets) {
                        errors.push({
                            type: ValidationErrorType.MERMAID_SYNTAX,
                            message: 'Mismatched brackets in Mermaid diagram',
                            line: mermaidStartLine + mermaidIndex + 1,
                        });
                    }
                });
            }
        } else if (inMermaidBlock) {
            mermaidContent.push(line);
        }
    });

    // Check if Mermaid block is still open at end of file
    if (inMermaidBlock) {
        errors.push({
            type: ValidationErrorType.MERMAID_SYNTAX,
            message: 'Unclosed Mermaid code block',
            line: mermaidStartLine,
        });
    }

    return errors;
}

/**
 * Validate internal links
 * Checks that all internal links point to existing documents
 */
export async function validateInternalLinksInContent(
    content: string,
    type: 'tenant' | 'admin'
): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Extract internal links from content
    const links = extractInternalLinks(content);

    if (links.length === 0) {
        return errors;
    }

    // Get all valid document slugs for this type
    const documents = await documentationService.listDocuments(type);
    const validSlugs = documents.map((doc) => {
        // Generate possible URL patterns
        const baseUrl = type === 'tenant' ? '/docs' : '/admin-docs';
        return [
            `${baseUrl}/${doc.slug}`,
            `${baseUrl}/${doc.category}/${doc.slug}`,
            doc.subcategory ? `${baseUrl}/${doc.category}/${doc.subcategory}/${doc.slug}` : null,
        ].filter(Boolean) as string[];
    }).flat();

    // Validate each link
    const validationResults = validateInternalLinks(links, validSlugs);

    validationResults.forEach((result) => {
        if (!result.isValid) {
            errors.push({
                type: ValidationErrorType.BROKEN_LINK,
                message: result.error || 'Broken internal link',
                details: {
                    href: result.link.href,
                    text: result.link.text,
                },
            });
        }
    });

    return errors;
}

/**
 * Comprehensive content validation
 * Runs all validation checks and returns combined results
 */
export async function validateDocumentContent(
    content: string,
    type: 'tenant' | 'admin'
): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // 1. Validate frontmatter (critical)
    const frontmatterErrors = validateFrontmatter(content);
    errors.push(...frontmatterErrors);

    // If frontmatter is invalid, we can't proceed with other validations
    if (frontmatterErrors.length > 0) {
        return {
            isValid: false,
            errors,
            warnings,
        };
    }

    // 2. Validate Markdown syntax (critical)
    const markdownErrors = validateMarkdownSyntax(content);
    errors.push(...markdownErrors);

    // 3. Validate Mermaid diagrams (warnings only)
    const mermaidErrors = validateMermaidDiagrams(content);
    warnings.push(...mermaidErrors);

    // 4. Validate internal links (warnings only - links might be added later)
    try {
        const linkErrors = await validateInternalLinksInContent(content, type);
        warnings.push(...linkErrors);
    } catch (error) {
        // Link validation is non-critical, log but don't fail
        console.error('Link validation failed:', error);
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(result: ValidationResult): string {
    const messages: string[] = [];

    if (result.errors.length > 0) {
        messages.push('Errors:');
        result.errors.forEach((error) => {
            const location = error.line ? ` (line ${error.line})` : '';
            const field = error.field ? ` [${error.field}]` : '';
            messages.push(`  - ${error.message}${location}${field}`);
        });
    }

    if (result.warnings.length > 0) {
        messages.push('\nWarnings:');
        result.warnings.forEach((warning) => {
            const location = warning.line ? ` (line ${warning.line})` : '';
            messages.push(`  - ${warning.message}${location}`);
        });
    }

    return messages.join('\n');
}
