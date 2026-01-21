import { NextRequest } from "next/server";

/**
 * Validates the Origin header for state-changing operations to prevent CSRF.
 * Recommended by OWASP and standard for Next.js API routes.
 */
export function verifyCsrf(req: NextRequest): boolean {
  // Skip CSRF check for safe methods
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) {
    return true;
  }

  // Get requested origin and server's own host
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  const referer = req.headers.get("referer");

  // In some environments, origin might be missing (e.g., non-browser clients)
  // but for browser-based SaaS, it should strictly be present for state-changing requests.
  if (!origin && !referer) {
    // If it's a programmatic API call without these headers, we might allow it
    // depending on the security policy (e.g., if using API tokens).
    // For now, we follow a strict browser-first policy.
    return false;
  }

  try {
    const originUrl = origin ? new URL(origin) : null;
    const refererUrl = referer ? new URL(referer) : null;
    const targetBaseUrl = process.env.NEXTAUTH_URL || `http://${host}`;
    const targetUrl = new URL(targetBaseUrl);

    // Verify origin matches our host
    if (originUrl && originUrl.host !== targetUrl.host) {
      console.warn(
        `[Security] CSRF Blocked: Origin mismatch. Target: ${targetUrl.host}, Got: ${originUrl.host}`,
      );
      return false;
    }

    // Fallback to referer if origin is missing
    if (!originUrl && refererUrl && refererUrl.host !== targetUrl.host) {
      console.warn(
        `[Security] CSRF Blocked: Referer mismatch. Target: ${targetUrl.host}, Got: ${refererUrl.host}`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      "[Security] CSRF Error: Failed to parse origin/referer",
      error,
    );
    return false;
  }
}
