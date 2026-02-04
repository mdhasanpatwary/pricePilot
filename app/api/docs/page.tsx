import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'API Documentation - PricePilot',
    description: 'Interactive API documentation for PricePilot REST API',
};

export default function ApiDocsPage() {
    return (
        <div className="h-screen w-full">
            <iframe
                src="/api-docs.html"
                className="w-full h-full border-0"
                title="API Documentation"
            />
        </div>
    );
}
