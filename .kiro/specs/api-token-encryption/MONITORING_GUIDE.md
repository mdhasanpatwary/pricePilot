# API Token Encryption - Monitoring and Alerting Guide

## Overview

This guide defines the metrics, alerts, and monitoring procedures for the API token encryption feature. Proper monitoring ensures early detection of security issues, performance problems, and operational failures.

## Monitoring Architecture

```
┌─────────────────┐
│   Application   │
│   (Encryption)  │
└────────┬────────┘
         │
         │ Metrics & Logs
         ▼
┌─────────────────┐
│  Metrics Store  │
│  (Prometheus/   │
│   CloudWatch)   │
└────────┬────────┘
         │
         │ Queries
         ▼
┌─────────────────┐
│  Alert Manager  │
│  (PagerDuty/    │
│   Slack)        │
└─────────────────┘
```

## Key Metrics to Monitor

### 1. Encryption Operations

#### Metric: `encryption_operations_total`
**Type:** Counter  
**Labels:** `operation` (encrypt/decrypt), `status` (success/failure)  
**Description:** Total number of encryption/decryption operations

**Query Examples:**
```promql
# Total encryptions per minute
rate(encryption_operations_total{operation="encrypt"}[1m])

# Encryption success rate
rate(encryption_operations_total{operation="encrypt",status="success"}[5m]) 
/ 
rate(encryption_operations_total{operation="encrypt"}[5m])
```

**What to watch:**
- Sudden drops in operation count (system issue)
- Increasing failure rate (key or configuration problem)

#### Metric: `encryption_operation_duration_ms`
**Type:** Histogram  
**Labels:** `operation` (encrypt/decrypt)  
**Description:** Duration of encryption/decryption operations in milliseconds

**Query Examples:**
```promql
# 95th percentile encryption latency
histogram_quantile(0.95, encryption_operation_duration_ms{operation="encrypt"})

# Average decryption time
avg(encryption_operation_duration_ms{operation="decrypt"})
```

**What to watch:**
- Latency > 10ms (performance degradation)
- Increasing latency trend (resource contention)

### 2. Decryption Failures

#### Metric: `decryption_failures_total`
**Type:** Counter  
**Labels:** `error_type` (authentication_error, invalid_format, key_error)  
**Description:** Total number of decryption failures by error type

**Query Examples:**
```promql
# Decryption failure rate
rate(decryption_failures_total[5m])

# Authentication errors (potential tampering)
rate(decryption_failures_total{error_type="authentication_error"}[5m])
```

**What to watch:**
- Any authentication errors (security incident)
- High failure rate (wrong key or corrupted data)

### 3. Token Migration

#### Metric: `token_migration_total`
**Type:** Counter  
**Labels:** `status` (success/failure)  
**Description:** Total number of token migrations

**Query Examples:**
```promql
# Migration success rate
rate(token_migration_total{status="success"}[1h]) 
/ 
rate(token_migration_total[1h])

# Failed migrations
sum(token_migration_total{status="failure"})
```

**What to watch:**
- Migration failures (data quality issues)
- Unexpected migrations after initial deployment

### 4. Key Access

#### Metric: `key_access_total`
**Type:** Counter  
**Labels:** `operation` (load, validate)  
**Description:** Total number of key access operations

**Query Examples:**
```promql
# Key access frequency
rate(key_access_total[5m])

# Key validation failures
rate(key_access_total{operation="validate",status="failure"}[5m])
```

**What to watch:**
- Key validation failures (configuration issue)
- Unusual access patterns (security concern)

### 5. Audit Log Events

#### Metric: `audit_log_events_total`
**Type:** Counter  
**Labels:** `event_type` (token_encrypted, token_decrypted, token_migrated)  
**Description:** Total number of audit log events

**Query Examples:**
```promql
# Encryption events per minute
rate(audit_log_events_total{event_type="token_encrypted"}[1m])

# Decryption events by tenant
sum by (tenant_id) (audit_log_events_total{event_type="token_decrypted"})
```

**What to watch:**
- Missing audit logs (logging failure)
- Unusual patterns (security investigation)

### 6. Cache Performance

#### Metric: `token_cache_hits_total` / `token_cache_misses_total`
**Type:** Counter  
**Description:** Token cache hit/miss counts

