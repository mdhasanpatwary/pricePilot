#!/usr/bin/env tsx
/**
 * Test API Validation
 *
 * This script tests that API validation is working correctly
 * by sending invalid requests and verifying error responses.
 */

import { z } from 'zod';
import {
    createApiKeySchema,
    maintenanceActionSchema,
    backupConfigSchema,
    alertRuleCreateSchema,
    syncSiteSchema,
    notificationSettingsSchema,
} from '../lib/validation/schemas';

console.log('🧪 Testing API Validation Schemas\n');

let passed = 0;
let failed = 0;

function testSchema(name: string, schema: z.ZodSchema, validData: any, invalidData: any) {
    console.log(`Testing ${name}...`);

    // Test valid data
    try {
        schema.parse(validData);
        console.log(`  ✅ Valid data accepted`);
        passed++;
    } catch (error) {
        console.log(`  ❌ Valid data rejected:`, error);
        failed++;
    }

    // Test invalid data
    try {
        schema.parse(invalidData);
        console.log(`  ❌ Invalid data accepted (should have been rejected)`);
        failed++;
    } catch (error) {
        console.log(`  ✅ Invalid data rejected`);
        passed++;
    }

    console.log('');
}

// Test createApiKeySchema
testSchema(
    'createApiKeySchema',
    createApiKeySchema,
    { name: 'My API Key', expiresDays: 30 },
    { name: '', expiresDays: 400 } // Empty name, invalid expiry
);

// Test maintenanceActionSchema
testSchema(
    'maintenanceActionSchema',
    maintenanceActionSchema,
    { action: 'clear_cache' },
    { action: 'invalid_action' }
);

// Test backupConfigSchema
testSchema(
    'backupConfigSchema',
    backupConfigSchema,
    { googleDriveLink: 'https://drive.google.com/file/123' },
    { googleDriveLink: 'not-a-url' }
);

// Test alertRuleCreateSchema
testSchema(
    'alertRuleCreateSchema',
    alertRuleCreateSchema,
    { metric: 'cpu_usage', condition: 'GREATER_THAN', value: 80 },
    { metric: '', condition: 'INVALID', value: 'not-a-number' }
);

// Test syncSiteSchema
testSchema(
    'syncSiteSchema',
    syncSiteSchema,
    { siteId: '123e4567-e89b-12d3-a456-426614174000' },
    { siteId: 'not-a-uuid' }
);

// Test notificationSettingsSchema
testSchema(
    'notificationSettingsSchema',
    notificationSettingsSchema,
    { slackEnabled: true, slackWebhookUrl: 'https://hooks.slack.com/services/123' },
    { slackEnabled: 'not-a-boolean', slackWebhookUrl: 'not-a-url' }
);

// Summary
console.log('═'.repeat(60));
console.log(`\n📊 Test Summary:`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total: ${passed + failed}`);

if (failed === 0) {
    console.log('\n✅ All validation tests passed!');
    process.exit(0);
} else {
    console.log('\n❌ Some validation tests failed');
    process.exit(1);
}
