/**
 * Empty state component for displaying when no data is available
 */

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
}: EmptyStateProps) {
    return (
        <Card
            className={cn(
                "flex flex-col items-center justify-center py-12 px-6 text-center",
                className
            )}
        >
            {Icon && (
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <Icon className="w-8 h-8 text-muted-foreground opacity-50" />
                </div>
            )}

            <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>

            {description && (
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                    {description}
                </p>
            )}

            {action && (
                <Button onClick={action.onClick} variant="outline">
                    {action.label}
                </Button>
            )}
        </Card>
    );
}

/**
 * Inline empty state (without card wrapper)
 */
export function InlineEmptyState({
    icon: Icon,
    title,
    description,
    className,
}: Omit<EmptyStateProps, "action">) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center py-8 px-6 text-center",
                className
            )}
        >
            {Icon && (
                <Icon className="w-12 h-12 text-muted-foreground opacity-30 mb-3" />
            )}

            <p className="text-sm font-medium text-foreground mb-1">{title}</p>

            {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
            )}
        </div>
    );
}
