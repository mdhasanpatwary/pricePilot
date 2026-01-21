import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import {
  validateBody,
  validationErrorResponse,
  createPricingRuleSchema,
  updatePricingRuleSchema,
} from "@/lib/validation";

/**
 * GET /api/rules
 * Fetch all pricing rules for the tenant
 */
async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    const rules = await prisma.pricingRule.findMany({
      where: { tenantId },
      orderBy: { priority: "asc" },
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error("Error fetching rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch rules" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/rules
 * Create a new pricing rule
 */
async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    // Validate and sanitize input
    const validation = await validateBody(req, createPricingRuleSchema);

    if (!validation.success) {
      return validationErrorResponse(validation);
    }

    const { name, strategy, parameter, priority, isActive, description } =
      validation.data!;

    const rule = await prisma.pricingRule.create({
      data: {
        tenantId,
        name,
        strategy,
        parameter,
        priority: priority || 1,
        isActive: isActive !== undefined ? isActive : true,
        description,
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error("Error creating rule:", error);
    return NextResponse.json(
      { error: "Failed to create rule" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/rules
 * Update an existing pricing rule
 */
async function handlePUT(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    // Validate and sanitize input
    const validation = await validateBody(req, updatePricingRuleSchema);

    if (!validation.success) {
      return validationErrorResponse(validation);
    }

    const { id, ...updateData } = validation.data!;

    // Verify ownership
    const existingRule = await prisma.pricingRule.findFirst({
      where: { id, tenantId },
    });

    if (!existingRule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const updatedRule = await prisma.pricingRule.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedRule);
  } catch (error) {
    console.error("Error updating rule:", error);
    return NextResponse.json(
      { error: "Failed to update rule" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/rules
 * Delete a pricing rule
 */
async function handleDELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Rule ID required" }, { status: 400 });
  }

  try {
    // Verify ownership
    const existingRule = await prisma.pricingRule.findFirst({
      where: { id, tenantId },
    });

    if (!existingRule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    await prisma.pricingRule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting rule:", error);
    return NextResponse.json(
      { error: "Failed to delete rule" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, "read", handleGET);
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "write", handlePOST);
}

export async function PUT(req: NextRequest) {
  return withRateLimit(req, "write", handlePUT);
}

export async function DELETE(req: NextRequest) {
  return withRateLimit(req, "write", handleDELETE);
}
