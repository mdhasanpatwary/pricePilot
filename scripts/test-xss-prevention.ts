/**
 * XSS Prevention Test Script
 *
 * Tests that XSS prevention is properly applied to user-generated content
 * including product descriptions, titles, and competitor data.
 */

import {
    escapeHtml,
    sanitizeProductDescription,
    sanitizeNotification,
    stripHtml,
    sanitizeUrl,
} from '../lib/utils/sanitize';

import {
    sanitizeProduct,
    sanitizeProducts,
    sanitizeCompetitorProduct,
    sanitizeProductMatch,
} from '../lib/middleware/sanitize-response';

console.log('🧪 Testing XSS Prevention...\n');

// Test 1: Basic HTML escaping
console.log('Test 1: Basic HTML Escaping');
const xssScript = '<script>alert("XSS")</script>';
const escaped = escapeHtml(xssScript);
console.log(`Input: ${xssScript}`);
console.log(`Output: ${escaped}`);
console.log(`✅ Pass: ${!escaped.includes('<script>')}\n`);

// Test 2: Product title sanitization
console.log('Test 2: Product Title Sanitization');
const maliciousTitle = 'Product <script>alert("XSS")</script> Name';
const product = {
    id: '1',
    title: maliciousTitle,
    description: '<p>Safe description</p><script>alert("XSS")</script>',
    sku: 'TEST-001',
    url: 'javascript:alert("XSS")',
    imageUrl: 'https://example.com/image.jpg',
};

const sanitizedProduct = sanitizeProduct(product);
console.log(`Input title: ${product.title}`);
console.log(`Output title: ${sanitizedProduct.title}`);
console.log(`✅ Pass: ${!sanitizedProduct.title.includes('<script>')}`);
console.log(`Input URL: ${product.url}`);
console.log(`Output URL: ${sanitizedProduct.url}`);
console.log(`✅ Pass: ${sanitizedProduct.url === ''}\n`);

// Test 3: Product description sanitization
console.log('Test 3: Product Description Sanitization');
const maliciousDescription = '<p>Safe content</p><script>alert("XSS")</script><img src=x onerror=alert("XSS")>';
const sanitizedDesc = sanitizeProductDescription(maliciousDescription);
console.log(`Input: ${maliciousDescription}`);
console.log(`Output: ${sanitizedDesc}`);
console.log(`✅ Pass: ${!sanitizedDesc.includes('<script>') && !sanitizedDesc.includes('onerror')}\n`);

// Test 4: Notification sanitization
console.log('Test 4: Notification Sanitization');
const maliciousNotification = 'Price updated for <b>Product</b><script>alert("XSS")</script>';
const sanitizedNotif = sanitizeNotification(maliciousNotification);
console.log(`Input: ${maliciousNotification}`);
console.log(`Output: ${sanitizedNotif}`);
console.log(`✅ Pass: ${!sanitizedNotif.includes('<script>') && sanitizedNotif.includes('<b>')}\n`);

// Test 5: URL sanitization
console.log('Test 5: URL Sanitization');
const dangerousUrls = [
    'javascript:alert("XSS")',
    'data:text/html,<script>alert("XSS")</script>',
    'vbscript:msgbox("XSS")',
    'https://example.com/safe',
    '/relative/path',
];

dangerousUrls.forEach((url) => {
    const sanitized = sanitizeUrl(url);
    const isSafe = url.startsWith('https://') || url.startsWith('/');
    console.log(`Input: ${url}`);
    console.log(`Output: ${sanitized}`);
    console.log(`✅ Pass: ${isSafe ? sanitized === url : sanitized === ''}`);
});
console.log();

// Test 6: Competitor product sanitization
console.log('Test 6: Competitor Product Sanitization');
const competitorProduct = {
    id: '2',
    title: 'Competitor <img src=x onerror=alert("XSS")> Product',
    sku: 'COMP-001',
    url: 'https://competitor.com/product',
    siteName: 'Competitor <script>alert("XSS")</script> Site',
    siteUrl: 'javascript:alert("XSS")',
    currentPrice: 99.99,
};

