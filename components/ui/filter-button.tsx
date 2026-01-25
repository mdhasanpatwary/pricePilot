/**
 * Standardized filter button component extending shadcn/ui Button
 * Provides consistent status indicators and follows shadcn/ui composition patterns
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button, ButtonProps } from "@/components/ui/button";
import { getInteractiveStyles } from "@/lib/utils/interactive-styles";

export interface FilterButtonProps extends Omit<ButtonProps, "onClick"> {
    segment: string;
    label: string;
    count?: number;
    status?: "RED" | "GREEN" | "NEUTRAL" | "COMP_OOS" | "NOT_FOUND" | "ALL";
    isActive: boolean;
    onClick: (segment: string) => void;
    showDot?: boolean;
}

/**
 * FilterButton extends shadcn/ui Button with status-aware styling
 * Maintains existing functionality while following shadcn/ui composition patterns
 */
export const FilterButton = React.forwardRef<HTMLButtonElement, FilterButtonProps>(({
    segment,
    label,
    count,
    status,
    isActive,
    onClick,
    className,
    showDot = true,
    variant = "ghost",
    size = "sm",
    ...props
}, ref) => {
    const handleClick = () => {
        onClick(segment);
    };

    // Get appropriate styling based on status
    const getStatusStyling = () => {
        if (!status || status === "ALL") {
            return {
                activeClass: "bg-background text-foreground shadow-sm",
                dotColor: "bg-muted-foreground/30"
            };
        }

        switch (status) {
            case "GREEN":
                return {
                    activeClass: "bg-success/10 text-success shadow-sm",
                    dotColor: "bg-success"
                };
            case "RED":
                return {
                    activeClass: "bg-danger/10 text-danger shadow-sm",
                    dotColor: "bg-danger"
                };
            case "COMP_OOS":
                return {
                    activeClass: "bg-amber-100/50 text-amber-600 shadow-sm",
                    dotColor: "bg-amber-500"
                };
            case "NOT_FOUND":
                return {
                    activeClass: "bg-slate-100/50 text-slate-600 shadow-sm",
                    dotColor: "bg-slate-400"
                };
            case "NEUTRAL":
                return {
                    activeClass: "bg-muted text-foreground shadow-sm",
                    dotColor: "bg-muted-foreground/30"
                };
            default:
                return {
                    activeClass: "bg-background text-foreground shadow-sm",
                    dotColor: "bg-muted-foreground/30"
                };
        }
    };

    const { activeClass, dotColor } = getStatusStyling();

    return (
        <Button
            ref={ref}
            onClick={handleClick}
            data-segment={segment}
            variant={variant}
            size={size}
            className={cn(
                "px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2",
                getInteractiveStyles("button", { includeActive: false }),
                isActive
                    ? activeClass
                    : "text-muted-foreground hover:text-foreground",
                className
            )}
            {...props}
        >
            {showDot && status !== "ALL" && (
                <div className={cn("w-1.5 h-1.5 rounded-full", dotColor)} />
            )}
            {label}
            {count !== undefined && ` (${count})`}
        </Button>
    );
});

FilterButton.displayName = "FilterButton";