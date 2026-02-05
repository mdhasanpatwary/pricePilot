"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Clock, Tag, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { FeedbackWidget } from './feedback-widget';
import { TableOfContents } from './table-of-contents';

interface Document {
    id: string;
    type: 'tenant' | 'admin';
    slug: string;
    title: string;
    content: string;
    htmlContent: string;
    category: string;
    subcategory?: string;
    metadata: {
        description?: string;
        tags: string[];
        author?: string;
        lastReviewed?: Date;
        relatedDocs: string[];
    };
    createdAt: Date;
    updatedAt: Date;
    updatedBy?: string;
}

interface Breadcrumb {
    title: string;
    slug: string;
}

interface DocumentationPageProps {
    document: Document;
    breadcrumbs: Breadcrumb[];
    relatedDocs: (Document | null)[];
    type: 'tenant' | 'admin';
}

export function DocumentationPage({
    document,
    breadcrumbs,
    relatedDocs,
    type,
}: DocumentationPageProps) {
    const [headings, setHeadings] = useState<Array<{ id: string; text: string; level: number }>>([]);

    useEffect(() => {
        // Extract headings from the rendered HTML for table of contents
        const extractHeadings = () => {
            if (typeof window === 'undefined') return;

            const contentElement = window.document.getElementById('documentation-content');
            if (!contentElement) return;

            const headingElements = contentElement.querySelectorAll('h2, h3, h4');
            const extractedHeadings = Array.from(headingElements).map((heading) => ({
                id: heading.id || '',
                text: heading.textContent || '',
                level: parseInt(heading.tagName.substring(1)),
            }));

            setHeadings(extractedHeadings);
        };

        // Wait for content to render
        setTimeout(extractHeadings, 100);
    }, [document.htmlContent, document.id]);

    // Track page view
    useEffect(() => {
        const trackPageView = async () => {
            try {
                await fetch('/api/v1/documentation/analytics/view', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        documentId: document.id,
                        type: document.type,
                    }),
                });
            } catch (error) {
                console.error('Failed to track page view:', error);
            }
        };

        trackPageView();
    }, [document.id, document.type]);

    const baseUrl = type === 'tenant' ? '/docs' : '/admin-docs';

    return (
        <div className="mx-auto max-w-5xl">
            {/* Breadcrumbs */}
            <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
                {breadcrumbs.map((crumb, index) => (
                    <div key={crumb.slug} className="flex items-center gap-2">
                        {index > 0 && <ChevronRight className="h-4 w-4" />}
                        {index === breadcrumbs.length - 1 ? (
                            <span className="font-medium text-foreground">{crumb.title}</span>
                        ) : (
                            <Link
                                href={crumb.slug ? `${baseUrl}/${crumb.slug}` : baseUrl}
                                className="hover:text-foreground transition-colors"
                            >
                                {crumb.title}
                            </Link>
                        )}
                    </div>
                ))}
            </nav>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_250px]">
                {/* Main content */}
                <div className="min-w-0">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="mb-4 text-4xl font-bold tracking-tight">{document.title}</h1>

                        {document.metadata.description && (
                            <p className="text-lg text-muted-foreground">{document.metadata.description}</p>
                        )}

                        {/* Metadata */}
                        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            {document.updatedAt && (
                                <div className="flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    <span>
                                        Updated {new Date(document.updatedAt).toLocaleDateString()}
                                    </span>
                                </div>
                            )}
                            {document.metadata.author && (
                                <div className="flex items-center gap-1">
                                    <FileText className="h-4 w-4" />
                                    <span>By {document.metadata.author}</span>
                                </div>
                            )}
                        </div>

                        {/* Tags */}
                        {document.metadata.tags && document.metadata.tags.length > 0 && (
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                                <Tag className="h-4 w-4 text-muted-foreground" />
                                {document.metadata.tags.map((tag) => (
                                    <Badge key={tag} variant="secondary">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    <Separator className="mb-8" />

                    {/* Documentation content */}
                    <div
                        id="documentation-content"
                        className="prose prose-slate dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: document.htmlContent }}
                    />

                    <Separator className="my-8" />

                    {/* Feedback widget */}
                    <FeedbackWidget documentId={document.id} />

                    {/* Related documents */}
                    {relatedDocs.length > 0 && (
                        <div className="mt-12">
                            <h2 className="mb-4 text-2xl font-bold">Related Documentation</h2>
                            <div className="grid gap-4 sm:grid-cols-2">
                                {relatedDocs.map((relatedDoc) => {
                                    if (!relatedDoc) return null;
                                    return (
                                        <Card key={relatedDoc.id} className="p-4 hover:border-primary transition-colors">
                                            <Link href={`${baseUrl}/${relatedDoc.slug}`}>
                                                <h3 className="font-semibold mb-2">{relatedDoc.title}</h3>
                                                {relatedDoc.metadata.description && (
                                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                                        {relatedDoc.metadata.description}
                                                    </p>
                                                )}
                                            </Link>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Table of contents sidebar */}
                <aside className="hidden lg:block">
                    <div className="sticky top-20">
                        <TableOfContents headings={headings} />
                    </div>
                </aside>
            </div>
        </div>
    );
}
