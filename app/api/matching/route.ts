import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";

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
        .filter(m => m.matchType !== "MANUAL") // Only show auto matches for review
        .map((m) => {
          return {
            id: m.id,
            confidence: parseFloat(m.confidenceScore.toString()),
            matchType: m.matchType,
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
              siteName: new URL(m.competitorProduct.site.baseUrl).hostname.replace("www.", ""),
            }
          };
        })
    );

    return NextResponse.json(formattedMatches);
  } catch (error) {
    console.error("Match fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch matches" }, { status: 500 });
  }
}

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { matchId, action } = await req.json();

    if (action === "APPROVE") {
      await prisma.productMatch.update({
        where: { id: matchId },
        data: { matchType: "MANUAL" }
      });
    } else if (action === "REJECT") {
      await prisma.productMatch.delete({
        where: { id: matchId }
      });
    }

    // Create Audit Log
    await (prisma.tenantAuditLog as any).create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        userEmail: session.user.email,
        action: `${action}_MATCH`,
        entityId: matchId,
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
        details: JSON.stringify({ matchId, action })
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, "read", handleGET);
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "write", handlePOST);
}
