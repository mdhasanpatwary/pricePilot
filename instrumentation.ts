export const runtime = 'nodejs';

/**
 * Next.js instrumentation file for application startup hooks
 * This file runs once when the server starts
 */



/**
 * Validates critical environment variables on application startup
 * Fails fast if required configuration is missing
 */
function validateEnvironment(): void {
    const errors: string[] = [];

    // Validate encryption key
    try {
        // We handle this in register now to use dynamic imports
        console.log('✓ Encryption key validation check scheduled');
    } catch (error) {
        // Handled below
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

        // process.exit is only available in Node.js
        if (typeof process !== 'undefined' && typeof process.exit === 'function') {
            process.exit(1);
        }
    }

    console.log('✓ Environment validation completed successfully');
}



/**
 * Register function called when the server starts
 * Only runs in Node.js runtime (not in Edge runtime)
 */
export async function register() {
    // Only run validation in Node.js runtime
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { KeyManager } = await import('./lib/services/encryption');
        const { initializeDistributedCache } = await import('./lib/services/cache-initialization');

        // Validate encryption key separately because it's the only one using dynamic import
        try {
            const keyManager = new KeyManager();
            keyManager.validateKey();
            console.log('✓ Encryption key validated successfully');
        } catch (error) {
            console.error('❌ Encryption key validation failed:', error instanceof Error ? error.message : String(error));
            if (typeof process !== 'undefined' && typeof process.exit === 'function') {
                process.exit(1);
            }
        }

        validateEnvironment();

        // Initialize distributed cache (non-blocking)
        try {
            await initializeDistributedCache();
            console.log('✓ Distributed cache initialized successfully');
        } catch (error) {
            console.warn('⚠️  Distributed cache initialization failed, continuing without it');
            if (error instanceof Error) {
                console.warn(`  Reason: ${error.message}`);
            }
        }
    }
}
