"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Search, BookOpen, ChevronRight, ChevronDown } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface TOCNode {
    title: string;
    slug: string;
    category: string;
    subcategory?: string;
    children?: TOCNode[];
    order: number;
}

interface DocumentationLayoutProps {
    type: 'tenant' | 'admin';
    children: React.ReactNode;
}

export function DocumentationLayout({ type, children }: DocumentationLayoutProps) {
    const [toc, setToc] = useState<TOCNode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        // Fetch table of contents
        const fetchTOC = async () => {
            try {
                const response = await fetch(`/api/v1/documentation/${type}/toc`);
                if (response.ok) {
                    const data = await response.json();
                    setToc(data.toc || []);
                }
            } catch (error) {
                console.error('Failed to fetch table of contents:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTOC();
    }, [type]);

    const baseUrl = type === 'tenant' ? '/docs' : '/admin-docs';

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-16 items-center justify-between px-4">
                    <div className="flex items-center gap-4">
                        {/* Mobile menu toggle */}
                        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="lg:hidden">
                                    <Menu className="h-5 w-5" />
                                    <span className="sr-only">Toggle menu</span>
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-80 p-0">
                                <div className="flex h-16 items-center border-b border-border px-6">
                                    <Link href={baseUrl} className="flex items-center gap-2">
                                        <BookOpen className="h-5 w-5 text-primary" />
                                        <span className="font-bold">
                                            {type === 'tenant' ? 'Documentation' : 'Admin Docs'}
                                        </span>
                                    </Link>
                                </div>
                                <ScrollArea className="h-[calc(100vh-4rem)]">
                                    <div className="p-6">
                                        <NavigationTree
                                            toc={toc}
                                            baseUrl={baseUrl}
                                            currentPath={pathname}
                                            onNavigate={() => setIsMobileMenuOpen(false)}
                                        />
                                    </div>
                                </ScrollArea>
                            </SheetContent>
                        </Sheet>

                        {/* Logo */}
                        <Link href={baseUrl} className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-primary" />
                            <span className="hidden font-bold sm:inline-block">
                                {type === 'tenant' ? 'Documentation' : 'Admin Documentation'}
                            </span>
                        </Link>
                    </div>

                    {/* Search bar */}
                    <div className="flex flex-1 items-center justify-center px-4">
                        <div className="w-full max-w-md">
                            <Link href={`${baseUrl}/search`}>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        type="text"
                                        placeholder="Search documentation..."
                                        className="w-full pl-10 pr-4"
                                        readOnly
                                    />
                                </div>
                            </Link>
                        </div>
                    </div>

                    {/* Right side actions */}
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/">Home</Link>
                        </Button>
                    </div>
                </div>
            </header>

            <div className="container flex-1">
                <div className="flex gap-6 lg:gap-10">
                    {/* Sidebar navigation - Desktop */}
                    <aside className="hidden w-64 shrink-0 lg:block">
                        <div className="sticky top-20 h-[calc(100vh-5rem)] overflow-y-auto py-6">
                            {isLoading ? (
                                <div className="space-y-2">
                                    <div className="h-8 w-full animate-pulse rounded bg-muted" />
                                    <div className="h-8 w-full animate-pulse rounded bg-muted" />
                                    <div className="h-8 w-full animate-pulse rounded bg-muted" />
                                </div>
                            ) : (
                                <NavigationTree
                                    toc={toc}
                                    baseUrl={baseUrl}
                                    currentPath={pathname}
                                />
                            )}
                        </div>
                    </aside>

                    {/* Main content */}
                    <main className="flex-1 py-6">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}

interface NavigationTreeProps {
    toc: TOCNode[];
    baseUrl: string;
    currentPath: string;
    onNavigate?: () => void;
}

function NavigationTree({ toc, baseUrl, currentPath, onNavigate }: NavigationTreeProps) {
    return (
        <nav className="space-y-1">
            {toc.map((category) => (
                <NavigationCategory
                    key={category.slug}
                    node={category}
                    baseUrl={baseUrl}
                    currentPath={currentPath}
                    onNavigate={onNavigate}
                />
            ))}
        </nav>
    );
}

interface NavigationCategoryProps {
    node: TOCNode;
    baseUrl: string;
    currentPath: string;
    level?: number;
    onNavigate?: () => void;
}

function NavigationCategory({
    node,
    baseUrl,
    currentPath,
    level = 0,
    onNavigate,
}: NavigationCategoryProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;
    const isActive = currentPath === `${baseUrl}/${node.slug}`;

    // Auto-expand if any child is active
    useEffect(() => {
        if (hasChildren && node.children) {
            const hasActiveChild = node.children.some(
                (child) => currentPath === `${baseUrl}/${child.slug}` ||
                    (child.children && child.children.some(
                        (grandchild) => currentPath === `${baseUrl}/${grandchild.slug}`
                    ))
            );
            if (hasActiveChild) {
                setIsExpanded((prev) => hasActiveChild ? true : prev);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPath]);

    if (level === 0) {
        // Category level - always show as header
        return (
            <div className="space-y-1">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                >
                    <span>{node.title}</span>
                    {hasChildren && (
                        isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )
                    )}
                </button>
                {isExpanded && hasChildren && (
                    <div className="ml-3 space-y-1 border-l border-border pl-3">
                        {node.children!.map((child) => (
                            <NavigationCategory
                                key={child.slug}
                                node={child}
                                baseUrl={baseUrl}
                                currentPath={currentPath}
                                level={level + 1}
                                onNavigate={onNavigate}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // Document/subcategory level
    return (
        <div className="space-y-1">
            <Link
                href={`${baseUrl}/${node.slug}`}
                onClick={onNavigate}
                className={cn(
                    'flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
            >
                <span>{node.title}</span>
                {hasChildren && (
                    <ChevronRight className="h-3 w-3" />
                )}
            </Link>
            {hasChildren && (
                <div className="ml-3 space-y-1 border-l border-border pl-3">
                    {node.children!.map((child) => (
                        <NavigationCategory
                            key={child.slug}
                            node={child}
                            baseUrl={baseUrl}
                            currentPath={currentPath}
                            level={level + 1}
                            onNavigate={onNavigate}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
