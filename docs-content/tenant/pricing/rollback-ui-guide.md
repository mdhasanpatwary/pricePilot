---
title: "Rollback UI Guide"
description: "Using the rollback interface to revert price changes"
category: "pricing"
tags: ["rollback", "ui", "guide"]
audience: "tenant"
---

# Rollback UI Implementation Guide

## Overview

The rollback UI provides users with an intuitive interface to view rollback history and perform rollback operations on price changes. The implementation follows PricePilot's design principles of simplicity, clarity, and user-friendliness.

## Components

### 1. Rollback History Page

**Location**: `app/dashboard/activity/rollback/page.tsx`

**Features**:
- Displays all rollback operations (single and bulk)
- Shows rollback type, details, user, and timestamp
- Real-time refresh capability
- Empty state for no rollbacks
- Error handling with retry option
- Responsive table layout

**Access**: Navigate to `/dashboard/activity/rollback`

**UI Elements**:
- **Type Badge**: Visual indicator for single vs bulk rollbacks
  - Blue badge for single rollbacks
  - Purple badge for bulk rollbacks
- **Details Column**: Shows product information and price changes
- **User Column**: Displays who performed the rollback
- **Timestamp Column**: Shows when the rollback occurred

### 2. Rollback Button Component

**Location**: `components/dashboard/rollback-button.tsx`

**Features**:
- Reusable button component for triggering rollbacks
- Confirmation dialog with rollback details
- Eligibility checking (prevents invalid rollbacks)
- Loading states during operation
- Error handling and display
- Success callback support

**Props**:
```typescript
interface RollbackButtonProps {
  updateLogId?: string;        // For single price change rollback
  snapshotId?: string;          // For bulk operation rollback
  productTitle?: string;        // Product name to display
  productCount?: number;        // Number of products (bulk only)
  oldPrice?: string;            // Original price before change
  newPrice?: string;            // New price after change
  onSuccess?: () => void;       // Callback after successful rollback
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}
```

**Usage Example**:
```tsx
import { RollbackButton } from "@/components/dashboard/rollback-button";

// Single price change rollback
<RollbackButton
  updateLogId="uuid-here"
  productTitle="Samsung Galaxy S21"
  oldPrice="799.99"
  newPrice="749.99"
  onSuccess={() => {
    // Refresh data or show notification
    fetchUpdates();
  }}
/>

// Bulk operation rollback
<RollbackButton
  snapshotId="snapshot-uuid"
  productCount={25}
  onSuccess={() => {
    fetchUpdates();
  }}
/>
```

### 3. Activity Page Integration

**Location**: `app/dashboard/activity/page.tsx`

**Updates**:
- Added "Rollback History" button in header
- Added rollback action rendering in audit log details
- Visual indicators for rollback operations

**Rollback Actions Display**:
- `ROLLBACK_PRICE`: Shows product name and price change
- `ROLLBACK_BULK_OPERATION`: Shows product count

## User Workflows

### Viewing Rollback History

1. Navigate to Dashboard → Activity
2. Click "Rollback History" button in header
3. View list of all rollback operations
4. Click refresh icon to update list

### Performing a Rollback (Future Integration)

1. Navigate to price update history or product details
2. Locate the price change to rollback
3. Click "Rollback" button
4. Review rollback details in confirmation dialog
5. Click "Confirm Rollback" to proceed
6. Wait for operation to complete
7. View success notification

## Design Principles

### Visual Hierarchy

- **Primary Action**: Rollback button uses destructive variant in confirmation
- **Type Indicators**: Color-coded badges for quick identification
- **Price Changes**: Clear before/after display with strikethrough and arrows

### User Safety

- **Confirmation Dialog**: Prevents accidental rollbacks
- **Warning Messages**: Alerts users about store updates
- **Eligibility Checks**: Prevents invalid rollback attempts
- **Error Display**: Clear error messages with actionable information

### Accessibility

- **Keyboard Navigation**: Full keyboard support for all interactions
- **Screen Reader Support**: Proper ARIA labels and descriptions
- **Focus Management**: Logical focus flow through dialogs
- **Color Contrast**: WCAG 2.1 AA compliant color combinations

## Integration Points

### Where to Add Rollback Buttons

1. **Price Update History Page** (Recommended)
   - Add rollback button to each price update row
   - Show eligibility status
   - Filter to show only rollback-eligible updates

2. **Product Detail Page** (Recommended)
   - Add rollback button in price history section
   - Show recent price changes with rollback option

3. **Bulk Operation Results** (Recommended)
   - Add rollback button to bulk operation summary
   - Show operation details before rollback

### Example Integration in Price Update History

