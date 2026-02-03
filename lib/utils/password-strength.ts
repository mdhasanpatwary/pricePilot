/**
 * Password Strength Utility
 * Requirement 2.7.6: Password strength validation and indicator
 */

export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';

export interface PasswordStrengthResult {
    strength: PasswordStrength;
    score: number; // 0-100
    feedback: string[];
    meetsRequirements: boolean;
}

/**
 * Calculate password strength based on multiple criteria
 */
export function calculatePasswordStrength(password: string): PasswordStrengthResult {
    const feedback: string[] = [];
    let score = 0;

    // Length check (0-30 points)
    if (password.length >= 12) {
        score += 20;
        if (password.length >= 16) score += 5;
        if (password.length >= 20) score += 5;
    } else {
        feedback.push(`Password must be at least 12 characters (currently ${password.length})`);
    }

    // Lowercase letters (0-15 points)
    const hasLowercase = /[a-z]/.test(password);
    if (hasLowercase) {
        score += 10;
        const lowercaseCount = (password.match(/[a-z]/g) || []).length;
        if (lowercaseCount >= 3) score += 5;
    } else {
        feedback.push('Add lowercase letters (a-z)');
    }

    // Uppercase letters (0-15 points)
    const hasUppercase = /[A-Z]/.test(password);
    if (hasUppercase) {
        score += 10;
        const uppercaseCount = (password.match(/[A-Z]/g) || []).length;
        if (uppercaseCount >= 2) score += 5;
    } else {
        feedback.push('Add uppercase letters (A-Z)');
    }

    // Numbers (0-15 points)
    const hasNumber = /\d/.test(password);
    if (hasNumber) {
        score += 10;
        const numberCount = (password.match(/\d/g) || []).length;
        if (numberCount >= 2) score += 5;
    } else {
        feedback.push('Add numbers (0-9)');
    }

    // Special characters (0-15 points)
    const hasSpecial = /[@$!%*?&]/.test(password);
    if (hasSpecial) {
        score += 10;
        const specialCount = (password.match(/[@$!%*?&]/g) || []).length;
        if (specialCount >= 2) score += 5;
    } else {
        feedback.push('Add special characters (@$!%*?&)');
    }

    // Variety bonus (0-10 points)
    const uniqueChars = new Set(password.split('')).size;
    if (uniqueChars >= 10) score += 5;
    if (uniqueChars >= 15) score += 5;

    // Common patterns penalty
    const commonPatterns = [
        /(.)\1{2,}/, // Repeated characters (aaa, 111)
        /^[a-z]+$/i, // Only letters
        /^\d+$/, // Only numbers
        /^(password|admin|user|test|demo)/i, // Common words
        /^(123|abc|qwerty)/i, // Sequential patterns
    ];

    for (const pattern of commonPatterns) {
        if (pattern.test(password)) {
            score = Math.max(0, score - 10);
            feedback.push('Avoid common patterns and repeated characters');
            break;
        }
    }

    // Determine strength level
    let strength: PasswordStrength;
    if (score >= 85) strength = 'very-strong';
    else if (score >= 70) strength = 'strong';
    else if (score >= 50) strength = 'good';
    else if (score >= 30) strength = 'fair';
    else strength = 'weak';

    // Check if meets minimum requirements
    const meetsRequirements =
        password.length >= 12 &&
        hasLowercase &&
        hasUppercase &&
        hasNumber &&
        hasSpecial;

    return {
        strength,
        score,
        feedback,
        meetsRequirements,
    };
}

/**
 * Get color for password strength indicator
 */
export function getStrengthColor(strength: PasswordStrength): string {
    switch (strength) {
        case 'very-strong':
            return 'bg-green-500';
        case 'strong':
            return 'bg-green-400';
        case 'good':
            return 'bg-yellow-500';
        case 'fair':
            return 'bg-orange-500';
        case 'weak':
            return 'bg-red-500';
    }
}

/**
 * Get text color for password strength indicator
 */
export function getStrengthTextColor(strength: PasswordStrength): string {
    switch (strength) {
        case 'very-strong':
            return 'text-green-600 dark:text-green-400';
        case 'strong':
            return 'text-green-600 dark:text-green-400';
        case 'good':
            return 'text-yellow-600 dark:text-yellow-400';
        case 'fair':
            return 'text-orange-600 dark:text-orange-400';
        case 'weak':
            return 'text-red-600 dark:text-red-400';
    }
}

/**
 * Get label for password strength
 */
export function getStrengthLabel(strength: PasswordStrength): string {
    switch (strength) {
        case 'very-strong':
            return 'Very Strong';
        case 'strong':
            return 'Strong';
        case 'good':
            return 'Good';
        case 'fair':
            return 'Fair';
        case 'weak':
            return 'Weak';
    }
}
