import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import {
  validateBody,
  validationErrorResponse,
  matchApprovalSchema,
} from "@/lib/validation";
import { recordAuditLog, getIpAddress } from "@/lib/audit";

async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    // Fetch all products with their matches
    const products = await prisma.product.findMany({
      where: {
        tenantId,
        site: {
          type: "USER",
        },
      },
      include: {
        site: true,
        matchesAsUser: {
          include: {
            competitorProduct: {
              include: {
                site: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // We define "Pending Approval" as any match that hasn't been manually confirmed.
    // In our simplified logic, since we don't have an 'approved' field in ProductMatch yet,
    // we return all AUTO matches for review.

    const formattedMatches = products.flatMap((product) =>
      product.matchesAsUser
        .filter((m: any) => m.status === "PENDING") // Show only pending review
        .map((m) => {
          let siteName = "Unknown";
          try {
            siteName = m.competitorProduct.site.baseUrl
              ? new URL(m.competitorProduct.site.baseUrl).hostname.replace(
                  "www.",
                  "",
                )
              : "Unknown";
          } catch (e) {}

          return {
            id: m.id,
            confidence: parseFloat(m.confidenceScore.toString()),
            matchType: m.matchType,
            status: (m as any).status,
            product: {
              id: product.id,
              title: product.title,
              sku: product.sku,
              price: parseFloat(product.currentPrice.toString()),
              url: product.url,
              image: (product as any).imageUrl,
              site: product.site.baseUrl,
            },
            competitor: {
              id: m.competitorProduct.id,
              title: m.competitorProduct.title,
              sku: m.competitorProduct.sku,
              price: parseFloat(m.competitorProduct.currentPrice.toString()),
              url: m.competitorProduct.url || m.competitorProduct.site.baseUrl,
              image: (m.competitorProduct as any).imageUrl,
              site: m.competitorProduct.site.baseUrl,
              siteName,
            },
          };
        }),
    );

    return NextResponse.json(formattedMatches);
  } catch (error) {
    console.error("Match fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch matches" },
      { status: 500 },
    );
  }
}

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const validation = await validateBody(req, matchApprovalSchema);
    if (!validation.success) {
      return validationErrorResponse(validation);
    }
    const { matchId, action } = validation.data!;
    console.log(`[MATCHING_POST] Action: ${action} for ID: ${matchId}`);
    console.log(
      `[MATCHING_POST] Session User:`,
      JSON.stringify(session.user, null, 2),
    );

    // Fetch match info for audit log
    const matchInfo = await prisma.productMatch.findUnique({
      where: { id: matchId },
      include: {
        userProduct: { select: { title: true } },
        competitorProduct: { select: { title: true } },
      },
    });

    if (action === "APPROVE") {
      await prisma.productMatch.update({
        where: { id: matchId },
        data: { status: "APPROVED" },
      });
    } else if (action === "REJECT") {
      await prisma.productMatch.update({
        where: { id: matchId },
        data: { status: "REJECTED" },
      });
    }

    // Create Audit Log
    console.log(`[MATCHING_POST] Recording audit log...`);
    const userId = session.user.id || (session.user as any).sub;

    if (!userId) {
      console.error(
        `[MATCHING_POST] CRITICAL: Cannot record audit log because userId is missing from session!`,
        JSON.stringify(session.user, null, 2),
      );
    } else {
      await recordAuditLog({
        tenantId: session.user.tenantId,
        userId: userId,
        userEmail: session.user.email!,
        action: `${action}_MATCH`,
        entityId: matchId,
        ipAddress: getIpAddress(req),
        details: {
          matchId,
          action,
          productTitle: matchInfo?.userProduct?.title,
          competitorTitle: matchInfo?.competitorProduct?.title,
        },
      });
      console.log(`[MATCHING_POST] Audit log sequence finished.`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MATCHING_POST] Error:", error);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, "read", handleGET);
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "write", handlePOST);
}
