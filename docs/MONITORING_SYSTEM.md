# Monitoring and Alerting System Documentation

## Overview

The PricePilot monitoring and alerting system provides comprehensive observability for the platform, tracking application health, detecting critical issues, and delivering multi-channel notifications to ensure rapid incident response.

## Key Features

- **Error Tracking**: Integration with Sentry for real-time error capture and analysis
- **Performance Monitoring**: Track response times, database queries, and external API calls
- **Custom Metrics**: Business-critical metrics for scraping, price updates, and system health
- **Multi-Channel Alerts**: Email and Slack notifications with configurable routing
- **Real-Time Dashboard**: Live system health monitoring with auto-refresh
- **Alert Management**: Configure thresholds, notification channels, and maintenance windows
- **Multi-Tenant Support**: Tenant-specific metrics and alerts
- **Security Monitoring**: Track authentication failures, rate limits, and suspicious activity

## Architecture

### Components

1. **Error Capture Middleware**: Intercepts application errors and sends to Sentry
2. **Metrics Collector**: Collects and aggregates application metrics in Redis
3. **Alert Rules Evaluator**: Evaluates metrics against configured alert rules
4. **Alert Deduplication Manager**: Prevents duplicate alerts and manages lifecycle
5. **Notification Router**: Routes alerts to appropriate channels (email, Slack)
6. **Monitoring Dashboard**: Real-time UI for system health visualization
7. **Alert Configuration Service**: Manages alert rules and notification settings

### Data Flow

```
Application → Error Capture → Sentry
           → Metrics Collector → Redis
           
Redis → Alert Evaluator → Notification Router → Email/Slack
                        → Dashboard Service → UI
```

## Getting Started

### Prerequisites

- Sentry account and DSN
- Redis/Upstash instance
- Email service configured (Resend)
- Slack workspace (optional)

### Environment Variables

See [Environment Variables Documentation](./MONITORING_ENVIRONMENT_VARIABLES.md) for complete configuration.

### Initial Setup

1. Configure environment variables
2. Run database migrations
3. Verify Sentry integration
4. Configure notification channels
5. Set up alert rules
6. Access monitoring dashboard

## Core Concepts

### Metrics

Metrics are time-series data points collected from application operations:

- **Response Times**: API endpoint latency
- **Error Rates**: Percentage of failed requests
- **Scraping Metrics**: Success/block rates for competitor scraping
- **Price Updates**: Success rates for price update operations
- **Security Events**: Authentication failures, rate limit violations

### Alert Rules

Alert rules define conditions that trigger notifications:

- **Metric Type**: What to monitor (error_rate, response_time, etc.)
- **Threshold**: Value that triggers the alert
- **Time Window**: Period over which to evaluate the metric
- **Severity**: Critical, warning, or info
- **Notification Channels**: Where to send alerts

### Alert Lifecycle

1. **Triggered**: Metric exceeds threshold
2. **Sent**: Notification delivered to channels
3. **Resolved**: Metric returns to normal
4. **Deduplicated**: Duplicate alerts suppressed within 15-minute window

## Built-in Alert Rules

The system includes pre-configured alert rules:

1. **High Error Rate**: Triggers when error rate > 1% over 5 minutes
2. **Slow Response Time**: Triggers when avg response time > 500ms over 5 minutes
3. **High Block Rate**: Triggers when scraping block rate > 30% over 15 minutes
4. **Price Update Failures**: Triggers when failure rate > 10% over 10 minutes
5. **Authentication Failures**: Triggers on 10+ failed attempts from single IP in 1 minute
6. **Database Connection Issues**: Triggers on any connection errors
7. **Redis Connection Issues**: Triggers on any connection errors

## User Guides

- [Alert Rule Configuration](./MONITORING_ALERT_CONFIGURATION.md)
- [Notification Channel Setup](./MONITORING_NOTIFICATION_SETUP.md)
- [Dashboard Usage](./MONITORING_UI.md)
- [Troubleshooting Guide](./MONITORING_TROUBLESHOOTING.md)

## API Reference

See [API Monitoring Documentation](./API_MONITORING.md) for complete API reference.

## Performance

The monitoring system is designed for minimal overhead:

- **Request Overhead**: < 5ms per request
- **Alert Evaluation**: < 1 second for all rules
- **Notification Delivery**: < 5 seconds to all channels

## Security

- All monitoring data respects tenant isolation
- Sensitive data is sanitized before capture
- API tokens are encrypted at rest
- Dashboard requires admin role access
- Alert delivery is logged for audit

## Support

For issues or questions:
1. Check the [Troubleshooting Guide](./MONITORING_TROUBLESHOOTING.md)
2. Review alert delivery logs in the dashboard
3. Check Sentry for error details
4. Contact platform support

## Related Documentation

- [Monitoring Infrastructure Setup](./MONITORING_INFRASTRUCTURE_SETUP.md)
- [Email Notifications](./EMAIL_NOTIFICATIONS.md)
- [Performance Monitoring](./PERFORMANCE_MONITORING.md)
- [API Monitoring](./API_MONITORING.md)
