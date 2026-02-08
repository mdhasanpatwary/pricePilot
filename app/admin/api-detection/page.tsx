"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Database } from "lucide-react";
import { ApiDetectionMetricsContent } from "./api-detection-metrics-content";
import { ApiPatternManagementContent } from "./api-pattern-management-content";

export default function ApiDetectionPage() {
    const [activeTab, setActiveTab] = useState("metrics");

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">API Detection Monitoring</h1>
                <p className="text-muted-foreground">
                    Monitor API detection performance, cache efficiency, and manage cached patterns
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
                    <TabsTrigger value="metrics" className="flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        <span>Detection Metrics</span>
                    </TabsTrigger>
                    <TabsTrigger value="patterns" className="flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        <span>Pattern Management</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="metrics" className="space-y-6">
                    <ApiDetectionMetricsContent />
                </TabsContent>

                <TabsContent value="patterns" className="space-y-6">
                    <ApiPatternManagementContent />
                </TabsContent>
            </Tabs>
        </div>
    );
}
