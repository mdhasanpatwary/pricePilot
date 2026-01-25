/**
 * Custom styling extensions for unique visual elements
 * Provides standardized custom styles that extend shadcn/ui components
 */

import { cn } from "@/lib/utils";

/**
 * Premium gradient styles for special buttons and elements
 */
export const premiumGradients = {
    primary: "bg-gradient-to-r from-primary via-primary/90 to-primary/80",
    success: "bg-gradient-to-r from-success via-success/90 to-success/80",
    warning: "bg-gradient-to-r from-warning via-warning/90 to-warning/80",
    destructive: "bg-gradient-to-r from-destructive via-destructive/90 to-destructive/80",
    muted: "bg-gradient-to-r from-muted via-muted/90 to-muted/80"
} as const;

/**
 * Glow effects for enhanced visual appeal
 */
export const glowEffects = {
    primary: "shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30",
    success: "shadow-lg shadow-success/20 hover:shadow-xl hover:shadow-success/30",
    warning: "shadow-lg shadow-warning/20 hover:shadow-xl hover:warning/30",
    destructive: "shadow-lg shadow-destructive/20 hover:shadow-xl hover:shadow-destructive/30",
    subtle: "shadow-sm hover:shadow-md transition-shadow duration-200"
} as const;

/**
 * Backdrop blur effects for modern glass-morphism
 */
export const backdropEffects = {
    light: "backdrop-blur-sm bg-background/80",
    medium: "backdrop-blur-md bg-background/60",
    heavy: "backdrop-blur-lg bg-background/40",
    glass: "backdrop-blur-xl bg-background/30"
} as const;

/**
 * Enhanced animation styles
 */
export const enhancedAnimations = {
    // Pulse animations for status indicators
    statusPulse: "animate-pulse",

    // Smooth entrance animations
    slideInFromTop: "animate-in slide-in-from-top duration-300",
    slideInFromRight: "animate-in slide-in-from-right duration-300",
    slideInFromBottom: "animate-in slide-in-from-bottom duration-300",
    slideInFromLeft: "animate-in slide-in-from-left duration-300",

    // Fade animations
    fadeIn: "animate-in fade-in duration-200",
    fadeOut: "animate-out fade-out duration-200",

    // Scale animations
    scaleIn: "animate-in zoom-in-95 duration-200",
    scaleOut: "animate-out zoom-out-95 duration-200",

    // Bounce effect for interactive elements
    bounce: "hover:animate-bounce",

    // Spin for loading states
    spin: "animate-spin"
} as const;

/**
 * Custom shadow styles for depth and elevation
 */
export const customShadows = {
    // Soft shadows for cards and containers
    soft: "shadow-sm hover:shadow-md transition-shadow duration-200",

    // Medium shadows for elevated elements
    elevated: "shadow-md hover:shadow-lg transition-shadow duration-200",

    // Strong shadows for modals and overlays
    overlay: "shadow-2xl",

    // Colored shadows for branded elements
    primaryGlow: "shadow-xl shadow-primary/20",
    successGlow: "shadow-xl shadow-success/20",
    warningGlow: "shadow-xl shadow-warning/20",
    destructiveGlow: "shadow-xl shadow-destructive/20",

    // Inner shadows for inset effects
    inset: "shadow-inner",

    // No shadow
    none: "shadow-none"
} as const;

/**
 * Status indicator dot styles
 */
export const statusDots = {
    active: "w-2 h-2 rounded-full bg-success animate-pulse",
    inactive: "w-2 h-2 rounded-full bg-muted-foreground/30",
    error: "w-2 h-2 rounded-full bg-destructive animate-pulse",
    warning: "w-2 h-2 rounded-full bg-warning animate-pulse",
    loading: "w-2 h-2 rounded-full bg-primary animate-pulse"
} as const;

/**
 * Decorative background elements
 */
export const decorativeBackgrounds = {
    // Subtle gradient overlays
    primaryOverlay: "bg-primary/5",
    successOverlay: "bg-success/5",
    warningOverlay: "bg-warning/5",
    destructiveOverlay: "bg-destructive/5",

    // Mesh gradients for hero sections
    meshPrimary: "bg-gradient-to-br from-primary/10 via-transparent to-primary/5",
    meshSuccess: "bg-gradient-to-br from-success/10 via-transparent to-success/5",

    // Noise textures for subtle patterns
    noise: "bg-[url('data:image/svg+xml,%3Csvg viewBox=\"0 0 256 256\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.9\" numOctaves=\"4\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noiseFilter)\" opacity=\"0.05\"/%3E%3C/svg%3E')]"
} as const;

