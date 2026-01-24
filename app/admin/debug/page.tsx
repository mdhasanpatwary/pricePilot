"use client";

import { useState, useEffect, useCallback } from "react";
import { 
    Bug, 
    AlertCircle, 
    Terminal, 
    Database, 
    ShieldAlert, 
    History, 
    RefreshCw, 
    ActivitySquare, 
    Layers,
    Play,
    Loader2,
    CheckCircle,
    XCircle,
    Globe,
    Server,
    Network,
    Target
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Tab = "intelligence" | "health" | "inconsistencies";

interface DebugData {
    summary: { errorCount: number; inconsistencyCount: number };
    logs: {
        sync: any[];
        updates: any[];
        scraping: any[];
        audit: any[];
    };
    inconsistencies: any[];
    timestamp: string;
}

type DiagnosisStatus = "healthy" | "warning" | "failed" | "pending";
interface DiagnosticResult { status: DiagnosisStatus; message: string; }
interface HealthData {
    results: {
        database: DiagnosticResult;
        redis: DiagnosticResult;
        internet: DiagnosticResult;
        proxies: DiagnosticResult;
        integrations: DiagnosticResult;
    };
    duration: number;
    timestamp: string;
}

export default function DebugCenterPage() {
    const [activeTab, setActiveTab] = useState<Tab>("intelligence");
    const [isLoading, setIsLoading] = useState(true);
    const [debugData, setDebugData] = useState<DebugData | null>(null);
    const [healthData, setHealthData] = useState<HealthData | null>(null);
    const [isRunningHealth, setIsRunningHealth] = useState(false);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/v1/admin/debug");
            if (res.ok) {
                const data = await res.json();
                setDebugData(data);
            }
        } catch (e) {
            toast.error("Failed to load debug stream");
        } finally {
            setIsLoading(false);
        }
    }, []);

    const runHealthCheck = async () => {
        setIsRunningHealth(true);
        try {
            const res = await fetch("/api/v1/admin/diagnostics", { method: "POST" });
            if (res.ok) {
                const data = await res.json();
                setHealthData(data);
                toast.success("Health assessment completed");
            }
        } catch (e) {
            toast.error("Diagnostic engine failure");
        } finally {
            setIsRunningHealth(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Bug className="w-6 h-6 text-primary" />
                        System Debug Center
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Unified diagnostic hub for platform intelligence, component health, and data integrity.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
                        <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
                        Refresh Data
                    </Button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 p-1 bg-muted/30 border border-border rounded-xl w-fit">
                {[
                    { id: "intelligence", label: "Intelligence Stream", icon: Terminal },
                    { id: "health", label: "Component Health", icon: ActivitySquare },
                    { id: "inconsistencies", label: "Data Anomalies", icon: ShieldAlert },
                ].map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id as Tab)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap",
                            activeTab === t.id
                                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <t.icon className="w-3.5 h-3.5" />
                        {t.label}
                        {t.id === "inconsistencies" && debugData?.summary.inconsistencyCount! > 0 && (
                            <span className="ml-1 w-4 h-4 rounded-full bg-danger text-white text-[10px] flex items-center justify-center">
                                {debugData?.summary.inconsistencyCount}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content Areas */}
            <div className="min-h-[500px]">
                {activeTab === "intelligence" && (
                    <IntelligenceView data={debugData} loading={isLoading} />
                )}
                {activeTab === "health" && (
                    <HealthView 
                        data={healthData} 
                        loading={isRunningHealth} 
                        onRun={runHealthCheck} 
                    />
                )}
                {activeTab === "inconsistencies" && (
                    <InconsistencyView data={debugData?.inconsistencies || []} loading={isLoading} />
                )}
            </div>
        </div>
    );
}

function IntelligenceView({ data, loading }: { data: DebugData | null; loading: boolean }) {
    if (loading && !data) {
        return <div className="space-y-4"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>;
    }

    if (!data) return null;

    return (
        <div className="grid gap-8 grid-cols-1 lg:grid-cols-2">
            {/* Sync Failures */}
            <LogSection 
                title="Crawler Failures" 
                logs={data.logs.sync} 
                icon={Globe}
                empty="No critical crawler events reported."
                renderItem={(log: any) => (
                    <div key={log.id} className="p-3 border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                            <Badge variant={log.level === "ERROR" ? "destructive" : "warning"} className="text-[10px]">
                                {log.level}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{new Date(log.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-[12px] font-medium leading-relaxed">{log.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 opacity-60 truncate">
                            {log.site.tenant.companyName} • {log.site.baseUrl}
                        </p>
                    </div>
                )}
            />

            {/* Price Engine Failures */}
            <LogSection 
                title="Pricing Logic Errors" 
                logs={data.logs.updates} 
                icon={Target}
                empty="Pricing engine is operating within parameters."
                renderItem={(log: any) => (
                    <div key={log.id} className="p-3 border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                            <Badge variant="destructive" className="text-[10px]">EXECUTION_FAILED</Badge>
                            <span className="text-[10px] text-muted-foreground">{new Date(log.executedAt).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-[12px] font-medium">{log.product.title}</p>
                        <p className="text-[11px] text-danger font-mono mt-1 bg-danger/5 p-2 rounded border border-danger/10">
                            {log.errorDetails || "Stack trace unavailable"}
                        </p>
                    </div>
                )}
            />

            {/* Recent System Activity */}
            <LogSection 
                title="Administrative Context" 
                logs={data.logs.audit} 
                icon={History}
                empty="No recent administrative events."
                renderItem={(log: any) => (
                    <div key={log.id} className="p-3 border-b last:border-0 flex items-start gap-3">
                         <div className="shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                             {log.userEmail[0].toUpperCase()}
                         </div>
                         <div className="flex-1 min-w-0">
                             <div className="flex items-center justify-between">
                                 <span className="text-xs font-bold truncate">{log.action}</span>
                                 <span className="text-[10px] text-muted-foreground">{new Date(log.createdAt).toLocaleTimeString()}</span>
                             </div>
                             <p className="text-[10px] text-muted-foreground truncate opacity-70">{log.userEmail}</p>
                         </div>
                    </div>
                )}
            />

            {/* Scrape Hard Retries */}
            <LogSection 
                title="Exhausted Retries" 
                logs={data.logs.scraping} 
                icon={RefreshCw}
                empty="No exhausted scrape tasks detected."
                renderItem={(log: any) => (
                    <div key={log.id} className="p-3 border-b last:border-0">
                        <div className="flex items-center gap-2 mb-1">
                             <Badge variant="outline" className="text-[9px] bg-red-50 text-red-700 border-red-200">MAX_RETRIES</Badge>
                             <span className="text-[10px] text-muted-foreground">{new Date(log.updatedAt).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-xs font-bold text-foreground/80">{log.userProduct.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 italic">{log.reason}</p>
                    </div>
                )}
            />
        </div>
    );
}

function LogSection({ title, logs, icon: Icon, empty, renderItem }: any) {
    return (
        <Card className="overflow-hidden flex flex-col h-[400px]">
            <div className="p-4 bg-muted/20 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-xs font-black uppercase tracking-widest">{title}</h3>
                </div>
                <Badge variant="outline" className="text-[10px]">{logs.length}</Badge>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {logs.length > 0 ? (
                    logs.map((log: any) => renderItem(log))
                ) : (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-2 opacity-40">
                         <Layers className="w-8 h-8" />
                         <p className="text-xs font-medium">{empty}</p>
                    </div>
                )}
            </div>
        </Card>
    );
}

function HealthView({ data, loading, onRun }: any) {
    return (
        <div className="space-y-6">
            <div className="p-6 bg-primary/5 border border-primary/10 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <h3 className="text-lg font-bold">Deep Health Assessment</h3>
                    <p className="text-sm text-muted-foreground max-w-lg">
                        Execute real-time latency and connectivity tests across the database cluster, Redis caching layer, proxy rotation, and integration gateways.
                    </p>
                </div>
                <Button onClick={onRun} disabled={loading} size="lg" className="h-12 px-8 font-bold shadow-lg shadow-primary/20">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Play className="w-5 h-5 mr-2" />}
                    {loading ? "Testing Elements..." : "Initiate System Test"}
                </Button>
            </div>

            {data ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <StatusCard title="Backend SQL Cluster" icon={Database} result={data.results.database} />
                    <StatusCard title="Cache Layer (Redis)" icon={Server} result={data.results.redis} />
                    <StatusCard title="Gateway Transit" icon={Globe} result={data.results.internet} />
                    <StatusCard title="Proxy Ingress" icon={Network} result={data.results.proxies} />
                    <StatusCard title="Store Adapters" icon={Layers} result={data.results.integrations} />
                    
                    <div className="lg:col-span-1 border border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center space-y-2">
                        <ActivitySquare className="w-8 h-8 text-primary opacity-20" />
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Global Latency</p>
                        <p className="text-xl font-bold">{data.duration}ms</p>
                    </div>
                </div>
            ) : (
                <div className="py-20 text-center border-2 border-dashed rounded-2xl opacity-50">
                    <ActivitySquare className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-sm font-medium">Diagnostic report will appear here after execution</p>
                </div>
            )}
        </div>
    );
}

function StatusCard({ title, icon: Icon, result }: any) {
    const isHealthy = result.status === "healthy";
    const isWarn = result.status === "warning";

    return (
        <Card className="p-5 flex flex-col justify-between border-border/60 hover:border-primary/30 transition-all group">
            <div className="flex items-start justify-between">
                <div className="p-2.5 bg-muted/50 rounded-xl group-hover:bg-primary/5 transition-colors">
                    <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                {isHealthy ? <CheckCircle className="text-green-500 w-5 h-5" /> : 
                 isWarn ? <AlertCircle className="text-amber-500 w-5 h-5" /> : 
                 <XCircle className="text-red-500 w-5 h-5" />}
            </div>
            <div className="mt-4">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{title}</p>
                <div className={cn(
                    "text-xs font-bold px-3 py-1.5 rounded-lg border",
                    isHealthy ? "bg-green-50 border-green-100 text-green-700" :
                    isWarn ? "bg-amber-50 border-amber-100 text-amber-700" :
                    "bg-red-50 border-red-100 text-red-700"
                )}>
                    {result.message}
                </div>
            </div>
        </Card>
    );
}

function InconsistencyView({ data, loading }: { data: any[]; loading: boolean }) {
    if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                 <ShieldAlert className="w-6 h-6 text-amber-600" />
                 <div>
                     <p className="text-sm font-bold text-amber-900 leading-none">Automated Anomaly Detection</p>
                     <p className="text-xs text-amber-700 mt-1 opacity-80 font-medium">Our heuristics engine identifies data patterns that might indicate logic failures, stale intelligence, or integration gaps.</p>
                 </div>
            </div>

            {data.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed rounded-2xl bg-green-50/10 border-green-200/50">
                    <CheckCircle className="w-12 h-12 text-green-500/30 mx-auto mb-4" />
                    <h3 className="font-bold text-lg">No Inconsistencies Detected</h3>
                    <p className="text-sm text-muted-foreground mt-1">Platform data integrity is at 100%.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {data.map((item, idx) => (
                        <Card key={idx} className="p-6 overflow-hidden border-l-4 border-l-danger">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Badge variant={item.severity === "CRITICAL" ? "destructive" : "warning"} className="text-[9px] font-black uppercase">
                                            {item.severity}
                                        </Badge>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">{item.type.replace('_',' ')}</span>
                                    </div>
                                    <h4 className="text-sm font-black">{item.message}</h4>
                                    <p className="text-xs text-muted-foreground font-medium italic">Impact: {item.impact}</p>
                                </div>
                                {item.details && (
                                    <div className="p-3 bg-muted rounded-lg max-w-md">
                                        <p className="text-[10px] font-mono text-muted-foreground leading-relaxed truncate">{item.details}</p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
