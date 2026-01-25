/**
 * Utility functions for shadcn/ui component variant validation and type safety
 */

import {
    ButtonVariant,
    ButtonSize,
    BadgeVariant,
    SheetSide,
    isValidButtonVariant,
    isValidBadgeVariant,
    isValidSheetSide
} from "@/lib/types/shadcn-ui";

// Variant validation functions
export const validateButtonVariant = (variant: string): ButtonVariant => {
    if (isValidButtonVariant(variant)) {
        return variant;
    }
    console.warn(`Invalid button variant: ${variant}. Falling back to 'default'.`);
    return "default";
};

export const validateBadgeVariant = (variant: string): BadgeVariant => {
    if (isValidBadgeVariant(variant)) {
        return variant;
    }
    console.warn(`Invalid badge variant: ${variant}. Falling back to 'default'.`);
    return "default";
};

export const validateSheetSide = (side: string): SheetSide => {
    if (isValidSheetSide(side)) {
        return side;
    }
    console.warn(`Invalid sheet side: ${side}. Falling back to 'right'.`);
    return "right";
};

// Status to badge variant mapping with type safety
export const getStatusBadgeVariant = (status: string): BadgeVariant => {
    const statusMap: Record<string, BadgeVariant> = {
        "RED": "destructive",
        "GREEN": "success",
        "NEUTRAL": "secondary",
        "COMP_OOS": "warning",
        "NOT_FOUND": "outline",
        "ACTIVE": "success",
        "INACTIVE": "secondary",
        "ERROR": "destructive",
        "WARNING": "warning",
        "SUCCESS": "success",
        "INFO": "outline"
    };

    const upperStatus = status.toUpperCase();
    return Object.prototype.hasOwnProperty.call(statusMap, upperStatus)
        ? statusMap[upperStatus]
        : "secondary";
};

// Button variant mapping for different contexts
export const getActionButtonVariant = (action: string): ButtonVariant => {
    const actionMap: Record<string, ButtonVariant> = {
        "delete": "destructive",
        "edit": "outline",
        "view": "ghost",
        "save": "default",
        "cancel": "outline",
        "submit": "default",
        "reset": "secondary"
    };

    const lowerAction = action.toLowerCase();
    return Object.prototype.hasOwnProperty.call(actionMap, lowerAction)
        ? actionMap[lowerAction]
        : "default";
};

// Size validation for components
export const validateButtonSize = (size: string): ButtonSize => {
    const validSizes: ButtonSize[] = ["default", "sm", "lg", "icon"];
    if (validSizes.includes(size as ButtonSize)) {
        return size as ButtonSize;
    }
    console.warn(`Invalid button size: ${size}. Falling back to 'default'.`);
    return "default";
};

// Utility to get appropriate variant based on conditions
export const getConditionalVariant = <T extends string>(
    condition: boolean,
    trueVariant: T,
    falseVariant: T
): T => {
    return condition ? trueVariant : falseVariant;
};

// Type-safe variant props builder
export interface VariantPropsBuilder<T> {
    variant?: T;
    size?: string;
    className?: string;
}

export const buildButtonProps = (
    variant?: ButtonVariant,
    size?: ButtonSize,
    className?: string
): VariantPropsBuilder<ButtonVariant> => ({
    variant: variant || "default",
    size: size || "default",
    className
});

export const buildBadgeProps = (
    variant?: BadgeVariant,
    className?: string
): VariantPropsBuilder<BadgeVariant> => ({
    variant: variant || "default",
    className
});

// Runtime variant validation with fallbacks
export const safeVariantProps = <T extends string>(
    variant: string | undefined,
    validVariants: T[],
    fallback: T
): T => {
    if (!variant) return fallback;
    if (validVariants.includes(variant as T)) {
        return variant as T;
    }
    console.warn(`Invalid variant: ${variant}. Using fallback: ${fallback}`);
    return fallback;
};

// Component variant constants for easy reference
export const BUTTON_VARIANTS = {
    PRIMARY: "default" as const,
    SECONDARY: "secondary" as const,
    OUTLINE: "outline" as const,
    GHOST: "ghost" as const,
    LINK: "link" as const,
    DESTRUCTIVE: "destructive" as const
} satisfies Record<string, ButtonVariant>;

export const BADGE_VARIANTS = {
    DEFAULT: "default" as const,
    SECONDARY: "secondary" as const,
    SUCCESS: "success" as const,
    WARNING: "warning" as const,
    DESTRUCTIVE: "destructive" as const,
    OUTLINE: "outline" as const
} satisfies Record<string, BadgeVariant>;

export const BUTTON_SIZES = {
    SMALL: "sm" as const,
    DEFAULT: "default" as const,
    LARGE: "lg" as const,
    ICON: "icon" as const
} satisfies Record<string, ButtonSize>;

// Variant composition utilities
export type VariantConfig<T> = {
    variant: T;
    condition?: boolean;
    fallback?: T;
};

export const selectVariant = <T extends string>(
    configs: VariantConfig<T>[],
    defaultVariant: T
): T => {
    for (const config of configs) {
        if (config.condition !== false) {
            return config.variant;
        }
    }
    return defaultVariant;
};