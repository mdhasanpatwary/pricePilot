/**
 * Export Service
 * Handles data export in multiple formats (JSON, CSV, PDF)
 * 
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
 */

import { ScrapingSessionData } from "@/lib/types/admin-dashboard";

export type ExportFormat = "json" | "csv" | "pdf";

export interface ExportOptions {
    format: ExportFormat;
    filename?: string;
}

export class ExportService {
    /**
     * Export sessions to specified format
     */
    static async exportSessions(
        sessions: ScrapingSessionData[],
        options: ExportOptions
    ): Promise<{ data: string | Buffer; contentType: string; filename: string }> {
        const filename = options.filename || `sessions-export-${Date.now()}`;

        switch (options.format) {
            case "json":
                return this.exportSessionsJSON(sessions, filename);
            case "csv":
                return this.exportSessionsCSV(sessions, filename);
            case "pdf":
                return this.exportSessionsPDF(sessions, filename);
            default:
                throw new Error(`Unsupported export format: ${options.format}`);
        }
    }

    /**
     * Export proxy metrics to specified format
     */
    static async exportProxyMetrics(
        metrics: any[],
        options: ExportOptions
    ): Promise<{ data: string | Buffer; contentType: string; filename: string }> {
        const filename = options.filename || `proxy-metrics-export-${Date.now()}`;

        switch (options.format) {
            case "json":
                return this.exportJSON(metrics, filename);
            case "csv":
                return this.exportProxyMetricsCSV(metrics, filename);
            case "pdf":
                return this.exportProxyMetricsPDF(metrics, filename);
            default:
                throw new Error(`Unsupported export format: ${options.format}`);
        }
    }

    /**
     * Export error logs to specified format
     */
    static async exportErrors(
        errors: any[],
        options: ExportOptions
    ): Promise<{ data: string | Buffer; contentType: string; filename: string }> {
        const filename = options.filename || `error-logs-export-${Date.now()}`;

        switch (options.format) {
            case "json":
                return this.exportJSON(errors, filename);
            case "csv":
                return this.exportErrorsCSV(errors, filename);
            case "pdf":
                return this.exportErrorsPDF(errors, filename);
            default:
                throw new Error(`Unsupported export format: ${options.format}`);
        }
    }

    /**
     * Export analytics to specified format
     */
    static async exportAnalytics(
        analytics: any,
        options: ExportOptions
    ): Promise<{ data: string | Buffer; contentType: string; filename: string }> {
        const filename = options.filename || `analytics-export-${Date.now()}`;

        switch (options.format) {
            case "json":
                return this.exportJSON(analytics, filename);
            case "csv":
                return this.exportAnalyticsCSV(analytics, filename);
            case "pdf":
                return this.exportAnalyticsPDF(analytics, filename);
            default:
                throw new Error(`Unsupported export format: ${options.format}`);
        }
    }

    // JSON Export Methods
    private static exportJSON(data: any, filename: string) {
        return {
            data: JSON.stringify(data, null, 2),
            contentType: "application/json",
            filename: `${filename}.json`,
        };
    }

    private static exportSessionsJSON(sessions: ScrapingSessionData[], filename: string) {
        return this.exportJSON(sessions, filename);
    }

    // CSV Export Methods
    private static exportSessionsCSV(sessions: ScrapingSessionData[], filename: string) {
        const headers = [
            "ID",
            "Tenant ID",
            "Tenant Name",
            "Site URL",
            "Target URL",
            "Status",
            "Current Stage",
            "Proxy Used",
            "Requests Completed",
            "Requests Total",
            "Challenge Type",
            "Challenge Status",
            "Start Time",
            "End Time",
            "Total Time (ms)",
        ];

        const rows = sessions.map(session => [
            session.id,
            session.tenantId,
            session.tenantName,
            session.siteUrl,
            session.targetUrl,
            session.status,
            session.currentStage,
            session.proxyUsed || "N/A",
            session.requestsCompleted,
            session.requestsTotal,
            session.challengeType || "N/A",
            session.challengeStatus || "N/A",
            session.startTime.toISOString(),
            session.endTime?.toISOString() || "N/A",
            session.metrics?.totalTime || "N/A",
        ]);

        const csv = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
            .join("\n");

        return {
            data: csv,
            contentType: "text/csv",
            filename: `${filename}.csv`,
        };
    }

