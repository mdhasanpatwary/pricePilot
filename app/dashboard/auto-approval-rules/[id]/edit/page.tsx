"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import AutoApprovalRuleForm from "@/components/dashboard/auto-approval-rule-form";

function EditAutoApprovalRuleContent() {
    const params = useParams();
    const router = useRouter();
    const ruleId = params.id as string;

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link
                    href="/dashboard"
                    className="hover:text-foreground transition-colors"
                >
                    Dashboard
                </Link>
                <ChevronRight className="w-4 h-4" />
                <Link
                    href="/dashboard/auto-approval-rules"
                    className="hover:text-foreground transition-colors"
                >
                    Auto-Approval Rules
                </Link>
                <ChevronRight className="w-4 h-4" />
                <span className="text-foreground font-medium">Edit Rule</span>
            </div>

            {/* Header Section */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    Edit Auto-Approval Rule
                </h1>
                <p className="text-muted-foreground mt-1 text-lg">
                    Update conditions for automatically approving price changes.
                </p>
            </div>

            {/* Form */}
            <AutoApprovalRuleForm
                ruleId={ruleId}
                onSuccess={() => {
                    router.push("/dashboard/auto-approval-rules");
                }}
                onCancel={() => {
                    router.push("/dashboard/auto-approval-rules");
                }}
            />
        </div>
    );
}

export default function EditAutoApprovalRulePage() {
    return (
        <Suspense
            fallback={
                <div className="space-y-8 animate-in fade-in duration-500 pb-10">
                    <div className="flex items-center gap-2 text-sm">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-24" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-10 w-80" />
                        <Skeleton className="h-4 w-96" />
                    </div>
                    <Skeleton className="h-[600px] w-full rounded-xl" />
                </div>
            }
        >
            <EditAutoApprovalRuleContent />
        </Suspense>
    );
}
