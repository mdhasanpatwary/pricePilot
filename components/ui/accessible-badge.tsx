import { Badge, BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AccessibleBadgeProps extends BadgeProps {
    /**
     * Screen reader text that describes the badge content
     */
    srText?: string;
    /**
     * ARIA label for the badge
     */
    ariaLabel?: string;
}

/**
 * An accessible badge component that includes screen reader text
 * for visual indicators, ensuring WCAG compliance.
 */
export function AccessibleBadge({
    children,
    srText,
    ariaLabel,
    className,
    ...props
}: AccessibleBadgeProps) {
    return (
        <Badge
            className={cn(className)}
            aria-label={ariaLabel || srText}
            role="status"
            {...props}
        >
            {children}
            {srText && <span className="sr-only">{srText}</span>}
        </Badge>
    );
}
