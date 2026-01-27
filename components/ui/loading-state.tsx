/**
 * Loading state components for async operations
 */

import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface LoadingStateProps {
    message?: string;
    className?: string;
}

/**
 * Full page loading spinner
 */
export function LoadingSpinner({ message, className }: LoadingStateProps) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center py-12",
                className
            )}
        >
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            {message && (
                <p className="text-sm text-muted-foreground">{message}</p>
            )}
        </div>
    );
}

/**
 * Inline loading spinner
 */
export function InlineLoader({ message, className }: LoadingStateProps) {
    return (
        <div className={cn("flex items-center gap-2", className)}>
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            {message && (
                <span className="text-sm text-muted-foreground">{message}</span>
            )}
        </div>
    );
}

/**
 * Card loading skeleton
 */
export function CardSkeleton({ className }: { className?: string }) {
    return (
        <Card className={cn("p-6", className)}>
            <div className="space-y-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-20 w-full" />
            </div>
        </Card>
    );
}

/**
 * Table loading skeleton
 */
export function TableSkeleton({
    rows = 5,
    columns = 4,
}: {
    rows?: number;
    columns?: number;
}) {
    return (
        <div className="space-y-3">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                    {Array.from({ length: columns }).map((_, j) => (
                        <Skeleton key={j} className="h-10 flex-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}

/**
 * Metrics dashboard skeleton
 */
export function MetricsSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <CardSkeleton key={i} />
                ))}
            </div>
            <CardSkeleton className="h-64" />
        </div>
    );
}

/**
 * Loading overlay for existing content
 */
export function LoadingOverlay({
    isLoading,
    message,
    children,
}: {
    isLoading: boolean;
    message?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="relative">
            {children}
            {isLoading && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
                    <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                        {message && (
                            <p className="text-sm font-medium text-foreground">{message}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Button loading state
 */
export function ButtonLoader({ className }: { className?: string }) {
    return <Loader2 className={cn("w-4 h-4 animate-spin", className)} />;
}
