import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { applyEncryptionMiddleware } from "./database/prisma-encryption-middleware";

const connectionString = `${process.env.DATABASE_URL}`;

const pool = new pg.Pool({
  connectionString,
  max: 20, // Reduced for Neon pooler limits
  min: 2, // Lower minimum for serverless
  idleTimeoutMillis: 60000, // Keep connections alive longer
  connectionTimeoutMillis: 30000, // Increased timeout for Neon cold starts
  allowExitOnIdle: true, // Allow pool to close when idle
  statement_timeout: 20000, // 20s query timeout
});
const adapter = new PrismaPg(pool);

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "production" ? ["error"] : ["query"], // Reduce logging in production
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
