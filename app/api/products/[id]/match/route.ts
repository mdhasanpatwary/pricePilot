import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url } = await req.json();
  const { id: productId } = await params;

  try {
    const origin = new URL(url).origin;

    // 1. Ensure competitor site exists
    let site = await prisma.site.findFirst({
      where: { tenantId: session.user.tenantId, baseUrl: origin, type: 'COMPETITOR' }
    });

    if (!site) {
      site = await prisma.site.create({
        data: {
          tenantId: session.user.tenantId,
          baseUrl: origin,
          type: 'COMPETITOR',
          platform: 'GENERIC'
        }
      });
    }

    // 2. Create/Update Competitor Product
    const existingCompProduct = await prisma.product.findFirst({ where: { siteId: site.id, url } });

    let compProduct;
    if (existingCompProduct) {
        compProduct = existingCompProduct;
    } else {
        compProduct = await prisma.product.create({
            data: {
                tenantId: session.user.tenantId,
                siteId: site.id,
                url,
                title: "Discovered Product",
                currentPrice: 0,
                currency: "USD"
            }
        });
    }

    // 3. Create/Update Match
    const existingMatch = await prisma.productMatch.findFirst({
        where: { userProductId: productId, competitorProductId: compProduct.id }
    });

    if (!existingMatch) {
        await prisma.productMatch.create({
            data: {
                userProductId: productId,
                competitorProductId: compProduct.id,
                matchType: 'MANUAL',
                confidenceScore: 1.0
            }
        });
    } else {
        await prisma.productMatch.update({
            where: { id: existingMatch.id },
            data: {
                matchType: 'MANUAL',
                confidenceScore: 1.0
            }
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
     console.error("Manual matching error:", error);
     return NextResponse.json({ error: "Invalid URL or matching failed" }, { status: 400 });
  }
}
