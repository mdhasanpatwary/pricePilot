import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { RulesEngine } from "@/lib/services/rules-engine";

/**
 * POST /api/pricing/evaluate
 * Evaluate all pricing rules and get recommendations
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;

  try {
    const body = await req.json();
    const { execute } = body;

    // Get recommendations
    const recommendations = await RulesEngine.evaluateAllRules(tenantId);

    if (execute && recommendations.length > 0) {
      // Execute the price changes
      const result = await RulesEngine.executePriceChanges(recommendations);

      return NextResponse.json({
        recommendations,
        executed: true,
        result,
      });
    }

    return NextResponse.json({
      recommendations,
      executed: false,
    });
  } catch (error) {
    console.error("Error evaluating pricing rules:", error);
    return NextResponse.json(
      { error: "Failed to evaluate pricing rules" },
      { status: 500 }
    );
  }
}
