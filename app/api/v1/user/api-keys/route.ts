import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes, createHash } from "crypto";
import { withRateLimit } from "@/lib/middleware/ratelimit";

/**
 * GET /api/v1/user/api-keys
 * List API keys for the current user
 */
async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const apiKeys = await (prisma as any).apiKey.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(apiKeys);
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/user/api-keys
 * Create a new API key
 */
async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, expiresDays } = await req.json();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const rawToken = `pp_${randomBytes(32).toString("hex")}`;
    const prefix = rawToken.substring(0, 11);
    const hashedKey = createHash("sha256").update(rawToken).digest("hex");

    const expiresAt = expiresDays
      ? new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000)
      : null;

    const apiKey = await (prisma as any).apiKey.create({
      data: {
        name,
        key: hashedKey,
        prefix,
        userId: session.user.id,
        tenantId: session.user.tenantId,
        expiresAt,
      },
    });

    // We only return the raw token ONCE
    return NextResponse.json({
      ...apiKey,
      token: rawToken,
    });
  } catch (error) {
    console.error("Error creating API key:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
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
