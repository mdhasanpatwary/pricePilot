import { ScraperService } from "../lib/services/scraper";

async function testTechLand() {
  const scraper = new ScraperService();
  const query = "A4TECH G3-300N";
  const baseUrl = "https://www.techlandbd.com/";
  
  try {
    const fs = require('fs');
    let output = "";
    const log = (msg: string) => {
        output += msg + "\n";
        console.log(msg);
    };

    const context = await (scraper as any).browserPool.acquireContext();
    const page = await context.newPage();
    const queryUrl = `https://www.techlandbd.com/search/advance/product/result/${encodeURIComponent(query).replace(/%20/g, "+")}`;
    log(`Navigating to: ${queryUrl}`);
    const response = await page.goto(queryUrl, { waitUntil: 'domcontentloaded' });
    log(`Status: ${response?.status()}`);
    
    await page.waitForTimeout(10000); 
    
    const title = await page.title();
    log(`Search Result Title: ${title}`);
    
    const productsCount = await page.evaluate(() => {
        return document.querySelectorAll('.product-thumb, .product-layout, .p-item, .product-item').length;
    });
    log(`Products found on page: ${productsCount}`);
    
    const links = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a'));
      return allLinks.slice(0, 50).map(a => ({ href: a.href, text: a.textContent?.trim() }));
    });
    log("Top 50 Links: " + JSON.stringify(links, null, 2));

    const thumbs = await page.evaluate(() => document.querySelectorAll('.product-thumb').length);
    log(`Product thumbs found: ${thumbs}`);

    const result = await scraper.searchAndScrape(baseUrl, query);
    log("Final Result: " + JSON.stringify(result, null, 2));
    fs.writeFileSync('test-output.txt', output);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await scraper.close();
  }
}

testTechLand();
