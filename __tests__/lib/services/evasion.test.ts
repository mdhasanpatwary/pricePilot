import { BrowserPool } from "../../../lib/services/browser-pool";
import { ScraperService, ScrapeBlockError } from "../../../lib/services/scraper";

// Mock Redis
jest.mock("@upstash/redis", () => ({
  Redis: { fromEnv: jest.fn().mockReturnValue({ get: jest.fn(), set: jest.fn(), del: jest.fn() }) },
}));

// Mock Global Fetch for pre-flight
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  status: 200,
  headers: { get: () => "text/html" }
} as any);

// Mock Playwright
jest.mock("playwright", () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue({
      newContext: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
          goto: jest.fn().mockResolvedValue({ status: () => 200 }),
          title: jest.fn().mockResolvedValue("Test Page"),
          content: jest.fn().mockResolvedValue("<html><body>Test</body></html>"),
          waitForTimeout: jest.fn().mockResolvedValue({}),
          waitForSelector: jest.fn().mockResolvedValue({}),
          close: jest.fn().mockResolvedValue({}),
          evaluate: jest.fn().mockResolvedValue({}),
          viewportSize: jest.fn().mockReturnValue({ width: 1280, height: 720 }),
          mouse: { move: jest.fn().mockResolvedValue({}), click: jest.fn().mockResolvedValue({}) },
          url: jest.fn().mockReturnValue("https://example.com"),
        }),
        addInitScript: jest.fn().mockResolvedValue({}),
        close: jest.fn().mockResolvedValue({}),
      }),
      close: jest.fn().mockResolvedValue({}),
    }),
  },
}));

// Mock playwright-extra
jest.mock("playwright-extra", () => ({
  chromium: {
    use: jest.fn(),
    launch: jest.fn().mockResolvedValue({
      newContext: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
          goto: jest.fn().mockResolvedValue({ status: () => 200 }),
          title: jest.fn().mockResolvedValue("Test Page"),
          content: jest.fn().mockResolvedValue("<html><body>Test</body></html>"),
          waitForTimeout: jest.fn().mockResolvedValue({}),
          waitForSelector: jest.fn().mockResolvedValue({}),
          close: jest.fn().mockResolvedValue({}),
          evaluate: jest.fn().mockResolvedValue({}),
          viewportSize: jest.fn().mockReturnValue({ width: 1280, height: 720 }),
          mouse: { move: jest.fn().mockResolvedValue({}), click: jest.fn().mockResolvedValue({}) },
          url: jest.fn().mockReturnValue("https://example.com"),
        }),
        addInitScript: jest.fn().mockResolvedValue({}),
        close: jest.fn().mockResolvedValue({}),
      }),
      close: jest.fn().mockResolvedValue({}),
    }),
  },
}));

// Mock stealth plugin
jest.mock("puppeteer-extra-plugin-stealth", () => {
  return jest.fn().mockReturnValue({});
});

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    syncLog: { create: jest.fn().mockResolvedValue({}) },
    site: { findUnique: jest.fn().mockResolvedValue(null) },
  },
}));

const mockPage: any = {
  goto: jest.fn().mockResolvedValue({ status: () => 200 }),
  title: jest.fn().mockResolvedValue("Test Page"),
  content: jest.fn().mockResolvedValue("<html><body>Test</body></html>"),
  waitForTimeout: jest.fn().mockResolvedValue({}),
  waitForSelector: jest.fn().mockResolvedValue({}),
  close: jest.fn().mockResolvedValue({}),
  evaluate: jest.fn().mockResolvedValue({}),
  viewportSize: jest.fn().mockReturnValue({ width: 1280, height: 720 }),
  mouse: { move: jest.fn().mockResolvedValue({}), click: jest.fn().mockResolvedValue({}) },
  url: jest.fn().mockReturnValue("https://example.com"),
};

const mockContext: any = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  addInitScript: jest.fn().mockResolvedValue({}),
  close: jest.fn().mockResolvedValue({}),
};

const mockBrowser: any = {
  newContext: jest.fn().mockResolvedValue(mockContext),
  close: jest.fn().mockResolvedValue({}),
};

describe("Advanced Evasion Features", () => {
  let scraper: ScraperService;

  beforeEach(() => {
    jest.clearAllMocks();
    scraper = new ScraperService();
  });

  it("should attempt to scrape a page and call human simulation", async () => {
    // Mock extraction
    jest.spyOn(ScraperService.prototype as any, 'extractFromJsonLd').mockResolvedValue({ price: 100, title: 'Test' });
    jest.spyOn(ScraperService.prototype as any, 'analyzeSecurity').mockResolvedValue({ isBlocked: false, provider: 'NONE' });

    const result = await scraper.scrapeProductPage("https://example.com/product");

    expect(result).not.toBeNull();
    expect(mockPage.mouse.move).toHaveBeenCalled();
    expect(mockPage.evaluate).toHaveBeenCalled(); // For scrolling
  });

  it("should retry when blocked", async () => {
    const analyzeSpy = jest.spyOn(ScraperService.prototype as any, 'analyzeSecurity');
    analyzeSpy
      .mockResolvedValueOnce({ isBlocked: true, provider: 'CLOUDFLARE' })
      .mockResolvedValueOnce({ isBlocked: false, provider: 'NONE' });

    jest.spyOn(ScraperService.prototype as any, 'extractFromJsonLd').mockResolvedValue({ price: 100, title: 'Test' });

    const result = await scraper.scrapeProductPage("https://example.com/retry");
    expect(analyzeSpy).toHaveBeenCalledTimes(2);
    expect(result).not.toBeNull();
  });
});
