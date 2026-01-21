"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";
import { logger } from "@/lib/logger";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to our centralized logger
    logger.error("Global UI Error", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background text-foreground">
      <div className="w-full max-w-md space-y-8 text-center animate-in fade-in zoom-in duration-300">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-10 w-10" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight uppercase">
            Something went wrong
          </h1>
          <p className="text-muted-foreground">
            An unexpected error occurred. Our team has been notified and is
            looking into it.
          </p>
        </div>

        {error.digest && (
          <div className="p-2 bg-muted/50 rounded-lg">
            <code className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              Error ID: {error.digest}
            </code>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            onClick={reset}
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
            Try Again
          </button>

          <Link
            href="/dashboard"
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-border bg-background px-6 py-3 font-bold hover:bg-muted transition-all active:scale-95"
          >
            <Home className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-widest pt-8">
          PricePilot Production Environment
        </p>
      </div>
    </div>
  );
}
