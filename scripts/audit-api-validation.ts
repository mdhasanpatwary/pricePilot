#!/usr/bin/env tsx
/**
 * Audit API Routes for Input Validation
 *
 * This script checks all API routes to ensure they have proper input validation
 * for POST/PUT/PATCH endpoints.
 *
 * Requirements: 2.7.3 - Apply validation to all API routes
 */

import fs from 'fs';
import { glob } from 'glob';

interface ValidationIssue {
    file: string;
    method: string;
    hasValidation: boolean;
    hasBodyParsing: boolean;
    hasQueryValidation: boolean;
    hasParamsValidation: boolean;
}

async function auditApiRoutes() {
    console.log('🔍 Auditing API routes for input validation...\n');

    const routeFiles = await glob('app/api/v1/**/route.ts');
    const issues: ValidationIssue[] = [];
    let totalRoutes = 0;
    let validatedRoutes = 0;
    let missingValidation = 0;

    for (const file of routeFiles) {
        const content = fs.readFileSync(file, 'utf-8');

        // Check for POST/PUT/PATCH methods
        const hasPOST = /export\s+async\s+function\s+POST/.test(content);
        const hasPUT = /export\s+async\s+function\s+PUT/.test(content);
        const hasPATCH = /export\s+async\s+function\s+PATCH/.test(content);

        if (!hasPOST && !hasPUT && !hasPATCH) {
            continue; // Skip routes without mutation methods
        }

        totalRoutes++;

        const hasValidateBody = /validateBody/.test(content);
        const hasValidateQuery = /validateQuery/.test(content);
        const hasValidateParams = /validateParams/.test(content);
        const hasZodSchema = /\.parse\(|\.safeParse\(/.test(content);
        const hasBodyParsing = /await\s+req\.json\(\)/.test(content);

        const hasValidation = hasValidateBody || hasValidateQuery || hasValidateParams || hasZodSchema;

        if (hasValidation) {
            validatedRoutes++;
        } else {
            missingValidation++;
        }

        issues.push({
            file: file.replace('app/api/v1/', ''),
            method: [hasPOST && 'POST', hasPUT && 'PUT', hasPATCH && 'PATCH'].filter(Boolean).join(', '),
            hasValidation,
            hasBodyParsing,
            hasQueryValidation: hasValidateQuery,
            hasParamsValidation: hasValidateParams,
        });
    }

    // Print summary
    console.log('📊 Validation Audit Summary');
    console.log('═'.repeat(60));
    console.log(`Total routes with mutations: ${totalRoutes}`);
    console.log(`Routes with validation: ${validatedRoutes} (${Math.round(validatedRoutes / totalRoutes * 100)}%)`);
    console.log(`Routes missing validation: ${missingValidation} (${Math.round(missingValidation / totalRoutes * 100)}%)`);
    console.log('');

    // Print routes missing validation
    const missing = issues.filter(i => !i.hasValidation);
    if (missing.length > 0) {
        console.log('⚠️  Routes Missing Validation:');
        console.log('─'.repeat(60));
        missing.forEach(issue => {
            console.log(`❌ ${issue.file}`);
            console.log(`   Methods: ${issue.method}`);
            console.log(`   Has body parsing: ${issue.hasBodyParsing ? 'Yes' : 'No'}`);
            console.log('');
        });
    }

    // Print routes with validation
    const validated = issues.filter(i => i.hasValidation);
    if (validated.length > 0) {
        console.log('✅ Routes With Validation:');
        console.log('─'.repeat(60));
        validated.forEach(issue => {
            console.log(`✓ ${issue.file}`);
            console.log(`   Methods: ${issue.method}`);
            console.log(`   Body: ${issue.hasValidation ? 'Yes' : 'No'}, Query: ${issue.hasQueryValidation ? 'Yes' : 'No'}, Params: ${issue.hasParamsValidation ? 'Yes' : 'No'}`);
            console.log('');
        });
    }

    return {
        totalRoutes,
        validatedRoutes,
        missingValidation,
        issues,
    };
}

// Run audit
auditApiRoutes()
    .then(result => {
        if (result.missingValidation > 0) {
            console.log('\n⚠️  Action Required: Add validation to routes missing it');
            process.exit(1);
        } else {
            console.log('\n✅ All routes have proper validation!');
            process.exit(0);
        }
    })
    .catch(error => {
        console.error('Error during audit:', error);
        process.exit(1);
    });
