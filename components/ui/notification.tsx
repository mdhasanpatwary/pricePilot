/**
 * Notification component extending shadcn/ui components
 * Demonstrates proper composition patterns by building upon Card, Badge, and Button
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { Button, ButtonProps } from "@/components/ui/button";
import { X, Bell, CheckCircle2, AlertTriangle, Info } from "lucide-react";

export interface NotificationProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string;
    message: string;
    type?: "info" | "success" | "warning" | "error";
    timestamp?: Date;
    onDismiss?: () => void;
    actions?: Array<{
        label: string;
        onClick: () => void;
        variant?: ButtonProps["variant"];
    }>;
}

const notificationConfig = {
    info: {
        icon: Info,
        badgeVariant: "secondary" as BadgeProps["variant"],
        iconColor: "text-blue-500",
    },
    success: {
        icon: CheckCircle2,
        badgeVariant: "default" as BadgeProps["variant"],
        iconColor: "text-success",
    },
    warning: {
        icon: AlertTriangle,
        badgeVariant: "outline" as BadgeProps["variant"],
        iconColor: "text-amber-500",
    },
    error: {
        icon: AlertTriangle,
        badgeVariant: "destructive" as BadgeProps["variant"],
        iconColor: "text-destructive",
    },
};

/**
 * Notification component that extends shadcn/ui Card
 * Follows composition patterns by building upon existing components
 */
export function Notification({
    title,
    message,
    type = "info",
    timestamp,
    onDismiss,
    actions,
    className,
    ...props
}: NotificationProps) {
    const config = notificationConfig[type];
    const Icon = config.icon;

    const formatTimestamp = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);

        if (minutes < 1) return "Just now";
        if (minutes < 60) return `${minutes}m ago`;
        if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <Card className={cn("relative", className)} {...props}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                        <div className={cn("mt-0.5", config.iconColor)}>
                            <Icon className="w-4 h-4" />
                        </div>
                        <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold leading-none">{title}</h4>
                                <Badge variant={config.badgeVariant} className="text-[10px] uppercase">
                                    {type}
                                </Badge>
                            </div>
                            {timestamp && (
                                <p className="text-[10px] text-muted-foreground font-medium">
                                    {formatTimestamp(timestamp)}
                                </p>
                            )}
                        </div>
                    </div>
                    {onDismiss && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onDismiss}
                            className="p-1 h-auto hover:bg-muted"
                            aria-label="Dismiss notification"
                        >
                            <X className="w-3.5 h-3.5" />
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {message}
                </p>
                {actions && actions.length > 0 && (
                    <div className="flex items-center gap-2">
                        {actions.map((action, index) => (
                            <Button
                                key={index}
                                variant={action.variant || "outline"}
                                size="sm"
                                onClick={action.onClick}
                                className="text-xs"
                            >
                                {action.label}
                            </Button>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/**
 * NotificationList component for displaying multiple notifications
 * Demonstrates composition by using multiple Notification components
 */
export interface NotificationListProps extends React.HTMLAttributes<HTMLDivElement> {
    notifications: Array<NotificationProps & { id: string }>;
    onDismissAll?: () => void;
}

export function NotificationList({
    notifications,
    onDismissAll,
    className,
    ...props
}: NotificationListProps) {
    if (notifications.length === 0) {
        return (
            <div className={cn("text-center py-8", className)} {...props}>
                <Bell className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
        );
    }

    return (
        <div className={cn("space-y-4", className)} {...props}>
            {onDismissAll && notifications.length > 1 && (
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-semibold">Notifications</h3>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDismissAll}
                        className="text-xs"
                    >
                        Dismiss all
                    </Button>
                </div>
            )}
            {notifications.map(({ id, ...notification }) => (
                <Notification key={id} {...notification} />
            ))}
        </div>
    );
}