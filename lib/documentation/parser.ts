/**
 * Markdown Parser with Frontmatter Support
 * 
 * This module provides functionality to parse Markdown documentation files
 * with YAML frontmatter metadata and convert them to HTML.
 * 
 * Uses the unified/remark/rehype ecosystem for robust Markdown processing.
 */

import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import rehypeShiki from 'rehype-shiki';
import { createHighlighter } from 'shiki';
import { visit } from 'unist-util-visit';
import type { Element } from 'hast';

/**
 * Frontmatter metadata structure
 */
export interface DocumentFrontmatter {
    title: string;
    description?: string;
    category: string;
    subcategory?: string | null;
    tags: string[];
    author?: string;
    lastReviewed?: string;
    relatedDocs?: string[];
}

/**
 * Parsed document structure
 */
export interface ParsedDocument {
    frontmatter: DocumentFrontmatter;
    content: string; // Raw Markdown content (without frontmatter)
    html: string; // Processed HTML
}

/**
 * Parser error types
 */
export class ParserError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'ParserError';
    }
}

/**
 * Validate frontmatter has required fields
 */
function validateFrontmatter(data: unknown): data is DocumentFrontmatter {
    if (!data || typeof data !== 'object') {
        return false;
    }

    const fm = data as Record<string, unknown>;

    // Required fields
    if (typeof fm.title !== 'string' || !fm.title.trim()) {
        throw new ParserError(
            'Missing or invalid required field: title',
            'INVALID_FRONTMATTER',
            { field: 'title' }
        );
    }

    if (typeof fm.category !== 'string' || !fm.category.trim()) {
        throw new ParserError(
            'Missing or invalid required field: category',
            'INVALID_FRONTMATTER',
            { field: 'category' }
        );
    }

    if (!Array.isArray(fm.tags)) {
        throw new ParserError(
            'Missing or invalid required field: tags (must be an array)',
            'INVALID_FRONTMATTER',
            { field: 'tags' }
        );
    }

    // Optional fields validation
    if (fm.description !== undefined && typeof fm.description !== 'string') {
        throw new ParserError(
            'Invalid field type: description must be a string',
            'INVALID_FRONTMATTER',
            { field: 'description' }
        );
    }

    if (
        fm.subcategory !== undefined &&
        fm.subcategory !== null &&
        typeof fm.subcategory !== 'string'
    ) {
        throw new ParserError(
            'Invalid field type: subcategory must be a string or null',
            'INVALID_FRONTMATTER',
            { field: 'subcategory' }
        );
    }

    if (fm.author !== undefined && typeof fm.author !== 'string') {
        throw new ParserError(
            'Invalid field type: author must be a string',
            'INVALID_FRONTMATTER',
            { field: 'author' }
        );
    }

    if (fm.lastReviewed !== undefined && typeof fm.lastReviewed !== 'string') {
        throw new ParserError(
            'Invalid field type: lastReviewed must be a string',
            'INVALID_FRONTMATTER',
            { field: 'lastReviewed' }
        );
    }

    if (fm.relatedDocs !== undefined && !Array.isArray(fm.relatedDocs)) {
        throw new ParserError(
            'Invalid field type: relatedDocs must be an array',
            'INVALID_FRONTMATTER',
            { field: 'relatedDocs' }
        );
    }

    return true;
}

/**
 * Parse Markdown content with frontmatter
 * 
 * @param markdownContent - Raw Markdown string with YAML frontmatter
 * @returns Parsed document with frontmatter, content, and HTML
 * 
 * @throws {ParserError} If frontmatter is invalid or Markdown parsing fails
 * 
 * @example
 * ```typescript
 * const markdown = `---
 * title: "Getting Started"
 * category: "guides"
 * tags: ["tutorial", "beginner"]
 * ---
 * 
 * # Getting Started
 * 
 * Welcome to the documentation!
 * `;
 * 
 * const parsed = await parseMarkdown(markdown);
 * console.log(parsed.frontmatter.title); // "Getting Started"
 * console.log(parsed.html); // "<h1>Getting Started</h1>..."
 * ```
 */
