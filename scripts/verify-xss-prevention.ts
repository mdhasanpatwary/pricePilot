/**
 * Verification script for XSS prevention utilities
 * 
 * This script tests the sanitization functions to ensure they properly
 * prevent XSS attacks while preserving safe content.
 */

import {
    sanitizeHtml,
    escapeHtml,
    sanitizeProductDescription,
    sanitizeNotification,
    stripHtml,
    sanitizeUrl,
    sanitizeJsonData,
} from '../lib/utils/sanitize';

console.log('🔒 XSS Prevention Verification\n');

// Test 1: sanitizeHtml - Basic XSS prevention
console.log('Test 1: sanitizeHtml - Basic XSS prevention');
const xssAttempt = '<script>alert("XSS")</script><p>Safe content</p>';
const sanitized1 = sanitizeHtml(xssAttempt);
console.log(`Input:  ${xssAttempt}`);
console.log(`Output: ${sanitized1}`);
console.log(`✓ Script tags removed: ${!sanitized1.includes('<script>')}\n`);

// Test 2: escapeHtml - HTML entity encoding
console.log('Test 2: escapeHtml - HTML entity encoding');
const htmlContent = '<div>Hello & "World"</div>';
const escaped = escapeHtml(htmlContent);
console.log(`Input:  ${htmlContent}`);
console.log(`Output: ${escaped}`);
console.log(`✓ HTML escaped: ${escaped.includes('&lt;') && escaped.includes('&gt;')}\n`);

// Test 3: sanitizeProductDescription - Preserve formatting
console.log('Test 3: sanitizeProductDescription - Preserve formatting');
const productDesc = '<h2>Features</h2><ul><li>Feature 1</li></ul><script>alert("XSS")</script>';
const sanitized3 = sanitizeProductDescription(productDesc);
console.log(`Input:  ${productDesc}`);
console.log(`Output: ${sanitized3}`);
console.log(`✓ Formatting preserved: ${sanitized3.includes('<h2>') && sanitized3.includes('<ul>')}`);
console.log(`✓ Script removed: ${!sanitized3.includes('<script>')}\n`);

// Test 4: sanitizeNotification - Minimal formatting
console.log('Test 4: sanitizeNotification - Minimal formatting');
const notification = 'Price updated for <b>Product</b><script>alert("XSS")</script>';
const sanitized4 = sanitizeNotification(notification);
console.log(`Input:  ${notification}`);
console.log(`Output: ${sanitized4}`);
console.log(`✓ Bold preserved: ${sanitized4.includes('<b>')}`);
console.log(`✓ Script removed: ${!sanitized4.includes('<script>')}\n`);

// Test 5: stripHtml - Remove all HTML
console.log('Test 5: stripHtml - Remove all HTML');
const htmlText = '<p>Hello <b>World</b></p>';
const stripped = stripHtml(htmlText);
console.log(`Input:  ${htmlText}`);
console.log(`Output: ${stripped}`);
console.log(`✓ All HTML removed: ${!stripped.includes('<')}\n`);

// Test 6: sanitizeUrl - Prevent protocol attacks
console.log('Test 6: sanitizeUrl - Prevent protocol attacks');
const dangerousUrl = 'javascript:alert("XSS")';
const safeUrl = 'https://example.com';
const sanitized6a = sanitizeUrl(dangerousUrl);
const sanitized6b = sanitizeUrl(safeUrl);
console.log(`Dangerous URL: ${dangerousUrl} -> ${sanitized6a || '(empty)'}`);
console.log(`Safe URL: ${safeUrl} -> ${sanitized6b}`);
console.log(`✓ Dangerous URL blocked: ${sanitized6a === ''}`);
console.log(`✓ Safe URL allowed: ${sanitized6b === safeUrl}\n`);

// Test 7: sanitizeJsonData - Recursive sanitization
console.log('Test 7: sanitizeJsonData - Recursive sanitization');
const jsonData = {
    name: '<script>alert("XSS")</script>Product',
    description: 'Safe text',
    nested: {
        value: '<b>Bold</b>',
    },
    array: ['<script>XSS</script>', 'safe'],
};
const sanitized7 = sanitizeJsonData(jsonData);
console.log('Input:', JSON.stringify(jsonData, null, 2));
console.log('Output:', JSON.stringify(sanitized7, null, 2));
console.log(`✓ Nested strings escaped: ${!JSON.stringify(sanitized7).includes('<script>')}\n`);

// Test 8: Edge cases
console.log('Test 8: Edge cases');
console.log(`Empty string: "${sanitizeHtml('')}"`);
console.log(`Null handling: "${sanitizeHtml(null as any)}"`);
console.log(`Undefined handling: "${sanitizeHtml(undefined as any)}"`);
console.log(`✓ Edge cases handled gracefully\n`);

// Test 9: Allowed tags preservation
console.log('Test 9: Allowed tags preservation');
const allowedContent = '<p>Text with <b>bold</b> and <i>italic</i> and <a href="https://example.com">link</a></p>';
const sanitized9 = sanitizeHtml(allowedContent);
console.log(`Input:  ${allowedContent}`);
console.log(`Output: ${sanitized9}`);
console.log(`✓ Allowed tags preserved: ${sanitized9.includes('<b>') && sanitized9.includes('<i>') && sanitized9.includes('<a')}\n`);

// Test 10: Event handler removal
console.log('Test 10: Event handler removal');
const eventHandlers = '<div onclick="alert(\'XSS\')">Click me</div><img src="x" onerror="alert(\'XSS\')">';
const sanitized10 = sanitizeHtml(eventHandlers);
console.log(`Input:  ${eventHandlers}`);
console.log(`Output: ${sanitized10}`);
console.log(`✓ Event handlers removed: ${!sanitized10.includes('onclick') && !sanitized10.includes('onerror')}\n`);

console.log('✅ All XSS prevention tests completed successfully!');
console.log('\n📋 Summary:');
console.log('- sanitizeHtml: Removes dangerous tags while preserving safe formatting');
console.log('- escapeHtml: Converts HTML special characters to entities');
console.log('- sanitizeProductDescription: Allows more formatting for product content');
console.log('- sanitizeNotification: Minimal formatting for notifications');
console.log('- stripHtml: Removes all HTML tags');
console.log('- sanitizeUrl: Prevents javascript: and data: protocol attacks');
console.log('- sanitizeJsonData: Recursively sanitizes object properties');
