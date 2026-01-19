import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { SyncOrchestrator } from "@/lib/services/sync-orchestrator";
import { withRateLimit } from "@/lib/middleware/ratelimit";

async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    const competitors = await prisma.site.findMany({
      where: {
        tenantId,
        type: "COMPETITOR",
      },
      select: {
        id: true,
        tenantId: true,
        type: true,
        platform: true,
        baseUrl: true,
        apiToken: true,
        lastSyncAt: true,
        isSyncing: true,
        syncTotal: true,
        syncProcessed: true,
        syncLastAction: true,
        syncStartedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { products: true },
        },
        syncLogs: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedCompetitors = competitors
      .map((site) => {
        try {
          let name = "Unknown";
          try {
            const urlObj = new URL(
              site.baseUrl.startsWith("http")
                ? site.baseUrl
                : `https://${site.baseUrl}`,
            );
            const hostname = urlObj.hostname;
            const cleanHostname = hostname.replace(/^www\./, "");
            const parts = cleanHostname.split(".");
            const rawName = parts.length > 1 ? parts[0] : cleanHostname;
            name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
          } catch (e) {
            console.error(
              `Invalid baseUrl for site ${site.id}: ${site.baseUrl}`,
            );
          }

          return {
            id: site.id,
            name: name.charAt(0).toUpperCase() + name.slice(1), // Capitalize first letter
            url: site.baseUrl,
            products: site._count.products,
            status: site.isSyncing
              ? "SYNCING"
              : site._count.products > 0
                ? "ACTIVE"
                : site.lastSyncAt
                  ? "NO MATCHES"
                  : "PENDING",
            health: site._count.products > 0 ? 100 : 0,
            isSyncing: site.isSyncing,
            syncTotal: site.syncTotal,
            syncProcessed: site.syncProcessed,
            syncLastAction: site.syncLastAction,
            syncStartedAt: site.syncStartedAt,
            logs: site.syncLogs || [],
          };
        } catch (e) {
          console.error(`Error formatting site ${site.id}:`, e);
          return null;
        }
      })
      .filter(Boolean);

    return NextResponse.json(formattedCompetitors);
  } catch (error) {
    console.error("Error fetching competitors:", error);
    if (error instanceof Error) {
      console.error("Message:", error.message);
      console.error("Stack:", error.stack);
    }
    return NextResponse.json(
      {
        error: "Failed to fetch competitors",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Fetch tenant limits
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Check for existing integration (Dynamic Limit)
    const existingCount = await prisma.site.count({
      where: {
        tenantId,
        type: "COMPETITOR",
      },
    });

    if (existingCount >= tenant.competitorLimit) {
      return NextResponse.json(
        {
          error: `Competitor tracking limit reached (${tenant.competitorLimit}). Please upgrade your plan to track more sites.`,
        },
        { status: 403 },
      );
    }

    const site = await prisma.site.create({
      data: {
        baseUrl: url,
        type: "COMPETITOR",
        tenantId,
        isSyncing: true, // Start as syncing immediately so UI picks it up
        syncLastAction: "Initializing crawler...",
      },
    });

    // Trigger auto-fetch immediately in background (with slight delay for DB propagation)
    setTimeout(() => {
      // Pass true to force sync even though isSyncing is already true
      SyncOrchestrator.syncSite(site.id, true).catch((error) => {
        console.error(
          `[API] Auto-fetch failed for new site ${site.id}:`,
          error,
        );
      });
    }, 500);

    return NextResponse.json(site);
  } catch (error) {
    console.error("Error creating competitor:", error);
    return NextResponse.json(
      { error: "Failed to create competitor" },
      { status: 500 },
    );
  }
}

async function handleDELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  try {
    await prisma.site.delete({
      where: {
        id,
        tenantId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting competitor:", error);
    return NextResponse.json(
      { error: "Failed to delete competitor" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, "read", handleGET);
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "write", handlePOST);
}

export async function DELETE(req: NextRequest) {
  return withRateLimit(req, "write", handleDELETE);
}
