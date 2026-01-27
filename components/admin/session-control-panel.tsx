"use client";

import { useState } from "react";
import {
    Play,
    Pause,
    XCircle,
    RotateCcw,
    Loader2,
    AlertTriangle,
    CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrapingSessionData } from "@/lib/types/admin-dashboard";

interface SessionControlPanelProps {
    sessions: ScrapingSessionData[];
    onOperationComplete?: () => void;
}

type Operation = "pause" | "resume" | "cancel" | "retry";

interface ConfirmationDialogState {
    open: boolean;
    operation: Operation | null;
    sessionIds: string[];
    sessionNames: string[];
}

interface RetryDialogState {
    open: boolean;
    sessionId: string | null;
    sessionName: string;
    proxy: string;
    userAgent: string;
}

export default function SessionControlPanel({
    sessions,
    onOperationComplete,
}: SessionControlPanelProps) {
    const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Confirmation dialog state
    const [confirmDialog, setConfirmDialog] = useState<ConfirmationDialogState>({
        open: false,
        operation: null,
        sessionIds: [],
        sessionNames: [],
    });

    // Retry dialog state
    const [retryDialog, setRetryDialog] = useState<RetryDialogState>({
        open: false,
        sessionId: null,
        sessionName: "",
        proxy: "",
        userAgent: "",
    });

    const [cancelReason, setCancelReason] = useState("");

    // Toggle session selection
    const toggleSession = (sessionId: string) => {
        const newSelected = new Set(selectedSessions);
        if (newSelected.has(sessionId)) {
            newSelected.delete(sessionId);
        } else {
            newSelected.add(sessionId);
        }
        setSelectedSessions(newSelected);
    };

    // Select all sessions
    const selectAll = () => {
        const controllableSessions = sessions.filter(
            (s) => s.status !== "completed" && s.status !== "failed"
        );
        setSelectedSessions(new Set(controllableSessions.map((s) => s.id)));
    };

    // Clear selection
    const clearSelection = () => {
        setSelectedSessions(new Set());
    };

    // Get selected session objects
    const getSelectedSessions = () => {
        return sessions.filter((s) => selectedSessions.has(s.id));
    };

    // Check if operation is available for selected sessions
    const canPause = () => {
        const selected = getSelectedSessions();
        return selected.length > 0 && selected.every((s) => s.status === "running");
    };

    const canResume = () => {
        const selected = getSelectedSessions();
        return selected.length > 0 && selected.every((s) => s.status === "initializing");
    };

    const canCancel = () => {
        const selected = getSelectedSessions();
        return (
            selected.length > 0 &&
            selected.every((s) => s.status !== "completed" && s.status !== "failed")
        );
    };

    // Open confirmation dialog
    const openConfirmDialog = (operation: Operation) => {
        const selected = getSelectedSessions();
        setConfirmDialog({
            open: true,
            operation,
            sessionIds: selected.map((s) => s.id),
            sessionNames: selected.map((s) => `${s.tenantName} - ${s.siteUrl}`),
        });
        setCancelReason("");
    };

    // Open retry dialog for single session
    const openRetryDialog = (session: ScrapingSessionData) => {
        setRetryDialog({
            open: true,
            sessionId: session.id,
            sessionName: `${session.tenantName} - ${session.siteUrl}`,
            proxy: session.proxyUsed || "",
            userAgent: session.userAgent || "",
        });
    };

    // Execute single session operation
    const executeSingleOperation = async (
        sessionId: string,
        operation: "pause" | "resume" | "cancel"
    ) => {
        const response = await fetch(`/api/v1/admin/sessions/${sessionId}/${operation}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: operation === "cancel" ? JSON.stringify({ reason: cancelReason }) : undefined,
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || `Failed to ${operation} session`);
        }

        return await response.json();
    };

    // Execute bulk operation
    const executeBulkOperation = async (
        sessionIds: string[],
        operation: "pause" | "resume" | "cancel"
    ) => {
        const response = await fetch("/api/v1/admin/sessions/bulk", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                operation,
                sessionIds,
                reason: operation === "cancel" ? cancelReason : undefined,
            }),
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || `Failed to ${operation} sessions`);
        }

        return await response.json();
    };

    // Execute retry operation
    const executeRetry = async () => {
        if (!retryDialog.sessionId) return;

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(
                `/api/v1/admin/sessions/${retryDialog.sessionId}/retry`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        proxy: retryDialog.proxy || undefined,
                        userAgent: retryDialog.userAgent || undefined,
                    }),
                }
            );

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to retry session");
            }

            const data = await response.json();
            setSuccess(`Session retry initiated. New session ID: ${data.newSessionId}`);
            setRetryDialog({ open: false, sessionId: null, sessionName: "", proxy: "", userAgent: "" });

            if (onOperationComplete) {
                onOperationComplete();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to retry session");
        } finally {
            setLoading(false);
        }
    };

    // Confirm and execute operation
    const confirmOperation = async () => {
        if (!confirmDialog.operation || confirmDialog.sessionIds.length === 0) return;

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            if (confirmDialog.sessionIds.length === 1) {
                // Single operation
                await executeSingleOperation(
                    confirmDialog.sessionIds[0],
                    confirmDialog.operation as "pause" | "resume" | "cancel"
                );
                setSuccess(`Session ${confirmDialog.operation}d successfully`);
            } else {
                // Bulk operation
                const result = await executeBulkOperation(
                    confirmDialog.sessionIds,
                    confirmDialog.operation as "pause" | "resume" | "cancel"
                );
                setSuccess(
                    `Bulk ${confirmDialog.operation}: ${result.summary.successful} successful, ${result.summary.failed} failed`
                );
            }

            // Clear selection and close dialog
            clearSelection();
            setConfirmDialog({ open: false, operation: null, sessionIds: [], sessionNames: [] });

            if (onOperationComplete) {
                onOperationComplete();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Operation failed");
        } finally {
            setLoading(false);
        }
    };

    const controllableSessions = sessions.filter(
        (s) => s.status !== "completed" && s.status !== "failed"
    );

    return (
        <div className="space-y-4">
            {/* Status Messages */}
            {error && (
                <Card className="p-4 bg-red-500/10 border-red-500/20">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <p className="text-sm text-red-500">{error}</p>
                    </div>
                </Card>
            )}

            {success && (
                <Card className="p-4 bg-green-500/10 border-green-500/20">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <p className="text-sm text-green-500">{success}</p>
                    </div>
                </Card>
            )}

            {/* Control Panel */}
            <Card className="p-4">
                <div className="space-y-4">
                    {/* Selection Controls */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                                {selectedSessions.size} of {controllableSessions.length} selected
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={selectAll}
                                disabled={controllableSessions.length === 0}
                            >
                                Select All
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={clearSelection}
                                disabled={selectedSessions.size === 0}
                            >
                                Clear
                            </Button>
                        </div>
                    </div>

                    {/* Operation Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openConfirmDialog("pause")}
                            disabled={!canPause() || loading}
                        >
                            <Pause className="w-4 h-4 mr-2" />
                            Pause
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openConfirmDialog("resume")}
                            disabled={!canResume() || loading}
                        >
                            <Play className="w-4 h-4 mr-2" />
                            Resume
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openConfirmDialog("cancel")}
                            disabled={!canCancel() || loading}
                        >
                            <XCircle className="w-4 h-4 mr-2" />
                            Cancel
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Session List */}
            <Card>
                <div className="p-4 border-b border-border">
                    <h3 className="text-lg font-semibold">Controllable Sessions</h3>
                </div>

                {controllableSessions.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-sm text-muted-foreground">
                            No controllable sessions available
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {controllableSessions.map((session) => (
                            <div key={session.id} className="p-4 hover:bg-muted/50 transition-colors">
                                <div className="flex items-start gap-4">
                                    <Checkbox
                                        checked={selectedSessions.has(session.id)}
                                        onCheckedChange={() => toggleSession(session.id)}
                                    />

                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">
                                                {session.tenantName}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {session.siteUrl}
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Status: {session.status} • Stage: {session.currentStage}
                                        </div>
                                        {session.proxyUsed && (
                                            <div className="text-xs text-muted-foreground font-mono">
                                                Proxy: {session.proxyUsed}
                                            </div>
                                        )}
                                    </div>

                                    {session.status === "failed" && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openRetryDialog(session)}
                                            disabled={loading}
                                        >
                                            <RotateCcw className="w-4 h-4 mr-2" />
                                            Retry
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Confirmation Dialog */}
            <Dialog
                open={confirmDialog.open}
                onOpenChange={(open) =>
                    setConfirmDialog({ ...confirmDialog, open })
                }
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Confirm {confirmDialog.operation?.toUpperCase()}
                        </DialogTitle>
                        <DialogDescription>
                            {confirmDialog.operation === "cancel"
                                ? "This action will cancel the selected sessions and cannot be undone."
                                : `Are you sure you want to ${confirmDialog.operation} the selected sessions?`}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <p className="text-sm font-medium mb-2">
                                Affected Sessions ({confirmDialog.sessionIds.length}):
                            </p>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                                {confirmDialog.sessionNames.map((name, index) => (
                                    <p key={index} className="text-xs text-muted-foreground">
                                        • {name}
                                    </p>
                                ))}
                            </div>
                        </div>

                        {confirmDialog.operation === "cancel" && (
                            <div className="space-y-2">
                                <Label htmlFor="cancel-reason">
                                    Cancellation Reason (optional)
                                </Label>
                                <Textarea
                                    id="cancel-reason"
                                    placeholder="Enter reason for cancellation..."
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                    rows={3}
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() =>
                                setConfirmDialog({
                                    open: false,
                                    operation: null,
                                    sessionIds: [],
                                    sessionNames: [],
                                })
                            }
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant={confirmDialog.operation === "cancel" ? "destructive" : "default"}
                            onClick={confirmOperation}
                            disabled={loading}
                        >
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Retry Dialog */}
            <Dialog
                open={retryDialog.open}
                onOpenChange={(open) =>
                    setRetryDialog({ ...retryDialog, open })
                }
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Retry Session</DialogTitle>
                        <DialogDescription>
                            Configure retry parameters for: {retryDialog.sessionName}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="retry-proxy">Proxy Override (optional)</Label>
                            <Input
                                id="retry-proxy"
                                placeholder="http://proxy:port or leave empty for auto-selection"
                                value={retryDialog.proxy}
                                onChange={(e) =>
                                    setRetryDialog({ ...retryDialog, proxy: e.target.value })
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                Leave empty to use automatic proxy selection
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="retry-user-agent">User Agent Override (optional)</Label>
                            <Input
                                id="retry-user-agent"
                                placeholder="Leave empty to use default user agent"
                                value={retryDialog.userAgent}
                                onChange={(e) =>
                                    setRetryDialog({ ...retryDialog, userAgent: e.target.value })
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                Leave empty to use default user agent
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() =>
                                setRetryDialog({
                                    open: false,
                                    sessionId: null,
                                    sessionName: "",
                                    proxy: "",
                                    userAgent: "",
                                })
                            }
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button onClick={executeRetry} disabled={loading}>
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Retry Session
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
