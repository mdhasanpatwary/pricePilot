"use client";

import { useState } from "react";
import { Undo2, Loader2, AlertTriangle } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface RollbackButtonProps {
    updateLogId?: string;
    snapshotId?: string;
    productTitle?: string;
    productCount?: number;
    oldPrice?: string;
    newPrice?: string;
    onSuccess?: () => void;
    variant?: "default" | "outline" | "ghost";
    size?: "default" | "sm" | "lg" | "icon";
    className?: string;
}

export function RollbackButton({
    updateLogId,
    snapshotId,
    productTitle,
    productCount,
    oldPrice,
    newPrice,
    onSuccess,
    variant = "outline",
    size = "sm",
    className = "",
}: RollbackButtonProps) {
    const [showDialog, setShowDialog] = useState(false);
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(false);
    const [canRollback, setCanRollback] = useState(true);
    const [reason, setReason] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isBulk = !!snapshotId;

    const checkEligibility = async () => {
        setChecking(true);
        setError(null);

        try {
            // For now, we'll assume eligibility since the API will check it
            // In a real implementation, you might want to add a separate eligibility check endpoint
            setCanRollback(true);
            setReason(null);
        } catch (err) {
            console.error("Failed to check eligibility", err);
            setError("Failed to check rollback eligibility");
        } finally {
            setChecking(false);
        }
    };

    const handleOpenDialog = async () => {
        setShowDialog(true);
        await checkEligibility();
    };

    const handleRollback = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/v1/price-update/rollback", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    updateLogId,
                    snapshotId,
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error?.message || "Rollback failed");
            }

            // Success!
            setShowDialog(false);

            // Show success notification (you can integrate with your notification system)
            if (typeof window !== "undefined") {
                // Simple alert for now - replace with your toast/notification system
                alert(data.data.message || "Rollback completed successfully");
            }

            // Call success callback
            if (onSuccess) {
                onSuccess();
            }
        } catch (err) {
            console.error("Rollback failed", err);
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button
                variant={variant}
                size={size}
                onClick={handleOpenDialog}
                className={className}
                title="Rollback this change"
            >
                <Undo2 className="w-4 h-4 mr-2" />
                Rollback
            </Button>

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            Confirm Rollback
                        </DialogTitle>
                        <DialogDescription>
                            {isBulk
                                ? "This will revert all price changes from this bulk operation."
                                : "This will revert the price change for this product."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        {checking ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : !canRollback ? (
                            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                                <p className="text-sm text-destructive font-medium">
                                    Cannot rollback: {reason}
                                </p>
                            </div>
                        ) : (
                            <>
                                {isBulk ? (
                                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium text-muted-foreground">
                                                Products affected:
                                            </span>
                                            <span className="text-sm font-bold">{productCount}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium text-muted-foreground">
                                                Product:
                                            </span>
                                            <span className="text-sm font-bold line-clamp-1">
                                                {productTitle || "Unknown"}
                                            </span>
                                        </div>
                                        {oldPrice && newPrice && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-muted-foreground">
                                                    Price change:
                                                </span>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="line-through text-muted-foreground">
                                                        ${newPrice}
                                                    </span>
                                                    <span>→</span>
                                                    <span className="font-bold text-green-600 dark:text-green-400">
                                                        ${oldPrice}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                                    <p className="text-sm text-amber-800 dark:text-amber-200">
                                        <strong>Warning:</strong> This action will update prices in
                                        your store. Make sure you want to proceed.
                                    </p>
                                </div>
                            </>
                        )}

                        {error && (
                            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                                <p className="text-sm text-destructive font-medium">{error}</p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowDialog(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleRollback}
                            disabled={loading || !canRollback || checking}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Rolling back...
                                </>
                            ) : (
                                <>
                                    <Undo2 className="w-4 h-4 mr-2" />
                                    Confirm Rollback
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
