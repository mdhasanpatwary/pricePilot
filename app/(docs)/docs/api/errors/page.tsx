import Callout from "@/components/docs/callout";
import { AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function ErrorsPage() {
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-[0.2em]">
          <AlertCircle className="w-4 h-4" /> API Reference
        </div>
        <h1 className="font-outfit text-4xl font-black tracking-tighter md:text-5xl text-foreground">
          Error Codes
        </h1>
        <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
          A comprehensive guide to understanding and resolving PricePilot API errors.
        </p>
      </div>

      <hr className="border-border" />

      <div className="p-12 rounded-3xl border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center text-center space-y-4">
        <div className="p-4 bg-muted rounded-full">
          <AlertCircle className="w-8 h-8 text-muted-foreground/40" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold">Documentation Coming Soon</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            We are currently compiling the full list of error codes and troubleshooting steps.
          </p>
        </div>
        <Link href="/docs/api/endpoints" className="text-xs font-black uppercase tracking-widest text-primary hover:underline">
          Go back to Endpoints
        </Link>
      </div>

      <Callout type="info">
        In the meantime, if you encounter an unexpected error, please check the <code className="font-mono text-xs">status</code> code of the response and contact support if it persists.
      </Callout>
    </div>
  );
}
