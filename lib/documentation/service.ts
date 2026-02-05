/**
 * Documentation Service
 * 
 * Provides comprehensive documentation management including:
 * - Document retrieval and listing
 * - Document creation and updates with version history
 * - Table of contents and breadcrumb generation
 * - Version history and revert functionality
 */

import { prisma } from '@/lib/prisma';
import { DocumentationType } from '@prisma/client';
import { parseMarkdown } from './parser';
import { diffLines, Change } from 'diff';
import { validateDocumentContent } from './validation';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface Document {
    id: string;
    type: 'tenant' | 'admin';
    slug: string;
    title: string;
    content: string; // Raw Markdown
    htmlContent: string; // Processed HTML
    category: string;
    subcategory?: string;
    metadata: DocumentMetadata;
    createdAt: Date;
    updatedAt: Date;
    updatedBy?: string;
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
    changeDescription?: string;
    createdBy: string;
    createdAt: Date;
}

export interface TOCNode {
    title: string;
    slug: string;
    category: string;
    subcategory?: string;
    children?: TOCNode[];
    order: number;
}

export interface Breadcrumb {
    title: string;
    slug: string;
}

export interface CreateDocumentInput {
    slug: string;
    title: string;
    content: string;
    category: string;
    subcategory?: string;
    metadata?: Partial<DocumentMetadata>;
}

export interface UpdateDocumentInput {
    content: string;
    userId: string;
    changeDescription?: string;
}

export interface VersionDiff {
    oldVersion: DocumentVersion;
    newVersion: DocumentVersion;
    changes: Change[];
}

// ============================================================================
// Documentation Service Class
// ============================================================================

export class DocumentationService {
    constructor() {
        // Constructor for future use
    }

    // ==========================================================================
    // Core Document Retrieval Methods (Task 4.1)
    // ==========================================================================

    /**
     * Get a single document by type and slug
     * 
     * @param type - Document type (tenant or admin)
     * @param slug - Document slug
     * @returns Document or null if not found
     */
    async getDocument(
        type: 'tenant' | 'admin',
        slug: string
    ): Promise<Document | null> {
        const docType = type === 'tenant' ? DocumentationType.TENANT : DocumentationType.ADMIN;

        const doc = await prisma.documentationDocument.findUnique({
            where: {
                type_slug: {
                    type: docType,
                    slug,
                },
            },
        });

        if (!doc) {
            return null;
        }

        return this.mapDocumentToInterface(doc);
    }

    /**
     * List documents by type and optionally filter by category
     * 
     * @param type - Document type (tenant or admin)
     * @param category - Optional category filter
     * @returns Array of documents
     */
    async listDocuments(
        type: 'tenant' | 'admin',
        category?: string
    ): Promise<Document[]> {
        const docType = type === 'tenant' ? DocumentationType.TENANT : DocumentationType.ADMIN;

        const where: any = { type: docType };
        if (category) {
            where.category = category;
        }

        const docs = await prisma.documentationDocument.findMany({
            where,
            orderBy: [
                { category: 'asc' },
                { subcategory: 'asc' },
                { title: 'asc' },
            ],
        });

        return docs.map(doc => this.mapDocumentToInterface(doc));
    }

    /**
     * Build hierarchical table of contents for a documentation type
     * 
     * @param type - Document type (tenant or admin)
     * @returns Hierarchical TOC structure
     */
    async getTableOfContents(type: 'tenant' | 'admin'): Promise<TOCNode[]> {
        const docs = await this.listDocuments(type);

        // Group documents by category and subcategory
        const categoryMap = new Map<string, TOCNode>();
        const subcategoryMap = new Map<string, TOCNode>();

        docs.forEach((doc, index) => {
            // Create or get category node
            if (!categoryMap.has(doc.category)) {
                categoryMap.set(doc.category, {
                    title: this.formatCategoryTitle(doc.category),
                    slug: doc.category,
                    category: doc.category,
                    children: [],
                    order: categoryMap.size,
                });
            }

            const categoryNode = categoryMap.get(doc.category)!;

            if (doc.subcategory) {
                // Create or get subcategory node
                const subcategoryKey = `${doc.category}/${doc.subcategory}`;
                if (!subcategoryMap.has(subcategoryKey)) {
                    const subcategoryNode: TOCNode = {
                        title: this.formatCategoryTitle(doc.subcategory),
                        slug: doc.subcategory,
                        category: doc.category,
                        subcategory: doc.subcategory,
                        children: [],
                        order: subcategoryMap.size,
                    };
                    subcategoryMap.set(subcategoryKey, subcategoryNode);
                    categoryNode.children!.push(subcategoryNode);
                }

                // Add document to subcategory
                const subcategoryNode = subcategoryMap.get(subcategoryKey)!;
                subcategoryNode.children!.push({
                    title: doc.title,
                    slug: doc.slug,
                    category: doc.category,
                    subcategory: doc.subcategory,
                    order: index,
                });
            } else {
                // Add document directly to category
                categoryNode.children!.push({
                    title: doc.title,
                    slug: doc.slug,
                    category: doc.category,
                    order: index,
                });
            }
        });

        return Array.from(categoryMap.values());
    }

