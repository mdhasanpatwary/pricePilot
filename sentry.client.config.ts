import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
const SENTRY_ENABLED = process.env.NEXT_PUBLIC_SENTRY_ENABLED !== 'false';

if (SENTRY_ENABLED && SENTRY_DSN) {
    Sentry.init({
        dsn: SENTRY_DSN,

        // Environment configuration
        environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
        release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

        // Performance Monitoring
        tracesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '1.0'),

        // Session Replay
        replaysSessionSampleRate: 0.1, // 10% of sessions
        replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

        // Integrations
        integrations: [
            Sentry.replayIntegration({
                maskAllText: true,
                blockAllMedia: true,
            }),
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
                        delete sanitized.token;
                        delete sanitized.apiKey;
                        delete sanitized.secret;
                        breadcrumb.data = sanitized;
                    }
                    return breadcrumb;
                });
            }

            // Remove sensitive data from request
            if (event.request?.data) {
                const sanitized: any = { ...event.request.data };
                delete sanitized.password;
                delete sanitized.token;
                delete sanitized.apiKey;
                delete sanitized.secret;
                event.request.data = sanitized;
            }

            return event;
        },
    });
}
