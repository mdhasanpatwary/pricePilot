import { notFound } from 'next/navigation';
import { documentationService } from '@/lib/documentation/service';
import { DocumentationPage } from '@/components/docs/documentation-page';

interface PageProps {
    params: Promise<{
        slug: string[];
    }>;
}

export async function generateMetadata({ params }: PageProps) {
    const { slug } = await params;
    const slugString = slug.join('/');

    const document = await documentationService.getDocument('admin', slugString);

    if (!document) {
        return {
            title: 'Not Found - PricePilot Admin Documentation',
        };
    }

    return {
        title: `${document.title} - PricePilot Admin Documentation`,
        description: document.metadata.description || `Technical documentation: ${document.title}`,
    };
}

export default async function AdminDocsPage({ params }: PageProps) {
    const { slug } = await params;
    const slugString = slug.join('/');

    // Fetch document
    const document = await documentationService.getDocument('admin', slugString);

    if (!document) {
        notFound();
    }

    // Fetch breadcrumbs
    const breadcrumbs = await documentationService.getBreadcrumbs('admin', slugString);

    // Fetch related documents
    const relatedDocs = await Promise.all(
        (document.metadata.relatedDocs || []).map(async (relatedSlug) => {
            return await documentationService.getDocument('admin', relatedSlug);
        })
    ).then(docs => docs.filter(Boolean));

    return (
        <DocumentationPage
            document={document}
            breadcrumbs={breadcrumbs}
            relatedDocs={relatedDocs}
            type="admin"
        />
    );
}
