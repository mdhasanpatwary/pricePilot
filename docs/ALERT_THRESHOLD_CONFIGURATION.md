# Alert Threshold Configuration Guide

## Overview

The PricePilot monitoring system supports configurable alert thresholds at both global and per-tenant levels. This allows administrators to customize alert rules based on specific requirements while maintaining sensible defaults.

## Features

### Global Alert Rules
- Apply to all tenants by default
- Serve as baseline configuration
- Can be overridden by tenant-specific rules

### Per-Tenant Customization
- Override global rules for specific tenants
- Customize thresholds based on tenant needs
- Maintain tenant isolation

### Effective Rules Resolution
- System automatically resolves effective rules
- Tenant-specific rules take precedence over global rules
- Falls back to global rules when no tenant override exists

## Configuration Interface

### Admin Settings Page

Access the alert configuration interface at:
```
/admin/alert-settings
```

**Features:**
- View and manage global alert rules
- Switch between tenant-specific configurations
- Create, edit, and delete alert rules
- Enable/disable rules without deletion
- Test alert rules immediately

### Alert Rule Parameters

Each alert rule consists of:

| Parameter | Description | Example |
|-----------|-------------|---------|
| **Name** | Descriptive rule name | "High Error Rate" |
| **Description** | Optional detailed description | "Triggers when error rate exceeds threshold" |
| **Severity** | Alert severity level | CRITICAL, WARNING, INFO |
| **Metric Type** | Type of metric to monitor | error_rate, response_time, block_rate |
| **Threshold** | Numeric threshold value | 0.05 (5%), 500 (ms) |
| **Condition Operator** | Comparison operator | GT (>), GTE (>=), LT (<), LTE (<=), EQ (=) |
| **Aggregation** | How to aggregate metrics | AVG, COUNT, SUM, MAX, MIN, P95, P99 |
| **Time Window** | Time period for aggregation (seconds) | 300 (5 minutes), 3600 (1 hour) |
| **Enabled** | Whether rule is active | true/false |

## API Endpoints

### List Alert Rules

**GET** `/api/v1/monitoring/alert-rules`

Query Parameters:
- `tenantId` (optional): Filter rules by tenant ID

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "rule-123",
      "tenantId": null,
      "name": "High Error Rate",
      "severity": "CRITICAL",
      "metricType": "error_rate",
      "threshold": 0.05,
      "conditionOperator": "GT",
      "conditionAggregation": "AVG",
      "timeWindowSeconds": 300,
      "enabled": true
    }
  ]
}
```

### Get Effective Rules

**GET** `/api/v1/monitoring/alert-rules/effective`

Query Parameters:
- `tenantId` (optional): Tenant ID (defaults to authenticated user's tenant)

Returns the effective rules for a tenant, considering both tenant-specific overrides and global defaults.

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "rule-123",
      "name": "High Error Rate",
      "threshold": 0.05,
      ...
    }
  ],
  "meta": {
    "tenantId": "tenant-456",
    "count": 5
  }
}
```

### Create Alert Rule

**POST** `/api/v1/monitoring/alert-rules`

Request Body:
```json
{
  "name": "High Response Time",
  "description": "Alert when response time exceeds 500ms",
  "severity": "WARNING",
  "metricType": "response_time",
  "threshold": 500,
  "conditionOperator": "GT",
  "conditionAggregation": "P95",
  "timeWindowSeconds": 300,
  "enabled": true,
  "tenantId": null
}
```

**Note:** Set `tenantId` to `null` for global rules, or specify a tenant ID for tenant-specific rules.

### Update Alert Rule

**PUT** `/api/v1/monitoring/alert-rules/{ruleId}`

Request Body (partial update):
```json
{
  "threshold": 600,
  "enabled": true
}
```

### Delete Alert Rule

**DELETE** `/api/v1/monitoring/alert-rules/{ruleId}`

## Common Use Cases

### 1. Create Global Default Rules

Create baseline rules that apply to all tenants:

```typescript
// High error rate alert
{
  "name": "High Error Rate",
  "severity": "CRITICAL",
  "metricType": "error_rate",
  "threshold": 0.05,
  "conditionOperator": "GT",
  "conditionAggregation": "AVG",
  "timeWindowSeconds": 300,
  "tenantId": null
}
```

### 2. Override for Specific Tenant

Create tenant-specific rule with different threshold:

```typescript
// Same metric, different threshold for tenant
{
  "name": "High Error Rate",
  "severity": "CRITICAL",
  "metricType": "error_rate",
  "threshold": 0.10,  // Higher threshold for this tenant
  "conditionOperator": "GT",
  "conditionAggregation": "AVG",
  "timeWindowSeconds": 300,
  "tenantId": "tenant-123"
}
```

### 3. Temporarily Disable Rule

Disable a rule without deleting it:

```typescript
// Update rule to disable
{
  "enabled": false
}
```

### 4. Adjust Threshold Based on Metrics

Update threshold based on observed behavior:

```typescript
// Increase threshold after analysis
{
  "threshold": 0.08
}
```

## Best Practices

### 1. Start with Conservative Thresholds
- Begin with stricter thresholds
- Adjust based on actual alert frequency
- Avoid alert fatigue

### 2. Use Appropriate Time Windows
- Short windows (5-15 min) for critical metrics
- Longer windows (30-60 min) for trends
- Consider metric volatility

### 3. Choose Right Aggregation
- **AVG**: General performance metrics
- **P95/P99**: Response time, latency
- **MAX**: Peak values, capacity planning
- **COUNT**: Event frequency

### 4. Severity Levels
- **CRITICAL**: Immediate action required
- **WARNING**: Attention needed soon
- **INFO**: Informational, no action needed

### 5. Tenant Customization
- Override only when necessary
- Document reasons for overrides
- Review overrides periodically

## Monitoring Alert Configuration

### Audit Trail

All alert configuration changes are logged:
- Who made the change
- What was changed
- When it was changed
- Previous and new values

### Testing Rules

Test alert rules before enabling:
1. Create rule in disabled state
2. Use "Test Rule" function
3. Verify alert triggers correctly
4. Enable rule when satisfied

## Troubleshooting

### Rule Not Triggering

**Check:**
1. Rule is enabled
2. Threshold is appropriate for metric scale
3. Time window is sufficient
4. Metric data is being collected
5. Condition operator is correct

### Too Many Alerts

**Solutions:**
1. Increase threshold
2. Lengthen time window
3. Change aggregation method
4. Add maintenance windows

### Tenant Override Not Working

**Verify:**
1. Tenant ID is correct
2. Metric type matches exactly
3. Rule is enabled
4. Using effective rules endpoint

## Security Considerations

### Access Control
- Only super admins can configure global rules
- Tenant admins can configure tenant-specific rules
- All changes are audited

### Validation
- All rule parameters are validated
- Invalid configurations are rejected
- Descriptive error messages provided

## Related Documentation

- [Monitoring System Overview](./MONITORING_SYSTEM.md)
- [Alert Notifications](./ALERT_NOTIFICATIONS.md)
- [API Documentation](./API_DOCUMENTATION_INDEX.md)

## Support

For issues or questions:
1. Check troubleshooting section
2. Review audit logs
3. Test rules individually
4. Contact system administrator