```tsx
"use client";

import { useState, useEffect } from "react";
import { RollbackButton } from "@/components/dashboard/rollback-button";

interface PriceUpdate {
  id: string;
  productId: string;
  productTitle: string;
  oldPrice: string;
  newPrice: string;
  status: string;
  executedAt: string;
}

export default function PriceUpdateHistoryPage() {
  const [updates, setUpdates] = useState<PriceUpdate[]>([]);

  const fetchUpdates = async () => {
    const res = await fetch("/api/v1/price-updates");
    const data = await res.json();
    setUpdates(data);
  };

  useEffect(() => {
    fetchUpdates();
  }, []);

  return (
    <div>
      <h1>Price Update History</h1>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Price Change</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {updates.map((update) => (
            <tr key={update.id}>
              <td>{update.productTitle}</td>
              <td>
                ${update.oldPrice} → ${update.newPrice}
              </td>
              <td>{new Date(update.executedAt).toLocaleDateString()}</td>
              <td>
                {update.status === "SUCCESS" && (
                  <RollbackButton
                    updateLogId={update.id}
                    productTitle={update.productTitle}
                    oldPrice={update.oldPrice}
                    newPrice={update.newPrice}
                    onSuccess={fetchUpdates}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## API Integration

The UI components integrate with the rollback API endpoints:

### POST /api/v1/price-update/rollback

**Request**:
```json
{
  "updateLogId": "uuid",  // OR
  "snapshotId": "uuid"
}
```

**Success Response**:
```json
{
  "success": true,
  "data": {
    "type": "single",
    "updateLogId": "uuid",
    "message": "Price change rolled back successfully"
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "ROLLBACK_NOT_ALLOWED",
    "message": "Cannot rollback: subsequent changes exist"
  }
}
```

### GET /api/v1/price-update/rollback/history

**Response**:
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "uuid",
        "type": "SINGLE",
        "timestamp": "2024-01-28T10:00:00Z",
        "userId": "uuid",
        "userEmail": "user@example.com",
        "details": {
          "productId": "uuid",
          "productTitle": "Product Name",
          "oldPrice": "99.99",
          "newPrice": "89.99"
        }
      }
    ],
    "count": 1
  }
}
```

## Testing

### Component Tests

**Location**: `__tests__/components/dashboard/rollback-button.test.tsx`

**Coverage**:
- Button rendering
- Dialog opening
- Product details display
- API calls
- Success handling
- Error handling
- Loading states
- Cancel functionality

**Run Tests**:
```bash
npm test rollback-button.test.tsx
```

### Manual Testing Checklist

- [ ] Rollback history page loads correctly
- [ ] Empty state displays when no rollbacks exist
- [ ] Rollback button opens confirmation dialog
- [ ] Single rollback shows correct product details
- [ ] Bulk rollback shows correct product count
- [ ] Confirmation performs rollback successfully
- [ ] Error messages display correctly
- [ ] Success notification appears
- [ ] Page refreshes after successful rollback
- [ ] Cancel button closes dialog without action
- [ ] Loading states display during operation
- [ ] Responsive design works on mobile
- [ ] Dark mode displays correctly
- [ ] Keyboard navigation works
- [ ] Screen reader announces changes

## Styling

The UI follows PricePilot's design system:

### Colors

- **Primary**: Blue for informational elements
- **Success**: Green for successful operations
- **Warning**: Amber for warnings and confirmations
- **Destructive**: Red for dangerous actions
- **Muted**: Gray for secondary information

### Typography

- **Headings**: Bold, tracking-tight
- **Body**: Regular weight, readable line height
- **Labels**: Uppercase, small, bold, wide tracking
- **Monospace**: For IDs and technical data

### Spacing

- **Consistent padding**: 4px increments (1rem = 16px)
- **Card padding**: 24px (1.5rem)
- **Table cell padding**: 16px vertical, 24px horizontal
- **Gap between elements**: 8px, 16px, or 24px

## Future Enhancements

1. **Batch Rollback**: Select multiple updates to rollback at once
2. **Rollback Preview**: Show what will change before confirming
3. **Rollback Scheduling**: Schedule rollback for future time
4. **Rollback Approval**: Require approval for high-impact rollbacks
5. **Rollback Notifications**: Email/SMS notifications for rollbacks
6. **Rollback Analytics**: Track rollback frequency and patterns
7. **Partial Bulk Rollback**: Rollback specific products from bulk operation

## Troubleshooting

### Rollback Button Not Appearing

**Cause**: Missing updateLogId or snapshotId prop

**Solution**: Ensure you're passing the correct ID prop to the component

### Dialog Not Opening

**Cause**: JavaScript error or missing dependencies

**Solution**: Check browser console for errors, ensure all dependencies are installed

### API Call Failing

**Cause**: Authentication issue or network error

**Solution**: Verify user is authenticated, check network tab for error details

### Success Callback Not Firing

**Cause**: onSuccess prop not provided or error in callback

**Solution**: Provide onSuccess prop and check for errors in callback function

## Support

For issues or questions about the rollback UI:
- Review this documentation
- Check component source code comments
- Review API documentation in `docs/ROLLBACK_PROCEDURES.md`
- Contact development team for technical support

## Related Documentation

- [Rollback Procedures](./ROLLBACK_PROCEDURES.md) - API and backend documentation
- [Rollback Implementation Summary](./ROLLBACK_IMPLEMENTATION_SUMMARY.md) - Technical details
- [UI Design Principles](../ui-design-principles.md) - Design guidelines
- [Component Documentation](../COMPONENT_DOCUMENTATION.md) - Component library
