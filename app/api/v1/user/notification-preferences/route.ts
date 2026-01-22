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

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailNotifications: true },
    });

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
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
    const { emailNotifications } = await req.json();

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { emailNotifications },
      select: { emailNotifications: true },
    });

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, "read", handleGET);
}

export async function PATCH(req: NextRequest) {
  return withRateLimit(req, "write", handlePATCH);
}
