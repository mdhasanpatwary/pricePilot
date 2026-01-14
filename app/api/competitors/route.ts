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

    const formattedCompetitors = competitors.map((site) => ({
      id: site.id,
      name: new URL(site.baseUrl).hostname.split('.')[0],
      url: site.baseUrl,
      products: site._count.products,
      status: site.lastSyncAt ? "ACTIVE" : "PENDING",
      health: 100, // Mocking health
    }));

    return NextResponse.json(formattedCompetitors);
  } catch (error) {
    console.error("Error fetching competitors:", error);
    return NextResponse.json({ error: "Failed to fetch competitors" }, { status: 500 });
  }
}
