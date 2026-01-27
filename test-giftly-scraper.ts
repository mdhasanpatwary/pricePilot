import { ScraperService } from './lib/services/scraper';

async function testGiftlyScraper() {
  const url = 'https://giftly.com.bd/index.php?route=product/product&product_id=21952';
  
  console.log('Testing scraper for giftly.com.bd...\n');
  console.log(`URL: ${url}\n`);
  
  const scraper = new ScraperService();
  
  try {
    const result = await scraper.scrapeProductPage(url);
    
    if (result) {
      console.log('✅ Scraping successful!\n');
      console.log('Product Data:');
      console.log('-------------');
      console.log(`Title: ${result.title}`);
      console.log(`Price: ${result.price} ${result.currency}`);
      console.log(`Brand: ${result.brand || 'N/A'}`);
      console.log(`Model: ${result.model || 'N/A'}`);
      console.log(`SKU: ${result.sku || 'N/A'}`);
      console.log(`In Stock: ${result.inStock}`);
      console.log(`Image URL: ${result.imageUrl || 'N/A'}`);
      console.log(`URL: ${result.url}`);
      console.log(`\nSpecifications:`, result.specifications || {});
    } else {
      console.log('❌ Scraping failed - no data returned');
    }
  } catch (error) {
    console.error('❌ Error during scraping:', error);
  }
}

testGiftlyScraper();
