import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const CONFIG_FILE = path.join(process.cwd(), "scraper-config.json");

interface ScraperConfig {
  proxies: string[];
  userAgents: string[];
  delay: {
    min: number;
    max: number;
  };
  bypasses: {
    headless: boolean;
    useStealthPlugin: boolean;
  };
}

const DEFAULT_CONFIG: ScraperConfig = {
  proxies: [],
  userAgents: [
    // Chrome on Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    // Chrome on Mac
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    // Firefox on Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    // Firefox on Mac
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0",
    // Safari on Mac
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    // Edge on Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0",
  ],
  delay: { min: 1000, max: 5000 },
  bypasses: { headless: true, useStealthPlugin: true },
};

async function readConfig(): Promise<ScraperConfig> {
  try {
    const data = await fs.readFile(CONFIG_FILE, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
  } catch (error) {
    return DEFAULT_CONFIG;
  }
}

async function writeConfig(config: ScraperConfig) {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export async function GET() {
  const config = await readConfig();
  return NextResponse.json(config);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const currentConfig = await readConfig();
    const newConfig = { ...currentConfig, ...body };
    await writeConfig(newConfig);
    return NextResponse.json({ success: true, config: newConfig });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save configuration" },
      { status: 500 }
    );
  }
}
