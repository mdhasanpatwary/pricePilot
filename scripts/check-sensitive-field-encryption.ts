import "dotenv/config";
import { prisma } from "@/lib/prisma";

type CountRow = {
  total: bigint | number;
  null_count: bigint | number;
  encrypted_prefix: bigint | number;
  encrypted_strict: bigint | number;
  plaintext_or_legacy: bigint | number;
};

function asNumber(v: bigint | number): number {
  return typeof v === "bigint" ? Number(v) : v;
}

async function main() {
  const hasKey = Boolean(process.env.ENCRYPTION_MASTER_KEY);
  if (!hasKey) {
    // This script is still useful for auditing existing rows, but new writes should fail without a key.
    console.warn(
      "[check-sensitive-field-encryption] ENCRYPTION_MASTER_KEY is not set in the current process environment.",
    );
  }

  const [webhookCounts] = await prisma.$queryRaw<Array<CountRow>>`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE "secret" IS NULL) AS null_count,
      COUNT(*) FILTER (WHERE "secret" IS NOT NULL AND "secret" LIKE 'aes-256-gcm:%') AS encrypted_prefix,
      COUNT(*) FILTER (WHERE "secret" IS NOT NULL AND "secret" ~ '^aes-256-gcm:[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$') AS encrypted_strict,
      COUNT(*) FILTER (WHERE "secret" IS NOT NULL AND "secret" NOT LIKE 'aes-256-gcm:%') AS plaintext_or_legacy
    FROM "Webhook";
  `;

  const [proxyCounts] = await prisma.$queryRaw<Array<CountRow>>`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE "passwordEncrypted" IS NULL) AS null_count,
      COUNT(*) FILTER (WHERE "passwordEncrypted" IS NOT NULL AND "passwordEncrypted" LIKE 'aes-256-gcm:%') AS encrypted_prefix,
      COUNT(*) FILTER (WHERE "passwordEncrypted" IS NOT NULL AND "passwordEncrypted" ~ '^aes-256-gcm:[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$') AS encrypted_strict,
      COUNT(*) FILTER (WHERE "passwordEncrypted" IS NOT NULL AND "passwordEncrypted" NOT LIKE 'aes-256-gcm:%') AS plaintext_or_legacy
    FROM "Proxy";
  `;

  console.log("\nWebhook.secret at-rest format counts:");
  console.table([
    {
      total: asNumber(webhookCounts.total),
      null: asNumber(webhookCounts.null_count),
      encrypted_prefix: asNumber(webhookCounts.encrypted_prefix),
      encrypted_strict: asNumber(webhookCounts.encrypted_strict),
      plaintext_or_legacy: asNumber(webhookCounts.plaintext_or_legacy),
    },
  ]);

  console.log("\nProxy.passwordEncrypted at-rest format counts:");
  console.table([
    {
      total: asNumber(proxyCounts.total),
      null: asNumber(proxyCounts.null_count),
      encrypted_prefix: asNumber(proxyCounts.encrypted_prefix),
      encrypted_strict: asNumber(proxyCounts.encrypted_strict),
      plaintext_or_legacy: asNumber(proxyCounts.plaintext_or_legacy),
    },
  ]);

  // List IDs only (never print the actual secret/password values).
  const nonEncryptedWebhooks = await prisma.$queryRaw<
    Array<{ id: string; tenantId: string; url: string; updatedAt: Date }>
  >`
    SELECT "id", "tenantId", "url", "updatedAt"
    FROM "Webhook"
    WHERE "secret" IS NOT NULL
      AND "secret" NOT LIKE 'aes-256-gcm:%'
    ORDER BY "updatedAt" DESC
    LIMIT 50;
  `;

  const nonEncryptedProxies = await prisma.$queryRaw<
    Array<{ id: string; provider: string; host: string; port: number; updatedAt: Date }>
  >`
    SELECT "id", "provider", "host", "port", "updatedAt"
    FROM "Proxy"
    WHERE "passwordEncrypted" IS NOT NULL
      AND "passwordEncrypted" NOT LIKE 'aes-256-gcm:%'
    ORDER BY "updatedAt" DESC
    LIMIT 50;
  `;

  if (nonEncryptedWebhooks.length > 0) {
    console.log("\nWebhook rows with non-encrypted secret (IDs only):");
    console.table(
      nonEncryptedWebhooks.map((w) => ({
        id: w.id,
        tenantId: w.tenantId,
        url: w.url,
        updatedAt: w.updatedAt.toISOString(),
      })),
    );
  }

  if (nonEncryptedProxies.length > 0) {
    console.log("\nProxy rows with non-encrypted passwordEncrypted (IDs only):");
    console.table(
      nonEncryptedProxies.map((p) => ({
        id: p.id,
        provider: p.provider,
        host: p.host,
        port: p.port,
        updatedAt: p.updatedAt.toISOString(),
      })),
    );
  }

  const badWebhookCount = asNumber(webhookCounts.plaintext_or_legacy);
  const badProxyCount = asNumber(proxyCounts.plaintext_or_legacy);

  if (badWebhookCount > 0 || badProxyCount > 0) {
    process.exitCode = 2;
  }
}

main()
  .catch((err) => {
    console.error("[check-sensitive-field-encryption] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
