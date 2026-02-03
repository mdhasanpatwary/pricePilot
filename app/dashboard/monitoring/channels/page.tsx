"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    Plus,
    Edit,
    Trash2,
    TestTube,
    Mail,
    MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

/**
 * Notification Channels Configuration Page
 * 
 * Provides UI for managing notification channels (email, Slack).
 * 
 * Features:
 * - Email channel configuration form
 * - Slack channel configuration form
 * - Channel test functionality
 * - Channel enable/disable toggles
 * 
 * Requirements: 4.5, 5.4
 */

interface NotificationChannel {
    id: string;
    type: "EMAIL" | "SLACK";
    name: string;
    enabled: boolean;
    config: EmailConfig | SlackConfig;
    createdAt: string;
    updatedAt: string;
}

interface EmailConfig {
    recipients: string[];
    fromAddress?: string;
    fromName?: string;
}

interface SlackConfig {
    webhookUrl: string;
    channel: string;
    username?: string;
    iconEmoji?: string;
}

export default function NotificationChannelsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [channels, setChannels] = useState<NotificationChannel[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);
    const [channelType, setChannelType] = useState<"EMAIL" | "SLACK">("EMAIL");
    const [formData, setFormData] = useState({
        name: "",
        enabled: true,
        emailRecipients: "",
        emailFromAddress: "",
        emailFromName: "",
        slackWebhookUrl: "",
        slackChannel: "",
        slackUsername: "",
        slackIconEmoji: "",
    });

    // Check admin access
    useEffect(() => {
        if (status === "loading") return;

        if (!session?.user) {
            router.push("/auth/login");
            return;
        }

        const isAdmin = session.user.role === "ADMIN" || session.user.isSuperAdmin === true;
        if (!isAdmin) {
            router.push("/dashboard");
            return;
        }
    }, [session, status, router]);

    // Fetch channels
    useEffect(() => {
        if (session?.user && (session.user.role === "ADMIN" || session.user.isSuperAdmin)) {
            fetchChannels();
        }
    }, [session]);

    const fetchChannels = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/v1/monitoring/channels");
            if (res.ok) {
                const data = await res.json();
                setChannels(data.data.channels || []);
            }
        } catch (error) {
            console.error("Failed to fetch channels:", error);
            toast.error("Failed to load notification channels");
        } finally {
            setLoading(false);
        }
    };

    const handleToggleChannel = async (channelId: string, enabled: boolean) => {
        try {
            const res = await fetch(`/api/v1/monitoring/channels/${channelId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled }),
            });

            if (res.ok) {
                toast.success(enabled ? "Channel enabled" : "Channel disabled");
                fetchChannels();
            } else {
                toast.error("Failed to update channel");
            }
        } catch (error) {
            toast.error("Failed to update channel");
        }
    };

    const handleTestChannel = async (channelId: string, channelName: string) => {
        try {
            toast.info(`Sending test notification to ${channelName}...`);
            const res = await fetch(`/api/v1/monitoring/channels/${channelId}/test`, {
                method: "POST",
            });

            if (res.ok) {
                const data = await res.json();
                if (data.data.testSent) {
                    toast.success("Test notification sent successfully");
                } else {
                    toast.error("Test notification failed - check channel configuration");
                }
            } else {
                toast.error("Failed to send test notification");
            }
        } catch (error) {
            toast.error("Failed to send test notification");
        }
    };

    const handleDeleteChannel = async (channelId: string) => {
        if (!confirm("Are you sure you want to delete this notification channel?")) {
            return;
        }

        try {
            const res = await fetch(`/api/v1/monitoring/channels/${channelId}`, {
                method: "DELETE",
            });

            if (res.ok) {
                toast.success("Channel deleted");
                fetchChannels();
            } else {
                toast.error("Failed to delete channel");
            }
        } catch (error) {
            toast.error("Failed to delete channel");
        }
    };

    const handleSaveChannel = async () => {
        // Validation
        if (!formData.name) {
            toast.error("Please enter a channel name");
            return;
        }

        let config: EmailConfig | SlackConfig;

        if (channelType === "EMAIL") {
            const recipients = formData.emailRecipients
                .split(",")
                .map((r) => r.trim())
                .filter((r) => r);

            if (recipients.length === 0) {
                toast.error("Please enter at least one email recipient");
                return;
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const invalidEmails = recipients.filter((email) => !emailRegex.test(email));
            if (invalidEmails.length > 0) {
                toast.error(`Invalid email addresses: ${invalidEmails.join(", ")}`);
                return;
            }

            config = {
                recipients,
                ...(formData.emailFromAddress && { fromAddress: formData.emailFromAddress }),
                ...(formData.emailFromName && { fromName: formData.emailFromName }),
            };
        } else {
            // Slack validation
            if (!formData.slackWebhookUrl) {
                toast.error("Please enter a Slack webhook URL");
                return;
            }

            if (!formData.slackChannel) {
                toast.error("Please enter a Slack channel");
                return;
            }

            config = {
                webhookUrl: formData.slackWebhookUrl,
                channel: formData.slackChannel,
                ...(formData.slackUsername && { username: formData.slackUsername }),
                ...(formData.slackIconEmoji && { iconEmoji: formData.slackIconEmoji }),
            };
        }

        try {
            const url = editingChannel
                ? `/api/v1/monitoring/channels/${editingChannel.id}`
                : "/api/v1/monitoring/channels";

            const method = editingChannel ? "PUT" : "POST";

            const payload = editingChannel
                ? { name: formData.name, enabled: formData.enabled, config }
                : { type: channelType, name: formData.name, enabled: formData.enabled, config };

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                toast.success(editingChannel ? "Channel updated" : "Channel created");
                setShowDialog(false);
                resetForm();
                fetchChannels();
            } else {
                const errorData = await res.json();
                toast.error(errorData.error?.message || "Failed to save channel");
            }
        } catch (error) {
            toast.error("Failed to save channel");
        }
    };

    const resetForm = () => {
        setEditingChannel(null);
        setChannelType("EMAIL");
        setFormData({
            name: "",
            enabled: true,
            emailRecipients: "",
            emailFromAddress: "",
            emailFromName: "",
            slackWebhookUrl: "",
            slackChannel: "",
            slackUsername: "",
            slackIconEmoji: "",
        });
    };

    const openEditDialog = (channel: NotificationChannel) => {
        setEditingChannel(channel);
        setChannelType(channel.type);

        if (channel.type === "EMAIL") {
            const emailConfig = channel.config as EmailConfig;
            setFormData({
                name: channel.name,
                enabled: channel.enabled,
                emailRecipients: emailConfig.recipients.join(", "),
                emailFromAddress: emailConfig.fromAddress || "",
                emailFromName: emailConfig.fromName || "",
                slackWebhookUrl: "",
                slackChannel: "",
                slackUsername: "",
                slackIconEmoji: "",
            });
        } else {
            const slackConfig = channel.config as SlackConfig;
            setFormData({
                name: channel.name,
                enabled: channel.enabled,
                emailRecipients: "",
                emailFromAddress: "",
                emailFromName: "",
                slackWebhookUrl: slackConfig.webhookUrl,
                slackChannel: slackConfig.channel,
                slackUsername: slackConfig.username || "",
                slackIconEmoji: slackConfig.iconEmoji || "",
            });
        }

        setShowDialog(true);
    };

    const openCreateDialog = () => {
        resetForm();
        setShowDialog(true);
    };

    const getChannelIcon = (type: string) => {
        switch (type) {
            case "EMAIL":
                return <Mail className="w-4 h-4" />;
            case "SLACK":
                return <MessageSquare className="w-4 h-4" />;
            default:
                return <Mail className="w-4 h-4" />;
        }
    };

    const getChannelTypeColor = (type: string) => {
        switch (type) {
            case "EMAIL":
                return "text-blue-600 dark:text-blue-400";
            case "SLACK":
                return "text-purple-600 dark:text-purple-400";
            default:
                return "text-gray-600 dark:text-gray-400";
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Notification Channels</h1>
                        <p className="text-muted-foreground mt-1">
                            Configure email and Slack notification channels
                        </p>
                    </div>
                </div>
                <div className="text-center py-12">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                    <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Notification Channels</h1>
                    <p className="text-muted-foreground mt-1">
                        Configure email and Slack notification channels
                    </p>
                </div>
                <Button onClick={openCreateDialog}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Channel
                </Button>
            </div>

            {/* Channels Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Configured Channels ({channels.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {channels.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No notification channels configured</p>
                            <Button onClick={openCreateDialog} variant="outline" className="mt-4">
                                Add your first channel
                            </Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Channel Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Configuration</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {channels.map((channel) => (
                                    <TableRow key={channel.id}>
                                        <TableCell>
                                            <Switch
                                                checked={channel.enabled}
                                                onCheckedChange={(checked) =>
                                                    handleToggleChannel(channel.id, checked)
                                                }
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className={getChannelTypeColor(channel.type)}>
                                                    {getChannelIcon(channel.type)}
                                                </span>
                                                <span className="font-medium">{channel.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{channel.type}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {channel.type === "EMAIL" ? (
                                                <div className="text-sm text-muted-foreground">
                                                    {(channel.config as EmailConfig).recipients.length} recipient(s)
                                                </div>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">
                                                    {(channel.config as SlackConfig).channel}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleTestChannel(channel.id, channel.name)}
                                                    title="Test channel"
                                                >
                                                    <TestTube className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => openEditDialog(channel)}
                                                    title="Edit channel"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleDeleteChannel(channel.id)}
                                                    title="Delete channel"
                                                >
                                                    <Trash2 className="w-4 h-4 text-danger" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Channel Configuration Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingChannel ? "Edit Notification Channel" : "Add Notification Channel"}
                        </DialogTitle>
                        <DialogDescription>
                            Configure notification delivery settings
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Basic Information */}
                        <div className="space-y-2">
                            <Label htmlFor="name">Channel Name *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Production Alerts"
                            />
                        </div>

                        {!editingChannel && (
                            <div className="space-y-2">
                                <Label htmlFor="type">Channel Type *</Label>
                                <Select
                                    value={channelType}
                                    onValueChange={(value: "EMAIL" | "SLACK") => setChannelType(value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="EMAIL">
                                            <div className="flex items-center gap-2">
                                                <Mail className="w-4 h-4" />
                                                Email
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="SLACK">
                                            <div className="flex items-center gap-2">
                                                <MessageSquare className="w-4 h-4" />
                                                Slack
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Email Configuration */}
                        {channelType === "EMAIL" && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="emailRecipients">Recipients *</Label>
                                    <Input
                                        id="emailRecipients"
                                        value={formData.emailRecipients}
                                        onChange={(e) =>
                                            setFormData({ ...formData, emailRecipients: e.target.value })
                                        }
                                        placeholder="admin@example.com, ops@example.com"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Comma-separated list of email addresses
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="emailFromAddress">From Address</Label>
                                        <Input
                                            id="emailFromAddress"
                                            type="email"
                                            value={formData.emailFromAddress}
                                            onChange={(e) =>
                                                setFormData({ ...formData, emailFromAddress: e.target.value })
                                            }
                                            placeholder="alerts@example.com"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="emailFromName">From Name</Label>
                                        <Input
                                            id="emailFromName"
                                            value={formData.emailFromName}
                                            onChange={(e) =>
                                                setFormData({ ...formData, emailFromName: e.target.value })
                                            }
                                            placeholder="PricePilot Alerts"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Slack Configuration */}
                        {channelType === "SLACK" && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="slackWebhookUrl">Webhook URL *</Label>
                                    <Input
                                        id="slackWebhookUrl"
                                        type="url"
                                        value={formData.slackWebhookUrl}
                                        onChange={(e) =>
                                            setFormData({ ...formData, slackWebhookUrl: e.target.value })
                                        }
                                        placeholder="https://hooks.slack.com/services/..."
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Get this from your Slack workspace settings
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="slackChannel">Channel *</Label>
                                    <Input
                                        id="slackChannel"
                                        value={formData.slackChannel}
                                        onChange={(e) =>
                                            setFormData({ ...formData, slackChannel: e.target.value })
                                        }
                                        placeholder="#alerts"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="slackUsername">Bot Username</Label>
                                        <Input
                                            id="slackUsername"
                                            value={formData.slackUsername}
                                            onChange={(e) =>
                                                setFormData({ ...formData, slackUsername: e.target.value })
                                            }
                                            placeholder="PricePilot Bot"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="slackIconEmoji">Icon Emoji</Label>
                                        <Input
                                            id="slackIconEmoji"
                                            value={formData.slackIconEmoji}
                                            onChange={(e) =>
                                                setFormData({ ...formData, slackIconEmoji: e.target.value })
                                            }
                                            placeholder=":bell:"
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowDialog(false);
                                resetForm();
                            }}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleSaveChannel}>
                            {editingChannel ? "Update Channel" : "Create Channel"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
