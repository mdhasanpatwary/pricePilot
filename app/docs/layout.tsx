import { Suspense } from 'react';
import { DocumentationLayout } from '@/components/docs/documentation-layout';

export const metadata = {
    title: 'Documentation - PricePilot',
    description: 'Learn how to use PricePilot to optimize your e-commerce pricing strategy',
};

export default function DocsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <DocumentationLayout type="tenant">
                {children}
            </DocumentationLayout>
        </Suspense>
    );
}
