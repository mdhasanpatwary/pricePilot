# Documentation Hook System

## Overview

The Documentation Hook System automatically monitors task completions and code changes to generate documentation update suggestions. This ensures that documentation stays synchronized with code changes and new features.

## Architecture

The system consists of three main components:

1. **Event Listener** (`hook.ts` - Task 11.1)
   - Monitors task completion events
   - Extracts task metadata (title, description, category)
   - Triggers documentation impact analysis

2. **Impact Analyzer** (`hook.ts` - Task 11.2)
   - Analyzes tasks for documentation impact
   - Identifies impact type (feature, bugfix, config, api, ui)
   - Determines affected documentation areas
   - Classifies target audience (tenant, admin, both)

3. **Suggestion Generator** (`hook.ts` - Task 11.3)
   - Generates documentation update suggestions
   - Identifies affected documents
   - Creates suggestions in pending status
   - Stores in `documentation_suggestions` table
   - Maintains audit log of all suggestions

## How It Works

### 1. Task Completion Flow

```
Task Completed
    ↓
Event Listener (onTaskCompleted)
    ↓
Impact Analysis (analyzeDocumentationImpact)
    ↓
Classification (classifyDocumentationType)
    ↓
Suggestion Generation (generateUpdateSuggestion)
    ↓
Find Affected Documents (findAffectedDocuments)
    ↓
Create Suggestion (createSuggestion)
    ↓
Store in Database (documentation_suggestions)
```

### 2. Impact Analysis

The system analyzes tasks based on keywords and patterns:

**Impact Types:**
- **Feature**: New functionality added
- **Bugfix**: Bug fixes and corrections
- **Configuration**: Environment or config changes
- **API**: API endpoint changes
- **UI**: User interface changes

**Target Audience Classification:**
- **Tenant**: User-facing features (products, pricing, integrations)
- **Admin**: System administration (monitoring, database, security)
- **Both**: Features affecting both audiences (API, authentication)

### 3. Affected Areas

The system identifies which documentation areas are affected:

- Authentication
- Products
- Competitors
- Pricing
- Integrations
- Monitoring
- Security
- Performance
- API
- Dashboard

## Usage

### Basic Usage

```typescript
import { documentationHook, Task } from '@/lib/documentation/hook';

// When a task is completed
const task: Task = {
    id: 'task-123',
    title: 'Add price update API endpoint',
    description: 'Implement new REST API endpoint for bulk price updates',
    category: 'api',
    completedAt: new Date(),
    completedBy: 'user-456',
};

await documentationHook.onTaskCompleted(task);
```

### Integration with Task Management

```typescript
// In your task management system
taskManager.on('taskCompleted', async (task) => {
    await documentationHook.onTaskCompleted({
        id: task.id,
        title: task.title,
        description: task.description,
        category: task.category,
        completedAt: task.completedAt,
        completedBy: task.completedBy,
    });
});
```

### Code Change Monitoring

```typescript
import { documentationHook, CodeChange } from '@/lib/documentation/hook';

// When code changes are detected
const changes: CodeChange[] = [
    {
        file: 'app/api/v1/products/route.ts',
        type: 'modified',
        diff: '...',
    },
];

await documentationHook.onCodeChanged(changes);
```

## API Endpoints

### List Suggestions

```http
GET /api/v1/documentation/suggestions
Authorization: Bearer <admin-token>

Query Parameters:
- status: pending | approved | rejected
- targetType: tenant | admin
- category: string
- limit: number (default: 50)
- offset: number (default: 0)
```

**Response:**
```json
{
    "success": true,
    "data": {
        "suggestions": [
            {
                "id": "uuid",
                "documentId": "uuid",
                "document": {
                    "id": "uuid",
                    "title": "API Documentation",
                    "slug": "api-reference",
                    "type": "tenant",
                    "category": "api"
                },
                "suggestedTitle": null,
                "suggestedContent": "# Documentation Update Suggestion...",
                "targetType": "tenant",
                "category": "api",
                "status": "pending",
                "taskId": "task-123",
                "createdAt": "2024-01-15T10:00:00Z",
                "reviewedBy": null,
                "reviewedAt": null
            }
        ],
        "pagination": {
            "total": 10,
            "limit": 50,
            "offset": 0,
            "hasMore": false
        }
    }
}
```

### Create Suggestion

```http
POST /api/v1/documentation/suggestions
Authorization: Bearer <admin-token>
Content-Type: application/json

{
    "documentId": "uuid",
    "suggestedTitle": "New Feature Guide",
    "suggestedContent": "# New Feature\n\nDescription...",
    "targetType": "tenant",
    "category": "features",
    "taskId": "task-123"
}
```

### Approve Suggestion

