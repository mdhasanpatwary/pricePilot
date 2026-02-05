# Documentation Hook Integration Guide

## Quick Start

This guide shows you how to integrate the Documentation Hook System into your application in 5 minutes.

## Step 1: Import the Hook

```typescript
import { documentationHook, Task } from '@/lib/documentation/hook';
```

## Step 2: Call on Task Completion

Whenever a task is marked as complete in your system, call the hook:

```typescript
// Example: In your task management service
async function completeTask(taskId: string, userId: string) {
    // Your existing task completion logic
    const task = await taskService.markComplete(taskId, userId);
    
    // NEW: Trigger documentation hook
    await documentationHook.onTaskCompleted({
        id: task.id,
        title: task.title,
        description: task.description,
        category: task.category,
        completedAt: new Date(),
        completedBy: userId,
    });
    
    return task;
}
```

## Step 3: Review Suggestions

Access pending suggestions via the API:

```typescript
// In your admin dashboard
async function getPendingSuggestions() {
    const response = await fetch('/api/v1/documentation/suggestions?status=pending', {
        headers: {
            'Authorization': `Bearer ${adminToken}`,
        },
    });
    
    const data = await response.json();
    return data.data.suggestions;
}
```

## Step 4: Approve or Reject

```typescript
// Approve a suggestion
async function approveSuggestion(suggestionId: string) {
    await fetch(`/api/v1/documentation/suggestions/${suggestionId}/approve`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${adminToken}`,
        },
    });
}

// Reject a suggestion
async function rejectSuggestion(suggestionId: string) {
    await fetch(`/api/v1/documentation/suggestions/${suggestionId}/reject`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${adminToken}`,
        },
    });
}
```

## Step 5: Apply Approved Suggestions

```typescript
import { documentationService } from '@/lib/documentation/service';

async function applySuggestion(suggestionId: string) {
    const suggestion = await prisma.documentationSuggestion.findUnique({
        where: { id: suggestionId },
    });
    
    if (suggestion.status !== 'APPROVED') {
        throw new Error('Suggestion not approved');
    }
    
    if (suggestion.documentId) {
        // Update existing document
        await documentationService.updateDocument(
            suggestion.documentId,
            suggestion.suggestedContent,
            suggestion.reviewedBy!,
            'Applied automated suggestion'
        );
    } else {
        // Create new document
        await documentationService.createDocument(
            suggestion.targetType.toLowerCase() as 'tenant' | 'admin',
            {
                slug: generateSlug(suggestion.suggestedTitle!),
                title: suggestion.suggestedTitle!,
                content: suggestion.suggestedContent,
                category: suggestion.category,
            }
        );
    }
}
```

## Complete Integration Example

Here's a complete example showing integration with a task management system:

```typescript
// lib/services/task-service.ts

import { documentationHook } from '@/lib/documentation/hook';
import { prisma } from '@/lib/prisma';

export class TaskService {
    /**
     * Mark a task as complete and trigger documentation hook
     */
    async completeTask(taskId: string, userId: string): Promise<Task> {
        // Update task status
        const task = await prisma.task.update({
            where: { id: taskId },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                completedBy: userId,
            },
        });
        
        // Trigger documentation hook
        try {
            await documentationHook.onTaskCompleted({
                id: task.id,
                title: task.title,
                description: task.description,
                category: task.category,
                completedAt: task.completedAt!,
                completedBy: userId,
            });
        } catch (error) {
            // Log error but don't fail task completion
            console.error('Failed to generate documentation suggestion:', error);
        }
        
        return task;
    }
}
```

## Admin Dashboard Integration

Create a simple admin UI for reviewing suggestions:

```typescript
// app/admin/documentation-suggestions/page.tsx

'use client';

import { useState, useEffect } from 'react';

export default function DocumentationSuggestionsPage() {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        loadSuggestions();
    }, []);
    
    async function loadSuggestions() {
        const response = await fetch('/api/v1/documentation/suggestions?status=pending');
        const data = await response.json();
        setSuggestions(data.data.suggestions);
        setLoading(false);
    }
    
    async function handleApprove(id: string) {
        await fetch(`/api/v1/documentation/suggestions/${id}/approve`, {
            method: 'POST',
        });
        loadSuggestions();
    }
    
    async function handleReject(id: string) {
        await fetch(`/api/v1/documentation/suggestions/${id}/reject`, {
            method: 'POST',
        });
        loadSuggestions();
    }
    
    if (loading) return <div>Loading...</div>;
    
    return (
        <div>
            <h1>Documentation Suggestions</h1>
            {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="suggestion-card">
                    <h3>{suggestion.suggestedTitle || 'Update Existing Document'}</h3>
                    <p><strong>Category:</strong> {suggestion.category}</p>
                    <p><strong>Target:</strong> {suggestion.targetType}</p>
                    <p><strong>Task:</strong> {suggestion.taskId}</p>
                    
                    {suggestion.document && (
                        <p><strong>Affects:</strong> {suggestion.document.title}</p>
                    )}
                    
                    <pre>{suggestion.suggestedContent}</pre>
                    
                    <div className="actions">
                        <button onClick={() => handleApprove(suggestion.id)}>
                            Approve
                        </button>
                        <button onClick={() => handleReject(suggestion.id)}>
                            Reject
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
```

## Notification Integration

Set up notifications for new suggestions:

```typescript
// lib/services/notification-service.ts

import { prisma } from '@/lib/prisma';

export async function notifyDocumentationTeam() {
    const pendingCount = await prisma.documentationSuggestion.count({
        where: { status: 'PENDING' },
    });
    
    if (pendingCount > 0) {
        // Send email notification
        await sendEmail({
            to: 'docs-team@pricepilot.com',
            subject: `${pendingCount} Documentation Suggestions Pending Review`,
            body: `There are ${pendingCount} documentation suggestions waiting for review.
                   
                   Review them at: https://app.pricepilot.com/admin/documentation-suggestions`,
        });
        
        // Or send Slack notification
        await sendSlackMessage({
            channel: '#documentation',
            text: `📝 ${pendingCount} documentation suggestions pending review`,
            link: 'https://app.pricepilot.com/admin/documentation-suggestions',
        });
    }
}

