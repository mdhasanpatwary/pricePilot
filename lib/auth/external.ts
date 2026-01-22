import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { validateApiKey } from "./api-key";

/**
 * Authenticates a request using either a session or an x-api-key header.
 */
export async function authenticateExternalRequest(req: NextRequest) {
  // 1. Check for API Key
  const apiKeyToken = req.headers.get("x-api-key");
  if (apiKeyToken) {
    const authRecord = await validateApiKey(apiKeyToken);
    if (authRecord) {
      return {
        user: {
          id: authRecord.user.id,
          email: authRecord.user.email,
          role: authRecord.user.role,
          tenantId: authRecord.tenant.id,
          isSuperAdmin: (authRecord.user as any).isSuperAdmin || false,
        },
        method: "API_KEY" as const,
      };
    }
  }

  // 2. Fallback to session
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return {
      user: session.user,
      method: "SESSION" as const,
    };
  }

  return null;
}
