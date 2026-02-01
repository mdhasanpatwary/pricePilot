# Rollback Procedures

## Overview

The PricePilot rollback mechanism allows users to undo price changes and bulk operations, ensuring data integrity and providing a safety net for incorrect price updates.

## Features

- **Single Price Change Rollback**: Revert individual price updates
- **Bulk Operation Rollback**: Revert entire bulk update operations
- **Eligibility Checks**: Validate if a rollback is possible before execution
- **Audit Trail**: Complete history of all rollback operations
- **Store Synchronization**: Automatic sync of rolled-back prices to connected stores
- **Notifications**: Real-time notifications for rollback operations

## Architecture

### Components

1. **RollbackService** (`lib/services/rollback.ts`)
   - Core business logic for rollback operations
   - Handles single and bulk rollbacks
   - Manages eligibility checks
   - Maintains audit trails

2. **Rollback API** (`app/api/v1/price-update/rollback/route.ts`)
   - RESTful endpoint for rollback operations
   - Authentication and authorization
   - Input validation
   - Rate limiting

3. **Database Models**
   - `PriceUpdateLog`: Tracks individual price changes
   - `BulkOperationSnapshot`: Stores bulk operation data
   - `TenantAuditLog`: Records all rollback actions
   - `PriceHistory`: Maintains price change history

## API Reference

### POST /api/v1/price-update/rollback

Performs a rollback operation for either a single price change or bulk operation.

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "updateLogId": "uuid",  // For single price change rollback
  "snapshotId": "uuid"    // For bulk operation rollback
}
```

**Note**: Provide either `updateLogId` OR `snapshotId`, not both.

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "type": "single",  // or "bulk"
    "updateLogId": "uuid",
    "message": "Price change rolled back successfully"
  },
  "meta": {
    "timestamp": "2024-01-28T10:00:00Z"
  }
}
```

**Error Responses**:

- **401 Unauthorized**: Missing or invalid authentication
- **400 Bad Request**: Rollback not allowed (e.g., already rolled back, subsequent changes exist)
- **404 Not Found**: Update log or snapshot not found
- **422 Unprocessable Entity**: Invalid request data
- **500 Internal Server Error**: Unexpected error

### GET /api/v1/price-update/rollback/history

Retrieves rollback history for the authenticated tenant.

**Authentication**: Required (Bearer token)

**Query Parameters**:
- `limit` (optional): Maximum number of records to return (default: 50, max: 100)