**Query Examples:**
```promql
# Cache hit rate
rate(token_cache_hits_total[5m]) 
/ 
(rate(token_cache_hits_total[5m]) + rate(token_cache_misses_total[5m]))
```

**What to watch:**
- Low hit rate (caching not working)
- Cache effectiveness over time

## Alert Definitions

### Critical Alerts (Page Immediately)

#### Alert: EncryptionKeyMissing
**Severity:** Critical  
**Condition:** Application cannot load encryption key  
**Threshold:** Any occurrence  

```yaml
alert: EncryptionKeyMissing
expr: encryption_key_load_failures_total > 0
for: 1m
labels:
  severity: critical
annotations:
  summary: "Encryption key not found or invalid"
  description: "Application cannot load ENCRYPTION_MASTER_KEY. All encryption operations will fail."
  runbook: "Check environment variables, verify key is set correctly"
```

**Response:**
1. Verify ENCRYPTION_MASTER_KEY environment variable is set
2. Check key format (44 characters, base64)
3. Review application startup logs
4. Escalate to security team if key is compromised

#### Alert: AuthenticationErrorsDetected
**Severity:** Critical  
**Condition:** Decryption authentication errors detected  
**Threshold:** > 0 in 5 minutes  

```yaml
alert: AuthenticationErrorsDetected
expr: rate(decryption_failures_total{error_type="authentication_error"}[5m]) > 0
for: 5m
labels:
  severity: critical
annotations:
  summary: "Token authentication errors detected - possible tampering"
  description: "{{ $value }} authentication errors per second. This may indicate data tampering or corruption."
  runbook: "Investigate affected tokens, check database integrity, review audit logs"
```

**Response:**
1. Identify affected website records
2. Review audit logs for suspicious activity
3. Check database for corruption
4. Mark affected websites for re-authentication
5. Escalate to security team

#### Alert: HighDecryptionFailureRate
**Severity:** Critical  
**Condition:** Decryption failure rate > 5%  
**Threshold:** > 5% for 5 minutes  

```yaml
alert: HighDecryptionFailureRate
expr: |
  (rate(decryption_failures_total[5m]) / rate(encryption_operations_total{operation="decrypt"}[5m])) > 0.05
for: 5m
labels:
  severity: critical
annotations:
  summary: "High decryption failure rate: {{ $value | humanizePercentage }}"
  description: "More than 5% of decryption operations are failing"
  runbook: "Check if wrong key is deployed, verify database integrity"
```

**Response:**
1. Verify correct encryption key is deployed
2. Check for recent configuration changes
3. Review error logs for patterns
4. Consider rollback if widespread issue

### Warning Alerts (Investigate Soon)

#### Alert: EncryptionLatencyHigh
**Severity:** Warning  
**Condition:** 95th percentile latency > 10ms  
**Threshold:** > 10ms for 10 minutes  

```yaml
alert: EncryptionLatencyHigh
expr: histogram_quantile(0.95, encryption_operation_duration_ms) > 10
for: 10m
labels:
  severity: warning
annotations:
  summary: "Encryption operations are slow: {{ $value }}ms"
  description: "95th percentile encryption latency exceeds 10ms threshold"
  runbook: "Check system resources, database performance, consider scaling"
```

**Response:**
1. Check CPU and memory usage
2. Review database query performance
3. Check for resource contention
4. Consider horizontal scaling

#### Alert: PlaintextTokensDetected
**Severity:** Warning  
**Condition:** Plaintext tokens detected after migration  
**Threshold:** > 0 for 1 hour  

```yaml
alert: PlaintextTokensDetected
expr: plaintext_tokens_count > 0
for: 1h
labels:
  severity: warning
annotations:
  summary: "{{ $value }} plaintext tokens still in database"
  description: "Some tokens were not migrated to encrypted format"
  runbook: "Run migration utility, investigate failed migrations"
```

**Response:**
1. Run migration utility in dry-run mode
2. Identify unmigrated tokens
3. Investigate why migration failed
4. Re-run migration or mark for re-authentication

#### Alert: MigrationFailures
**Severity:** Warning  
**Condition:** Token migration failures detected  
**Threshold:** > 5 failures in 1 hour  

