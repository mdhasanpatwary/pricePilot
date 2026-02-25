import { NextRequest, NextResponse } from "next/server";

import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function handleGET() {
  const session = await getCachedSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  const isAdmin = user.role === "ADMIN" || user.isSuperAdmin === true;
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
  }

  const { TenantConcurrencyLimiter } = await import("@/lib/services/scheduling/tenant-concurrency-limiter");
  const limiter = new TenantConcurrencyLimiter();
  const counters = await limiter.getActiveCounters();
  const tenantIds = counters.map((c) => c.tenantId);

  const tenants = tenantIds.length
    ? await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true },
    })
    : [];

  const tenantNameById = new Map(tenants.map((t) => [t.id, t.companyName]));

  const rows = counters.map((counter) => ({
    tenantId: counter.tenantId,
    tenantName: tenantNameById.get(counter.tenantId) || "Unknown",
    active: counter.active,
    maxPerTenant: limiter.getMaxPerTenant(),
    utilizationPct: Math.round((counter.active / limiter.getMaxPerTenant()) * 100),
  }));

  const totalActive = rows.reduce((sum, row) => sum + row.active, 0);
  const saturatedTenants = rows.filter((row) => row.active >= row.maxPerTenant).length;

  return NextResponse.json({
    success: true,
    data: {
      config: {
        maxPerTenant: limiter.getMaxPerTenant(),
        leaseTtlMs: limiter.getLeaseTtlMs(),
      },
      summary: {
        tenantsWithActiveJobs: rows.length,
        totalActiveJobs: totalActive,
        saturatedTenants,
      },
      tenants: rows,
    },
  });
}

export async function GET(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "read", handleGET);
}

