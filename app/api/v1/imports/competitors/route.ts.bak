import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const urls = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("http"));

    if (urls.length === 0) {
      return NextResponse.json(
        { error: "No valid URLs found in CSV" },
        { status: 400 },
      );
    }

    // Check limits
    const currentSitesCount = await prisma.site.count({
      where: { tenantId, type: "COMPETITOR" },
    });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    const limit = tenant?.competitorLimit || 5;

    let addedCount = 0;
    let skippedCount = 0;

    for (const url of urls) {
      if (currentSitesCount + addedCount >= limit) {
        skippedCount += urls.length - addedCount - skippedCount;
        break;
      }

      // Basic validation
      try {
        const parsedUrl = new URL(url);

        const existingSite = await prisma.site.findFirst({
          where: {
            tenantId,
            baseUrl: parsedUrl.origin,
            type: "COMPETITOR",
          },
        });

        if (!existingSite) {
          await prisma.site.create({
            data: {
              tenantId,
              baseUrl: parsedUrl.origin,
              type: "COMPETITOR",
              platform: "GENERIC",
            },
          });
          addedCount++;
        } else {
          skippedCount++;
        }
      } catch (e) {
        skippedCount++;
        continue;
      }
    }

    return NextResponse.json({
      success: true,
      added: addedCount,
      skipped: skippedCount,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Failed to process competitor list" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "importExport", handlePOST);
}
