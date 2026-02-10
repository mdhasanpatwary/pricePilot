/**
 * Instrumented Prisma Client
 * 
 * Prisma client with performance tracking enabled.
 * Use this client to measure query execution times across your application.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { createInstrumentedPrismaClient } from './middleware/query-performance-tracker';
import { applyEncryptionMiddleware } from './database/prisma-encryption-middleware';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.error('Please ensure your .env file exists and contains DATABASE_URL');
    throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new pg.Pool({
    connectionString,
    max: 20,
    min: 2,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 30000,
    allowExitOnIdle: true,
    statement_timeout: 20000,
});

const adapter = new PrismaPg(pool);

const globalForInstrumentedPrisma = global as unknown as {
    instrumentedPrisma: ReturnType<typeof createInstrumentedPrismaClient>
};

// Create base Prisma client
const basePrisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query'],
    errorFormat: 'pretty',
});

// Apply encryption middleware
applyEncryptionMiddleware(basePrisma, {
    enabled: true,
    verbose: process.env.NODE_ENV !== 'production',
    throwOnDecryptionError: true,
});

// Create instrumented client with performance tracking
export const instrumentedPrisma =
    globalForInstrumentedPrisma.instrumentedPrisma ||
    createInstrumentedPrismaClient(basePrisma);

if (process.env.NODE_ENV !== 'production') {
    globalForInstrumentedPrisma.instrumentedPrisma = instrumentedPrisma;
}
