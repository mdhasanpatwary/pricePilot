"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
}

export default function CodeBlock({ code, language, filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-8 rounded-md border border-border bg-muted/20 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-border bg-muted/40">
        <div className="flex items-center gap-2">
          {filename && (
            <span className="text-[11px] font-bold text-foreground/60">
              {filename}
            </span>
          )}
          {!filename && (
            <span className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest">
              {language || "code"}
            </span>
          )}
        </div>

        <button
          onClick={copyToClipboard}
          className={cn(
            "p-1 rounded-md transition-all hover:bg-muted-foreground/10",
            copied ? "text-success" : "text-muted-foreground/60"
          )}
          title="Copy to clipboard"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="relative">
        <pre className="p-5 overflow-x-auto text-[13px] font-mono leading-relaxed text-foreground/80 selection:bg-primary/20">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
