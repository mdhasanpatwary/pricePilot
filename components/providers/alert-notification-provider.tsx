"use client";

import { useEffect, useState, createContext, useContext, useRef } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

/**
 * Alert severity levels
 */
type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Alert notification interface
 */
interface AlertNotification {
    id: string;
    severity: AlertSeverity;
    title: string;
    message: string;
    competitorWebsiteId?: string;
    timestamp: Date;
}

/**
 * Alert notification context
 */
interface AlertNotificationContextType {
    notifications: AlertNotification[];
    dismissNotification: (id: string) => void;
}

const AlertNotificationContext = createContext<AlertNotificationContextType>({
    notifications: [],
    dismissNotification: () => { },
});

/**
 * Hook to use alert notifications
 */
export function useAlertNotifications() {
    return useContext(AlertNotificationContext);
}

/**
 * Get color classes for alert severity
 */
function getSeverityColors(severity: AlertSeverity) {
    switch (severity) {
        case 'critical':
            return {
                bg: 'bg-red-50 dark:bg-red-950/90',
                border: 'border-red-200 dark:border-red-900',
                icon: 'text-red-600 dark:text-red-400',
            };
        case 'warning':
            return {
                bg: 'bg-amber-50 dark:bg-amber-950/90',
                border: 'border-amber-200 dark:border-amber-900',
                icon: 'text-amber-600 dark:text-amber-400',
            };
        default:
            return {
                bg: 'bg-gray-50 dark:bg-gray-950/90',
                border: 'border-gray-200 dark:border-gray-900',
                icon: 'text-gray-600 dark:text-gray-400',
            };
    }
}

/**
 * Toast Notification Component
 */
function ToastNotification({
    notification,
    onDismiss,
}: {
    notification: AlertNotification;
    onDismiss: () => void;
}) {
    const colors = getSeverityColors(notification.severity);

    // Auto-dismiss after 10 seconds for non-critical alerts
    useEffect(() => {
        if (notification.severity !== 'critical') {
            const timer = setTimeout(onDismiss, 10000);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [notification.severity, onDismiss]);

    return (
        <div
            className={cn(
                "w-full max-w-md p-4 rounded-lg border shadow-lg backdrop-blur-sm",
                colors.bg,
                colors.border,
                "animate-in slide-in-from-right duration-300"
            )}
        >
            <div className="flex items-start gap-3">
                {notification.severity === 'critical' ? (
                    <XCircle className={cn("w-5 h-5 mt-0.5 shrink-0", colors.icon)} />
                ) : (
                    <AlertTriangle className={cn("w-5 h-5 mt-0.5 shrink-0", colors.icon)} />
                )}

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-foreground">
                            {notification.title}
                        </h4>
                        <button
                            onClick={onDismiss}
                            className="shrink-0 p-0.5 hover:bg-background/50 rounded transition-colors"
                        >
                            <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                    </div>

                    <p className="text-xs text-muted-foreground mb-2">
                        {notification.message}
                    </p>

                    <Link
                        href="/admin/alerts"
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={onDismiss}
                    >
                        View All Alerts →
                    </Link>
                </div>
            </div>
        </div>
    );
}

/**
 * AlertNotificationProvider Component
 * 
 * Provides in-app toast notifications for critical scraping alerts.
 * Polls for new critical alerts and displays them as toast notifications.
 * 
 * Requirements: 12.4
 */
export function AlertNotificationProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const [notifications, setNotifications] = useState<AlertNotification[]>([]);
    const lastSeenAlertTimestampRef = useRef<number>(0);

    useEffect(() => {
        if (!session?.user?.id) return;

        let isCancelled = false;
        lastSeenAlertTimestampRef.current = Date.now();

        const checkForAlerts = async () => {
            if (isCancelled || document.hidden) return;

            try {
                const res = await fetch(
                    `/api/v1/scraping/alerts?severity=critical&acknowledged=false&sort=-timestamp&limit=5`
                );
                if (!res.ok) return;

                const data = await res.json();
                const alerts = data.data?.alerts || [];
                const currentLastSeen = lastSeenAlertTimestampRef.current;

                // Filter for alerts created after last check
                const newAlerts = alerts.filter((alert: any) => {
                    const alertTime = new Date(alert.timestamp).getTime();
                    return Number.isFinite(alertTime) && alertTime > currentLastSeen;
                });

                if (newAlerts.length > 0) {
                    // Add new notifications
                    const newNotifications = newAlerts.map((alert: any) => ({
                        id: alert.id,
                        severity: alert.severity,
                        title: alert.title,
                        message: alert.message,
                        competitorWebsiteId: alert.competitorWebsiteId,
                        timestamp: new Date(alert.timestamp),
                    }));

                    setNotifications((prev) => [...newNotifications, ...prev].slice(0, 5));
                }

                const maxSeenFromBatch = alerts.reduce((maxTs: number, alert: any) => {
                    const alertTime = new Date(alert.timestamp).getTime();
                    return Number.isFinite(alertTime) && alertTime > maxTs ? alertTime : maxTs;
                }, currentLastSeen);
                lastSeenAlertTimestampRef.current = maxSeenFromBatch;
            } catch (error) {
                console.error('Failed to check for alerts:', error);
            }
        };

        // Initial check
        void checkForAlerts();

        // Poll every 30 seconds while tab is visible
        const interval = setInterval(() => {
            void checkForAlerts();
        }, 30000);

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                void checkForAlerts();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            isCancelled = true;
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [session?.user?.id]);

    const dismissNotification = (id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    };

    return (
        <AlertNotificationContext.Provider value={{ notifications, dismissNotification }}>
            {children}

            {/* Toast Notifications Container */}
            {notifications.length > 0 && (
                <div className="fixed top-4 right-4 z-[9999] space-y-2 pointer-events-none">
                    <div className="pointer-events-auto space-y-2">
                        {notifications.map((notification) => (
                            <ToastNotification
                                key={notification.id}
                                notification={notification}
                                onDismiss={() => dismissNotification(notification.id)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </AlertNotificationContext.Provider>
    );
}
