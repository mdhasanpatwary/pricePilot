"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function ProxyHealthRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to the new analytics hub
        router.replace("/admin/analytics?tab=proxies");
    }, [router]);

    return (
        <div className="flex h-[50vh] w-full items-center justify-center">
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground font-medium">
                    Redirecting to Analytics Hub...
                </p>
            </div>
        </div>
    );
}
