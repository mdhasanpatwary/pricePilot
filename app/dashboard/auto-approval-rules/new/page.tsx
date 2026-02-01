"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import AutoApprovalRuleForm from "@/components/dashboard/auto-approval-rule-form";

function NewAutoApprovalRuleContent() {
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
                <span className="text-foreground font-medium">Create New Rule</span>
            </div>

            {/* Header Section */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    Create Auto-Approval Rule
                </h1>
                <p className="text-muted-foreground mt-1 text-lg">
                    Define conditions for automatically approving price changes.
                </p>
            </div>

            {/* Form */}
            <AutoApprovalRuleForm
                onSuccess={() => {
                    window.location.href = "/dashboard/auto-approval-rules";
                }}
                onCancel={() => {
                    window.location.href = "/dashboard/auto-approval-rules";
                }}
            />
        </div>
    );
}

export default function NewAutoApprovalRulePage() {
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
            <NewAutoApprovalRuleContent />
        </Suspense>
    );
}
