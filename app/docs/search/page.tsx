"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Loader2, FileText, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface SearchResult {
    documentId: string;
    title: string;
    slug: string;
    excerpt: string;
    breadcrumbs: Array<{ title: string; slug: string }>;
    relevanceScore: number;
    matchedTerms: string[];
}

export default function SearchPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [query, setQuery] = useState(searchParams.get('q') || '');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [total, setTotal] = useState(0);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [popularPages, setPopularPages] = useState<string[]>([]);

    const performSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim()) {
            setResults([]);
            setTotal(0);
            setSuggestions([]);
            setHasSearched(false);
            setError(null);
            return;
        }

        setIsLoading(true);
        setHasSearched(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/v1/documentation/search?q=${encodeURIComponent(searchQuery)}&type=tenant`
            );

            const data = await response.json();

            if (response.ok) {
                setResults(data.data?.results || []);
                setTotal(data.data?.total || 0);
                setSuggestions(data.data?.suggestions || []);
            } else {
                // Handle error response
                setError(data.error?.userMessage || 'Search failed. Please try again.');

                // If search is unavailable, show popular pages
                if (data.data?.popularPages) {
                    setPopularPages(data.data.popularPages);
                }
            }
        } catch (error) {
            console.error('Search failed:', error);
            setError('Search is temporarily unavailable. Please try again in a few moments.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const q = searchParams.get('q');
        if (q) {
            setQuery(q);
            performSearch(q);
        }
    }, [searchParams, performSearch]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            router.push(`/docs/search?q=${encodeURIComponent(query)}`);
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        setQuery(suggestion);
        router.push(`/docs/search?q=${encodeURIComponent(suggestion)}`);
    };

    return (
        <div className="mx-auto max-w-4xl">
            {/* Search header */}
            <div className="mb-8">
                <h1 className="mb-4 text-4xl font-bold tracking-tight">Search Documentation</h1>
                <p className="text-muted-foreground">
                    Find answers to your questions across all documentation
                </p>
            </div>

            {/* Search input */}
            <form onSubmit={handleSearch} className="mb-8">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search for topics, features, or guides..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="h-14 pl-12 pr-4 text-lg"
                        autoFocus
                    />
                </div>
            </form>

            {/* Loading state */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}

            {/* Error state */}
            {!isLoading && error && (
                <div className="py-12">
                    <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20 p-6">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                <svg
                                    className="h-6 w-6 text-yellow-600 dark:text-yellow-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                    />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                                    Search Unavailable
                                </h3>
                                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-4">
                                    {error}
                                </p>
                                {popularPages.length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-2">
                                            Popular pages you might find helpful:
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {popularPages.map((page, index) => (
                                                <Badge key={index} variant="secondary">
                                                    {page}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="mt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => performSearch(query)}
                                    >
                                        Try Again
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Results */}
            {!isLoading && !error && hasSearched && (
                <>
                    {results.length > 0 ? (
                        <>
                            <div className="mb-6 text-sm text-muted-foreground">
                                Found {total} {total === 1 ? 'result' : 'results'} for &quot;{query}&quot;
                            </div>

                            <div className="space-y-4">
                                {results.map((result) => (
                                    <SearchResultCard key={result.documentId} result={result} />
                                ))}
                            </div>
                        </>
                    ) : (
                        <ZeroResultsState
                            query={query}
                            suggestions={suggestions}
                            onSuggestionClick={handleSuggestionClick}
                        />
                    )}
                </>
            )}

            {/* Initial state */}
            {!hasSearched && !isLoading && (
                <div className="py-12 text-center">
                    <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground">
                        Enter a search term to find relevant documentation
                    </p>
                </div>
            )}
        </div>
    );
}

function SearchResultCard({ result }: { result: SearchResult }) {
    return (
        <Link href={`/docs/${result.slug}`}>
            <Card className="group p-6 transition-all hover:border-primary hover:shadow-md">
                <div className="space-y-3">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {result.breadcrumbs.map((crumb, index) => (
                            <div key={index} className="flex items-center gap-2">
                                {index > 0 && <ChevronRight className="h-3 w-3" />}
                                <span>{crumb.title}</span>
                            </div>
                        ))}
                    </div>

                    {/* Title */}
                    <h3 className="text-xl font-semibold group-hover:text-primary transition-colors">
                        {result.title}
                    </h3>

                    {/* Excerpt */}
                    <p className="text-sm text-muted-foreground line-clamp-2">
                        {result.excerpt}
                    </p>

                    {/* Matched terms */}
                    {result.matchedTerms.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {result.matchedTerms.map((term, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                    {term}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
            </Card>
        </Link>
    );
}

function ZeroResultsState({
    query,
    suggestions,
    onSuggestionClick,
}: {
    query: string;
    suggestions: string[];
    onSuggestionClick: (suggestion: string) => void;
}) {
    return (
        <div className="py-12">
            <div className="mb-8 text-center">
                <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                <h2 className="mb-2 text-2xl font-semibold">No results found</h2>
                <p className="text-muted-foreground">
                    We couldn&apos;t find any documentation matching &quot;{query}&quot;
                </p>
            </div>

            {suggestions.length > 0 && (
                <div className="mx-auto max-w-md">
                    <h3 className="mb-4 text-center font-semibold">Try these popular searches:</h3>
                    <div className="flex flex-wrap justify-center gap-2">
                        {suggestions.map((suggestion, index) => (
                            <Button
                                key={index}
                                variant="outline"
                                size="sm"
                                onClick={() => onSuggestionClick(suggestion)}
                            >
                                {suggestion}
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-8 text-center">
                <p className="text-sm text-muted-foreground">
                    Try using different keywords or{' '}
                    <Link href="/docs" className="text-primary hover:underline">
                        browse all documentation
                    </Link>
                </p>
            </div>
        </div>
    );
}
