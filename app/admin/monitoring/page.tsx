"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Bug, HeartPulse, Eye, Settings } from "lucide-react";
import RealTimeMonitor from "@/components/admin/real-time-monitor";
import { SystemHealthMonitor } from "@/components/admin/system-health-monitor";
import SessionControlPanel from "@/components/admin/session-control-panel";
import { ScrapingSessionData } from "@/lib/types/admin-dashboard";

// Import debug page components
import { DebugCenterContent } from "./debug-center-content";
import { DiagnosticsContent } from "./diagnostics-content";

export default function MonitoringHubPage() {
    const searchParams = useSearchParams();
    const tabParam = searchParams.get("tab");
    const [activeTab, setActiveTab] = useState(tabParam || "live");
    const [sessions, setSessions] = useState<ScrapingSessionData[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(false);

    useEffect(() => {
        if (tabParam) {
            setActiveTab(tabParam);
        }
    }, [tabParam]);

    // Fetch sessions when control tab is active
    useEffect(() => {
        if (activeTab === "control") {
            fetchSessions();
        }
    }, [activeTab]);

    const fetchSessions = async () => {
        setLoadingSessions(true);
        try {
            const res = await fetch("/api/v1/admin/sessions");
            if (res.ok) {
                const data = await res.json();
                setSessions(data.sessions || []);
            }
        } catch (error) {
            console.error("Failed to fetch sessions:", error);
        } finally {
            setLoadingSessions(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Monitoring Hub</h1>
                <p className="text-muted-foreground">
                    Unified monitoring, diagnostics, and system health dashboard
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5 lg:w-auto lg:inline-grid">
                    <TabsTrigger value="live" className="flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        <span className="hidden sm:inline">Live Monitor</span>
                        <span className="sm:hidden">Live</span>
                    </TabsTrigger>
                    <TabsTrigger value="control" className="flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        <span className="hidden sm:inline">Session Control</span>
                        <span className="sm:hidden">Control</span>
                    </TabsTrigger>
                    <TabsTrigger value="health" className="flex items-center gap-2">
                        <HeartPulse className="w-4 h-4" />
                        <span className="hidden sm:inline">System Health</span>
                        <span className="sm:hidden">Health</span>
                    </TabsTrigger>
                    <TabsTrigger value="debug" className="flex items-center gap-2">
                        <Bug className="w-4 h-4" />
                        <span className="hidden sm:inline">Debug Center</span>
                        <span className="sm:hidden">Debug</span>
                    </TabsTrigger>
                    <TabsTrigger value="diagnostics" className="flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        <span className="hidden sm:inline">Diagnostics</span>
                        <span className="sm:hidden">Tests</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="live" className="space-y-6">
                    <RealTimeMonitor refreshInterval={5000} showControls={true} />
                </TabsContent>

                <TabsContent value="control" className="space-y-6">
                    {loadingSessions ? (
                        <div className="flex h-[50vh] w-full items-center justify-center">
                            <div className="flex flex-col items-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                                <p className="text-xs text-muted-foreground font-medium">
                                    Loading sessions...
                                </p>
                            </div>
                        </div>
                    ) : (
                        <SessionControlPanel
                            sessions={sessions}
                            onOperationComplete={fetchSessions}
                        />
                    )}
                </TabsContent>

                <TabsContent value="health" className="space-y-6">
                    <SystemHealthMonitor />
                </TabsContent>

                <TabsContent value="debug" className="space-y-6">
                    <DebugCenterContent />
                </TabsContent>

                <TabsContent value="diagnostics" className="space-y-6">
                    <DiagnosticsContent />
                </TabsContent>
            </Tabs>
        </div>
    );
}
