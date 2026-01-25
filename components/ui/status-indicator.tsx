/**
 * Standardized status indicator component using shadcn/ui Badge variants
 * Provides consistent styling for all status displays across the application
 */

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BadgeVariant } from "@/lib/types/shadcn-ui";
import { getStatusBadgeVariant } from "@/lib/utils/variant-helpers";

export interface StatusIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
    status: string;
    label?: string;
    icon?: React.ReactNode;
    size?: "sm" | "default" | "lg";
    variant?: BadgeVariant;
}

/**
 * StatusIndicator component that maps status strings to appropriate Badge variants
 * Maintains existing color schemes while using standardized shadcn/ui components
 */
export function StatusIndicator({
    status,
    label,
    icon,
    size = "default",
    className,
    variant,
    ...props
}: StatusIndicatorProps) {
    // Use provided variant or determine from status
    const badgeVariant = variant || getStatusBadgeVariant(status);

    // Format label - use provided label or format status
    const displayLabel = label || status.replace(/_/g, " ").toLowerCase()
        .split(" ")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

    // Size-specific styling
    const sizeClasses = {
        sm: "text-[9px] px-1.5 py-0.5",
        default: "text-[10px] px-2 py-0.5",
        lg: "text-xs px-2.5 py-1"
    };

    return (
        <Badge
            variant={badgeVariant}
            className={cn(
                "inline-flex items-center gap-1 font-bold uppercase tracking-wider",
                sizeClasses[size],
                className
            )}
            {...props}
        >
            {icon && <span className="w-3 h-3">{icon}</span>}
            {displayLabel}
        </Badge>
    );
}

/**
 * Specialized status indicators for common use cases
 */

export interface ActionStatusProps extends React.HTMLAttributes<HTMLDivElement> {
    action: string;
    size?: "sm" | "default" | "lg";
}

export function ActionStatus({ action, className, size = "default", ...props }: ActionStatusProps) {
    const getActionIcon = () => {
        if (action.includes("APPROVE")) {
            return <CheckCircle2 className="w-3 h-3" />;
        }
        if (action.includes("REJECT")) {
            return <XCircle className="w-3 h-3" />;
        }
        return <History className="w-3 h-3" />;
    };

    const getActionVariant = (): BadgeVariant => {
        if (action.includes("APPROVE")) return "success";
        if (action.includes("REJECT")) return "destructive";
        return "secondary";
    };

    return (
        <StatusIndicator
            status={action}
            icon={getActionIcon()}
            variant={getActionVariant()}
            size={size}
            className={className}
            {...props}
        />
    );
}

export interface ConnectionStatusProps extends React.HTMLAttributes<HTMLDivElement> {
    status: "ACTIVE" | "INACTIVE" | "ERROR" | "CONNECTING";
    size?: "sm" | "default" | "lg";
    showDot?: boolean;
}

export function ConnectionStatus({
    status,
    className,
    size = "default",
    showDot = false,
    ...props
}: ConnectionStatusProps) {
    const getStatusIcon = () => {
        switch (status) {
            case "ACTIVE":
                return showDot ?
                    <div className="w-2 h-2 rounded-full bg-current animate-pulse" /> :
                    <CheckCircle2 className="w-3 h-3" />;
            case "ERROR":
                return <XCircle className="w-3 h-3" />;
            case "CONNECTING":
                return <Loader2 className="w-3 h-3 animate-spin" />;
            default:
                return <Circle className="w-3 h-3" />;
        }
    };

    return (
        <StatusIndicator
            status={status}
            icon={getStatusIcon()}
            size={size}
            className={className}
            {...props}
        />
    );
}

export interface PriceStatusProps extends React.HTMLAttributes<HTMLDivElement> {
    status: "RED" | "GREEN" | "NEUTRAL" | "COMP_OOS" | "NOT_FOUND";
    size?: "sm" | "default" | "lg";
    showDot?: boolean;
}

export function PriceStatus({
    status,
    className,
    size = "default",
    showDot = false,
    ...props
}: PriceStatusProps) {
    const getStatusLabel = () => {
        switch (status) {
            case "RED": return "At Risk";
            case "GREEN": return "Optimal";
            case "NEUTRAL": return "Parity";
            case "COMP_OOS": return "Stock Out";
            case "NOT_FOUND": return "Not Found";
            default: return status;
        }
    };

    const getStatusIcon = () => {
        if (showDot) {
            return <div className="w-1.5 h-1.5 rounded-full bg-current" />;
        }

        switch (status) {
            case "RED": return <TrendingDown className="w-3 h-3" />;
            case "GREEN": return <TrendingUp className="w-3 h-3" />;
            case "NEUTRAL": return <Minus className="w-3 h-3" />;
            case "COMP_OOS": return <AlertTriangle className="w-3 h-3" />;
            case "NOT_FOUND": return <Search className="w-3 h-3" />;
            default: return null;
        }
    };

    return (
        <StatusIndicator
            status={status}
            label={getStatusLabel()}
            icon={getStatusIcon()}
            size={size}
            className={className}
            {...props}
        />
    );
}

// Import required icons
import {
    CheckCircle2,
    XCircle,
    History,
    Circle,
    Loader2,
    TrendingDown,
    TrendingUp,
    Minus,
    AlertTriangle,
    Search
} from "lucide-react";