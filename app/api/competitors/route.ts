import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;

  try {
    const competitors = await prisma.site.findMany({
      where: {
        tenantId,
        type: "COMPETITOR",
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedCompetitors = competitors.map((site) => {
      const hostname = new URL(site.baseUrl).hostname;
      const cleanHostname = hostname.replace(/^www\./, "");
      const name = cleanHostname.split(".")[0];

      return {
        id: site.id,
        name: name.charAt(0).toUpperCase() + name.slice(1), // Capitalize first letter
        url: site.baseUrl,
        products: site._count.products,
        status: site.lastSyncAt ? "ACTIVE" : "PENDING",
        health: 100, // Mocking health
      };
    });

    return NextResponse.json(formattedCompetitors);
  } catch (error) {
    console.error("Error fetching competitors:", error);
    return NextResponse.json({ error: "Failed to fetch competitors" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;

  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Fetch tenant limits
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Check for existing integration (Dynamic Limit)
    const existingCount = await prisma.site.count({
      where: {
        tenantId,
        type: "COMPETITOR"
      }
    });

    if (existingCount >= tenant.competitorLimit) {
      return NextResponse.json(
        { error: `Competitor tracking limit reached (${tenant.competitorLimit}). Please upgrade your plan to track more sites.` },
        { status: 403 }
      );
    }

    const site = await prisma.site.create({
      data: {
        baseUrl: url,
        type: "COMPETITOR",
        tenantId,
      },
    });

    return NextResponse.json(site);
  } catch (error) {
    console.error("Error creating competitor:", error);
    return NextResponse.json({ error: "Failed to create competitor" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;
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
    return NextResponse.json({ error: "Failed to delete competitor" }, { status: 500 });
  }
}
