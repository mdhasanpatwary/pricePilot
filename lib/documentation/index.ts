/**
 * Documentation Module
 * 
 * This module provides functionality for parsing and processing
 * Markdown documentation files with frontmatter metadata, as well as
 * comprehensive documentation management services.
 */

// Export parser functions and types
export {
    parseMarkdown,
    parseMarkdownFile,
    extractFrontmatter,
    hasFrontmatter,
    ParserError,
    type DocumentFrontmatter,
    type ParsedDocument,
} from './parser';

// Export service and types
export {
    documentationService,
    DocumentationService,
    type Document,
    type DocumentMetadata,
    type DocumentVersion,
    type TOCNode,
    type Breadcrumb,
    type CreateDocumentInput,
    type UpdateDocumentInput,
    type VersionDiff,
} from './service';
