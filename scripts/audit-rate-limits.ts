#!/usr/bin/env tsx
/**
 * Rate Limit Audit Script
 * 
 * Scans all API route files in app/api/ to check for withRateLimit usage
 * and generates a coverage report with suggestions for appropriate rate limiters.
 * 
 * Requirements: 1.1, 1.8
 * 
 * Usage: tsx scripts/audit-rate-limits.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface RouteInfo {
  file: string;
  methods: string[];
  hasRateLimit: boolean;
  rateLimiterType?: string;
  suggestedLimiter: string;
  category: string;
}

interface AuditReport {
  totalRoutes: number;
  protectedRoutes: number;
  unprotectedRoutes: number;
  coveragePercentage: number;
  routes: RouteInfo[];
  unprotectedByCategory: Record<string, RouteInfo[]>;
}

/**
 * Recursively find all route.ts files in a directory
 */
function findRouteFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and other non-API directories
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          files.push(...findRouteFiles(fullPath, baseDir));
        }
      } else if (entry.name === 'route.ts') {
        files.push(path.relative(baseDir, fullPath));
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  
  return files;
}

/**
 * Extract HTTP methods from a route file
 */
function extractMethods(content: string): string[] {
  const methods: string[] = [];
  const methodRegex = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/g;
  
  let match;
  while ((match = methodRegex.exec(content)) !== null) {
    methods.push(match[1]);
  }
  
  return methods;
}

/**
 * Check if route uses withRateLimit
 */
function hasRateLimit(content: string): boolean {
  return content.includes('withRateLimit');
}

/**
 * Extract rate limiter type if present
 */
