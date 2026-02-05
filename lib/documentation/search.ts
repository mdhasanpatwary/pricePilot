/**
 * Documentation Search Service
 * 
 * Provides full-text search functionality for documentation using PostgreSQL's
 * built-in full-text search capabilities with tsvector.
 */

import { prisma } from '@/lib/prisma';
import { DocumentationType } from '@prisma/client';
import { SearchError } from './errors';

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

export interface Breadcrumb {
    title: string;
    slug: string;
}

export interface SearchResults {
    query: string;
    results: SearchResult[];
    total: number;
    suggestions?: string[];
}

export class SearchService {
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY_MS = 1000;

    /**
     * Execute operation with retry logic
     */
    private async withRetry<T>(
        operation: () => Promise<T>,
        retries: number = this.MAX_RETRIES
    ): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            if (retries > 0) {
                // Exponential backoff
                const delay = this.RETRY_DELAY_MS * (this.MAX_RETRIES - retries + 1);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.withRetry(operation, retries - 1);
            }
            throw error;
        }
    }
    /**
     * Index a document for full-text search
     * Uses PostgreSQL's tsvector for efficient full-text search
     */
    async indexDocument(documentId: string): Promise<void> {
        // PostgreSQL automatically maintains the full-text search index
        // through the GIN index on the tsvector column
        // We just need to ensure the document content is up to date

        const document = await prisma.documentationDocument.findUnique({
            where: { id: documentId },
            select: { id: true, title: true, content: true }
        });

        if (!document) {
            throw new Error(`Document ${documentId} not found`);
        }

        // The index is automatically updated when the document is saved
        // This method exists for explicit reindexing if needed
        await prisma.$executeRaw`
      UPDATE "DocumentationDocument"
      SET "updatedAt" = NOW()
      WHERE id = ${documentId}::uuid
    `;
    }

    /**
     * Reindex all documents of a specific type
     */
    async reindexAll(type: DocumentationType): Promise<void> {
        // Force update of all documents to refresh search index
        await prisma.$executeRaw`
      UPDATE "DocumentationDocument"
      SET "updatedAt" = NOW()
      WHERE type = ${type}::"DocumentationType"
    `;
    }

    /**
     * Remove a document from the search index
     */
    async removeFromIndex(documentId: string): Promise<void> {
        // Deleting the document automatically removes it from the index
        // This method is here for consistency with the interface
        await prisma.documentationDocument.delete({
            where: { id: documentId }
        });
    }

    /**
     * Execute a full-text search query
     * Ranks results by relevance: title matches > heading matches > content matches
     * Includes retry logic with exponential backoff
     */
    async search(
        query: string,
        type: DocumentationType,
        options: SearchOptions = {}
    ): Promise<SearchResults> {
        try {
            return await this.withRetry(async () => {
                return await this.executeSearch(query, type, options);
            });
        } catch (error) {
            console.error('Search failed after retries:', error);

            // Return graceful degradation with popular pages
            const popularPages = await this.getPopularPages(type, 5);

            throw new SearchError('Search is temporarily unavailable', {
                query,
                type,
                suggestions: popularPages,
                retryAfter: 5000,
            });
        }
    }

    /**
     * Internal search execution method
     */
    private async executeSearch(
        query: string,
        type: DocumentationType,
        options: SearchOptions = {}
    ): Promise<SearchResults> {
        const { category, tags, limit = 20, offset = 0 } = options;

        // Sanitize query for PostgreSQL full-text search
        const sanitizedQuery = query.trim().replace(/[^\w\s]/g, ' ');
        if (!sanitizedQuery) {
            return {
                query,
                results: [],
                total: 0,
                suggestions: await this.getPopularPages(type, 5)
            };
        }

        // Build the tsquery for PostgreSQL full-text search
        const tsquery = sanitizedQuery.split(/\s+/).filter(Boolean).join(' & ');

        // Execute search with ranking
        // ts_rank_cd gives higher weight to title matches
        const results = await prisma.$queryRaw<Array<{
            id: string;
            type: DocumentationType;
            slug: string;
            title: string;
            content: string;
            category: string;
            subcategory: string | null;
            metadata: any;
            rank: number;
        }>>`
      SELECT 
        id,
        type,
        slug,
        title,
        content,
        category,
        subcategory,
        metadata,
        ts_rank_cd(
          to_tsvector('english', title || ' ' || title || ' ' || content),
          to_tsquery('english', ${tsquery})
        ) as rank
      FROM "DocumentationDocument"
      WHERE 
        type = ${type}::"DocumentationType"
        AND to_tsvector('english', title || ' ' || content) @@ to_tsquery('english', ${tsquery})
        ${category ? prisma.$queryRawUnsafe(`AND category = '${category}'`) : prisma.$queryRawUnsafe('')}
      ORDER BY rank DESC, "updatedAt" DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

        // Get total count for pagination
        const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "DocumentationDocument"
      WHERE 
        type = ${type}::"DocumentationType"
        AND to_tsvector('english', title || ' ' || content) @@ to_tsquery('english', ${tsquery})
        ${category ? prisma.$queryRawUnsafe(`AND category = '${category}'`) : prisma.$queryRawUnsafe('')}
    `;

        const total = Number(countResult[0]?.count || 0);

        // Filter by tags if provided
        let filteredResults = results;
        if (tags && tags.length > 0) {
            filteredResults = results.filter(doc => {
                const docTags = (doc.metadata as any)?.tags || [];
                return tags.some(tag => docTags.includes(tag));
            });
        }

        // Transform results
        const searchResults: SearchResult[] = await Promise.all(
            filteredResults.map(async (doc) => {
                const excerpt = this.generateExcerpt(doc.content, sanitizedQuery);
                const breadcrumbs = this.generateBreadcrumbs(doc);
                const matchedTerms = this.extractMatchedTerms(doc.title + ' ' + doc.content, sanitizedQuery);

                return {
                    documentId: doc.id,
                    title: doc.title,
                    slug: doc.slug,
                    excerpt,
                    breadcrumbs,
                    relevanceScore: doc.rank,
                    matchedTerms
                };
            })
        );

        // Record the search for analytics
        await this.recordSearch(query, type, searchResults.length);

        // If no results, provide suggestions
        const suggestions = searchResults.length === 0
            ? await this.suggest(query, type)
            : undefined;

        return {
            query,
            results: searchResults,
            total,
            suggestions
        };
    }

    /**
     * Generate search suggestions based on query
     */
    async suggest(_query: string, type: DocumentationType): Promise<string[]> {
        // Get popular search queries
        const popularSearches = await prisma.documentationSearch.groupBy({
            by: ['query'],
            where: {
                type,
                resultsCount: { gt: 0 }
            },
            _count: {
                query: true
            },
            orderBy: {
                _count: {
                    query: 'desc'
                }
            },
            take: 5
        });

        return popularSearches.map((s: { query: string }) => s.query);
    }

    /**
     * Record a search query for analytics
     */
    async recordSearch(
        query: string,
        type: DocumentationType,
        resultsCount: number
    ): Promise<void> {
        await prisma.documentationSearch.create({
            data: {
                query,
                type,
                resultsCount
            }
        });
    }

    /**
     * Generate an excerpt from content highlighting the search terms
     */
    private generateExcerpt(content: string, query: string, maxLength: number = 200): string {
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
        const contentLower = content.toLowerCase();

        // Find the first occurrence of any search term
        let bestIndex = -1;
        for (const term of terms) {
            const index = contentLower.indexOf(term);
            if (index !== -1 && (bestIndex === -1 || index < bestIndex)) {
                bestIndex = index;
            }
        }

        if (bestIndex === -1) {
            // No match found, return beginning of content
            return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
        }

        // Extract excerpt around the match
        const start = Math.max(0, bestIndex - 50);
        const end = Math.min(content.length, bestIndex + maxLength - 50);
        let excerpt = content.substring(start, end);

        // Add ellipsis if needed
        if (start > 0) excerpt = '...' + excerpt;
        if (end < content.length) excerpt = excerpt + '...';

        return excerpt;
    }

    /**
     * Generate breadcrumbs for a document
     */
    private generateBreadcrumbs(doc: {
        type: DocumentationType;
        category: string;
        subcategory: string | null;
        slug: string;
    }): Breadcrumb[] {
        const breadcrumbs: Breadcrumb[] = [];

        // Add root
        breadcrumbs.push({
            title: doc.type === 'TENANT' ? 'Documentation' : 'Admin Documentation',
            slug: doc.type === 'TENANT' ? '/docs' : '/admin-docs'
        });

        // Add category
        breadcrumbs.push({
            title: this.formatCategoryName(doc.category),
            slug: `${doc.type === 'TENANT' ? '/docs' : '/admin-docs'}/${doc.category}`
        });

        // Add subcategory if exists
        if (doc.subcategory) {
            breadcrumbs.push({
                title: this.formatCategoryName(doc.subcategory),
                slug: `${doc.type === 'TENANT' ? '/docs' : '/admin-docs'}/${doc.category}/${doc.subcategory}`
            });
        }

        return breadcrumbs;
    }

    /**
     * Format category name for display
     */
    private formatCategoryName(category: string): string {
        return category
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Extract matched terms from content
     */
    private extractMatchedTerms(content: string, query: string): string[] {
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
        const contentLower = content.toLowerCase();

        return terms.filter(term => contentLower.includes(term));
    }

    /**
     * Get popular pages for suggestions when search returns no results
     */
    private async getPopularPages(type: DocumentationType, limit: number = 5): Promise<string[]> {
        const popularDocs = await prisma.documentationDocument.findMany({
            where: { type },
            select: { title: true },
            orderBy: {
                pageViews: {
                    _count: 'desc'
                }
            },
            take: limit
        });

        return popularDocs.map((doc: { title: string }) => doc.title);
    }
}

// Export singleton instance
export const searchService = new SearchService();