    /**
     * Generate breadcrumb trail for a document
     * 
     * @param type - Document type (tenant or admin)
     * @param slug - Document slug
     * @returns Array of breadcrumbs
     */
    async getBreadcrumbs(
        type: 'tenant' | 'admin',
        slug: string
    ): Promise<Breadcrumb[]> {
        const doc = await this.getDocument(type, slug);
        if (!doc) {
            return [];
        }

        const breadcrumbs: Breadcrumb[] = [
            {
                title: type === 'tenant' ? 'Documentation' : 'Admin Documentation',
                slug: '',
            },
            {
                title: this.formatCategoryTitle(doc.category),
                slug: doc.category,
            },
        ];

        if (doc.subcategory) {
            breadcrumbs.push({
                title: this.formatCategoryTitle(doc.subcategory),
                slug: `${doc.category}/${doc.subcategory}`,
            });
        }

        breadcrumbs.push({
            title: doc.title,
            slug: doc.slug,
        });

        return breadcrumbs;
    }

    // ==========================================================================
    // Document Management Methods (Task 4.2)
    // ==========================================================================

    /**
     * Create a new documentation document
     * 
     * @param type - Document type (tenant or admin)
     * @param data - Document creation data
     * @returns Created document
     * @throws {Error} If content validation fails
     */
    async createDocument(
        type: 'tenant' | 'admin',
        data: CreateDocumentInput
    ): Promise<Document> {
        const docType = type === 'tenant' ? DocumentationType.TENANT : DocumentationType.ADMIN;

        // Validate content before creating
        const validation = await validateDocumentContent(data.content, type);
        if (!validation.isValid) {
            const errorMessages = validation.errors.map(e => e.message).join('; ');
            throw new Error(`Content validation failed: ${errorMessages}`);
        }

        // Parse markdown to HTML
        const parsed = await parseMarkdown(data.content);

        // Prepare metadata
        const metadata: DocumentMetadata = {
            description: data.metadata?.description,
            tags: data.metadata?.tags || [],
            author: data.metadata?.author,
            lastReviewed: data.metadata?.lastReviewed,
            relatedDocs: data.metadata?.relatedDocs || [],
        };

        // Create document in database
        const doc = await prisma.documentationDocument.create({
            data: {
                type: docType,
                slug: data.slug,
                title: data.title,
                content: data.content,
                htmlContent: parsed.html,
                category: data.category,
                subcategory: data.subcategory,
                metadata: metadata as any,
            },
        });

        return this.mapDocumentToInterface(doc);
    }

    /**
     * Update an existing documentation document
     * Stores previous version before updating
     * 
     * @param documentId - Document ID
     * @param content - New content
     * @param userId - User making the update
     * @param changeDescription - Optional description of changes
     * @returns Updated document
     * @throws {Error} If document not found or content validation fails
     */
    async updateDocument(
        documentId: string,
        content: string,
        userId: string,
        changeDescription?: string
    ): Promise<Document> {
        // Get current document
        const currentDoc = await prisma.documentationDocument.findUnique({
            where: { id: documentId },
        });

        if (!currentDoc) {
            throw new Error(`Document not found: ${documentId}`);
        }

        // Determine document type for validation
        const type = currentDoc.type === DocumentationType.TENANT ? 'tenant' : 'admin';

        // Validate content before updating
        const validation = await validateDocumentContent(content, type);
        if (!validation.isValid) {
            const errorMessages = validation.errors.map(e => e.message).join('; ');
            throw new Error(`Content validation failed: ${errorMessages}`);
        }

        // Store previous version
        await prisma.documentationVersion.create({
            data: {
                documentId,
                content: currentDoc.content,
                changeDescription,
                createdBy: userId,
            },
        });

        // Parse new markdown to HTML
        const parsed = await parseMarkdown(content);

        // Update document
        const updatedDoc = await prisma.documentationDocument.update({
            where: { id: documentId },
            data: {
                content,
                htmlContent: parsed.html,
                updatedBy: userId,
                updatedAt: new Date(),
            },
        });

        return this.mapDocumentToInterface(updatedDoc);
    }

    // ==========================================================================
    // Version History Methods (Task 4.3)
    // ==========================================================================

    /**
     * Get version history for a document
     * 
     * @param documentId - Document ID
     * @returns Array of document versions, newest first
     */
    async getDocumentHistory(documentId: string): Promise<DocumentVersion[]> {
        const versions = await prisma.documentationVersion.findMany({
            where: { documentId },
            orderBy: { createdAt: 'desc' },
        });

        return versions.map(v => ({
            id: v.id,
            documentId: v.documentId,
            content: v.content,
            changeDescription: v.changeDescription || undefined,
            createdBy: v.createdBy,
            createdAt: v.createdAt,
        }));
    }