function extractRateLimiterType(content: string): string | undefined {
  const rateLimitRegex = /withRateLimit\s*\(\s*req\s*,\s*["'](\w+)["']/;
  const match = content.match(rateLimitRegex);
  return match ? match[1] : undefined;
}

/**
 * Categorize route based on path
 */
function categorizeRoute(filePath: string): string {
  if (filePath.includes('/auth/')) return 'auth';
  if (filePath.includes('/admin/')) return 'admin';
  if (filePath.includes('/debug/')) return 'debug';
  if (filePath.includes('/cron/')) return 'cron';
  if (filePath.includes('/export')) return 'export';
  if (filePath.includes('/import')) return 'import';
  if (filePath.includes('/alert')) return 'alert';
  if (filePath.includes('/analytics/')) return 'analytics';
  if (filePath.includes('/sync')) return 'sync';
  if (filePath.includes('/health')) return 'health';
  return 'general';
}

/**
 * Suggest appropriate rate limiter based on route category and methods
 */
function suggestRateLimiter(category: string, methods: string[], _filePath: string): string {
  // Auth endpoints - strict rate limiting
  if (category === 'auth') {
    return 'auth';
  }
  
  // Debug endpoints - strict rate limiting
  if (category === 'debug') {
    return 'auth';
  }
  
  // Sync operations - very strict
  if (category === 'sync') {
    return 'sync';
  }
  
  // Import/Export - moderate
  if (category === 'export' || category === 'import') {
    return 'importExport';
  }
  
  // Alert endpoints - read limiter
  if (category === 'alert') {
    return 'read';
  }
  
  // Analytics endpoints - read limiter
  if (category === 'analytics') {
    return 'read';
  }
  
  // Cron endpoints - typically no user-based rate limiting (authenticated via API key)
  if (category === 'cron') {
    return 'none (cron job)';
  }
  
  // Health check - typically no rate limiting
  if (category === 'health') {
    return 'none (health check)';
  }
  
  // Admin endpoints - based on method
  if (category === 'admin') {
    if (methods.some(m => ['POST', 'PUT', 'DELETE', 'PATCH'].includes(m))) {
      return 'write';
    }
    return 'read';
  }
  
  // General endpoints - based on method
  if (methods.some(m => ['POST', 'PUT', 'DELETE', 'PATCH'].includes(m))) {
    return 'write';
  }
  
  return 'read';
}

/**
 * Analyze a single route file
 */
function analyzeRoute(filePath: string, baseDir: string): RouteInfo {
  const fullPath = path.join(baseDir, filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  
  const methods = extractMethods(content);
  const hasRL = hasRateLimit(content);
  const rateLimiterType = hasRL ? extractRateLimiterType(content) : undefined;
  const category = categorizeRoute(filePath);
  const suggestedLimiter = suggestRateLimiter(category, methods, filePath);
  
  return {
    file: filePath,
    methods,
    hasRateLimit: hasRL,
    rateLimiterType,
    suggestedLimiter,
    category,
  };
}

/**
 * Generate audit report
 */
function generateReport(routes: RouteInfo[]): AuditReport {
  const totalRoutes = routes.length;
  const protectedRoutes = routes.filter(r => r.hasRateLimit).length;
  const unprotectedRoutes = totalRoutes - protectedRoutes;
  const coveragePercentage = totalRoutes > 0 ? (protectedRoutes / totalRoutes) * 100 : 0;
  
  // Group unprotected routes by category
  const unprotectedByCategory: Record<string, RouteInfo[]> = {};
  routes
    .filter(r => !r.hasRateLimit)
    .forEach(route => {
      if (!unprotectedByCategory[route.category]) {
        unprotectedByCategory[route.category] = [];
      }
      unprotectedByCategory[route.category].push(route);
    });
  
  return {
    totalRoutes,
    protectedRoutes,
    unprotectedRoutes,
    coveragePercentage,
    routes,
    unprotectedByCategory,
  };
}

/**
 * Print report to console
 */
function printReport(report: AuditReport): void {
  console.log('\n='.repeat(80));
  console.log('RATE LIMIT COVERAGE AUDIT REPORT');
  console.log('='.repeat(80));
  console.log();
  
  console.log('SUMMARY:');
  console.log(`  Total API Routes: ${report.totalRoutes}`);
  console.log(`  Protected Routes: ${report.protectedRoutes}`);
  console.log(`  Unprotected Routes: ${report.unprotectedRoutes}`);
  console.log(`  Coverage: ${report.coveragePercentage.toFixed(2)}%`);
  console.log();
  
  if (report.unprotectedRoutes > 0) {
    console.log('UNPROTECTED ROUTES BY CATEGORY:');
    console.log();
    
    for (const [category, routes] of Object.entries(report.unprotectedByCategory)) {
      console.log(`  ${category.toUpperCase()} (${routes.length} routes):`);
      routes.forEach(route => {
        console.log(`    - ${route.file}`);
        console.log(`      Methods: ${route.methods.join(', ')}`);
        console.log(`      Suggested: ${route.suggestedLimiter}`);
        console.log();
      });
    }
  }
  
  console.log('PROTECTED ROUTES:');
  console.log();
  
  const protectedRoutes = report.routes.filter(r => r.hasRateLimit);
  const byLimiterType: Record<string, RouteInfo[]> = {};
  
  protectedRoutes.forEach(route => {
    const type = route.rateLimiterType || 'unknown';
    if (!byLimiterType[type]) {
      byLimiterType[type] = [];
    }
    byLimiterType[type].push(route);
  });
  
  for (const [type, routes] of Object.entries(byLimiterType)) {
    console.log(`  ${type.toUpperCase()} (${routes.length} routes):`);
    routes.forEach(route => {
      console.log(`    - ${route.file} [${route.methods.join(', ')}]`);
    });
    console.log();
  }
  
  console.log('='.repeat(80));
  
  if (report.coveragePercentage === 100) {
    console.log('✅ SUCCESS: All API routes are protected with rate limiting!');
  } else {
    console.log(`⚠️  WARNING: ${report.unprotectedRoutes} routes need rate limiting protection.`);
  }
  
  console.log('='.repeat(80));
  console.log();
}

/**
 * Save report to markdown file
 */
function saveMarkdownReport(report: AuditReport, outputPath: string): void {
  let markdown = '# Rate Limit Coverage Audit Report\n\n';
  markdown += `Generated: ${new Date().toISOString()}\n\n`;
  
  markdown += '## Summary\n\n';
  markdown += `- **Total API Routes**: ${report.totalRoutes}\n`;
  markdown += `- **Protected Routes**: ${report.protectedRoutes}\n`;
  markdown += `- **Unprotected Routes**: ${report.unprotectedRoutes}\n`;
  markdown += `- **Coverage**: ${report.coveragePercentage.toFixed(2)}%\n\n`;
  
  if (report.unprotectedRoutes > 0) {
    markdown += '## Unprotected Routes\n\n';
    
    for (const [category, routes] of Object.entries(report.unprotectedByCategory)) {
      markdown += `### ${category.charAt(0).toUpperCase() + category.slice(1)} (${routes.length} routes)\n\n`;
      
      routes.forEach(route => {
        markdown += `#### \`${route.file}\`\n\n`;
        markdown += `- **Methods**: ${route.methods.join(', ')}\n`;
        markdown += `- **Suggested Limiter**: \`${route.suggestedLimiter}\`\n\n`;
      });
    }
  }
  
  markdown += '## Protected Routes\n\n';
  
  const protectedRoutes = report.routes.filter(r => r.hasRateLimit);
  const byLimiterType: Record<string, RouteInfo[]> = {};
  
  protectedRoutes.forEach(route => {
    const type = route.rateLimiterType || 'unknown';
    if (!byLimiterType[type]) {
      byLimiterType[type] = [];
    }
    byLimiterType[type].push(route);
  });
  
  for (const [type, routes] of Object.entries(byLimiterType)) {
    markdown += `### ${type} (${routes.length} routes)\n\n`;
    routes.forEach(route => {
      markdown += `- \`${route.file}\` [${route.methods.join(', ')}]\n`;
    });
    markdown += '\n';
  }
  
  markdown += '## Status\n\n';
  if (report.coveragePercentage === 100) {
    markdown += '✅ **SUCCESS**: All API routes are protected with rate limiting!\n';
  } else {
    markdown += `⚠️ **WARNING**: ${report.unprotectedRoutes} routes need rate limiting protection.\n`;
  }
  
  fs.writeFileSync(outputPath, markdown, 'utf-8');
  console.log(`\n📄 Markdown report saved to: ${outputPath}\n`);
}

/**
 * Main execution
 */
function main(): void {
  const apiDir = path.join(process.cwd(), 'app', 'api');
  
  console.log('🔍 Scanning API routes...');
  console.log(`   Directory: ${apiDir}`);
  console.log();
  
  const routeFiles = findRouteFiles(apiDir);
  console.log(`   Found ${routeFiles.length} route files`);
  console.log();
  
  const routes = routeFiles.map(file => analyzeRoute(file, apiDir));
  const report = generateReport(routes);
  
  printReport(report);
  
  // Save markdown report
  const outputPath = path.join(process.cwd(), 'rate-limit-audit-report.md');
  saveMarkdownReport(report, outputPath);
  
  // Exit with error code if coverage is not 100%
  if (report.coveragePercentage < 100) {
    process.exit(1);
  }
}

// Run the audit
main();
