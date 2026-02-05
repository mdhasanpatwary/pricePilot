import { Suspense } from 'react';
import { searchService } from '@/lib/documentation/search';
import Link from 'next/link';

interface SearchPageProps {
    searchParams: Promise<{
        q?: string;
        category?: string;
    }>;
}

export const metadata = {
    title: 'Search Admin Documentation - PricePilot',
    description: 'Search technical documentation for PricePilot administrators',
};

async function SearchResults({ query, category }: { query?: string; category?: string }) {
    if (!query) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-600 dark:text-gray-400">
                    Enter a search query to find admin documentation.
                </p>
            </div>
        );
    }

    const results = await searchService.search(query, 'ADMIN' as any, {
        category,
        limit: 20,
    });

    if (results.results.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                    No results found for &quot;{query}&quot;
                </p>
                {results.suggestions && results.suggestions.length > 0 && (
                    <div className="mt-6">
                        <p className="text-sm text-gray-500 dark:text-gray-500 mb-2">
                            Did you mean:
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {results.suggestions.map((suggestion) => (
                                <Link
                                    key={suggestion}
                                    href={`/admin-docs/search?q=${encodeURIComponent(suggestion)}`}
                                    className="text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    {suggestion}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">
                Found {results.total} result{results.total !== 1 ? 's' : ''} for &quot;{query}&quot;
            </p>
            {results.results.map((result) => (
                <div
                    key={result.documentId}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                >
                    <Link
                        href={`/admin-docs/${result.slug}`}
                        className="text-xl font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        {result.title}
                    </Link>
                    <div className="mt-2 text-sm text-gray-500 dark:text-gray-500">
                        {result.breadcrumbs.map((crumb, index) => (
                            <span key={crumb.slug}>
                                {index > 0 && ' / '}
                                {crumb.title}
                            </span>
                        ))}
                    </div>
                    <p className="mt-3 text-gray-700 dark:text-gray-300">
                        {result.excerpt}
                    </p>
                    {result.matchedTerms.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {result.matchedTerms.map((term) => (
                                <span
                                    key={term}
                                    className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded"
                                >
                                    {term}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

export default async function AdminSearchPage({ searchParams }: SearchPageProps) {
    const { q: query, category } = await searchParams;

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
                Search Admin Documentation
            </h1>
            <Suspense fallback={<div>Searching...</div>}>
                <SearchResults query={query} category={category} />
            </Suspense>
        </div>
    );
}
