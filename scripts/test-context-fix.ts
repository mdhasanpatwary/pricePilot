/**
 * Test script to verify browser context lifecycle fixes
 * This simulates parallel scraping operations to ensure no race conditions
 */

import { ScraperService } from '../lib/services/scraper';
import { logger } from '../lib/logger';

async function testParallelScraping() {
  const scraper = new ScraperService();
  
  try {
    await scraper.init();
    logger.info('[Test] Scraper initialized');
    
    // Test URLs - using a mix of search and direct scraping
    const testOperations = [
      { type: 'search', baseUrl: 'https://www.techlandbd.com', query: 'D-Link Router' },
      { type: 'search', baseUrl: 'https://www.techlandbd.com', query: 'TP-Link Switch' },
      { type: 'search', baseUrl: 'https://www.techlandbd.com', query: 'Asus Laptop' },
      { type: 'search', baseUrl: 'https://www.techlandbd.com', query: 'Samsung Monitor' },
      { type: 'search', baseUrl: 'https://www.techlandbd.com', query: 'Logitech Mouse' },
    ];
    
    logger.info(`[Test] Starting ${testOperations.length} parallel operations...`);
    
    // Run all operations in parallel
    const results = await Promise.allSettled(
      testOperations.map(async (op, index) => {
        logger.info(`[Test] Operation ${index + 1}: ${op.type} - ${op.query}`);
        
        if (op.type === 'search') {
          return await scraper.searchAndScrape(op.baseUrl, op.query);
        }
        
        return null;
      })
    );
    
    // Analyze results
    let successful = 0;
    let failed = 0;
    let errors: string[] = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value) {
          successful++;
          logger.info(`[Test] ✅ Operation ${index + 1} succeeded: ${result.value.title}`);
        } else {
          failed++;
          logger.warn(`[Test] ⚠️ Operation ${index + 1} returned null (no results)`);
        }
      } else {
        failed++;
        const error = result.reason?.message || 'Unknown error';
        errors.push(`Operation ${index + 1}: ${error}`);
        logger.error(`[Test] ❌ Operation ${index + 1} failed: ${error}`);
      }
    });
    
    // Check for context-related errors
    const contextErrors = errors.filter(e => 
      e.includes('context') || 
      e.includes('browser has been closed') ||
      e.includes('Target page')
    );
    
    logger.info('\n[Test] === RESULTS ===');
    logger.info(`[Test] Total operations: ${testOperations.length}`);
    logger.info(`[Test] Successful: ${successful}`);
    logger.info(`[Test] Failed: ${failed}`);
    logger.info(`[Test] Context errors: ${contextErrors.length}`);
    
    if (contextErrors.length > 0) {
      logger.error('[Test] ❌ CONTEXT ERRORS DETECTED:');
      contextErrors.forEach(err => logger.error(`  - ${err}`));
    } else {
      logger.info('[Test] ✅ No context-related errors!');
    }
    
    // Get pool stats
    const poolStats = scraper.getPoolStats();
    logger.info(`[Test] Browser pool stats: ${JSON.stringify(poolStats)}`);
    
    // Cleanup
    await scraper.close();
    logger.info('[Test] Scraper closed');
    
    // Exit with appropriate code
    process.exit(contextErrors.length > 0 ? 1 : 0);
    
  } catch (error) {
    logger.error('[Test] Fatal error:', { error });
    await scraper.close();
    process.exit(1);
  }
}

// Run the test
testParallelScraping();
