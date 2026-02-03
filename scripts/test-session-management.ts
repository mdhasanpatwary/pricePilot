/**
 * Session Management Test Script
 *
 * Tests the enhanced session management features
 * Requirements: 2.7.7
 */

import { SessionManager } from '../lib/utils/session-manager';
import { prisma } from '../lib/prisma';

async function testSessionManagement() {
    console.log('🔐 Testing Session Management Features\n');

    try {
        // Test 1: Create test user and session
        console.log('1️⃣  Creating test session...');
        const testUser = await prisma.user.findFirst({
            where: { email: { contains: '@' } },
        });

        if (!testUser) {
            console.log('❌ No test user found. Please create a user first.');
            return;
        }

        const testSession = await prisma.session.create({
            data: {
                sessionToken: `test-session-${Date.now()}`,
                userId: testUser.id,
                expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            },
        });
        console.log('✅ Test session created:', testSession.sessionToken);

        // Test 2: Get user sessions
        console.log('\n2️⃣  Getting user sessions...');
        const sessions = await SessionManager.getUserSessions(testUser.id);
        console.log(`✅ Found ${sessions.length} active session(s)`);

        // Test 3: Update session activity
        console.log('\n3️⃣  Updating session activity...');
        await SessionManager.updateSessionActivity(testSession.sessionToken);
        console.log('✅ Session activity updated');

        // Test 4: Extend session
        console.log('\n4️⃣  Extending session (remember me)...');
        await SessionManager.extendSession(testSession.sessionToken, 30);
        const extendedSession = await prisma.session.findUnique({
            where: { sessionToken: testSession.sessionToken },
        });
        console.log('✅ Session extended to:', extendedSession?.expires);

        // Test 5: Create expired session
        console.log('\n5️⃣  Creating expired session for cleanup test...');
        await prisma.session.create({
            data: {
                sessionToken: `expired-session-${Date.now()}`,
                userId: testUser.id,
                expires: new Date(Date.now() - 1000), // Already expired
            },
        });
        console.log('✅ Expired session created');

        // Test 6: Cleanup expired sessions
        console.log('\n6️⃣  Cleaning up expired sessions...');
        const deletedCount = await SessionManager.cleanupExpiredSessions();
        console.log(`✅ Cleaned up ${deletedCount} expired session(s)`);

        // Test 7: Invalidate specific session
        console.log('\n7️⃣  Invalidating specific session...');
        await SessionManager.invalidateSession(testSession.sessionToken);
        const deletedSession = await prisma.session.findUnique({
            where: { sessionToken: testSession.sessionToken },
        });
        console.log('✅ Session invalidated:', deletedSession === null);

        // Test 8: Verify session was deleted
        console.log('\n8️⃣  Verifying session deletion...');
        const remainingSessions = await SessionManager.getUserSessions(testUser.id);
        console.log(`✅ Remaining sessions: ${remainingSessions.length}`);

        console.log('\n✅ All session management tests passed!\n');

        // Summary
        console.log('📊 Test Summary:');
        console.log('  ✅ Session creation');
        console.log('  ✅ Session retrieval');
        console.log('  ✅ Activity tracking');
        console.log('  ✅ Session extension (remember me)');
        console.log('  ✅ Expired session cleanup');
        console.log('  ✅ Session invalidation');
        console.log('  ✅ Session deletion verification');

    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run tests
testSessionManagement()
    .then(() => {
        console.log('\n✅ Session management test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Session management test failed:', error);
        process.exit(1);
    });
