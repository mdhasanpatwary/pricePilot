#!/usr/bin/env ts-node

/**
 * Verification script for API documentation setup
 * 
 * This script verifies that:
 * 1. OpenAPI specification file exists and is valid JSON
 * 2. All required files are in place
 * 3. Documentation is accessible
 */

import fs from 'fs';
import path from 'path';

interface VerificationResult {
    check: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    message: string;
}

const results: VerificationResult[] = [];

function addResult(check: string, status: 'PASS' | 'FAIL' | 'WARN', message: string) {
    results.push({ check, status, message });
}

function printResults() {
    console.log('\n' + '='.repeat(80));
    console.log('API Documentation Verification Results');
    console.log('='.repeat(80) + '\n');

    let passCount = 0;
    let failCount = 0;
    let warnCount = 0;

    results.forEach(result => {
        const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
        console.log(`${icon} ${result.check}`);
        console.log(`   ${result.message}\n`);

        if (result.status === 'PASS') passCount++;
        if (result.status === 'FAIL') failCount++;
        if (result.status === 'WARN') warnCount++;
    });

    console.log('='.repeat(80));
    console.log(`Summary: ${passCount} passed, ${failCount} failed, ${warnCount} warnings`);
    console.log('='.repeat(80) + '\n');

    if (failCount > 0) {
        console.log('❌ Verification FAILED - Please fix the issues above\n');
        process.exit(1);
    } else if (warnCount > 0) {
        console.log('⚠️  Verification PASSED with warnings\n');
        process.exit(0);
    } else {
        console.log('✅ Verification PASSED - API documentation is ready!\n');
        process.exit(0);
    }
}