// Run daily at 9 AM
cron.schedule('0 9 * * *', notifyDocumentationTeam);
```

## Customization

### Custom Keywords

Adjust the keyword matching in `lib/documentation/hook.ts`:

```typescript
// Add your own keywords
const customAdminKeywords = [
    'admin', 'system', 'deployment',
    // Add more admin-specific keywords
];

const customTenantKeywords = [
    'user', 'product', 'competitor',
    // Add more tenant-specific keywords
];
```

### Custom Categories

Map your task categories to documentation categories:

```typescript
private inferCategory(task: Task, type: 'tenant' | 'admin'): string {
    const content = `${task.title} ${task.description}`.toLowerCase();
    
    // Add your own category mappings
    if (content.includes('your-feature')) return 'your-category';
    
    // ... existing mappings
}
```

## Troubleshooting

### Suggestions Not Generated

**Problem:** Tasks complete but no suggestions are created.

**Solution:**
1. Check task descriptions are meaningful
2. Verify task categories are recognized
3. Review console logs for errors
4. Check database connection

### Wrong Classification

**Problem:** Suggestions classified incorrectly (tenant vs admin).

**Solution:**
1. Review task description keywords
2. Adjust keyword lists in `hook.ts`
3. Add more specific keywords
4. Improve task categorization

### Too Many Suggestions

**Problem:** Too many suggestions generated.

**Solution:**
1. Add more "no impact" keywords
2. Improve task descriptions
3. Filter by impact type
4. Adjust threshold for impact detection

## Best Practices

### 1. Write Clear Task Descriptions

```typescript
// Good
{
    title: 'Add OAuth authentication',
    description: 'Implement OAuth 2.0 authentication for third-party integrations. Supports Google, GitHub, and Microsoft providers.',
    category: 'authentication',
}

// Bad
{
    title: 'Fix auth',
    description: 'Fixed it',
    category: 'bugfix',
}
```

### 2. Use Consistent Categories

Standardize your task categories:
- `api` - API changes
- `ui` - User interface
- `feature` - New features
- `bugfix` - Bug fixes
- `configuration` - Config changes

### 3. Review Regularly

Set up a regular review schedule:
- Daily for high-priority suggestions
- Weekly for routine updates
- Monthly for comprehensive review

### 4. Apply Promptly

Don't let approved suggestions pile up:
- Apply within 24 hours of approval
- Batch apply related suggestions
- Verify documentation after applying

## Support

For help with integration:

1. Check the [Hook System README](./HOOK_SYSTEM_README.md)
2. Review [usage examples](./hook-example.ts)
3. Check API documentation
4. Contact the documentation team

## Next Steps

After integration:

1. Monitor suggestion generation
2. Track approval rates
3. Gather feedback from documentation team
4. Tune keywords and classification
5. Consider automation for low-risk changes

---

**Ready to integrate?** Start with Step 1 above and you'll be up and running in minutes!
