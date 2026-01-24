import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import { z } from "zod";

const updateSiteSchema = z.object({
  searchQueryPattern: z.string().nullable().optional(),
});

async function handlePATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

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
  return withRateLimit(req, "write", (req) => handlePATCH(req, context));
}