    private static exportProxyMetricsCSV(metrics: any[], filename: string) {
        const headers = [
            "Proxy URL",
            "Type",
            "Success Rate",
            "Failure Rate",
            "Avg Response Time",
            "Total Requests",
            "Success Count",
            "Failure Count",
            "Last Check Time",
        ];

        const rows = metrics.map(metric => [
            metric.proxyUrl || metric.url,
            metric.type,
            metric.successRate || "N/A",
            metric.failureRate || "N/A",
            metric.avgResponseTime || "N/A",
            metric.totalRequests || "N/A",
            metric.successCount || "N/A",
            metric.failureCount || "N/A",
            metric.lastCheckTime || "N/A",
        ]);

        const csv = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
            .join("\n");

        return {
            data: csv,
            contentType: "text/csv",
            filename: `${filename}.csv`,
        };
    }

    private static exportErrorsCSV(errors: any[], filename: string) {
        const headers = [
            "Timestamp",
            "Session ID",
            "Tenant ID",
            "Error Type",
            "Error Message",
            "Site URL",
            "Proxy Used",
        ];

        const rows = errors.map(error => [
            error.timestamp || new Date().toISOString(),
            error.sessionId || "N/A",
            error.tenantId || "N/A",
            error.type || "Unknown",
            error.message || error.error || "N/A",
            error.siteUrl || "N/A",
            error.proxyUsed || "N/A",
        ]);

        const csv = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
            .join("\n");

        return {
            data: csv,
            contentType: "text/csv",
            filename: `${filename}.csv`,
        };
    }

    private static exportAnalyticsCSV(analytics: any, filename: string) {
        // Convert analytics object to CSV format
        const headers = ["Metric", "Value"];
        const rows: string[][] = [];

        const flattenObject = (obj: any, prefix = "") => {
            for (const key in obj) {
                const value = obj[key];
                const newKey = prefix ? `${prefix}.${key}` : key;

                if (value && typeof value === "object" && !Array.isArray(value)) {
                    flattenObject(value, newKey);
                } else {
                    rows.push([newKey, String(value)]);
                }
            }
        };

        flattenObject(analytics);

        const csv = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
            .join("\n");

        return {
            data: csv,
            contentType: "text/csv",
            filename: `${filename}.csv`,
        };
    }

    // PDF Export Methods (simplified text-based PDF)
    private static exportSessionsPDF(sessions: ScrapingSessionData[], filename: string) {
        // For now, return a simple text-based format
        // In production, you would use a library like pdfkit or puppeteer
        const content = this.generateSessionsPDFContent(sessions);

        return {
            data: Buffer.from(content),
            contentType: "application/pdf",
            filename: `${filename}.pdf`,
        };
    }

    private static exportProxyMetricsPDF(metrics: any[], filename: string) {
        const content = this.generateProxyMetricsPDFContent(metrics);

        return {
            data: Buffer.from(content),
            contentType: "application/pdf",
            filename: `${filename}.pdf`,
        };
    }

    private static exportErrorsPDF(errors: any[], filename: string) {
        const content = this.generateErrorsPDFContent(errors);

        return {
            data: Buffer.from(content),
            contentType: "application/pdf",
            filename: `${filename}.pdf`,
        };
    }

    private static exportAnalyticsPDF(analytics: any, filename: string) {
        const content = this.generateAnalyticsPDFContent(analytics);

        return {
            data: Buffer.from(content),
            contentType: "application/pdf",
            filename: `${filename}.pdf`,
        };
    }

