import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
];

export async function GET() {
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

export async function POST(req: Request) {
  try {
    const { key, value } = await req.json();

    const config = await prisma.systemConfig.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });

    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update configuration" },
      { status: 500 },
    );
  }
}
