import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