const sanitizedCompetitor = sanitizeCompetitorProduct(competitorProduct);
console.log(`Input title: ${competitorProduct.title}`);
console.log(`Output title: ${sanitizedCompetitor.title}`);
// Check that dangerous HTML is escaped (contains &lt; instead of <)
console.log(`✅ Pass: ${sanitizedCompetitor.title.includes('&lt;img') || !sanitizedCompetitor.title.includes('<img')}`);
console.log(`Input siteName: ${competitorProduct.siteName}`);
console.log(`Output siteName: ${sanitizedCompetitor.siteName}`);
console.log(`✅ Pass: ${sanitizedCompetitor.siteName.includes('&lt;script') || !sanitizedCompetitor.siteName.includes('<script>')}`);
console.log(`Input siteUrl: ${competitorProduct.siteUrl}`);
console.log(`Output siteUrl: ${sanitizedCompetitor.siteUrl}`);
console.log(`✅ Pass: ${sanitizedCompetitor.siteUrl === ''}\n`);

// Test 7: Product match sanitization
console.log('Test 7: Product Match Sanitization');
const productMatch = {
    id: '3',
    userProduct: {
        id: '1',
        title: 'User <script>alert("XSS")</script> Product',
        sku: 'USER-001',
        url: 'https://mystore.com/product',
    },
    competitorProduct: {
        id: '2',
        title: 'Competitor <img src=x onerror=alert("XSS")> Product',
        sku: 'COMP-001',
        url: 'javascript:alert("XSS")',
    },
    confidenceScore: 0.95,
    matchType: 'SKU',
};

const sanitizedMatch = sanitizeProductMatch(productMatch);
console.log(`Input user product title: ${productMatch.userProduct.title}`);
console.log(`Output user product title: ${sanitizedMatch.userProduct.title}`);
console.log(`✅ Pass: ${sanitizedMatch.userProduct.title.includes('&lt;script') || !sanitizedMatch.userProduct.title.includes('<script>')}`);
console.log(`Input competitor product title: ${productMatch.competitorProduct.title}`);
console.log(`Output competitor product title: ${sanitizedMatch.competitorProduct.title}`);
console.log(`✅ Pass: ${sanitizedMatch.competitorProduct.title.includes('&lt;img') || !sanitizedMatch.competitorProduct.title.includes('<img')}`);
console.log(`Input competitor URL: ${productMatch.competitorProduct.url}`);
console.log(`Output competitor URL: ${sanitizedMatch.competitorProduct.url}`);
console.log(`✅ Pass: ${sanitizedMatch.competitorProduct.url === ''}\n`);

// Test 8: Array sanitization
console.log('Test 8: Array Sanitization');
const products = [
    {
        id: '1',
        title: 'Product <script>alert(1)</script> 1',
        sku: 'P1',
    },
    {
        id: '2',
        title: 'Product <img src=x onerror=alert(2)> 2',
        sku: 'P2',
    },
];

const sanitizedProducts = sanitizeProducts(products);
console.log(`Input count: ${products.length}`);
console.log(`Output count: ${sanitizedProducts.length}`);
console.log(`✅ Pass: ${sanitizedProducts.length === products.length}`);
console.log(`✅ Pass: ${sanitizedProducts[0].title.includes('&lt;script') || !sanitizedProducts[0].title.includes('<script>')}`);
console.log(`✅ Pass: ${sanitizedProducts[1].title.includes('&lt;img') || !sanitizedProducts[1].title.includes('<img')}\n`);

// Test 9: HTML stripping
console.log('Test 9: HTML Stripping');
const htmlContent = '<p>Hello <b>World</b></p><script>alert("XSS")</script>';
const stripped = stripHtml(htmlContent);
console.log(`Input: ${htmlContent}`);
console.log(`Output: ${stripped}`);
console.log(`✅ Pass: ${stripped === 'Hello World'}\n`);

// Test 10: Allowed HTML tags in product descriptions
console.log('Test 10: Allowed HTML Tags in Product Descriptions');
const richDescription = '<h2>Features</h2><ul><li>Feature 1</li><li>Feature 2</li></ul><script>alert("XSS")</script>';
const sanitizedRichDesc = sanitizeProductDescription(richDescription);
console.log(`Input: ${richDescription}`);
console.log(`Output: ${sanitizedRichDesc}`);
console.log(`✅ Pass: ${sanitizedRichDesc.includes('<h2>') && sanitizedRichDesc.includes('<ul>') && !sanitizedRichDesc.includes('<script>')}\n`);

console.log('✅ All XSS Prevention Tests Completed!');
console.log('\n📋 Summary:');
console.log('- Product titles are escaped');
console.log('- Product descriptions are sanitized with allowed tags');
console.log('- Competitor data is sanitized');
console.log('- URLs are validated and dangerous protocols removed');
console.log('- Notifications are sanitized with minimal formatting');
console.log('- Arrays of products are properly sanitized');
console.log('- HTML can be stripped completely when needed');