export async function parseMarkdown(
    markdownContent: string
): Promise<ParsedDocument> {
    try {
        // Parse frontmatter and content
        const { data, content } = matter(markdownContent);

        // Validate frontmatter
        validateFrontmatter(data);

        // Initialize Shiki highlighter
        const highlighter = await createHighlighter({
            themes: ['nord'],
            langs: [
                'javascript',
                'typescript',
                'python',
                'java',
                'php',
                'sql',
                'bash',
                'json',
                'yaml',
                'markdown',
                'html',
                'css',
                'tsx',
                'jsx',
            ],
        });

        // Process Markdown to HTML using unified/remark/rehype
        const processor = unified()
            .use(remarkParse) // Parse Markdown to AST
            .use(remarkGfm) // Support GitHub Flavored Markdown (tables, strikethrough, etc.)
            .use(remarkRehype, { allowDangerousHtml: true }) // Convert Markdown AST to HTML AST
            .use(rehypeRaw) // Parse raw HTML in Markdown
            .use(rehypeMermaidPlugin) // Mark Mermaid diagrams for client-side rendering (before Shiki)
            .use(rehypeShiki, {
                highlighter,
                theme: 'nord',
            }) // Add syntax highlighting
            .use(rehypeStringify); // Serialize HTML AST to string

        const result = await processor.process(content);
        const html = String(result);

        return {
            frontmatter: data as DocumentFrontmatter,
            content: content.trim(),
            html: html.trim(),
        };
    } catch (error) {
        // Re-throw ParserError as-is
        if (error instanceof ParserError) {
            throw error;
        }

        // Wrap other errors
        if (error instanceof Error) {
            throw new ParserError(
                `Failed to parse Markdown: ${error.message}`,
                'PARSE_ERROR',
                { originalError: error.message }
            );
        }

        // Unknown error
        throw new ParserError(
            'Failed to parse Markdown: Unknown error',
            'PARSE_ERROR'
        );
    }
}

/**
 * Parse Markdown from a file path
 * 
 * @param filePath - Path to the Markdown file
 * @returns Parsed document with frontmatter, content, and HTML
 * 
 * @throws {ParserError} If file cannot be read or parsing fails
 */
export async function parseMarkdownFile(
    filePath: string
): Promise<ParsedDocument> {
    try {
        const fs = await import('fs/promises');
        const markdownContent = await fs.readFile(filePath, 'utf-8');
        return parseMarkdown(markdownContent);
    } catch (error) {
        if (error instanceof ParserError) {
            throw error;
        }

        if (error instanceof Error) {
            throw new ParserError(
                `Failed to read file: ${error.message}`,
                'FILE_READ_ERROR',
                { filePath, originalError: error.message }
            );
        }

        throw new ParserError(
            'Failed to read file: Unknown error',
            'FILE_READ_ERROR',
            { filePath }
        );
    }
}

/**
 * Extract frontmatter only (without processing Markdown)
 * 
 * @param markdownContent - Raw Markdown string with YAML frontmatter
 * @returns Frontmatter metadata
 * 
 * @throws {ParserError} If frontmatter is invalid
 */
export function extractFrontmatter(
    markdownContent: string
): DocumentFrontmatter {
    try {
        const { data } = matter(markdownContent);
        validateFrontmatter(data);
        return data as DocumentFrontmatter;
    } catch (error) {
        if (error instanceof ParserError) {
            throw error;
        }

        if (error instanceof Error) {
            throw new ParserError(
                `Failed to extract frontmatter: ${error.message}`,
                'FRONTMATTER_ERROR',
                { originalError: error.message }
            );
        }

        throw new ParserError(
            'Failed to extract frontmatter: Unknown error',
            'FRONTMATTER_ERROR'
        );
    }
}

/**
 * Check if a string contains valid frontmatter
 * 
 * @param markdownContent - Raw Markdown string
 * @returns True if valid frontmatter exists
 */
export function hasFrontmatter(markdownContent: string): boolean {
    try {
        const { data } = matter(markdownContent);
        validateFrontmatter(data);
        return true;
    } catch {
        return false;
    }
}

/**
 * Custom rehype plugin to mark Mermaid code blocks for client-side rendering
 * This plugin identifies code blocks with language "mermaid" and transforms them
 * so they can be rendered by Mermaid.js on the client side.
 */
