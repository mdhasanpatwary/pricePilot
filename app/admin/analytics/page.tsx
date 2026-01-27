"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, Shield, TrendingUp, Server, BarChart3 } from "lucide-react";
import MetricsDashboard from "@/components/admin/metrics-dashboard";

// Import analytics page components
import { ScraperStatusContent } from "./scraper-status-content";
import { ProxyHealthContent } from "./proxy-health-content";
import { ChallengeStatsContent } from "./challenge-stats-content";
import { ScrapingMetricsContent } from "./scraping-metrics-content";

export default function AnalyticsHubPage() {
    const searchParams = useSearchParams();
    const tabParam = searchParams.get("tab");
    const [activeTab, setActiveTab] = useState(tabParam || "dashboard");

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Analytics Hub</h1>
                <p className="text-muted-foreground">
                    Comprehensive scraping analytics, proxy health, and performance metrics
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5 lg:w-auto lg:inline-grid">
                    <TabsTrigger value="dashboard" className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        <span className="hidden sm:inline">Dashboard</span>
                        <span className="sm:hidden">Dash</span>
                    </TabsTrigger>
                    <TabsTrigger value="overview" className="flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        <span className="hidden sm:inline">Scraper Status</span>
                        <span className="sm:hidden">Status</span>
                    </TabsTrigger>
                    <TabsTrigger value="metrics" className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        <span className="hidden sm:inline">Scraping Metrics</span>
                        <span className="sm:hidden">Metrics</span>
                    </TabsTrigger>
                    <TabsTrigger value="proxies" className="flex items-center gap-2">
                        <Server className="w-4 h-4" />
                        <span className="hidden sm:inline">Proxy Health</span>
                        <span className="sm:hidden">Proxies</span>
                    </TabsTrigger>
                    <TabsTrigger value="challenges" className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        <span className="hidden sm:inline">Challenge Stats</span>
                        <span className="sm:hidden">Challenges</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard" className="space-y-6">
                    <MetricsDashboard />
                </TabsContent>

                <TabsContent value="overview" className="space-y-6">
                    <ScraperStatusContent />
                </TabsContent>

                <TabsContent value="metrics" className="space-y-6">
                    <ScrapingMetricsContent />
                </TabsContent>

                <TabsContent value="proxies" className="space-y-6">
                    <ProxyHealthContent />
                </TabsContent>

                <TabsContent value="challenges" className="space-y-6">
                    <ChallengeStatsContent />
                </TabsContent>
            </Tabs>
        </div>
    );
}
