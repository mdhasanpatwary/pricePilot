import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import {
  validateBody,
  validationErrorResponse,
  systemConfigSchema,
} from "@/lib/validation";
import { recordAuditLog, getIpAddress } from "@/lib/audit";

// Default configuration values
const DEFAULT_CONFIGS = [
  {
    key: "MATCHING_SIMILARITY_THRESHOLD",
    value: "0.65",
    description: "Threshold for title similarity matching (0.0 to 1.0)",
    type: "number",
  },
  {
    key: "SCRAPER_BATCH_SIZE",
    value: "5",
    description: "Number of products to scrape in parallel per site",
    type: "number",
  },
  {
    key: "SCRAPER_TIMEOUT",
    value: "45000",
    description: "Timeout in milliseconds for scraper requests",
    type: "number",
  },
  {
    key: "SCRAPER_MAX_RETRIES",
    value: "3",
    description: "Maximum number of retries for failed scrapes",
    type: "number",
  },
  {
    key: "SYNC_MASTER_KILL_SWITCH",
    value: "false",
    description: "If true, all automated sync operations are suspended",
    type: "boolean",
  },
  {
    key: "PRICE_ROUNDING_MODE",
    value: "NONE",
    description: "Rounding strategy: NONE, NEAREST_NINE, CEIL, FLOOR",
    type: "string",
  },
  {
    key: "BACKUP_GOOGLE_DRIVE_LINK",
    value: "",
    description:
      "Cloud destination (Google Drive Link) for automated system snapshots.",
    type: "string",
  },
];

async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const configs = await prisma.systemConfig.findMany({
      orderBy: { key: "asc" },
    });

    // If no configs exist, initialize with defaults
    if (configs.length === 0) {
      for (const def of DEFAULT_CONFIGS) {
        await prisma.systemConfig.create({ data: def });
      }
      const newConfigs = await prisma.systemConfig.findMany({
        orderBy: { key: "asc" },
      });
      return NextResponse.json(newConfigs);
    }

    return NextResponse.json(configs);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch configuration" },
      { status: 500 },
    );
  }
}

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const validation = await validateBody(req, systemConfigSchema);

    if (!validation.success) {
      return validationErrorResponse(validation);
    }

    const { key, value } = validation.data!;

    const config = await prisma.systemConfig.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });

    await recordAuditLog({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      userEmail: session.user.email!,
      action: "UPDATE_SYSTEM_CONFIG",
      entityId: key,
      ipAddress: getIpAddress(req),
      details: { key, value },
    });

    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update configuration" },
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