    /**
     * Revert a document to a previous version
     * Creates a new version entry recording the revert
     * 
     * @param documentId - Document ID
     * @param versionId - Version ID to revert to
     * @param userId - User performing the revert
     * @returns Updated document
     */
    async revertDocument(
        documentId: string,
        versionId: string,
        userId: string
    ): Promise<Document> {
        // Get the version to revert to
        const targetVersion = await prisma.documentationVersion.findUnique({
            where: { id: versionId },
        });

        if (!targetVersion) {
            throw new Error(`Version not found: ${versionId}`);
        }

        if (targetVersion.documentId !== documentId) {
            throw new Error('Version does not belong to this document');
        }

        // Get current document
        const currentDoc = await prisma.documentationDocument.findUnique({
            where: { id: documentId },
        });

        if (!currentDoc) {
            throw new Error(`Document not found: ${documentId}`);
        }

        // Store current version before reverting
        await prisma.documentationVersion.create({
            data: {
                documentId,
                content: currentDoc.content,
                changeDescription: `Reverted to version ${versionId}`,
                createdBy: userId,
            },
        });

        // Parse the old content to HTML
        const parsed = await parseMarkdown(targetVersion.content);

        // Update document with reverted content
        const updatedDoc = await prisma.documentationDocument.update({
            where: { id: documentId },
            data: {
                content: targetVersion.content,
                htmlContent: parsed.html,
                updatedBy: userId,
                updatedAt: new Date(),
            },
        });

        return this.mapDocumentToInterface(updatedDoc);
    }

    /**
     * Generate a diff between two versions
     * 
     * @param documentId - Document ID
     * @param oldVersionId - Old version ID
     * @param newVersionId - New version ID (or 'current' for current document)
     * @returns Diff object with changes
     */
    async generateDiff(
        documentId: string,
        oldVersionId: string,
        newVersionId: string | 'current'
    ): Promise<VersionDiff> {
        // Get old version
        const oldVersion = await prisma.documentationVersion.findUnique({
            where: { id: oldVersionId },
        });

        if (!oldVersion || oldVersion.documentId !== documentId) {
            throw new Error('Old version not found or does not belong to this document');
        }

        let newVersion: DocumentVersion;
        let newContent: string;

        if (newVersionId === 'current') {
            // Compare with current document
            const currentDoc = await prisma.documentationDocument.findUnique({
                where: { id: documentId },
            });

            if (!currentDoc) {
                throw new Error(`Document not found: ${documentId}`);
            }

            newVersion = {
                id: 'current',
                documentId,
                content: currentDoc.content,
                changeDescription: 'Current version',
                createdBy: currentDoc.updatedBy || 'system',
                createdAt: currentDoc.updatedAt,
            };
            newContent = currentDoc.content;
        } else {
            // Compare with another version
            const newVer = await prisma.documentationVersion.findUnique({
                where: { id: newVersionId },
            });

            if (!newVer || newVer.documentId !== documentId) {
                throw new Error('New version not found or does not belong to this document');
            }

            newVersion = {
                id: newVer.id,
                documentId: newVer.documentId,
                content: newVer.content,
                changeDescription: newVer.changeDescription || undefined,
                createdBy: newVer.createdBy,
                createdAt: newVer.createdAt,
            };
            newContent = newVer.content;
        }

        // Generate diff
        const changes = diffLines(oldVersion.content, newContent);

        return {
            oldVersion: {
                id: oldVersion.id,
                documentId: oldVersion.documentId,
                content: oldVersion.content,
                changeDescription: oldVersion.changeDescription || undefined,
                createdBy: oldVersion.createdBy,
                createdAt: oldVersion.createdAt,
            },
            newVersion,
            changes,
        };
    }

    // ==========================================================================
    // Helper Methods
    // ==========================================================================

    /**
     * Map database document to interface
     */
    private mapDocumentToInterface(doc: any): Document {
        return {
            id: doc.id,
            type: doc.type === DocumentationType.TENANT ? 'tenant' : 'admin',
            slug: doc.slug,
            title: doc.title,
            content: doc.content,
            htmlContent: doc.htmlContent,
            category: doc.category,
            subcategory: doc.subcategory || undefined,
            metadata: doc.metadata as DocumentMetadata,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            updatedBy: doc.updatedBy || undefined,
        };
    }

    /**
     * Format category/subcategory slug to title
     * Converts "getting-started" to "Getting Started"
     */
    private formatCategoryTitle(slug: string): string {
        return slug
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
}

// Export singleton instance
export const documentationService = new DocumentationService();
