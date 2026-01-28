/**
 * Next.js instrumentation file for application startup hooks
 * This file runs once when the server starts
 */

import { KeyManager } from './lib/services/encryption';

/**
 * Validates critical environment variables on application startup
 * Fails fast if required configuration is missing
 */
function validateEnvironment(): void {
    const errors: string[] = [];

    // Validate encryption key
    try {
        const keyManager = new KeyManager();
        keyManager.validateKey();
        console.log('✓ Encryption key validated successfully');
    } catch (error) {
        if (error instanceof Error) {
            errors.push(`Encryption key validation failed: ${error.message}`);
        }
    }

    // Add other critical environment variable checks here
    const requiredEnvVars = [
        'DATABASE_URL',
        'NEXTAUTH_SECRET',
        'NEXTAUTH_URL',
    ];

    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            errors.push(`Missing required environment variable: ${envVar}`);
        }
    }

    // If any validation errors, fail the application startup
    if (errors.length > 0) {
        console.error('❌ Environment validation failed:');
        errors.forEach(error => console.error(`  - ${error}`));
        console.error('\nApplication cannot start with invalid configuration.');
        process.exit(1);
    }

    console.log('✓ Environment validation completed successfully');
}

/**
 * Register function called when the server starts
 * Only runs in Node.js runtime (not in Edge runtime)
 */
export function register() {
    // Only run validation in Node.js runtime
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        validateEnvironment();
    }
}
