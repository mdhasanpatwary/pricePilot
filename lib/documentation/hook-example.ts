/**
 * Documentation Hook Usage Examples
 * 
 * This file demonstrates how to use the documentation hook system
 * to automatically generate documentation suggestions when tasks are completed.
 */

import { documentationHook, Task } from './hook';

/**
 * Example 1: Handle a feature task completion
 */
export async function exampleFeatureTask() {
    const task: Task = {
        id: 'task-123',
        title: 'Add price update API endpoint',
        description: 'Implement new REST API endpoint for bulk price updates with validation and error handling',
        category: 'api',
        completedAt: new Date(),
        completedBy: 'user-456',
    };

    // This will:
    // 1. Analyze the task for documentation impact
    // 2. Identify it as an API change affecting both tenant and admin docs
    // 3. Generate suggestions for updating API documentation
    await documentationHook.onTaskCompleted(task);
}

/**
 * Example 2: Handle a UI task completion
 */
export async function exampleUITask() {
    const task: Task = {
        id: 'task-124',
        title: 'Redesign product matching interface',
        description: 'Update the product matching UI with improved filters and bulk actions for users',
        category: 'ui',
        completedAt: new Date(),
        completedBy: 'user-456',
    };

    // This will:
    // 1. Identify it as a UI change affecting tenant documentation
    // 2. Suggest updating user guides with new interface screenshots
    // 3. Recommend updating the product matching documentation
    await documentationHook.onTaskCompleted(task);
}

/**
 * Example 3: Handle an admin feature task
 */
export async function exampleAdminTask() {
    const task: Task = {
        id: 'task-125',
        title: 'Add tenant monitoring dashboard',
        description: 'Implement admin dashboard for monitoring tenant activity, resource usage, and system health',
        category: 'monitoring',
        completedAt: new Date(),
        completedBy: 'user-456',
    };

    // This will:
    // 1. Identify it as an admin-only feature
    // 2. Generate suggestions for admin documentation
    // 3. Recommend updating system monitoring guides
    await documentationHook.onTaskCompleted(task);
}

/**
 * Example 4: Handle a configuration task
 */
export async function exampleConfigTask() {
    const task: Task = {
        id: 'task-126',
        title: 'Add Redis caching configuration',
        description: 'Add new environment variables for Redis connection and caching strategies',
        category: 'configuration',
        completedAt: new Date(),
        completedBy: 'user-456',
    };

    // This will:
    // 1. Identify it as a configuration change
    // 2. Suggest updating environment variables documentation
    // 3. Recommend adding configuration examples
    await documentationHook.onTaskCompleted(task);
}

/**
 * Example 5: Handle a bugfix task (minimal documentation impact)
 */
export async function exampleBugfixTask() {
    const task: Task = {
        id: 'task-127',
        title: 'Fix price calculation rounding error',
        description: 'Fix bug where prices were incorrectly rounded in certain edge cases',
        category: 'bugfix',
        completedAt: new Date(),
        completedBy: 'user-456',
    };

    // This will:
    // 1. Identify it as a bugfix with minimal documentation impact
    // 2. May suggest updating troubleshooting guide if applicable
    await documentationHook.onTaskCompleted(task);
}

/**
 * Example 6: Retrieve pending suggestions for review
 */
export async function exampleRetrieveSuggestions() {
    const { prisma } = await import('@/lib/prisma');

    // Get all pending suggestions
    const pendingSuggestions = await prisma.documentationSuggestion.findMany({
        where: {
            status: 'PENDING',
        },
        orderBy: {
            createdAt: 'desc',
        },
        include: {
            document: {
                select: {
                    title: true,
                    slug: true,
                    type: true,
                },
            },
        },
    });

    console.log(`Found ${pendingSuggestions.length} pending documentation suggestions`);

    for (const suggestion of pendingSuggestions) {
        console.log(`\nSuggestion ID: ${suggestion.id}`);
        console.log(`Target Type: ${suggestion.targetType}`);
        console.log(`Category: ${suggestion.category}`);
        console.log(`Task ID: ${suggestion.taskId}`);

        if (suggestion.document) {
            console.log(`Affects Document: ${suggestion.document.title} (${suggestion.document.slug})`);
        } else {
            console.log(`Suggests New Document: ${suggestion.suggestedTitle}`);
        }

        console.log(`Content Preview: ${suggestion.suggestedContent.substring(0, 200)}...`);
    }

    return pendingSuggestions;
}

/**
 * Example 7: Approve a suggestion
 */
export async function exampleApproveSuggestion(suggestionId: string, reviewerId: string) {
    const { prisma } = await import('@/lib/prisma');

    // Approve the suggestion
    const suggestion = await prisma.documentationSuggestion.update({
        where: { id: suggestionId },
        data: {
            status: 'APPROVED',
            reviewedBy: reviewerId,
            reviewedAt: new Date(),
        },
    });

    console.log(`Approved suggestion ${suggestionId}`);

    // Now you would typically apply the suggestion to the documentation
    // This could be done manually or through an automated process

    return suggestion;
}

/**
 * Example 8: Reject a suggestion
 */
export async function exampleRejectSuggestion(suggestionId: string, reviewerId: string) {
    const { prisma } = await import('@/lib/prisma');

    // Reject the suggestion
    const suggestion = await prisma.documentationSuggestion.update({
        where: { id: suggestionId },
        data: {
            status: 'REJECTED',
            reviewedBy: reviewerId,
            reviewedAt: new Date(),
        },
    });

    console.log(`Rejected suggestion ${suggestionId}`);

    return suggestion;
}

/**
 * Example 9: Integration with task management system
 * 
 * This shows how you would integrate the documentation hook
 * with your existing task management system.
 */
export async function integrateWithTaskSystem() {
    // Pseudo-code for integration

    // In your task management system, when a task is marked as complete:
    // 
    // taskManager.on('taskCompleted', async (task) => {
    //     await documentationHook.onTaskCompleted({
    //         id: task.id,
    //         title: task.title,
    //         description: task.description,
    //         category: task.category,
    //         completedAt: task.completedAt,
    //         completedBy: task.completedBy,
    //     });
    // });

    console.log('Documentation hook integrated with task management system');
}

/**
 * Example 10: Batch process multiple tasks
 */
export async function exampleBatchProcess() {
    const tasks: Task[] = [
        {
            id: 'task-201',
            title: 'Add OAuth authentication',
            description: 'Implement OAuth 2.0 authentication for third-party integrations',
            category: 'authentication',
            completedAt: new Date(),
            completedBy: 'user-456',
        },
        {
            id: 'task-202',
            title: 'Add export to CSV feature',
            description: 'Allow users to export product and price data to CSV format',
            category: 'feature',
            completedAt: new Date(),
            completedBy: 'user-456',
        },
        {
            id: 'task-203',
            title: 'Optimize database queries',
            description: 'Add indexes and optimize slow queries for better performance',
            category: 'performance',
            completedAt: new Date(),
            completedBy: 'user-456',
        },
    ];

    // Process all tasks
    for (const task of tasks) {
        await documentationHook.onTaskCompleted(task);
    }

    console.log(`Processed ${tasks.length} tasks for documentation suggestions`);
}