// Check 1: OpenAPI specification exists
function checkOpenAPISpec() {
    const specPath = path.join(process.cwd(), 'public', 'openapi.json');

    if (!fs.existsSync(specPath)) {
        addResult(
            'OpenAPI Specification File',
            'FAIL',
            `File not found: ${specPath}`
        );
        return;
    }

    try {
        const content = fs.readFileSync(specPath, 'utf-8');
        const spec = JSON.parse(content);

        // Validate basic structure
        if (!spec.openapi) {
            addResult(
                'OpenAPI Specification File',
                'FAIL',
                'Missing "openapi" version field'
            );
            return;
        }

        if (!spec.info) {
            addResult(
                'OpenAPI Specification File',
                'FAIL',
                'Missing "info" section'
            );
            return;
        }

        if (!spec.paths) {
            addResult(
                'OpenAPI Specification File',
                'FAIL',
                'Missing "paths" section'
            );
            return;
        }

        const pathCount = Object.keys(spec.paths).length;
        addResult(
            'OpenAPI Specification File',
            'PASS',
            `Valid OpenAPI ${spec.openapi} spec with ${pathCount} endpoints`
        );

    } catch (error) {
        addResult(
            'OpenAPI Specification File',
            'FAIL',
            `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

// Check 2: Swagger UI HTML file exists
function checkSwaggerUIFile() {
    const htmlPath = path.join(process.cwd(), 'public', 'api-docs.html');

    if (!fs.existsSync(htmlPath)) {
        addResult(
            'Swagger UI HTML File',
            'FAIL',
            `File not found: ${htmlPath}`
        );
        return;
    }

    const content = fs.readFileSync(htmlPath, 'utf-8');

    // Check for required Swagger UI elements
    const requiredElements = [
        'swagger-ui-bundle.js',
        'swagger-ui.css',
        'SwaggerUIBundle',
        'swagger-ui'
    ];

    const missingElements = requiredElements.filter(element => !content.includes(element));

    if (missingElements.length > 0) {
        addResult(
            'Swagger UI HTML File',
            'WARN',
            `Missing elements: ${missingElements.join(', ')}`
        );
    } else {
        addResult(
            'Swagger UI HTML File',
            'PASS',
            'Contains all required Swagger UI elements'
        );
    }
}

// Check 3: Next.js route exists
function checkNextJSRoute() {
    const routePath = path.join(process.cwd(), 'app', 'api', 'docs', 'page.tsx');

    if (!fs.existsSync(routePath)) {
        addResult(
            'Next.js API Docs Route',
            'FAIL',
            `File not found: ${routePath}`
        );
        return;
    }

    addResult(
        'Next.js API Docs Route',
        'PASS',
        'Route file exists at /app/api/docs/page.tsx'
    );
}

// Check 4: Documentation guide exists
function checkDocumentationGuide() {
    const guidePath = path.join(process.cwd(), 'docs', 'API_DOCUMENTATION_SETUP.md');

    if (!fs.existsSync(guidePath)) {
        addResult(
            'Documentation Setup Guide',
            'WARN',
            'Setup guide not found - consider creating one'
        );
        return;
    }

    addResult(
        'Documentation Setup Guide',
        'PASS',
        'Setup guide exists at /docs/API_DOCUMENTATION_SETUP.md'
    );
}

// Check 5: Validate OpenAPI spec structure
function validateOpenAPIStructure() {
    const specPath = path.join(process.cwd(), 'public', 'openapi.json');

    if (!fs.existsSync(specPath)) {
        return; // Already reported in checkOpenAPISpec
    }

    try {
        const content = fs.readFileSync(specPath, 'utf-8');
        const spec = JSON.parse(content);

        const warnings: string[] = [];

        // Check for security schemes
        if (!spec.components?.securitySchemes) {
            warnings.push('No security schemes defined');
        }

        // Check for schemas
        if (!spec.components?.schemas) {
            warnings.push('No data schemas defined');
        }

        // Check for tags
        if (!spec.tags || spec.tags.length === 0) {
            warnings.push('No tags defined for endpoint organization');
        }

        // Check for servers
        if (!spec.servers || spec.servers.length === 0) {
            warnings.push('No servers defined');
        }

        if (warnings.length > 0) {
            addResult(
                'OpenAPI Spec Structure',
                'WARN',
                `Recommendations: ${warnings.join(', ')}`
            );
        } else {
            addResult(
                'OpenAPI Spec Structure',
                'PASS',
                'All recommended sections present'
            );
        }

    } catch (error) {
        // Already reported in checkOpenAPISpec
    }
}

// Check 6: Verify endpoint documentation completeness
function checkEndpointDocumentation() {
    const specPath = path.join(process.cwd(), 'public', 'openapi.json');

    if (!fs.existsSync(specPath)) {
        return; // Already reported
    }

    try {
        const content = fs.readFileSync(specPath, 'utf-8');
        const spec = JSON.parse(content);

        let totalEndpoints = 0;
        let documentedEndpoints = 0;
        let endpointsWithExamples = 0;

        Object.entries(spec.paths || {}).forEach(([_path, methods]: [string, any]) => {
            Object.entries(methods).forEach(([method, endpoint]: [string, any]) => {
                if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
                    totalEndpoints++;

                    if (endpoint.summary && endpoint.description) {
                        documentedEndpoints++;
                    }

                    if (endpoint.requestBody?.content?.['application/json']?.example ||
                        endpoint.responses?.['200']?.content?.['application/json']?.example) {
                        endpointsWithExamples++;
                    }
                }
            });
        });

        const docPercentage = totalEndpoints > 0
            ? Math.round((documentedEndpoints / totalEndpoints) * 100)
            : 0;

        const examplePercentage = totalEndpoints > 0
            ? Math.round((endpointsWithExamples / totalEndpoints) * 100)
            : 0;

        if (docPercentage < 80) {
            addResult(
                'Endpoint Documentation',
                'WARN',
                `${docPercentage}% of endpoints have descriptions (${documentedEndpoints}/${totalEndpoints})`
            );
        } else {
            addResult(
                'Endpoint Documentation',
                'PASS',
                `${docPercentage}% of endpoints documented (${documentedEndpoints}/${totalEndpoints})`
            );
        }

        if (examplePercentage < 50) {
            addResult(
                'Request/Response Examples',
                'WARN',
                `Only ${examplePercentage}% of endpoints have examples (${endpointsWithExamples}/${totalEndpoints})`
            );
        } else {
            addResult(
                'Request/Response Examples',
                'PASS',
                `${examplePercentage}% of endpoints have examples (${endpointsWithExamples}/${totalEndpoints})`
            );
        }

    } catch (error) {
        // Already reported
    }
}

// Run all checks
async function runVerification() {
    console.log('\n🔍 Starting API Documentation Verification...\n');

    checkOpenAPISpec();
    checkSwaggerUIFile();
    checkNextJSRoute();
    checkDocumentationGuide();
    validateOpenAPIStructure();
    checkEndpointDocumentation();

    printResults();
}

// Execute verification
runVerification().catch(error => {
    console.error('❌ Verification failed with error:', error);
    process.exit(1);
});
