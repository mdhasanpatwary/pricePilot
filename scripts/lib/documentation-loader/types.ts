/**
 * Shared TypeScript types for the documentation content loader system.
 * 
 * This module defines all interfaces and types used across the documentation
 * loading components including file scanning, parsing, validation, and database operations.
 */

/**
 * Information about a markdown file discovered during directory scanning.
 */
export interface FileInfo {
  /** Absolute or relative path to the markdown file */
  path: string;
  
  /** Documentation type: tenant-facing or admin-facing */
  type: 'tenant' | 'admin';
  
  /** Primary category extracted from directory structure */
  category: string;
  
  /** Optional subcategory for nested directory structures */
  subcategory?: string;
  
  /** Filename without path (e.g., "getting-started.md") */
  filename: string;
}

/**
 * YAML frontmatter structure expected in markdown files.
 */
export interface DocumentFrontmatter {
  /** Document title (required) */
  title: string;
  
  /** Brief description of the document (optional) */
  description?: string;
  
  /** Primary category - must match directory structure (required) */
  category: string;
  
  /** Optional subcategory for nested organization */
  subcategory?: string;
  
  /** Array of keywords/tags for search and organization (required) */
  tags: string[];
  
  /** Author name (optional) */
  author?: string;
  
  /** ISO date string (YYYY-MM-DD) of last review (required) */
  lastReviewed?: string;
  
  /** Array of related document slugs for cross-referencing (optional) */
  relatedDocs?: string[];
}

/**
 * Result of parsing a markdown file with frontmatter.
 */
export interface ParsedDocument {
  /** Parsed frontmatter object */
  frontmatter: DocumentFrontmatter;
  
  /** Markdown content (everything after frontmatter) */
  content: string;
}

/**
 * Individual validation error for a specific field.
 */
export interface ValidationError {
  /** Field name that failed validation */
  field: string;
  
  /** Human-readable error message */
  message: string;
}

/**
 * Result of validating frontmatter structure and content.
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  
  /** Array of validation errors (empty if valid) */
  errors: ValidationError[];
}

/**
 * Result of writing a document to the database.
 */
export interface WriteResult {
  /** Action performed: created, updated, or skipped */
  action: 'created' | 'updated' | 'skipped';
  
  /** Database document ID if operation succeeded */
  documentId?: string;
  
  /** Error message if operation failed */
  error?: string;
}

/**
 * Error encountered during the loading process.
 */
export interface LoaderError {
  /** File path where error occurred */
  file: string;
  
  /** Error message */
  error: string;
  
  /** Type of error for categorization */
  type: 'read' | 'parse' | 'validate' | 'database';
}

/**
 * Command-line options for the loader script.
 */
export interface LoaderOptions {
  /** If true, perform validation but don't modify database */
  dryRun: boolean;
  
  /** If true, verify database content matches source files */
  verify: boolean;
  
  /** If true, output detailed logging */
  verbose: boolean;
}

/**
 * Final result summary from the loader execution.
 */
export interface LoaderResult {
  /** Total number of files processed */
  totalFiles: number;
  
  /** Number of documents created */
  created: number;
  
  /** Number of documents updated */
  updated: number;
  
  /** Number of files skipped due to errors */
  skipped: number;
  
  /** Array of all errors encountered */
  errors: LoaderError[];
  
  /** Total execution time in milliseconds */
  duration: number;
}
