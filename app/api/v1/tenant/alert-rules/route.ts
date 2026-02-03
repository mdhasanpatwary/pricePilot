import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import {
  validateBody,
  validationErrorResponse,
  alertRuleCreateSchema,
  alertRuleUpdateSchema,
} from "@/lib/validation";

async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rules = await prisma.alertRule.findMany({
      where: {
        tenantId: session.user.tenantId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error("[ALERT_RULES_GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch alert rules" },
      { status: 500 },
    );
  }
}

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Validate request body
    const validation = await validateBody(req, alertRuleCreateSchema);

    if (!validation.success) {
      return validationErrorResponse(validation);
    }

    const { metric, condition, value, isActive } = validation.data!;

    const rule = await prisma.alertRule.create({
      data: {
        name: `Alert for ${metric}`,
        description: `Alert when ${metric} ${condition} ${value}`,
        type: "PRICE_CHANGE",
        target: "ALL_PRODUCTS",
        targetId: null,
        condition,
        value,
        isActive: isActive !== undefined ? isActive : true,
        tenantId: session.user.tenantId,
      },
    });

    return NextResponse.json(rule);
  } catch (error) {
    console.error("[ALERT_RULES_POST]", error);
    return NextResponse.json(
      { error: "Failed to create alert rule" },
      { status: 500 },
    );
  }
}

async function handlePATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Validate request body
    const validation = await validateBody(req, alertRuleUpdateSchema);

    if (!validation.success) {
      return validationErrorResponse(validation);
    }

    const { id, metric, condition, value, isActive } = validation.data!;

    // Build update data
    const updateData: any = {};
    if (metric !== undefined) {
      updateData.target = metric;
      updateData.name = `Alert for ${metric}`;
    }
    if (condition !== undefined) updateData.condition = condition;
    if (value !== undefined) updateData.value = value;
    if (isActive !== undefined) updateData.isActive = isActive;

    const rule = await prisma.alertRule.update({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
      data: updateData,
    });

    return NextResponse.json(rule);
  } catch (error) {
    console.error("[ALERT_RULES_PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update alert rule" },
      { status: 500 },
    );
  }
}

async function handleDELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  try {
    await prisma.alertRule.delete({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ALERT_RULES_DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete alert rule" },
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

export async function PATCH(req: NextRequest) {
  return withRateLimit(req, "write", handlePATCH);
}

export async function DELETE(req: NextRequest) {
  return withRateLimit(req, "write", handleDELETE);
}
