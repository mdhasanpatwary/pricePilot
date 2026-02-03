import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENABLED = process.env.SENTRY_ENABLED !== 'false';

if (SENTRY_ENABLED && SENTRY_DSN) {
    Sentry.init({
        dsn: SENTRY_DSN,

        // Environment configuration
        environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
        release: process.env.SENTRY_RELEASE,

        // Performance Monitoring
        tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0'),

        // Integrations
        integrations: [
            // Add Node.js specific integrations
        ],

        // Filter out sensitive data
        beforeSend(event, _hint) {
            // Remove sensitive data from breadcrumbs
            if (event.breadcrumbs) {
                event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
                    if (breadcrumb.data) {
                        // Remove sensitive fields
                        const sanitized: any = { ...breadcrumb.data };
                        delete sanitized.password;
                        delete sanitized.passwordHash;
                        delete sanitized.token;
                        delete sanitized.apiKey;
                        delete sanitized.apiToken;
                        delete sanitized.secret;
                        delete sanitized.encryptionKey;
                        delete sanitized.webhookUrl;
                        delete sanitized.slackWebhookUrl;
                        breadcrumb.data = sanitized;
                    }
                    return breadcrumb;
                });
            }

            // Remove sensitive data from request
            if (event.request?.data) {
                const sanitized: any = { ...event.request.data };
                delete sanitized.password;
                delete sanitized.passwordHash;
                delete sanitized.token;
                delete sanitized.apiKey;
                delete sanitized.apiToken;
                delete sanitized.secret;
                delete sanitized.encryptionKey;
                delete sanitized.webhookUrl;
                delete sanitized.slackWebhookUrl;
                event.request.data = sanitized;
            }

            // Remove sensitive data from extra context
            if (event.extra) {
                const sanitized: any = { ...event.extra };
                delete sanitized.password;
                delete sanitized.passwordHash;
                delete sanitized.token;
                delete sanitized.apiKey;
                delete sanitized.apiToken;
                delete sanitized.secret;
                delete sanitized.encryptionKey;
                delete sanitized.webhookUrl;
                delete sanitized.slackWebhookUrl;
                event.extra = sanitized;
            }

            return event;
        },

    });
}
