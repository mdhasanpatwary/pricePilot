import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import axios from "axios";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

export async function POST() {
  const results = {
    database: { status: "pending", message: "" },
    redis: { status: "pending", message: "" },
    internet: { status: "pending", message: "" },
    proxies: { status: "pending", message: "" },
    integrations: { status: "pending", message: "" },
  };

  const start = Date.now();

  try {
    // 1. Database Check - FAST
    try {
      const t0 = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      results.database = {
        status: "healthy",
        message: `Connected (${Date.now() - t0}ms)`,
      };
    } catch (e) {
      console.error("DB Check failed:", e);
      results.database = {
        status: "failed",
        message: e instanceof Error ? e.message : "Connection failed",
      };
    }

    // 2. Redis Check - FAST
    try {
      if (
        process.env.UPSTASH_REDIS_REST_URL &&
        process.env.UPSTASH_REDIS_REST_TOKEN
      ) {
        const t0 = Date.now();
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        await redis.ping();
        results.redis = {
          status: "healthy",
          message: `Connected (${Date.now() - t0}ms)`,
        };
      } else {
        results.redis = {
          status: "warning",
          message: "Not configured (In-memory fallback active)",
        };
      }
    } catch (e) {
      console.error("Redis Check failed:", e);
      results.redis = {
        status: "failed",
        message: e instanceof Error ? e.message : "Connection failed",
      };
    }

    // 3. Internet Connectivity - MEDIUM
    try {
      const t0 = Date.now();
      await axios.get("https://www.google.com", { timeout: 5000 });
      results.internet = {
        status: "healthy",
        message: `Online (${Date.now() - t0}ms)`,
      };
    } catch (e) {
      results.internet = {
        status: "failed",
        message: "No internet access or timeout",
      };
    }

    // 4. Scraper Proxies - INSTANT (Config check only)
    try {
      const proxies = process.env.SCRAPER_PROXIES
        ? process.env.SCRAPER_PROXIES.split(",").filter(Boolean)
        : [];
      if (proxies.length > 0) {
        results.proxies = {
          status: "healthy",
          message: `${proxies.length} proxies configured`,
        };
      } else {
        results.proxies = {
          status: "warning",
          message:
            "No proxies configured! (Direct scraping will block IP quickly)",
        };
      }
    } catch (e) {
      results.proxies = { status: "failed", message: "Config error" };
    }

    // 5. Integrations & Tenant Health - DB Query
    try {
      const tenantCount = await prisma.tenant.count();
      const siteCount = await prisma.site.count({
        where: { type: "USER", apiToken: { not: null } },
      });
      const recentErrors = await prisma.syncLog.count({
        where: {
          level: "ERROR",
          createdAt: { gte: new Date(Date.now() - 3600 * 1000) }, // Last hour
        },
      });

      results.integrations = {
        status: recentErrors > 10 ? "warning" : "healthy",
        message: `${tenantCount} Tenants, ${siteCount} Connected Stores. ${recentErrors} recent errors.`,
      };
    } catch (e) {
      results.integrations = {
        status: "failed",
        message: "Could not query stats",
      };
    }

    return NextResponse.json({
      results,
      duration: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
