/**
 * Pagination component
 * Provides UI controls for paginated data
 */

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "./button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./select";
import { cn } from "@/lib/utils";

export interface PaginationProps {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    pageSizeOptions?: number[];
    showPageSize?: boolean;
    className?: string;
}

export function Pagination({
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 25, 50, 100],
    showPageSize = true,
    className,
}: PaginationProps) {
    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);

    const canGoPrevious = currentPage > 1;
    const canGoNext = currentPage < totalPages;

    // Generate page numbers to display
    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible) {
            // Show all pages
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Show first page
            pages.push(1);

            if (currentPage > 3) {
                pages.push("...");
            }

            // Show pages around current page
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }

            if (currentPage < totalPages - 2) {
                pages.push("...");
            }

            // Show last page
            pages.push(totalPages);
        }

        return pages;
    };

    return (
        <div
            className={cn(
                "flex flex-col sm:flex-row items-center justify-between gap-4",
                className
            )}
        >
            {/* Items info */}
            <div className="text-sm text-muted-foreground">
                Showing {startItem} to {endItem} of {totalItems} items
            </div>

            <div className="flex items-center gap-4">
                {/* Page size selector */}
                {showPageSize && onPageSizeChange && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Items per page:</span>
                        <Select
                            value={pageSize.toString()}
                            onValueChange={(value) => onPageSizeChange(parseInt(value))}
                        >
                            <SelectTrigger className="w-[70px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {pageSizeOptions.map((size) => (
                                    <SelectItem key={size} value={size.toString()}>
                                        {size}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* Page navigation */}
                <div className="flex items-center gap-1">
                    {/* First page */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(1)}
                        disabled={!canGoPrevious}
                        aria-label="First page"
                    >
                        <ChevronsLeft className="w-4 h-4" />
                    </Button>

                    {/* Previous page */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={!canGoPrevious}
                        aria-label="Previous page"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>

                    {/* Page numbers */}
                    <div className="flex items-center gap-1">
                        {getPageNumbers().map((page, index) => {
                            if (page === "...") {
                                return (
                                    <span
                                        key={`ellipsis-${index}`}
                                        className="px-2 text-muted-foreground"
                                    >
                                        ...
                                    </span>
                                );
                            }

                            return (
                                <Button
                                    key={page}
                                    variant={page === currentPage ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => onPageChange(page as number)}
                                    className="min-w-[36px]"
                                >
                                    {page}
                                </Button>
                            );
                        })}
                    </div>

                    {/* Next page */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={!canGoNext}
                        aria-label="Next page"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>

                    {/* Last page */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(totalPages)}
                        disabled={!canGoNext}
                        aria-label="Last page"
                    >
                        <ChevronsRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
