"use client";

import { useMemo } from "react";
import {
    calculatePasswordStrength,
    getStrengthColor,
    getStrengthTextColor,
    getStrengthLabel,
} from "@/lib/utils/password-strength";
import { Check, X } from "lucide-react";

interface PasswordStrengthIndicatorProps {
    password: string;
    showRequirements?: boolean;
}

/**
 * Password Strength Indicator Component
 * Requirement 2.7.6: Visual password strength indicator
 */
export function PasswordStrengthIndicator({
    password,
    showRequirements = true,
}: PasswordStrengthIndicatorProps) {
    const result = useMemo(
        () => calculatePasswordStrength(password),
        [password]
    );

    if (!password) {
        return null;
    }

    const { strength, score, meetsRequirements } = result;
    const strengthColor = getStrengthColor(strength);
    const strengthTextColor = getStrengthTextColor(strength);
    const strengthLabel = getStrengthLabel(strength);

    // Calculate bar segments (4 segments)
    const segments = 4;
    const filledSegments = Math.ceil((score / 100) * segments);

    return (
        <div className="space-y-3 mt-2">
            {/* Strength Bar */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                        Password Strength
                    </span>
                    <span className={`text-xs font-bold ${strengthTextColor}`}>
                        {strengthLabel}
                    </span>
                </div>
                <div className="flex gap-1.5">
                    {Array.from({ length: segments }).map((_, index) => (
                        <div
                            key={index}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${index < filledSegments
                                    ? strengthColor
                                    : "bg-muted"
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Requirements Checklist */}
            {showRequirements && (
                <div className="space-y-1.5 text-xs">
                    <RequirementItem
                        met={password.length >= 12}
                        text="At least 12 characters"
                    />
                    <RequirementItem
                        met={/[a-z]/.test(password)}
                        text="One lowercase letter"
                    />
                    <RequirementItem
                        met={/[A-Z]/.test(password)}
                        text="One uppercase letter"
                    />
                    <RequirementItem
                        met={/\d/.test(password)}
                        text="One number"
                    />
                    <RequirementItem
                        met={/[@$!%*?&]/.test(password)}
                        text="One special character (@$!%*?&)"
                    />
                </div>
            )}

            {/* Overall Status */}
            {meetsRequirements && (
                <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 font-medium">
                    <Check className="w-3.5 h-3.5" />
                    <span>Meets all requirements</span>
                </div>
            )}
        </div>
    );
}

interface RequirementItemProps {
    met: boolean;
    text: string;
}

function RequirementItem({ met, text }: RequirementItemProps) {
    return (
        <div className="flex items-center gap-2">
            {met ? (
                <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
            ) : (
                <X className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            )}
            <span
                className={
                    met
                        ? "text-green-600 dark:text-green-400"
                        : "text-muted-foreground"
                }
            >
                {text}
            </span>
        </div>
    );
}