function rehypeMermaidPlugin() {
    return (tree: any) => {
        visit(tree, 'element', (node: Element) => {
            // Look for <pre> elements containing <code class="language-mermaid">
            if (node.tagName === 'pre' && node.children && node.children.length > 0) {
                const codeNode = node.children[0] as Element;

                if (
                    codeNode.type === 'element' &&
                    codeNode.tagName === 'code' &&
                    codeNode.properties &&
                    Array.isArray(codeNode.properties.className) &&
                    codeNode.properties.className.includes('language-mermaid')
                ) {
                    // Transform the <pre><code> structure into a <div class="mermaid">
                    node.tagName = 'div';
                    node.properties = { className: ['mermaid'] };

                    // Extract the text content from the code node
                    if (codeNode.children && codeNode.children.length > 0) {
                        const textNode = codeNode.children[0];
                        if (textNode.type === 'text') {
                            node.children = [textNode];
                        }
                    }
                }
            }
        });
    };
}

/**
 * Internal link information
 */
export interface InternalLink {
    href: string;
    text: string;
    line?: number;
}

/**
 * Link validation result
 */
export interface LinkValidationResult {
    link: InternalLink;
    isValid: boolean;
    error?: string;
}

/**
 * Extract internal links from Markdown content
 * Internal links are those that start with '/' or don't include '://'
 * 
 * @param markdownContent - Raw Markdown string
 * @returns Array of internal links found in the content
 * 
 * @example
 * ```typescript
 * const markdown = `
 * Check out [our guide](/docs/guide) and [API docs](/api/reference).
 * External link: [Google](https://google.com)
 * `;
 * 
 * const links = extractInternalLinks(markdown);
 * // Returns: [
 * //   { href: '/docs/guide', text: 'our guide' },
 * //   { href: '/api/reference', text: 'API docs' }
 * // ]
 * ```
 */
export function extractInternalLinks(markdownContent: string): InternalLink[] {
    const links: InternalLink[] = [];

    // Regular expression to match Markdown links: [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

    let match;
    while ((match = linkRegex.exec(markdownContent)) !== null) {
        const text = match[1];
        const href = match[2];

        // Check if it's an internal link (starts with / or doesn't contain ://)
        const isInternal = href.startsWith('/') || !href.includes('://');

        // Skip anchor-only links (#section) and mailto/tel links
        if (isInternal && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
            links.push({ href, text });
        }
    }

    return links;
}

/**
 * Validate internal links against a list of valid document slugs
 * 
 * @param links - Array of internal links to validate
 * @param validSlugs - Array of valid document slugs/paths
 * @returns Array of validation results
 * 
 * @example
 * ```typescript
 * const links = [
 *   { href: '/docs/getting-started', text: 'Getting Started' },
 *   { href: '/docs/invalid-page', text: 'Invalid' }
 * ];
 * 
 * const validSlugs = ['/docs/getting-started', '/docs/api-reference'];
 * const results = validateInternalLinks(links, validSlugs);
 * // Returns validation results for each link
 * ```
 */
export function validateInternalLinks(
    links: InternalLink[],
    validSlugs: string[]
): LinkValidationResult[] {
    return links.map((link) => {
        // Remove query parameters and fragments for validation
        const cleanHref = link.href.split('?')[0].split('#')[0];

        // Check if the link exists in valid slugs
        const isValid = validSlugs.some((slug) => {
            // Exact match
            if (slug === cleanHref) return true;

            // Match with or without trailing slash
            if (slug === cleanHref + '/' || slug + '/' === cleanHref) return true;

            return false;
        });

        return {
            link,
            isValid,
            error: isValid ? undefined : `Target document not found: ${cleanHref}`,
        };
    });
}

/**
 * Generate warnings for broken internal links
 * 
 * @param validationResults - Array of link validation results
 * @returns Array of warning messages for broken links
 * 
 * @example
 * ```typescript
 * const results = validateInternalLinks(links, validSlugs);
 * const warnings = generateLinkWarnings(results);
 * warnings.forEach(warning => console.warn(warning));
 * ```
 */
export function generateLinkWarnings(
    validationResults: LinkValidationResult[]
): string[] {
    return validationResults
        .filter((result) => !result.isValid)
        .map((result) => {
            return `Broken link: "${result.link.text}" -> ${result.link.href} (${result.error})`;
        });
}