    // PDF Content Generation (simplified)
    private static generateSessionsPDFContent(sessions: ScrapingSessionData[]): string {
        let content = "SCRAPING SESSIONS REPORT\n";
        content += "=".repeat(80) + "\n\n";
        content += `Generated: ${new Date().toISOString()}\n`;
        content += `Total Sessions: ${sessions.length}\n\n`;

        sessions.forEach((session, index) => {
            content += `\nSession ${index + 1}\n`;
            content += "-".repeat(80) + "\n";
            content += `ID: ${session.id}\n`;
            content += `Tenant: ${session.tenantName} (${session.tenantId})\n`;
            content += `Site: ${session.siteUrl}\n`;
            content += `Target: ${session.targetUrl}\n`;
            content += `Status: ${session.status}\n`;
            content += `Stage: ${session.currentStage}\n`;
            content += `Proxy: ${session.proxyUsed || "N/A"}\n`;
            content += `Progress: ${session.requestsCompleted}/${session.requestsTotal}\n`;
            content += `Started: ${session.startTime.toISOString()}\n`;
            if (session.endTime) {
                content += `Ended: ${session.endTime.toISOString()}\n`;
            }
            if (session.metrics?.totalTime) {
                content += `Duration: ${session.metrics.totalTime}ms\n`;
            }
            content += "\n";
        });

        return content;
    }

    private static generateProxyMetricsPDFContent(metrics: any[]): string {
        let content = "PROXY METRICS REPORT\n";
        content += "=".repeat(80) + "\n\n";
        content += `Generated: ${new Date().toISOString()}\n`;
        content += `Total Proxies: ${metrics.length}\n\n`;

        metrics.forEach((metric, index) => {
            content += `\nProxy ${index + 1}\n`;
            content += "-".repeat(80) + "\n";
            content += `URL: ${metric.proxyUrl || metric.url}\n`;
            content += `Type: ${metric.type}\n`;
            content += `Success Rate: ${metric.successRate || "N/A"}\n`;
            content += `Avg Response Time: ${metric.avgResponseTime || "N/A"}ms\n`;
            content += `Total Requests: ${metric.totalRequests || "N/A"}\n`;
            content += `Success Count: ${metric.successCount || "N/A"}\n`;
            content += `Failure Count: ${metric.failureCount || "N/A"}\n`;
            content += "\n";
        });

        return content;
    }

    private static generateErrorsPDFContent(errors: any[]): string {
        let content = "ERROR LOGS REPORT\n";
        content += "=".repeat(80) + "\n\n";
        content += `Generated: ${new Date().toISOString()}\n`;
        content += `Total Errors: ${errors.length}\n\n`;

        errors.forEach((error, index) => {
            content += `\nError ${index + 1}\n`;
            content += "-".repeat(80) + "\n";
            content += `Timestamp: ${error.timestamp || new Date().toISOString()}\n`;
            content += `Session ID: ${error.sessionId || "N/A"}\n`;
            content += `Tenant ID: ${error.tenantId || "N/A"}\n`;
            content += `Type: ${error.type || "Unknown"}\n`;
            content += `Message: ${error.message || error.error || "N/A"}\n`;
            content += `Site: ${error.siteUrl || "N/A"}\n`;
            if (error.stack) {
                content += `Stack Trace:\n${error.stack}\n`;
            }
            content += "\n";
        });

        return content;
    }

    private static generateAnalyticsPDFContent(analytics: any): string {
        let content = "ANALYTICS REPORT\n";
        content += "=".repeat(80) + "\n\n";
        content += `Generated: ${new Date().toISOString()}\n\n`;

        const formatObject = (obj: any, indent = 0): string => {
            let result = "";
            const spaces = " ".repeat(indent);

            for (const key in obj) {
                const value = obj[key];
                if (value && typeof value === "object" && !Array.isArray(value)) {
                    result += `${spaces}${key}:\n`;
                    result += formatObject(value, indent + 2);
                } else {
                    result += `${spaces}${key}: ${value}\n`;
                }
            }

            return result;
        };

        content += formatObject(analytics);

        return content;
    }
}
