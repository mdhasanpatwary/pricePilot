import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/middleware/ratelimit";

async function handleGET() {
  const status = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: "unknown",
    },
  };

  try {
    // Basic database connectivity check
    await prisma.$queryRaw`SELECT 1`;
    status.services.database = "healthy";
  } catch (error) {
    status.status = "degraded";
    status.services.database = "unhealthy";
    console.error("[HealthCheck] Database error:", error);
  }

  return NextResponse.json(status, {
    status: status.status === "healthy" ? 200 : 503,
  });
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, 'read', handleGET);
}
