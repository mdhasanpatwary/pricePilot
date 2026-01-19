import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    const sites = await prisma.site.findMany({
      where: {
        tenantId,
        type: "COMPETITOR",
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    // Prepare CSV header
    const headers = [
      "ID",
      "Base URL",
      "Platform",
      "Product Count",
      "Last Sync",
      "Created At",
    ];

    const rows = sites.map((s) => [
      s.id,
      s.baseUrl,
      s.platform,
      s._count.products,
      s.lastSyncAt?.toISOString() || "Never",
      s.createdAt.toISOString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="pricepilot-competitors-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export competitors" },
      { status: 500 },
    );
  }
}
