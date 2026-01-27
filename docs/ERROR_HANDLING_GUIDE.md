# Error Handling and User Feedback Guide

This guide explains how to use the error handling, loading states, and user feedback utilities implemented in the admin dashboard.

## Table of Contents

1. [Error Boundaries](#error-boundaries)
2. [API Client with Retry Logic](#api-client-with-retry-logic)
3. [Loading States](#loading-states)
4. [Graceful Degradation](#graceful-degradation)
5. [Custom Hooks](#custom-hooks)
6. [Toast Notifications](#toast-notifications)
7. [Best Practices](#best-practices)

## Error Boundaries

Error boundaries catch JavaScript errors anywhere in the component tree and display a fallback UI.

### Basic Usage

```tsx
import { ErrorBoundary } from "@/components/error-boundary";

function MyPage() {
  return (
    <ErrorBoundary>
      <MyComponent />
    </ErrorBoundary>
  );
}
```

### With Custom Fallback

```tsx
<ErrorBoundary
  fallback={
    <div>
      <h2>Something went wrong</h2>
      <button onClick={() => window.location.reload()}>Reload</button>
    </div>
  }
>
  <MyComponent />
</ErrorBoundary>
```

### With Error Handler

```tsx
<ErrorBoundary
  onError={(error, errorInfo) => {
    // Log to error tracking service
    console.error("Error caught:", error, errorInfo);
  }}
>
  <MyComponent />
</ErrorBoundary>
```

### With Reset Keys

```tsx
const [userId, setUserId] = useState("123");

<ErrorBoundary resetKeys={[userId]}>
  <UserProfile userId={userId} />
</ErrorBoundary>
```

### HOC Pattern

```tsx
import { withErrorBoundary } from "@/components/error-boundary";

const MyComponent = () => {
  // Component code
};

export default withErrorBoundary(MyComponent, {
  onError: (error) => console.error(error),
});
```

## API Client with Retry Logic

The API client provides automatic retry logic, timeout handling, and error management.

### Basic Usage

```tsx
import { apiClient } from "@/lib/utils/api-client";

// GET request
const response = await apiClient.get("/api/v1/admin/sessions");

if (response.success) {
  console.log(response.data);
} else {
  console.error(response.error);
}
```

### POST Request

```tsx
const response = await apiClient.post(
  "/api/v1/admin/sessions",
  { tenantId: "123", siteUrl: "example.com" },
  {
    showSuccessToast: true,
    successMessage: "Session created successfully",
  }
);
```

### With Custom Options

```tsx
const response = await apiClient.get("/api/v1/admin/metrics", {
  retries: 3,
  retryDelay: 2000,
  timeout: 60000,
  showErrorToast: true,
  showSuccessToast: false,
});
```

### Available Methods

- `apiClient.get(url, options)`
- `apiClient.post(url, body, options)`
- `apiClient.put(url, body, options)`
- `apiClient.patch(url, body, options)`
- `apiClient.delete(url, options)`

## Loading States

Various loading state components for different use cases.

### Loading Spinner

```tsx
import { LoadingSpinner } from "@/components/ui/loading-state";

<LoadingSpinner message="Loading data..." />
```

### Inline Loader

```tsx
import { InlineLoader } from "@/components/ui/loading-state";

<InlineLoader message="Fetching..." />
```

### Card Skeleton

```tsx
import { CardSkeleton } from "@/components/ui/loading-state";

{loading ? <CardSkeleton /> : <MyCard data={data} />}
```

### Table Skeleton

```tsx
import { TableSkeleton } from "@/components/ui/loading-state";

{loading ? <TableSkeleton rows={5} columns={4} /> : <MyTable data={data} />}
```

### Loading Overlay

```tsx
import { LoadingOverlay } from "@/components/ui/loading-state";

<LoadingOverlay isLoading={isProcessing} message="Processing...">
  <MyContent />
</LoadingOverlay>
```

### Button Loader

```tsx
import { ButtonLoader } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";

<Button disabled={loading}>
  {loading && <ButtonLoader className="mr-2" />}
  Submit
</Button>
```

## Graceful Degradation

Utilities for handling missing or invalid data gracefully.

### Safe Value Access

```tsx
import {
  withFallback,
  safeGet,
  safeNumber,
  safePercentage,
  safeDate,
  safeArray,
  safeString,
} from "@/lib/utils/graceful-degradation";

// Provide fallback for null/undefined
const value = withFallback(data?.value, 0);

// Safely access nested properties
const name = safeGet(user, "profile.name", "Unknown");

// Format numbers safely
const count = safeNumber(data?.count, 0);
const percentage = safePercentage(data?.rate, 0, 2); // "0.00%"

// Format dates safely
const date = safeDate(data?.timestamp, "N/A");

// Ensure array
const items = safeArray(data?.items, []);

// Ensure string
const text = safeString(data?.text, "");
```

### Relative Time

```tsx
import { safeRelativeTime } from "@/lib/utils/graceful-degradation";

const timeAgo = safeRelativeTime(session.startTime); // "5m ago"
```

### Duration Formatting

```tsx
import { safeDuration } from "@/lib/utils/graceful-degradation";

const duration = safeDuration(1500); // "1.5s"
```

### File Size Formatting

```tsx
import { safeFileSize } from "@/lib/utils/graceful-degradation";

const size = safeFileSize(1024 * 1024); // "1.00 MB"
```

### Empty State Messages

```tsx
import { getEmptyStateMessage } from "@/lib/utils/graceful-degradation";

const message = getEmptyStateMessage("sessions"); // "No active sessions found"
```

## Custom Hooks

### useFetch Hook

Automatic data fetching with retry logic and caching.

```tsx
import { useFetch } from "@/lib/hooks/useFetch";

function MyComponent() {
  const { data, loading, error, refetch } = useFetch("/api/v1/admin/sessions", {
    enabled: true,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
    cacheTime: 60000, // Cache for 1 minute
    retries: 2,
    onSuccess: (data) => console.log("Data loaded:", data),
    onError: (error) => console.error("Error:", error),
  });

  if (loading) return <LoadingSpinner />;
  if (error) return <div>Error: {error}</div>;

  return <div>{/* Render data */}</div>;
}
```

### useAsyncOperation Hook

Manage async operations with loading and error states.

```tsx
import { useAsyncOperation } from "@/lib/hooks/useAsyncOperation";

function MyComponent() {
  const { data, loading, error, execute, reset } = useAsyncOperation({
    showErrorToast: true,
    showSuccessToast: true,
    successMessage: "Operation completed",
    onSuccess: (data) => console.log("Success:", data),
    onError: (error) => console.error("Error:", error),
  });

  const handleSubmit = async () => {
    const result = await execute(async () => {
      const response = await fetch("/api/endpoint", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      return response.json();
    });

    if (result.success) {
      // Handle success
    }
  };

  return (
    <Button onClick={handleSubmit} disabled={loading}>
      {loading ? "Processing..." : "Submit"}
    </Button>
  );
}
```

## Toast Notifications

Using Sonner for toast notifications.

### Success Toast

```tsx
import { toast } from "sonner";

toast.success("Operation completed successfully");
```

### Error Toast

```tsx
toast.error("Failed to complete operation");
```

### Info Toast

```tsx
toast.info("Processing your request...");
```

### Warning Toast

```tsx
toast.warning("This action cannot be undone");
```

### Loading Toast

```tsx
const toastId = toast.loading("Processing...");

// Later, update the toast
toast.success("Completed!", { id: toastId });
```

### Promise Toast

```tsx
toast.promise(
  fetch("/api/endpoint").then((res) => res.json()),
  {
    loading: "Loading...",
    success: "Data loaded successfully",
    error: "Failed to load data",
  }
);
```

## Empty States

Display friendly messages when no data is available.

```tsx
import { EmptyState } from "@/components/ui/empty-state";
import { Activity } from "lucide-react";

<EmptyState
  icon={Activity}
  title="No sessions found"
  description="There are currently no active scraping sessions."
  action={{
    label: "Refresh",
    onClick: () => refetch(),
  }}
/>
```

### Inline Empty State

```tsx
import { InlineEmptyState } from "@/components/ui/empty-state";

<InlineEmptyState
  icon={Activity}
  title="No data available"
  description="Try adjusting your filters"
/>
```

## Best Practices

### 1. Always Wrap Components in Error Boundaries

```tsx
// ✅ Good
<ErrorBoundary>
  <AdminDashboard />
</ErrorBoundary>

// ❌ Bad
<AdminDashboard />
```

### 2. Use Loading States for Async Operations

```tsx
// ✅ Good
{loading ? <LoadingSpinner /> : <DataTable data={data} />}

// ❌ Bad
<DataTable data={data} /> // No loading state
```

### 3. Provide Fallback Values

```tsx
// ✅ Good
const count = safeNumber(data?.count, 0);

// ❌ Bad
const count = data.count; // May crash if data is null
```

### 4. Handle Errors Gracefully

```tsx
// ✅ Good
const response = await apiClient.get("/api/endpoint");
if (response.success) {
  // Handle success
} else {
  // Handle error
  console.error(response.error);
}

// ❌ Bad
const data = await fetch("/api/endpoint").then(r => r.json());
// No error handling
```

### 5. Show User Feedback

```tsx
// ✅ Good
const handleSave = async () => {
  const result = await apiClient.post("/api/save", data, {
    showSuccessToast: true,
    successMessage: "Saved successfully",
  });
};

// ❌ Bad
const handleSave = async () => {
  await apiClient.post("/api/save", data);
  // No user feedback
};
```

### 6. Use Empty States

```tsx
// ✅ Good
{sessions.length === 0 ? (
  <EmptyState
    icon={Activity}
    title="No sessions"
    description="No active sessions found"
  />
) : (
  <SessionList sessions={sessions} />
)}

// ❌ Bad
{sessions.length === 0 ? null : <SessionList sessions={sessions} />}
```

### 7. Implement Retry Logic

```tsx
// ✅ Good
const { data, error, refetch } = useFetch("/api/endpoint", {
  retries: 2,
});

// ❌ Bad
const [data, setData] = useState(null);
useEffect(() => {
  fetch("/api/endpoint").then(r => r.json()).then(setData);
}, []); // No retry on failure
```

### 8. Cache Frequently Accessed Data

```tsx
// ✅ Good
const { data } = useFetch("/api/metrics", {
  cacheTime: 60000, // Cache for 1 minute
  refetchInterval: 30000, // Refresh every 30 seconds
});

// ❌ Bad
useEffect(() => {
  const interval = setInterval(() => {
    fetch("/api/metrics"); // No caching, fetches every time
  }, 1000);
}, []);
```

## Complete Example

Here's a complete example combining all best practices:

```tsx
import { ErrorBoundary } from "@/components/error-boundary";
import { useFetch } from "@/lib/hooks/useFetch";
import { LoadingSpinner } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { safeArray } from "@/lib/utils/graceful-degradation";
import { Activity } from "lucide-react";
import { toast } from "sonner";

function SessionMonitor() {
  const { data, loading, error, refetch } = useFetch("/api/v1/admin/sessions", {
    refetchInterval: 5000,
    retries: 2,
    cacheTime: 30000,
    onError: (err) => console.error("Failed to fetch sessions:", err),
  });

  const sessions = safeArray(data?.sessions, []);

  const handleRefresh = async () => {
    try {
      await refetch();
      toast.success("Sessions refreshed");
    } catch (err) {
      toast.error("Failed to refresh");
    }
  };

  if (loading && sessions.length === 0) {
    return <LoadingSpinner message="Loading sessions..." />;
  }

  if (error) {
    return (
      <EmptyState
        icon={Activity}
        title="Failed to load sessions"
        description={error}
        action={{
          label: "Retry",
          onClick: handleRefresh,
        }}
      />
    );
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No active sessions"
        description="There are currently no scraping sessions running."
        action={{
          label: "Refresh",
          onClick: handleRefresh,
        }}
      />
    );
  }

  return (
    <div>
      {/* Render sessions */}
    </div>
  );
}

export default function SessionMonitorPage() {
  return (
    <ErrorBoundary>
      <SessionMonitor />
    </ErrorBoundary>
  );
}
```

## Summary

The error handling and user feedback system provides:

- **Error Boundaries**: Catch and handle component errors gracefully
- **API Client**: Automatic retry logic and timeout handling
- **Loading States**: Various loading indicators for different contexts
- **Graceful Degradation**: Safe data access with fallback values
- **Custom Hooks**: Simplified async operations and data fetching
- **Toast Notifications**: User feedback for actions and errors
- **Empty States**: Friendly messages when no data is available

By following these patterns, you ensure a robust and user-friendly admin dashboard that handles errors gracefully and provides clear feedback to users.
