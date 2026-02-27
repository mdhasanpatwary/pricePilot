/**
 * Environment Separation & Production Safety Guards
 *
 * Enforces strict separation between development and production environments.
 * Phase 7 Security Hardening
 */

/**
 * Check if running in production environment
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development environment
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Ensure code only runs in development (fail hard in production)
 *
 * @param context - Context for error message
 * @throws Error if called in production
 *
 * @example
 * ```typescript
 * ensureDevelopmentOnly('Debug endpoint');
 * // Throws in production with message: "Debug endpoint not available in production"
 * ```
 */
export function ensureDevelopmentOnly(context: string): void {
  if (isProduction()) {
    throw new Error(`${context} not available in production`);
  }
}

/**
 * Ensure code only runs in production (fail hard in development)
 *
 * Useful for enforcing access patterns that must run in prod only
 */
export function ensureProductionOnly(context: string): void {
  if (!isProduction()) {
    throw new Error(`${context} can only run in production`);
  }
}

/**
 * Cast value to type only in development (T in dev, never in prod)
 *
 * Helps prevent development-only code from being used in production
 */
export function devOnly<T>(value: T): T | never {
  if (isProduction()) {
    throw new Error('Development-only code path executed in production');
  }
  return value;
}

/**
 * Gate internal mode globally and check production constraint
 *
 * @throws Error if INTERNAL_MODE=true is detected in production
 */
export function validateInternalModeForProduction(): void {
  const internalMode = process.env.INTERNAL_MODE === 'true';
  
  if (isProduction() && internalMode) {
    throw new Error(
      'INTERNAL_MODE=true detected in production environment. ' +
      'This is a critical configuration error and must be fixed immediately. ' +
      'Set INTERNAL_MODE=false in production.'
    );
  }
}

/**
 * Environment safety check to run at application startup
 *
 * Verifies that dangerous settings are not enabled in production
 */
export function performEnvironmentSafetyChecks(): void {
  if (!isProduction()) {
    return; // Skip checks in development
  }
  
  // Check INTERNAL_MODE is disabled in production
  validateInternalModeForProduction();
  
  // Check for debug flags that should never be true in production
  if (process.env.DEBUG === 'true' || process.env.DEBUG === '1') {
    throw new Error('DEBUG mode enabled in production');
  }
  
  if (process.env.VERBOSE === 'true' || process.env.VERBOSE === '1') {
    console.warn('[Security] VERBOSE mode enabled in production');
  }
  
  // Log that checks passed
  console.log('[Security] Environment safety checks passed');
}

/**
 * Type-safe environment variable reader with production defaults
 *
 * @example
 * ```typescript
 * // Returns empty string in production, actual value in development
 * const debugKey = getEnvForEnvironment('DEBUG_API_KEY', '');
 * ```
 */
export function getEnvForEnvironment(
  key: string,
  productionDefault?: string,
  developmentDefault?: string
): string {
  if (isProduction()) {
    return process.env[key] || productionDefault || '';
  }
  
  return process.env[key] || developmentDefault || '';
}
