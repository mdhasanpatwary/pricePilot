/**
 * Type definitions for the dual documentation system
 */

// ============================================================================
// Analytics Types
// ============================================================================

/**
 * Time range for analytics queries
 */
export interface TimeRange {
    start: Date;
    end: Date;
}

/**
 * Page view metrics for a documentation page
 */
export interface PageMetric {
    documentId: string;
    title: string;
    slug: string;
    views: number;
    uniqueVisitors: number;
    avgTimeOnPage: number;
}

/**
 * Search query metrics
 */
export interface SearchMetric {
    query: string;
    searchCount: number;
    avgResultsCount: number;
    clickThroughRate: number;
}

/**
 * Bounce rate metrics for a documentation page
 */
export interface BounceRateMetric {
    documentId: string;
    title: string;
    bounceRate: number;
    views: number;
}

/**
 * Related page metrics based on co-occurrence
 */
export interface RelatedPageMetric {
    documentId: string;
    title: string;
    coOccurrenceCount: number;
}

/**
 * User feedback comment
 */
export interface FeedbackComment {
    rating: number;
    comment: string;
    createdAt: Date;
}

/**
 * Aggregated feedback summary for a documentation page
 */
export interface FeedbackSummary {
    documentId: string;
    averageRating: number;
    totalFeedback: number;
    ratingDistribution: Record<number, number>;
    recentComments: FeedbackComment[];
}

// ============================================================================
// Document Types (re-exported from service.ts for convenience)
// ============================================================================

export interface Document {
    id: string;
    type: 'tenant' | 'admin';
    slug: string;
    title: string;
    content: string;
    htmlContent: string;
    category: string;
    subcategory?: string;
    metadata: DocumentMetadata;
    createdAt: Date;
    updatedAt: Date;
    updatedBy: string;
}

export interface DocumentMetadata {
    description?: string;
    tags: string[];
    author?: string;
    lastReviewed?: Date;
    relatedDocs: string[];
}

export interface DocumentVersion {
    id: string;
    documentId: string;
    content: string;
    changeDescription: string;
    createdBy: string;
    createdAt: Date;
}

export interface TOCNode {
    title: string;
    slug: string;
    children?: TOCNode[];
    order: number;
}

export interface Breadcrumb {
    title: string;
    slug: string;
}

// ============================================================================
// Search Types (re-exported from search.ts for convenience)
// ============================================================================

export interface SearchOptions {
    category?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
}

export interface SearchResult {
    documentId: string;
    title: string;
    slug: string;
    excerpt: string;
    breadcrumbs: Breadcrumb[];
    relevanceScore: number;
    matchedTerms: string[];
}

export interface SearchResults {
    query: string;
    results: SearchResult[];
    total: number;
    suggestions?: string[];
}

// ============================================================================
// Parser Types (re-exported from parser.ts for convenience)
// ============================================================================

export interface DocumentFrontmatter {
    title: string;
    description?: string;
    category: string;
    subcategory?: string;
    tags?: string[];
    author?: string;
    lastReviewed?: string;
    relatedDocs?: string[];
}

export interface ParsedDocument {
    frontmatter: DocumentFrontmatter;
    content: string;
    htmlContent: string;
}

export interface InternalLink {
    href: string;
    text: string;
    line?: number;
}

export interface LinkValidationResult {
    link: InternalLink;
    isValid: boolean;
    targetExists: boolean;
    errorMessage?: string;
}