```yaml
alert: MigrationFailures
expr: increase(token_migration_total{status="failure"}[1h]) > 5
for: 5m
labels:
  severity: warning
annotations:
  summary: "{{ $value }} token migrations failed in the last hour"
  description: "Multiple tokens failed to migrate to encrypted format"
  runbook: "Review migration logs, check database connectivity, investigate specific failures"
```

**Response:**
1. Review migration error logs
2. Check database connectivity
3. Investigate specific failed records
4. Re-run migration for failed tokens

### Informational Alerts (Monitor Trends)

#### Alert: UnusualEncryptionVolume
**Severity:** Info  
**Condition:** Encryption operations 2x above baseline  
**Threshold:** > 2x baseline for 15 minutes  

```yaml
alert: UnusualEncryptionVolume
expr: |
  rate(encryption_operations_total{operation="encrypt"}[5m]) 
  > 
  2 * avg_over_time(rate(encryption_operations_total{operation="encrypt"}[5m])[1d:5m])
for: 15m
labels:
  severity: info
annotations:
  summary: "Encryption volume is {{ $value }}x above baseline"
  description: "Unusual increase in encryption operations"
  runbook: "Investigate if this is expected (e.g., bulk import) or anomalous"
```

**Response:**
1. Check for bulk operations or imports
2. Review recent user activity
3. Verify no automated attacks
4. Monitor for continued anomalies

## Dashboard Recommendations

### Dashboard 1: Encryption Operations Overview

**Panels:**
1. **Encryption Operations Rate** (Time series)
   - Encryptions per minute
   - Decryptions per minute
   
2. **Operation Success Rate** (Gauge)
   - Encryption success rate
   - Decryption success rate
   
3. **Operation Latency** (Time series)
   - P50, P95, P99 latency
   - Separate lines for encrypt/decrypt
   
4. **Error Rate** (Time series)
   - Decryption failures by error type
   - Stacked area chart

### Dashboard 2: Security Monitoring

**Panels:**
1. **Authentication Errors** (Single stat)
   - Count of authentication errors
   - Red if > 0
   
2. **Audit Events** (Time series)
   - Events by type (encrypted, decrypted, migrated)
   - Stacked area chart
   
3. **Key Access Events** (Time series)
   - Key load and validation events
   
4. **Failed Decryptions by Tenant** (Table)
   - Top tenants with decryption failures
   - Sortable by count

### Dashboard 3: Migration Progress

**Panels:**
1. **Migration Status** (Pie chart)
   - Encrypted vs plaintext tokens
   
2. **Migration Rate** (Time series)
   - Successful migrations per hour
   - Failed migrations per hour
   
3. **Migration Statistics** (Single stats)
   - Total migrated
   - Total failed
   - Success rate
   
4. **Recent Migrations** (Table)
   - Recent migration events
   - Status and error details

## Log Monitoring

### Critical Log Patterns

#### Pattern 1: Key Loading Failures
```
[ERROR] Failed to load encryption key: KeyNotFoundError
[ERROR] ENCRYPTION_MASTER_KEY environment variable not set
```

**Action:** Immediate investigation, verify environment configuration

#### Pattern 2: Authentication Errors
```
[ERROR] Authentication tag verification failed for website {id}
[SECURITY] Potential data tampering detected
```

**Action:** Security investigation, check database integrity

#### Pattern 3: Decryption Failures
```
[ERROR] Failed to decrypt token for website {id}: DecryptionError
[ERROR] Invalid encrypted format detected
```

**Action:** Investigate specific website, may need re-authentication

### Log Aggregation Queries

**Query 1: Encryption errors in last hour**
```
level:ERROR AND (encryption OR decryption) AND timestamp:[now-1h TO now]
```

**Query 2: Security events**
```
level:SECURITY AND timestamp:[now-24h TO now]
```

**Query 3: Migration events**
```
event:token_migrated AND timestamp:[now-1h TO now]
```

## Troubleshooting Procedures

### Procedure 1: Investigating Decryption Failures

**Steps:**
1. Identify affected website(s) from logs
2. Query database for website record:
   ```sql
   SELECT id, tenant_id, platform, api_token 
   FROM user_websites 
   WHERE id = 'affected_website_id';
   ```
3. Check if token format is valid:
   - Should start with `aes-256-gcm:`
   - Should have 4 colon-separated parts
