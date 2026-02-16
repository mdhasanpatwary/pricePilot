import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { applyEncryptionMiddleware } from "./database/prisma-encryption-middleware";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build';

const pool = new pg.Pool({
  connectionString,
  max: IS_BUILD ? 1 : 20, // Limit connections during build
  min: IS_BUILD ? 0 : 2,  // No eager connections during build
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 30000,
  allowExitOnIdle: true,
  statement_timeout: 20000,
});

const adapter = new PrismaPg(pool);
const prismaLogLevels: Array<"query" | "warn" | "error"> =
  process.env.NODE_ENV === "production"
    ? ["error"]
    : process.env.PRISMA_LOG_QUERIES === "true"
      ? ["query", "warn", "error"]
      : ["warn", "error"];

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: prismaLogLevels,
    errorFormat: "pretty",
  });

// Apply encryption middleware for automatic API token encryption/decryption
if (!globalForPrisma.prisma) {
  applyEncryptionMiddleware(prisma, {
    enabled: true,
    verbose: process.env.NODE_ENV !== "production",
    throwOnDecryptionError: true,
  });
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
