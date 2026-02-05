"use client";

import { useEffect, useState } from 'react';
import { List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface Heading {
    id: string;
    text: string;
    level: number;
}

interface TableOfContentsProps {
    headings: Heading[];
}

export function TableOfContents({ headings }: TableOfContentsProps) {
    const [activeId, setActiveId] = useState<string>('');
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveId(entry.target.id);
                    }
                });
            },
            {
                rootMargin: '-80px 0px -80% 0px',
            }
        );

        headings.forEach((heading) => {
            const element = document.getElementById(heading.id);
            if (element) {
                observer.observe(element);
            }
        });

        return () => {
            headings.forEach((heading) => {
                const element = document.getElementById(heading.id);
                if (element) {
                    observer.unobserve(element);
                }
            });
        };
    }, [headings]);

    if (headings.length === 0) {
        return null;
    }

    const handleClick = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            const top = element.offsetTop - 80;
            window.scrollTo({ top, behavior: 'smooth' });
            setIsOpen(false); // Close mobile sheet after navigation
        }
    };

    const tocContent = (
        <nav className="space-y-1">
            {headings.map((heading) => (
                <button
                    key={heading.id}
                    onClick={() => handleClick(heading.id)}
                    className={cn(
                        'block w-full text-left text-sm transition-colors hover:text-foreground',
                        heading.level === 2 && 'pl-0',
                        heading.level === 3 && 'pl-4',
                        heading.level === 4 && 'pl-8',
                        activeId === heading.id
                            ? 'font-medium text-primary'
                            : 'text-muted-foreground'
                    )}
                >
                    {heading.text}
                </button>
            ))}
        </nav>
    );

    return (
        <>
            {/* Mobile TOC - Sheet */}
            <div className="lg:hidden fixed bottom-4 right-4 z-50">
                <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <SheetTrigger asChild>
                        <Button
                            size="lg"
                            className="rounded-full shadow-lg"
                            aria-label="Table of contents"
                        >
                            <List className="h-5 w-5 mr-2" />
                            Contents
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-80">
                        <SheetHeader>
                            <SheetTitle>On This Page</SheetTitle>
                        </SheetHeader>
                        <div className="mt-6">
                            {tocContent}
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            {/* Desktop TOC - Sticky sidebar */}
            <div className="hidden lg:block space-y-2">
                <h4 className="font-semibold text-sm mb-4">On This Page</h4>
                {tocContent}
            </div>
        </>
    );
}
