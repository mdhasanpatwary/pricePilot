"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function DiagnosticsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new monitoring hub
    router.replace("/admin/monitoring?tab=diagnostics");
  }, [router]);

  return (
    <div className="flex h-[50vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">
          Redirecting to Monitoring Hub...
        </p>
      </div>
    </div>
  );
}
