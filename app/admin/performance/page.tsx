"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, Zap, HardDrive, Activity, GitBranch } from "lucide-react";
import { SlowQueriesPanel } from "./slow-queries-panel";
import { IndexRecommendationsPanel } from "./index-recommendations-panel";
import { ConnectionPoolPanel } from "./connection-pool-panel";
import { CacheStatsPanel } from "./cache-stats-panel";
import { ReplicationStatusPanel } from "./replication-status-panel";

export default function PerformancePage() {
    const [activeTab, setActiveTab] = useState("queries");

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Database Performance</h1>
                <p className="text-muted-foreground">
                    Monitor and optimize database performance, caching, and query execution
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5 lg:w-auto lg:inline-grid">
                    <TabsTrigger value="queries" className="flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        <span className="hidden sm:inline">Slow Queries</span>
                        <span className="sm:hidden">Queries</span>
                    </TabsTrigger>
                    <TabsTrigger value="indexes" className="flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        <span className="hidden sm:inline">Indexes</span>
                        <span className="sm:hidden">Indexes</span>
                    </TabsTrigger>
                    <TabsTrigger value="pool" className="flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        <span className="hidden sm:inline">Connection Pool</span>
                        <span className="sm:hidden">Pool</span>
                    </TabsTrigger>
                    <TabsTrigger value="cache" className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4" />
                        <span className="hidden sm:inline">Cache Stats</span>
                        <span className="sm:hidden">Cache</span>
                    </TabsTrigger>
                    <TabsTrigger value="replication" className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4" />
                        <span className="hidden sm:inline">Replication</span>
                        <span className="sm:hidden">Replicas</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="queries" className="space-y-6">
                    <SlowQueriesPanel />
                </TabsContent>

                <TabsContent value="indexes" className="space-y-6">
                    <IndexRecommendationsPanel />
                </TabsContent>

                <TabsContent value="pool" className="space-y-6">
                    <ConnectionPoolPanel />
                </TabsContent>

                <TabsContent value="cache" className="space-y-6">
                    <CacheStatsPanel />
                </TabsContent>

                <TabsContent value="replication" className="space-y-6">
                    <ReplicationStatusPanel />
                </TabsContent>
            </Tabs>
        </div>
    );
}