**Success Response** (200 OK):
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
  },
  "meta": {
    "timestamp": "2024-01-28T10:00:00Z"
  }
}
```

## Rollback Eligibility Rules

### Single Price Change Rollback

A price change can be rolled back if:
1. ✅ The update log exists
2. ✅ The update status is `SUCCESS`
3. ✅ No subsequent price changes have been made to the product

A price change CANNOT be rolled back if:
1. ❌ The update log does not exist
2. ❌ The update status is not `SUCCESS` (e.g., `FAILED`, `PENDING`)
3. ❌ There have been subsequent price changes to the product

### Bulk Operation Rollback

A bulk operation can be rolled back if:
1. ✅ The snapshot exists
2. ✅ The operation has not been rolled back already

A bulk operation CANNOT be rolled back if:
1. ❌ The snapshot does not exist
2. ❌ The operation has already been rolled back

## Rollback Process

### Single Price Change Rollback

1. **Validation**
   - Verify update log exists
   - Check update status is `SUCCESS`
   - Ensure no subsequent price changes

2. **Database Transaction**
   - Revert product price to old price
   - Create price history record
   - Create new price update log for rollback
   - Create audit log entry

3. **Store Synchronization**
   - Sync rolled-back price to connected store (OpenCart/Laravel)
   - Handle sync failures gracefully with notifications

4. **Notification**
   - Send success notification to tenant
   - Include product details and price information

### Bulk Operation Rollback

1. **Validation**
   - Verify snapshot exists
   - Check operation has not been rolled back

2. **Database Transaction**
   - Parse changes from snapshot
   - For each product:
     - Revert price to old price
     - Create price history record
     - Create price update log entry
   - Mark snapshot as rolled back
   - Create audit log entry

3. **Notification**
   - Send success notification to tenant
   - Include product count and operation details

## Error Handling

### Sync Failures

If store synchronization fails during rollback:
- The database rollback is still committed
- A notification is sent about the sync failure
- User can manually sync the product later

### Transaction Failures

If the database transaction fails:
- All changes are rolled back (atomicity)
- Error is logged with full context
- User receives error notification

## Security Considerations

1. **Authentication**: All rollback operations require authentication
2. **Tenant Isolation**: Users can only rollback their own tenant's data
3. **Audit Trail**: All rollback operations are logged with user information
4. **Rate Limiting**: API endpoints are rate-limited to prevent abuse
5. **Input Validation**: All inputs are validated using Zod schemas

## Best Practices

### For Developers

1. **Always check eligibility** before attempting rollback
2. **Use transactions** for all database operations
3. **Log all operations** with sufficient context
4. **Handle errors gracefully** and provide user-friendly messages
5. **Test rollback operations** with real store integrations

### For Users

1. **Verify before rollback**: Check the price change details before rolling back
2. **Act quickly**: Rollback is only possible if no subsequent changes have been made
3. **Monitor notifications**: Watch for sync failure notifications
4. **Review history**: Use rollback history to track all rollback operations
5. **Test in staging**: Test rollback procedures in a staging environment first

## Monitoring and Alerting

### Metrics to Monitor

1. **Rollback Success Rate**: Percentage of successful rollback operations
2. **Sync Failure Rate**: Percentage of rollback operations with sync failures
3. **Rollback Frequency**: Number of rollback operations per tenant
4. **Eligibility Rejection Rate**: Percentage of rollback attempts that fail eligibility checks

### Alerts to Configure

1. **High Rollback Rate**: Alert if rollback rate exceeds threshold (e.g., >10% of price updates)
2. **Sync Failures**: Alert on sync failures during rollback
3. **Repeated Rollbacks**: Alert if same product is rolled back multiple times
4. **Bulk Rollback**: Alert on bulk operation rollbacks (high impact)

## Troubleshooting

### Common Issues

#### "Cannot rollback: there have been subsequent price changes"

**Cause**: Another price update was made to the product after the one you're trying to rollback.

**Solution**: You can only rollback the most recent price change. If you need to revert to an earlier price, you'll need to manually update the price.

#### "This operation has already been rolled back"

**Cause**: The bulk operation has already been rolled back once.

**Solution**: Bulk operations can only be rolled back once. If you need to make further changes, use a new bulk update operation.

#### "Rollback Sync Failed"

**Cause**: The price was rolled back in the database but failed to sync to the store.

**Solution**: 
1. Check store connectivity
2. Verify API token is valid
3. Manually sync the product from the dashboard
4. Contact support if issue persists

## Future Enhancements

1. **Partial Bulk Rollback**: Allow rolling back specific products from a bulk operation
2. **Rollback Preview**: Show what will happen before executing rollback
3. **Scheduled Rollback**: Schedule rollback operations for future execution
4. **Rollback Approval**: Require approval for high-impact rollbacks
5. **Multi-level Rollback**: Support rolling back multiple levels of changes

## Related Documentation

- [API Design Standards](../api-design-standards.md)
- [Database Schema Guidelines](../database-schema-guidelines.md)
- [Security Requirements](../security-requirements.md)
- [Price Update Documentation](./PRICE_UPDATES.md)

## Support

For issues or questions about rollback procedures:
- Email: support@pricepilot.com
- Documentation: https://docs.pricepilot.com
- GitHub Issues: https://github.com/pricepilot/pricepilot/issues
