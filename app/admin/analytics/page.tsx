"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, Shield, TrendingUp, Server, BarChart3, Globe, DollarSign } from "lucide-react";
import MetricsDashboard from "@/components/admin/metrics-dashboard";

// Import analytics page components
import { ScraperStatusContent } from "./scraper-status-content";
import { ProxyHealthContent } from "./proxy-health-content";
import { ChallengeStatsContent } from "./challenge-stats-content";
import { ScrapingMetricsContent } from "./scraping-metrics-content";
import { DomainHealthContent } from "./domain-health-content";
import { ScrapeCostContent } from "./scrape-cost-content";

export default function AnalyticsHubPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const tabParam = searchParams.get("tab") || "dashboard";

    // Update URL when tab changes
    const handleTabChange = (value: string) => {
        router.push(`/admin/analytics?tab=${value}`, { scroll: false });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Analytics Hub</h1>
                <p className="text-muted-foreground">
                    Comprehensive scraping analytics, proxy health, and performance metrics
                </p>
            </div>

            <Tabs value={tabParam} onValueChange={handleTabChange} className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7 lg:w-auto lg:inline-grid">
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
                    <TabsTrigger value="domains" className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        <span className="hidden sm:inline">Domain Health</span>
                        <span className="sm:hidden">Domains</span>
                    </TabsTrigger>
                    <TabsTrigger value="cost" className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        <span className="hidden sm:inline">Scrape Cost</span>
                        <span className="sm:hidden">Cost</span>
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

                <TabsContent value="domains" className="space-y-6">
                    <DomainHealthContent />
                </TabsContent>

                <TabsContent value="cost" className="space-y-6">
                    <ScrapeCostContent />
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