```http
POST /api/v1/documentation/suggestions/:id/approve
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
    "success": true,
    "data": {
        "suggestion": {
            "id": "uuid",
            "status": "approved",
            "reviewedBy": "user-456",
            "reviewedAt": "2024-01-15T10:30:00Z"
        }
    }
}
```

### Reject Suggestion

```http
POST /api/v1/documentation/suggestions/:id/reject
Authorization: Bearer <admin-token>
```

## Database Schema

### documentation_suggestions Table

```sql
CREATE TABLE documentation_suggestions (
    id UUID PRIMARY KEY,
    document_id UUID REFERENCES documentation_documents(id),
    suggested_title VARCHAR(500),
    suggested_content TEXT NOT NULL,
    target_type VARCHAR(10) NOT NULL, -- 'TENANT' or 'ADMIN'
    category VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    task_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP
);
```

## Configuration

### Impact Keywords

The system uses keyword matching to determine documentation impact. You can customize these in `hook.ts`:

**Admin Keywords:**
```typescript
const adminKeywords = [
    'admin', 'system', 'deployment', 'infrastructure', 'monitoring',
    'database', 'migration', 'security', 'performance', 'alerting',
    // ... add more
];
```

**Tenant Keywords:**
```typescript
const tenantKeywords = [
    'user', 'product', 'competitor', 'price', 'update', 'matching',
    'integration', 'opencart', 'laravel', 'dashboard', 'report',
    // ... add more
];
```

## Best Practices

### 1. Review Suggestions Regularly

Set up a regular review process for pending suggestions:

```typescript
// Daily review reminder
cron.schedule('0 9 * * *', async () => {
    const pendingCount = await prisma.documentationSuggestion.count({
        where: { status: 'PENDING' },
    });
    
    if (pendingCount > 0) {
        // Send notification to documentation team
        console.log(`${pendingCount} documentation suggestions pending review`);
    }
});
```

### 2. Provide Clear Task Descriptions

The quality of suggestions depends on task descriptions:

```typescript
// Good task description
const task = {
    title: 'Add OAuth authentication',
    description: 'Implement OAuth 2.0 authentication for third-party integrations. Supports Google, GitHub, and Microsoft providers.',
    category: 'authentication',
};

// Poor task description
const task = {
    title: 'Fix auth',
    description: 'Fixed it',
    category: 'bugfix',
};
```

### 3. Categorize Tasks Properly

Use consistent task categories:

- `api` - API changes
- `ui` - User interface changes
- `feature` - New features
- `bugfix` - Bug fixes
- `configuration` - Config changes
- `authentication` - Auth changes
- `monitoring` - Monitoring/alerting
- `performance` - Performance improvements

### 4. Handle Suggestions Promptly

Approved suggestions should be applied to documentation:

```typescript
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

## Monitoring

### Metrics to Track

1. **Suggestion Generation Rate**
   - How many suggestions are generated per day/week
   - Breakdown by impact type and target audience

2. **Review Time**
   - Average time from creation to review
   - Identify bottlenecks in review process

3. **Approval Rate**
   - Percentage of suggestions approved vs rejected
   - Helps tune the impact analysis

4. **Documentation Coverage**
   - Which areas get the most suggestions
   - Identify documentation gaps

### Example Monitoring Query

```typescript
// Get suggestion metrics for the last 30 days
const metrics = await prisma.documentationSuggestion.groupBy({
    by: ['status', 'targetType'],
    where: {
        createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
    },
    _count: true,
});
```

## Troubleshooting

### Suggestions Not Being Generated

1. Check that tasks have proper descriptions
2. Verify task categories are recognized
3. Review impact keywords in `hook.ts`
4. Check database connection and permissions

### Too Many False Positives

1. Refine impact keywords
2. Add more "no impact" keywords
3. Improve task categorization
4. Adjust impact analysis logic

### Suggestions Missing Context

1. Improve task descriptions
2. Add more metadata to tasks
3. Enhance suggestion content generation
4. Include code diffs in analysis

## Future Enhancements

1. **AI-Powered Analysis**
   - Use LLM to analyze code changes
   - Generate more detailed suggestions
   - Improve classification accuracy

2. **Automated Application**
   - Auto-apply low-risk suggestions
   - Require review only for major changes
   - Version control integration

3. **Smart Notifications**
   - Notify relevant documentation owners
   - Priority-based notifications
   - Slack/email integration

4. **Analytics Dashboard**
   - Visualize suggestion trends
   - Track documentation health
   - Identify coverage gaps

## Support

For questions or issues with the documentation hook system:

1. Check this README
2. Review example usage in `hook-example.ts`
3. Check API documentation
4. Contact the documentation team

## License

Internal use only - PricePilot Documentation System