4. Check audit logs for recent changes:
   ```sql
   SELECT * FROM audit_logs 
   WHERE website_id = 'affected_website_id' 
   ORDER BY timestamp DESC 
   LIMIT 10;
   ```
5. Verify encryption key is correct in environment
6. If corrupted, mark for re-authentication:
   ```sql
   UPDATE user_websites 
   SET status = 'requires_reauth' 
   WHERE id = 'affected_website_id';
   ```

### Procedure 2: Investigating Performance Issues

**Steps:**
1. Check current latency metrics:
   ```promql
   histogram_quantile(0.95, encryption_operation_duration_ms)
   ```
2. Review system resources (CPU, memory, disk I/O)
3. Check database query performance:
   ```sql
   SELECT query, mean_exec_time, calls 
   FROM pg_stat_statements 
   WHERE query LIKE '%user_websites%' 
   ORDER BY mean_exec_time DESC 
   LIMIT 10;
   ```
4. Verify token cache is working:
   ```promql
   rate(token_cache_hits_total[5m]) / 
   (rate(token_cache_hits_total[5m]) + rate(token_cache_misses_total[5m]))
   ```
5. Check for resource contention or scaling needs

### Procedure 3: Investigating Security Alerts

**Steps:**
1. Review authentication error details in logs
2. Identify affected tenant and website
3. Check audit logs for suspicious activity:
   ```sql
   SELECT * FROM audit_logs 
   WHERE tenant_id = 'affected_tenant' 
   AND timestamp > NOW() - INTERVAL '24 hours'
   ORDER BY timestamp DESC;
   ```
4. Verify database integrity:
   ```sql
   SELECT COUNT(*) as corrupted_tokens
   FROM user_websites
   WHERE api_token IS NOT NULL 
   AND api_token NOT LIKE 'aes-256-gcm:%'
   AND LENGTH(api_token) > 100;
   ```
5. If tampering suspected, escalate to security team
6. Consider forcing re-authentication for affected users

## Monitoring Checklist

### Daily Checks
- [ ] Review critical alerts from last 24 hours
- [ ] Check encryption operation success rate
- [ ] Verify no authentication errors
- [ ] Review error logs for patterns

### Weekly Checks
- [ ] Review encryption latency trends
- [ ] Check migration progress (if ongoing)
- [ ] Verify audit log completeness
- [ ] Review dashboard for anomalies

### Monthly Checks
- [ ] Review all alert thresholds for accuracy
- [ ] Analyze long-term performance trends
- [ ] Verify monitoring coverage is complete
- [ ] Update runbooks based on incidents

## Integration with Existing Monitoring

### Prometheus Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'pricepilot-encryption'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### CloudWatch Metrics

```javascript
// Publish custom metrics
const cloudwatch = new AWS.CloudWatch();

await cloudwatch.putMetricData({
  Namespace: 'PricePilot/Encryption',
  MetricData: [{
    MetricName: 'EncryptionDuration',
    Value: durationMs,
    Unit: 'Milliseconds',
    Timestamp: new Date(),
    Dimensions: [{
      Name: 'Operation',
      Value: 'encrypt'
    }]
  }]
}).promise();
```

### Datadog Integration

```javascript
// Send metrics to Datadog
const dogstatsd = require('node-dogstatsd').StatsD;
const client = new dogstatsd();

client.histogram('encryption.duration', durationMs, ['operation:encrypt']);
client.increment('encryption.operations', 1, ['operation:encrypt', 'status:success']);
```

## Alert Routing

### Severity-Based Routing

**Critical Alerts:**
- PagerDuty: Page on-call engineer
- Slack: #incidents channel
- Email: engineering-leads@pricepilot.com

**Warning Alerts:**
- Slack: #engineering-alerts channel
- Email: engineering-team@pricepilot.com

**Info Alerts:**
- Slack: #monitoring channel
- Dashboard notifications only

### On-Call Rotation

Ensure 24/7 coverage for critical encryption alerts:
- Primary on-call: Responds within 15 minutes
- Secondary on-call: Backup if primary unavailable
- Escalation: Engineering manager after 30 minutes

## References

- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Key Rotation Procedure](./KEY_ROTATION_GUIDE.md)
- [Design Document](./design.md)
- [Requirements Document](./requirements.md)
