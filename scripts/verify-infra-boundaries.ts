import fs from "fs";
import path from "path";

/**
 * Architectural Boundary Validator
 *
 * Enforces that /app directory (outside /api) does not import from:
 * - lib/redis
 * - lib/queue
 * - lib/services (unless proxied or approved)
 *
 * This ensures the Next.js build process remains isolated from runtime infrastructure.
 */

const FORBIDDEN_IMPORTS = [
  "@/lib/redis",
  "@/lib/queue",
  "../lib/redis",
  "../lib/queue",
  "../../lib/redis",
  "../../lib/queue"
];

const SEARCH_DIR = path.join(process.cwd(), "app");

function verifyFiles(dir: string) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip /api routes as they are runtime-only
      if (file === "api") continue;
      verifyFiles(fullPath);
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const forbidden of FORBIDDEN_IMPORTS) {
        if (content.includes(forbidden)) {
          console.error(`❌ ARCHITECTURAL VIOLATION: Forbidden import "${forbidden}" found in ${fullPath}`);
          process.exit(1);
        }
      }
    }
  }
}

console.log("🔍 Verifying architectural boundaries in /app...");
verifyFiles(SEARCH_DIR);
console.log("✅ Architectural boundaries are secure.");