/**
 * Border styles for enhanced visual hierarchy
 */
export const enhancedBorders = {
    // Gradient borders
    primaryGradient: "border border-transparent bg-gradient-to-r from-primary/20 to-primary/10 bg-clip-padding",

    // Animated borders
    shimmer: "relative overflow-hidden border border-border before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-primary/20 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-1000",

    // Dashed borders for special states
    dashed: "border-2 border-dashed border-border",
    dashedPrimary: "border-2 border-dashed border-primary/30",

    // Thick borders for emphasis
    thick: "border-2 border-border",
    thickPrimary: "border-2 border-primary"
} as const;

/**
 * Typography enhancements
 */
export const enhancedTypography = {
    // Gradient text effects
    primaryGradientText: "bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent",

    // Text shadows for depth
    textShadow: "text-shadow-sm",

    // Letter spacing variations
    tight: "tracking-tight",
    normal: "tracking-normal",
    wide: "tracking-wide",
    wider: "tracking-wider",
    widest: "tracking-widest"
} as const;

/**
 * Utility function to combine custom styles with base styles
 */
export function withCustomStyles(
    baseStyles: string,
    customStyles: {
        gradient?: keyof typeof premiumGradients;
        glow?: keyof typeof glowEffects;
        backdrop?: keyof typeof backdropEffects;
        animation?: keyof typeof enhancedAnimations;
        shadow?: keyof typeof customShadows;
        border?: keyof typeof enhancedBorders;
    } = {}
): string {
    const { gradient, glow, backdrop, animation, shadow, border } = customStyles;

    return cn(
        baseStyles,
        gradient && premiumGradients[gradient],
        glow && glowEffects[glow],
        backdrop && backdropEffects[backdrop],
        animation && enhancedAnimations[animation],
        shadow && customShadows[shadow],
        border && enhancedBorders[border]
    );
}

/**
 * Pre-built component style combinations
 */
export const componentStylePresets = {
    // Premium button with gradient and glow
    premiumButton: cn(
        premiumGradients.primary,
        glowEffects.primary,
        enhancedAnimations.scaleIn,
        "text-primary-foreground font-bold transition-all duration-200 active:scale-95"
    ),

    // Glass card with backdrop blur
    glassCard: cn(
        backdropEffects.glass,
        customShadows.soft,
        enhancedBorders.thick,
        "rounded-xl"
    ),

    // Status indicator with pulse
    statusIndicator: cn(
        statusDots.active,
        enhancedAnimations.statusPulse
    ),

    // Floating action button
    floatingButton: cn(
        customShadows.elevated,
        glowEffects.primary,
        enhancedAnimations.bounce,
        "rounded-full p-3 bg-primary text-primary-foreground"
    ),

    // Hero section background
    heroBackground: cn(
        decorativeBackgrounds.meshPrimary,
        decorativeBackgrounds.noise,
        "relative overflow-hidden"
    ),

    // Modal overlay
    modalOverlay: cn(
        backdropEffects.medium,
        customShadows.overlay,
        enhancedAnimations.fadeIn
    )
} as const;

/**
 * Responsive custom styles
 */
export const responsiveCustomStyles = {
    // Mobile-first gradient buttons
    mobileGradientButton: "bg-primary sm:bg-gradient-to-r sm:from-primary sm:to-primary/80",

    // Desktop-only glow effects
    desktopGlow: "lg:shadow-lg lg:shadow-primary/20 lg:hover:shadow-xl lg:hover:shadow-primary/30",

    // Tablet-specific backdrop blur
    tabletBackdrop: "md:backdrop-blur-md md:bg-background/60"
} as const;

/**
 * Dark mode custom styles
 */
export const darkModeCustomStyles = {
    // Enhanced shadows for dark mode
    darkShadow: "dark:shadow-2xl dark:shadow-black/50",

    // Adjusted gradients for dark mode
    darkGradient: "dark:from-primary/80 dark:to-primary/60",

    // Dark mode glow effects
    darkGlow: "dark:shadow-primary/40"
} as const;