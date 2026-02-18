import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { encryptForStorage } from "@/lib/services/encryption/field-encryption";

async function main() {
  if (!process.env.ENCRYPTION_MASTER_KEY) {
    throw new Error(
      "ENCRYPTION_MASTER_KEY is not set. Refusing to create test data that might be stored in plaintext.",
    );
  }

  let tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        companyName: "Encryption Check Tenant",
      },
    });
    console.log(`[create-encryption-test-data] Created tenant ${tenant.id}`);
  } else {
    console.log(`[create-encryption-test-data] Using tenant ${tenant.id}`);
  }

  const webhookUrl = "https://example.com/pricepilot/webhook";
  const webhookSecret = encryptForStorage(
    `pp_test_webhook_secret_${Date.now()}`,
  );

  const webhook = await prisma.webhook.create({
    data: {
      tenantId: tenant.id,
      url: webhookUrl,
      secret: webhookSecret,
      isActive: true,
    },
    select: { id: true, tenantId: true, url: true, createdAt: true },
  });
  console.log(`[create-encryption-test-data] Created webhook ${webhook.id}`);

  const port = 40000 + Math.floor(Math.random() * 20000);
  const proxyPassword = encryptForStorage(`pp_test_proxy_pw_${Date.now()}`);

  const proxy = await prisma.proxy.create({
    data: {
      provider: "test",
      host: "127.0.0.1",
      port,
      protocol: "http",
      username: "test-user",
      passwordEncrypted: proxyPassword,
      region: "test",
      status: "active",
    },
    select: { id: true, host: true, port: true, createdAt: true },
  });
  console.log(`[create-encryption-test-data] Created proxy ${proxy.id} (${proxy.host}:${proxy.port})`);
}

main()
  .catch((err) => {
    console.error("[create-encryption-test-data] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });

