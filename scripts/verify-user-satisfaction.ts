/**
 * User Satisfaction System Verification Script
 * 
 * Verifies that the user satisfaction tracking system is properly configured
 */

import { prisma } from '@/lib/prisma';
import { UserSatisfactionService } from '@/lib/services/user-satisfaction';

async function verifyUserSatisfactionSystem() {
    console.log('🔍 Verifying User Satisfaction System...\n');

    const results = {
        passed: 0,
        failed: 0,
        warnings: 0,
    };

    // Test 1: Database Schema
    console.log('1️⃣ Checking database schema...');
    try {
        // Check if UserFeedback table exists
        const feedbackCount = await prisma.userFeedback.count();
        console.log(`   ✅ UserFeedback table exists (${feedbackCount} records)`);
        results.passed++;

        // Check if SatisfactionMetric table exists
        const metricCount = await prisma.satisfactionMetric.count();
        console.log(`   ✅ SatisfactionMetric table exists (${metricCount} records)`);
        results.passed++;

        // Check if UserFeedbackHistory table exists
        const historyCount = await prisma.userFeedbackHistory.count();
        console.log(`   ✅ UserFeedbackHistory table exists (${historyCount} records)`);
        results.passed++;

        // Check if FeedbackPrompt table exists
        const promptCount = await prisma.feedbackPrompt.count();
        console.log(`   ✅ FeedbackPrompt table exists (${promptCount} records)`);
        results.passed++;
    } catch (error) {
        console.log(`   ❌ Database schema check failed: ${error}`);
        results.failed++;
    }

    // Test 2: Service Layer
    console.log('\n2️⃣ Checking service layer...');
    try {
        // Test getSatisfactionScore
        const score = await UserSatisfactionService.getSatisfactionScore();
        console.log(`   ✅ getSatisfactionScore() works`);
        console.log(`      Average Rating: ${score.averageRating}`);
        console.log(`      Total Responses: ${score.totalResponses}`);
        console.log(`      NPS: ${score.nps}`);
        results.passed++;

        // Test getFeedbackByCategory
        const categoryBreakdown = await UserSatisfactionService.getFeedbackByCategory();
        console.log(`   ✅ getFeedbackByCategory() works (${Object.keys(categoryBreakdown).length} categories)`);
        results.passed++;

        // Test getSatisfactionTrend
        const trend = await UserSatisfactionService.getSatisfactionTrend(undefined, 30);
        console.log(`   ✅ getSatisfactionTrend() works (${trend.length} data points)`);
        results.passed++;

        // Test getRecentFeedback
        const recentFeedback = await UserSatisfactionService.getRecentFeedback(undefined, 10);
        console.log(`   ✅ getRecentFeedback() works (${recentFeedback.length} items)`);
        results.passed++;
    } catch (error) {
        console.log(`   ❌ Service layer check failed: ${error}`);
        results.failed++;
    }

    // Test 3: API Endpoints
    console.log('\n3️⃣ Checking API endpoints...');
    const endpoints = [
        '/api/v1/feedback/submit',
        '/api/v1/feedback/score',
        '/api/v1/feedback/trend',
        '/api/v1/feedback/recent',
        '/api/v1/feedback/by-category',
        '/api/v1/feedback/should-prompt',
    ];

    for (const endpoint of endpoints) {
        try {
            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(process.cwd(), 'app', endpoint.replace('/api/v1/', ''), 'route.ts');

            if (fs.existsSync(filePath)) {
                console.log(`   ✅ ${endpoint} exists`);
                results.passed++;
            } else {
                console.log(`   ❌ ${endpoint} not found`);
                results.failed++;
            }
        } catch (error) {
            console.log(`   ❌ Error checking ${endpoint}: ${error}`);
            results.failed++;
        }
    }

    // Test 4: UI Components
    console.log('\n4️⃣ Checking UI components...');
    const components = [
        'components/feedback-widget.tsx',
        'components/admin/satisfaction-dashboard.tsx',
        'app/admin/satisfaction/page.tsx',
    ];

    for (const component of components) {
        try {
            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(process.cwd(), component);

            if (fs.existsSync(filePath)) {
                console.log(`   ✅ ${component} exists`);
                results.passed++;
            } else {
                console.log(`   ❌ ${component} not found`);
                results.failed++;
            }
        } catch (error) {
            console.log(`   ❌ Error checking ${component}: ${error}`);
            results.failed++;
        }
    }

    // Test 5: Documentation
    console.log('\n5️⃣ Checking documentation...');
    const docs = [
        'docs/USER_SATISFACTION_GUIDE.md',
        'docs/FEEDBACK_QUICK_REFERENCE.md',
        'USER_SATISFACTION_IMPLEMENTATION_COMPLETE.md',
    ];

    for (const doc of docs) {
        try {
            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(process.cwd(), doc);

            if (fs.existsSync(filePath)) {
                console.log(`   ✅ ${doc} exists`);
                results.passed++;
            } else {
                console.log(`   ❌ ${doc} not found`);
                results.failed++;
            }
        } catch (error) {
            console.log(`   ❌ Error checking ${doc}: ${error}`);
            results.failed++;
        }
    }

    // Test 6: Satisfaction Score Target
    console.log('\n6️⃣ Checking satisfaction score target...');
    try {
        const score = await UserSatisfactionService.getSatisfactionScore();

        if (score.totalResponses === 0) {
            console.log(`   ⚠️  No feedback data yet - system ready to collect`);
            results.warnings++;
        } else if (score.averageRating >= 4.5) {
            console.log(`   ✅ Target achieved! Average rating: ${score.averageRating}/5.0`);
            results.passed++;
        } else {
            console.log(`   ⚠️  Current rating: ${score.averageRating}/5.0 (Target: 4.5/5.0)`);
            console.log(`      Gap: ${(4.5 - score.averageRating).toFixed(2)} points`);
            results.warnings++;
        }
    } catch (error) {
        console.log(`   ❌ Score check failed: ${error}`);
        results.failed++;
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`⚠️  Warnings: ${results.warnings}`);
    console.log('='.repeat(60));

    if (results.failed === 0) {
        console.log('\n🎉 User Satisfaction System is fully operational!');
        console.log('\n📋 Next Steps:');
        console.log('   1. Deploy the updated code');
        console.log('   2. Run database migration: npx prisma db push');
        console.log('   3. Access admin dashboard: /admin/satisfaction');
        console.log('   4. Add FeedbackWidget to key pages');
        console.log('   5. Monitor satisfaction metrics daily');
        console.log('\n🎯 Target: Maintain average rating >4.5/5');
    } else {
        console.log('\n⚠️  Some checks failed. Please review the errors above.');
    }

    await prisma.$disconnect();
}

// Run verification
verifyUserSatisfactionSystem().catch((error) => {
    console.error('Verification failed:', error);
    process.exit(1);
});
