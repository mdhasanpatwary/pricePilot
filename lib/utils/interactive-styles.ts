/**
 * Standardized interactive styling utilities for consistent hover and focus states
 * Provides unified interaction patterns across all components
 */

import { cn } from "@/lib/utils";

/**
 * Standard interactive states for different component types
 */
export const interactiveStyles = {
    // Button-like interactive elements
    button: {
        base: "transition-all duration-200 ease-in-out",
        hover: "hover:bg-primary/10 hover:text-primary hover:border-primary/20",
        focus: "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2",
        active: "active:scale-95",
        disabled: "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
    },

    // Subtle interactive elements (like table rows, cards)
    subtle: {
        base: "transition-colors duration-200 ease-in-out",
        hover: "hover:bg-muted/30",
        focus: "focus:outline-none focus:bg-muted/50",
        active: "",
        disabled: "disabled:opacity-50 disabled:cursor-not-allowed"
    },

    // Navigation and menu items
    navigation: {
        base: "transition-all duration-200 ease-in-out",
        hover: "hover:bg-muted/50 hover:text-foreground",
        focus: "focus:outline-none focus:bg-muted/70",
        active: "active:bg-muted/80",
        disabled: "disabled:opacity-50 disabled:cursor-not-allowed"
    },

    // Input-like elements
    input: {
        base: "transition-all duration-200 ease-in-out",
        hover: "hover:border-primary/30",
        focus: "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50",
        active: "",
        disabled: "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted/30"
    },

    // Destructive actions
    destructive: {
        base: "transition-all duration-200 ease-in-out",
        hover: "hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20",
        focus: "focus:outline-none focus:ring-2 focus:ring-destructive/20 focus:ring-offset-2",
        active: "active:scale-95",
        disabled: "disabled:opacity-50 disabled:cursor-not-allowed"
    },

    // Success actions
    success: {
        base: "transition-all duration-200 ease-in-out",
        hover: "hover:bg-success/10 hover:text-success hover:border-success/20",
        focus: "focus:outline-none focus:ring-2 focus:ring-success/20 focus:ring-offset-2",
        active: "active:scale-95",
        disabled: "disabled:opacity-50 disabled:cursor-not-allowed"
    },

    // Warning actions
    warning: {
        base: "transition-all duration-200 ease-in-out",
        hover: "hover:bg-warning/10 hover:text-warning hover:border-warning/20",
        focus: "focus:outline-none focus:ring-2 focus:ring-warning/20 focus:ring-offset-2",
        active: "active:scale-95",
        disabled: "disabled:opacity-50 disabled:cursor-not-allowed"
    }
} as const;

/**
 * Interactive style variants for different component states
 */
export type InteractiveVariant = keyof typeof interactiveStyles;

/**
 * Get complete interactive styling for a component
 */
export function getInteractiveStyles(
    variant: InteractiveVariant = "button",
    options: {
        includeBase?: boolean;
        includeHover?: boolean;
        includeFocus?: boolean;
        includeActive?: boolean;
        includeDisabled?: boolean;
    } = {}
): string {
    const {
        includeBase = true,
        includeHover = true,
        includeFocus = true,
        includeActive = true,
        includeDisabled = true
    } = options;

    const styles = interactiveStyles[variant];

    return cn(
        includeBase && styles.base,
        includeHover && styles.hover,
        includeFocus && styles.focus,
        includeActive && styles.active,
        includeDisabled && styles.disabled
    );
}

/**
 * Specialized interactive styles for common use cases
 */
export const commonInteractiveStyles = {
    // Table row interactions
    tableRow: cn(
        interactiveStyles.subtle.base,
        interactiveStyles.subtle.hover,
        "cursor-pointer"
    ),

    // Icon button interactions
    iconButton: cn(
        interactiveStyles.button.base,
        "hover:bg-primary/10 hover:text-primary",
        interactiveStyles.button.focus,
        "rounded-md p-1.5 text-muted-foreground"
    ),

    // Link interactions
    link: cn(
        interactiveStyles.navigation.base,
        "hover:text-primary hover:underline",
        interactiveStyles.navigation.focus
    ),

    // Card interactions
    card: cn(
        interactiveStyles.subtle.base,
        interactiveStyles.subtle.hover,
        "cursor-pointer border-border hover:border-primary/20"
    ),

    // Filter button interactions
    filterButton: cn(
        interactiveStyles.button.base,
        "hover:text-foreground",
        interactiveStyles.button.focus
    ),

    // Menu item interactions
    menuItem: cn(
        interactiveStyles.navigation.base,
        interactiveStyles.navigation.hover,
        interactiveStyles.navigation.focus,
        "cursor-pointer rounded-md px-2 py-1.5"
    ),

    // Form control interactions
    formControl: cn(
        interactiveStyles.input.base,
        interactiveStyles.input.hover,
        interactiveStyles.input.focus
    )
};

/**
 * Get interactive styles based on component state
 */
export function getStateStyles(
    variant: InteractiveVariant,
    state: {
        isActive?: boolean;
        isDisabled?: boolean;
        isLoading?: boolean;
        isSelected?: boolean;
    } = {}
): string {
    const { isActive, isDisabled, isLoading, isSelected } = state;

    const baseStyles = getInteractiveStyles(variant);

    return cn(
        baseStyles,
        isActive && "bg-primary/10 text-primary border-primary/20",
        isSelected && "bg-primary/5 border-primary/30",
        isDisabled && "opacity-50 cursor-not-allowed pointer-events-none",
        isLoading && "opacity-75 cursor-wait"
    );
}

/**
 * Animation utilities for interactive elements
 */
export const animationStyles = {
    // Smooth scale animation for buttons
    scaleOnPress: "active:scale-95 transition-transform duration-100",

    // Smooth opacity animation for hover states
    fadeOnHover: "hover:opacity-80 transition-opacity duration-200",

    // Smooth color transitions
    colorTransition: "transition-colors duration-200 ease-in-out",

    // Smooth all transitions
    smoothTransition: "transition-all duration-200 ease-in-out",

    // Loading pulse animation
    loadingPulse: "animate-pulse",

    // Subtle bounce animation
    subtleBounce: "hover:animate-pulse"
};

/**
 * Focus ring utilities for accessibility
 */
export const focusRingStyles = {
    default: "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2",
    tight: "focus:outline-none focus:ring-1 focus:ring-primary/30",
    none: "focus:outline-none",
    visible: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
};

/**
 * Hover state utilities
 */
export const hoverStyles = {
    lift: "hover:shadow-md hover:-translate-y-0.5 transition-all duration-200",
    glow: "hover:shadow-lg hover:shadow-primary/10 transition-shadow duration-200",
    scale: "hover:scale-105 transition-transform duration-200",
    brightness: "hover:brightness-110 transition-all duration-200"
};