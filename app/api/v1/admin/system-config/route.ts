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
  {
    key: "RETENTION_PRICE_HISTORY_DAYS",
    value: "90",
    description: "Number of days to keep price history records.",
    type: "number",
  },
  {
    key: "RETENTION_SYNC_LOG_DAYS",
    value: "14",
    description: "Number of days to keep sync console logs.",
    type: "number",
  },
  {
    key: "RETENTION_AUDIT_LOG_DAYS",
    value: "365",
    description: "Number of days to keep tenant audit logs (GDPR).",
    type: "number",
  },
  {
    key: "RETENTION_NOTIFICATION_DAYS",
    value: "60",
    description: "Number of days to keep user notifications.",
    type: "number",
  },
  {
    key: "RETENTION_BULK_SNAPSHOT_DAYS",
    value: "30",
    description:
      "Number of days to keep bulk operation snapshots for rollback.",
    type: "number",
  },
  {
    key: "NOTIFICATIONS_EMAIL_ENABLED",
    value: "false",
    description: "Enable/Disable global email notifications.",
    type: "boolean",
  },
  {
    key: "SMTP_HOST",
    value: "smtp.example.com",
    description: "SMTP Server Hostname",
    type: "string",
  },
  {
    key: "SMTP_PORT",
    value: "587",
    description: "SMTP Server Port (e.g., 587 for TLS, 465 for SSL)",
    type: "number",
  },
  {
    key: "SMTP_USER",
    value: "user@example.com",
    description: "SMTP Username",
    type: "string",
  },
  {
    key: "SMTP_PASS",
    value: "password",
    description: "SMTP Password",
    type: "string",
  },
  {
    key: "SMTP_FROM",
    value: "PricePilot <noreply@example.com>",
    description: "Sender email address",
    type: "string",
  },
  {
    key: "NOTIFICATIONS_SLACK_ENABLED",
    value: "false",
    description: "Enable/Disable global Slack notifications.",
    type: "boolean",
  },
  {
    key: "SLACK_WEBHOOK_URL",
    value: "",
    description: "Default Slack Webhook URL for global alerts.",
    type: "string",
  },
];

async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Ensure all default configs exist
    for (const def of DEFAULT_CONFIGS) {
      const existing = await prisma.systemConfig.findUnique({
        where: { key: def.key },
      });
      if (!existing) {
        await prisma.systemConfig.create({ data: def });
      }
    }

    const allConfigs = await prisma.systemConfig.findMany({
      orderBy: { key: "asc" },
    });

    return NextResponse.json(allConfigs);
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
