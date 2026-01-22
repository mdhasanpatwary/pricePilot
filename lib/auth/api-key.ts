import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

/**
 * Validates an API key and returns the associated user and tenant.
 * Format: pp_abcdef12...
 */
export async function validateApiKey(token: string) {
  if (!token || !token.startsWith("pp_")) {
    return null;
  }

  try {
    const hashedKey = createHash("sha256").update(token).digest("hex");

    const apiKey = await (prisma as any).apiKey.findUnique({
      where: { key: hashedKey },
      include: {
        user: true,
        tenant: true,
      },
    });

    if (!apiKey || !apiKey.isActive) {
      return null;
    }

    // Check expiration
    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      await (prisma as any).apiKey.update({
        where: { id: apiKey.id },
        data: { isActive: false },
      });
      return null;
    }

    // Update last used
    await (prisma as any).apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      user: apiKey.user,
      tenant: apiKey.tenant,
    };
  } catch (error) {
    console.error("API Key validation error:", error);
    return null;
  }
}
