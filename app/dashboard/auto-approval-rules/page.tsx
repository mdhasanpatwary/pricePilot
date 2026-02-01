"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AutoApprovalRulesList from "@/components/dashboard/auto-approval-rules-list";

function AutoApprovalRulesContent() {
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
                <span className="text-foreground font-medium">Auto-Approval Rules</span>
            </div>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        Auto-Approval Rules
                    </h1>
                    <p className="text-muted-foreground mt-1 text-lg">
                        Configure rules to automatically approve price changes that meet your criteria.
                    </p>
                </div>
                <Link href="/dashboard/auto-approval-rules/new">
                    <Button className="px-6 py-2.5">
                        <Plus className="w-4 h-4 mr-2" />
                        Create New Rule
                    </Button>
                </Link>
            </div>

            {/* Rules List */}
            <AutoApprovalRulesList />
        </div>
    );
}

export default function AutoApprovalRulesPage() {
    return (
        <Suspense
            fallback={
                <div className="space-y-8 animate-in fade-in duration-500 pb-10">
                    <div className="flex items-center gap-2 text-sm">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-col gap-2">
                            <Skeleton className="h-10 w-64" />
                            <Skeleton className="h-4 w-96" />
                        </div>
                        <Skeleton className="h-10 w-40" />
                    </div>
                    <Skeleton className="h-96 w-full rounded-xl" />
                </div>
            }
        >
            <AutoApprovalRulesContent />
        </Suspense>
    );
}
