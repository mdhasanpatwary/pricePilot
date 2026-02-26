import { NextRequest, NextResponse } from "next/server";
import { getCachedSession } from "@/lib/auth/cached-session";

/**
 * Gate for internal diagnostics and debug routes.
 *
 * Requirements:
 * 1. INTERNAL_MODE env var must be 'true'
 * 2. NODE_ENV must NOT be 'production'
 * 3. User must be a Super Admin
 *
 * This ensures that debug endpoints are completely inaccessible in production
 * and even in development require explicit enabling and super admin privileges.
 */
export async function withInternalGate(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const isInternalMode = process.env.INTERNAL_MODE === "true";
  const isProduction = process.env.NODE_ENV === "production";

  // Strict check: No internal routes in production, and only when explicitly enabled
  if (isProduction || !isInternalMode) {
    // Return 404 to make the route appear non-existent
    return new NextResponse(null, { status: 404 });
  }

  // Auth check: Only super admins can access internal tools
  const session = await getCachedSession();
  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return handler(req);
}
