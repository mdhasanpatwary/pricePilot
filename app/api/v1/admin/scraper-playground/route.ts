import { NextRequest, NextResponse } from "next/server";
import { ScraperService } from "@/lib/services/scraper";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import {
  validateBody,
  validationErrorResponse,
  scraperPlaygroundSchema,
} from "@/lib/validation";

async function handlePOST(req: NextRequest) {
  try {
    // Validate input
    const validation = await validateBody(req, scraperPlaygroundSchema);
    if (!validation.success) {
      return validationErrorResponse(validation);
    }

    const { url } = validation.data!;

    const scraper = new ScraperService();
    // Use scrapeProductPage which is designed for direct URL scraping
    const result = await scraper.scrapeProductPage(url);

    await scraper.close();

    if (!result) {
      return NextResponse.json(
        { error: "Failed to scrape product. The scraper returned null." },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Scraper Playground Error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, 'write', handlePOST);
}
