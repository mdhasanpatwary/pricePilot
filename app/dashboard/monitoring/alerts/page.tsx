"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    Plus,
    Edit,
    Trash2,
    TestTube,
    Calendar,
    Bell,
    AlertTriangle,
    Info,
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
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

/**
 * Alert Configuration Page
 * 
 * Provides UI for managing alert rules and maintenance windows.
 * 
 * Features:
 * - Alert rules list with enable/disable toggles
 * - Create/edit alert rule form
 * - Threshold configuration inputs
 * - Notification channel selection
 * - Maintenance window configuration
 * - Test alert button
 * - Form validation
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 10.1
 */

interface AlertRule {
    id: string;
    name: string;
    description: string;
    severity: "CRITICAL" | "WARNING" | "INFO";
    enabled: boolean;
    metricType: string;
    conditionOperator: "gt" | "gte" | "lt" | "lte" | "eq";
    conditionAggregation: "count" | "avg" | "sum" | "max" | "min" | "p95" | "p99";
    timeWindowSeconds: number;
    threshold: number;
    notificationChannels: string[];
    tenantId?: string | null;
}

interface MaintenanceWindow {
    id: string;
    name: string;
    description?: string;
    startTime: string;
    endTime: string;
    isActive: boolean;
}

export default function AlertConfigurationPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [rules, setRules] = useState<AlertRule[]>([]);
    const [maintenanceWindows, setMaintenanceWindows] = useState<MaintenanceWindow[]>([]);
    const [loading, setLoading] = useState(true);
    const [showRuleDialog, setShowRuleDialog] = useState(false);
    const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false);
    const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
    const [formData, setFormData] = useState<Partial<AlertRule>>({
        name: "",
        description: "",
        severity: "WARNING",
        enabled: true,
        metricType: "error",
        conditionOperator: "gt",
        conditionAggregation: "avg",
        timeWindowSeconds: 300,
        threshold: 1,
        notificationChannels: [],
    });
    const [maintenanceFormData, setMaintenanceFormData] = useState({
        name: "",
        description: "",
        startTime: "",
        endTime: "",
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

    // Fetch alert rules and maintenance windows
    useEffect(() => {
        if (session?.user && (session.user.role === "ADMIN" || session.user.isSuperAdmin)) {
            fetchData();
        }
    }, [session]);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Fetch alert rules
            const rulesRes = await fetch("/api/v1/monitoring/alert-rules");
            if (rulesRes.ok) {
                const rulesData = await rulesRes.json();
                setRules(rulesData.data.rules || []);
            }

            // Fetch maintenance windows
            const maintenanceRes = await fetch("/api/v1/monitoring/maintenance-window");
            if (maintenanceRes.ok) {
                const maintenanceData = await maintenanceRes.json();
                setMaintenanceWindows(maintenanceData.data.windows || []);
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
            toast.error("Failed to load alert configuration");
        } finally {
            setLoading(false);
        }
    };

    const handleToggleRule = async (ruleId: string, enabled: boolean) => {
        try {
            const res = await fetch(`/api/v1/monitoring/alert-rules/${ruleId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled }),
            });

            if (res.ok) {
                toast.success(enabled ? "Alert rule enabled" : "Alert rule disabled");
                fetchData();
            } else {
                toast.error("Failed to update alert rule");
            }
        } catch (error) {
            toast.error("Failed to update alert rule");
        }
    };

    const handleTestRule = async (ruleId: string) => {
        try {
            const res = await fetch(`/api/v1/monitoring/alert-rules/${ruleId}/test`, {
                method: "POST",
            });

            if (res.ok) {
                const data = await res.json();
                if (data.data.triggered) {
                    toast.success("Test alert sent successfully");
                } else {
                    toast.info("Alert conditions not met - no alert sent");
                }
            } else {
                toast.error("Failed to test alert rule");
            }
        } catch (error) {
            toast.error("Failed to test alert rule");
        }
    };

    const handleDeleteRule = async (ruleId: string) => {
        if (!confirm("Are you sure you want to delete this alert rule?")) {
            return;
        }

        try {
            const res = await fetch(`/api/v1/monitoring/alert-rules/${ruleId}`, {
                method: "DELETE",
            });

            if (res.ok) {
                toast.success("Alert rule deleted");
                fetchData();
            } else {
                toast.error("Failed to delete alert rule");
            }
        } catch (error) {
            toast.error("Failed to delete alert rule");
        }
    };

    const handleSaveRule = async () => {
        // Validation
        if (!formData.name || !formData.description) {
            toast.error("Please fill in all required fields");
            return;
        }

        if (formData.threshold === undefined || formData.threshold < 0) {
            toast.error("Please enter a valid threshold");
            return;
        }

        if (formData.timeWindowSeconds === undefined || formData.timeWindowSeconds < 60) {
            toast.error("Time window must be at least 60 seconds");
            return;
        }

        try {
            const url = editingRule
                ? `/api/v1/monitoring/alert-rules/${editingRule.id}`
                : "/api/v1/monitoring/alert-rules";

            const method = editingRule ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                toast.success(editingRule ? "Alert rule updated" : "Alert rule created");
                setShowRuleDialog(false);
                setEditingRule(null);
                setFormData({
                    name: "",
                    description: "",
                    severity: "WARNING",
                    enabled: true,
                    metricType: "error",
                    conditionOperator: "gt",
                    conditionAggregation: "avg",
                    timeWindowSeconds: 300,
                    threshold: 1,
                    notificationChannels: [],
                });
                fetchData();
            } else {
                const errorData = await res.json();
                toast.error(errorData.error?.message || "Failed to save alert rule");
            }
        } catch (error) {
            toast.error("Failed to save alert rule");
        }
    };

    const handleSaveMaintenanceWindow = async () => {
        // Validation
        if (!maintenanceFormData.name || !maintenanceFormData.startTime || !maintenanceFormData.endTime) {
            toast.error("Please fill in all required fields");
            return;
        }

        const start = new Date(maintenanceFormData.startTime);
        const end = new Date(maintenanceFormData.endTime);

        if (start >= end) {
            toast.error("End time must be after start time");
            return;
        }

        try {
            const res = await fetch("/api/v1/monitoring/maintenance-window", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: maintenanceFormData.name,
                    description: maintenanceFormData.description,
                    startTime: start.toISOString(),
                    endTime: end.toISOString(),
                }),
            });

            if (res.ok) {
                toast.success("Maintenance window created");
                setShowMaintenanceDialog(false);
                setMaintenanceFormData({
                    name: "",
                    description: "",
                    startTime: "",
                    endTime: "",
                });
                fetchData();
            } else {
                toast.error("Failed to create maintenance window");
            }
        } catch (error) {
            toast.error("Failed to create maintenance window");
        }
    };

    const openEditDialog = (rule: AlertRule) => {
        setEditingRule(rule);
        setFormData(rule);
        setShowRuleDialog(true);
    };

    const openCreateDialog = () => {
        setEditingRule(null);
        setFormData({
            name: "",
            description: "",
            severity: "WARNING",
            enabled: true,
            metricType: "error",
            conditionOperator: "gt",
            conditionAggregation: "avg",
            timeWindowSeconds: 300,
            threshold: 1,
            notificationChannels: [],
        });
        setShowRuleDialog(true);
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case "CRITICAL":
                return <AlertTriangle className="w-4 h-4 text-danger" />;
            case "WARNING":
                return <Bell className="w-4 h-4 text-warning" />;
            case "INFO":
                return <Info className="w-4 h-4 text-primary" />;
            default:
                return <Bell className="w-4 h-4" />;
        }
    };

    const getSeverityBadgeVariant = (severity: string) => {
        switch (severity) {
            case "CRITICAL":
                return "destructive";
            case "WARNING":
                return "default";
            case "INFO":
                return "secondary";
            default:
                return "outline";
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Alert Configuration</h1>
                        <p className="text-muted-foreground mt-1">
                            Manage alert rules and maintenance windows
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
                    <h1 className="text-3xl font-bold tracking-tight">Alert Configuration</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage alert rules and maintenance windows
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={() => setShowMaintenanceDialog(true)} variant="outline">
                        <Calendar className="w-4 h-4 mr-2" />
                        Maintenance Window
                    </Button>
                    <Button onClick={openCreateDialog}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Alert Rule
                    </Button>
                </div>
            </div>

            {/* Alert Rules Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Alert Rules ({rules.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {rules.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No alert rules configured</p>
                            <Button onClick={openCreateDialog} variant="outline" className="mt-4">
                                Create your first alert rule
                            </Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Alert Rule</TableHead>
                                    <TableHead>Severity</TableHead>
                                    <TableHead>Metric</TableHead>
                                    <TableHead>Condition</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rules.map((rule) => (
                                    <TableRow key={rule.id}>
                                        <TableCell>
                                            <Switch
                                                checked={rule.enabled}
                                                onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <p className="font-medium">{rule.name}</p>
                                                <p className="text-sm text-muted-foreground">{rule.description}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={getSeverityBadgeVariant(rule.severity)}>
                                                <span className="flex items-center gap-1">
                                                    {getSeverityIcon(rule.severity)}
                                                    {rule.severity}
                                                </span>
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <code className="text-xs bg-muted px-2 py-1 rounded">
                                                {rule.metricType}
                                            </code>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm">
                                                {rule.conditionAggregation}({rule.metricType}) {rule.conditionOperator}{" "}
                                                {rule.threshold}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleTestRule(rule.id)}
                                                    title="Test alert"
                                                >
                                                    <TestTube className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => openEditDialog(rule)}
                                                    title="Edit rule"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleDeleteRule(rule.id)}
                                                    title="Delete rule"
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

            {/* Maintenance Windows */}
            {maintenanceWindows.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Active Maintenance Windows</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {maintenanceWindows.map((window) => (
                                <div
                                    key={window.id}
                                    className="flex items-center justify-between p-4 border rounded-lg"
                                >
                                    <div>
                                        <p className="font-medium">{window.name}</p>
                                        {window.description && (
                                            <p className="text-sm text-muted-foreground">{window.description}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {new Date(window.startTime).toLocaleString()} -{" "}
                                            {new Date(window.endTime).toLocaleString()}
                                        </p>
                                    </div>
                                    <Badge variant={window.isActive ? "default" : "secondary"}>
                                        {window.isActive ? "Active" : "Scheduled"}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Create/Edit Alert Rule Dialog */}
            <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingRule ? "Edit Alert Rule" : "Create Alert Rule"}
                        </DialogTitle>
                        <DialogDescription>
                            Configure alert conditions and notification settings
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Basic Information */}
                        <div className="space-y-2">
                            <Label htmlFor="name">Alert Name *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="High Error Rate"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description *</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Alert when error rate exceeds threshold"
                                rows={3}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="severity">Severity *</Label>
                                <Select
                                    value={formData.severity}
                                    onValueChange={(value: any) => setFormData({ ...formData, severity: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CRITICAL">Critical</SelectItem>
                                        <SelectItem value="WARNING">Warning</SelectItem>
                                        <SelectItem value="INFO">Info</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="metricType">Metric Type *</Label>
                                <Select
                                    value={formData.metricType}
                                    onValueChange={(value) => setFormData({ ...formData, metricType: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="error">Error Rate</SelectItem>
                                        <SelectItem value="response_time">Response Time</SelectItem>
                                        <SelectItem value="scraping_success">Scraping Success</SelectItem>
                                        <SelectItem value="scraping_block">Scraping Block Rate</SelectItem>
                                        <SelectItem value="price_update">Price Update</SelectItem>
                                        <SelectItem value="auth_failure">Auth Failures</SelectItem>
                                        <SelectItem value="db_connection">DB Connection</SelectItem>
                                        <SelectItem value="redis_connection">Redis Connection</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Condition Configuration */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="aggregation">Aggregation *</Label>
                                <Select
                                    value={formData.conditionAggregation}
                                    onValueChange={(value: any) =>
                                        setFormData({ ...formData, conditionAggregation: value })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="avg">Average</SelectItem>
                                        <SelectItem value="sum">Sum</SelectItem>
                                        <SelectItem value="count">Count</SelectItem>
                                        <SelectItem value="max">Maximum</SelectItem>
                                        <SelectItem value="min">Minimum</SelectItem>
                                        <SelectItem value="p95">95th Percentile</SelectItem>
                                        <SelectItem value="p99">99th Percentile</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="operator">Operator *</Label>
                                <Select
                                    value={formData.conditionOperator}
                                    onValueChange={(value: any) =>
                                        setFormData({ ...formData, conditionOperator: value })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="gt">Greater Than (&gt;)</SelectItem>
                                        <SelectItem value="gte">Greater or Equal (&gt;=)</SelectItem>
                                        <SelectItem value="lt">Less Than (&lt;)</SelectItem>
                                        <SelectItem value="lte">Less or Equal (&lt;=)</SelectItem>
                                        <SelectItem value="eq">Equal (=)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="threshold">Threshold *</Label>
                                <Input
                                    id="threshold"
                                    type="number"
                                    step="0.01"
                                    value={formData.threshold}
                                    onChange={(e) =>
                                        setFormData({ ...formData, threshold: parseFloat(e.target.value) })
                                    }
                                    placeholder="1.0"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="timeWindow">Time Window (seconds) *</Label>
                            <Input
                                id="timeWindow"
                                type="number"
                                value={formData.timeWindowSeconds}
                                onChange={(e) =>
                                    setFormData({ ...formData, timeWindowSeconds: parseInt(e.target.value) })
                                }
                                placeholder="300"
                            />
                            <p className="text-xs text-muted-foreground">
                                Minimum 60 seconds. Common values: 60 (1m), 300 (5m), 900 (15m), 3600 (1h)
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowRuleDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveRule}>
                            {editingRule ? "Update Rule" : "Create Rule"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Maintenance Window Dialog */}
            <Dialog open={showMaintenanceDialog} onOpenChange={setShowMaintenanceDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Schedule Maintenance Window</DialogTitle>
                        <DialogDescription>
                            Alerts will be suppressed during this time period
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="maintenanceName">Name *</Label>
                            <Input
                                id="maintenanceName"
                                value={maintenanceFormData.name}
                                onChange={(e) =>
                                    setMaintenanceFormData({ ...maintenanceFormData, name: e.target.value })
                                }
                                placeholder="Database Maintenance"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="maintenanceDescription">Description</Label>
                            <Textarea
                                id="maintenanceDescription"
                                value={maintenanceFormData.description}
                                onChange={(e) =>
                                    setMaintenanceFormData({ ...maintenanceFormData, description: e.target.value })
                                }
                                placeholder="Scheduled database upgrade"
                                rows={2}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="startTime">Start Time *</Label>
                            <Input
                                id="startTime"
                                type="datetime-local"
                                value={maintenanceFormData.startTime}
                                onChange={(e) =>
                                    setMaintenanceFormData({ ...maintenanceFormData, startTime: e.target.value })
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="endTime">End Time *</Label>
                            <Input
                                id="endTime"
                                type="datetime-local"
                                value={maintenanceFormData.endTime}
                                onChange={(e) =>
                                    setMaintenanceFormData({ ...maintenanceFormData, endTime: e.target.value })
                                }
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowMaintenanceDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveMaintenanceWindow}>Schedule</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
