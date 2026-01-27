/**
 * Export Button Component
 * Provides export functionality with format selection and progress indication
 * 
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileJson, FileText, FileType, Loader2 } from "lucide-react";

export type ExportType = "sessions" | "metrics" | "errors" | "analytics";
export type ExportFormat = "json" | "csv" | "pdf";

export interface ExportButtonProps {
    type: ExportType;
    filters?: Record<string, string | undefined>;
    label?: string;
    variant?: "default" | "outline" | "ghost";
    size?: "default" | "sm" | "lg" | "icon";
    className?: string;
}

export function ExportButton({
    type,
    filters = {},
    label = "Export",
    variant = "outline",
    size = "default",
    className,
}: ExportButtonProps) {
    const [isExporting, setIsExporting] = useState(false);
    const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);

    const handleExport = async (format: ExportFormat) => {
        setIsExporting(true);
        setExportingFormat(format);

        try {
            // Build query parameters
            const params = new URLSearchParams({ format });
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== "") {
                    params.append(key, value);
                }
            });

            // Determine endpoint based on type
            const endpoint = `/api/v1/admin/export/${type}?${params.toString()}`;

            // Fetch export
            const response = await fetch(endpoint);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Export failed");
            }

            // Get filename from Content-Disposition header or generate one
            const contentDisposition = response.headers.get("Content-Disposition");
            let filename = `${type}-export-${Date.now()}.${format}`;

            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }

            // Download file
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Export error:", error);
            alert(error instanceof Error ? error.message : "Export failed");
        } finally {
            setIsExporting(false);
            setExportingFormat(null);
        }
    };

    const getFormatIcon = (format: ExportFormat) => {
        switch (format) {
            case "json":
                return <FileJson className="mr-2 h-4 w-4" />;
            case "csv":
                return <FileText className="mr-2 h-4 w-4" />;
            case "pdf":
                return <FileType className="mr-2 h-4 w-4" />;
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant={variant}
                    size={size}
                    disabled={isExporting}
                    className={className}
                >
                    {isExporting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Exporting {exportingFormat?.toUpperCase()}...
                        </>
                    ) : (
                        <>
                            <Download className="mr-2 h-4 w-4" />
                            {label}
                        </>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    onClick={() => handleExport("json")}
                    disabled={isExporting}
                >
                    {getFormatIcon("json")}
                    Export as JSON
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => handleExport("csv")}
                    disabled={isExporting}
                >
                    {getFormatIcon("csv")}
                    Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => handleExport("pdf")}
                    disabled={isExporting}
                >
                    {getFormatIcon("pdf")}
                    Export as PDF
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
