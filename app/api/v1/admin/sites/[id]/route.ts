import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

const updateSiteSchema = z.object({
  searchQueryPattern: z.string().nullable().optional(),
});

async function handlePATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCachedSession();

  if (!session || !session.user.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const result = updateSiteSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.issues },
        { status: 400 }
      );
    }

    const { searchQueryPattern } = result.data;

    const updatedSite = await prisma.site.update({
      where: { id },
      data: {
        searchQueryPattern,
      },
    });

    return NextResponse.json(updatedSite);
  } catch (error) {
    console.error("Failed to update site:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withRequestContextAndRateLimit(req, "write", (req) => handlePATCH(req, context));
}
