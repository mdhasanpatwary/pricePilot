import MetricsDashboard from "@/components/admin/metrics-dashboard";

export const metadata = {
    title: "Metrics Dashboard - Admin",
    description: "Real-time metrics and analytics dashboard",
};

export default function MetricsPage() {
    return (
        <div className="container mx-auto py-6">
            <MetricsDashboard />
        </div>
    );
}
