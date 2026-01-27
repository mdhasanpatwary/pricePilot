"use client";

import { use } from "react";
import TenantDebugView from "@/components/admin/tenant-debug-view";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function TenantDebugPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/admin/tenants">
                    <Button variant="outline" size="sm">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Tenants
                    </Button>
                </Link>
            </div>

            <TenantDebugView tenantId={id} />
        </div>
    );
}
