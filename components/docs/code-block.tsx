"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  code: string;
  language?: string;
  filename?: string;
}

/**
 * CodeBlock component extending shadcn/ui Button for copy functionality
 * Uses Badge for language/filename display and follows shadcn/ui styling patterns
 */
export default function CodeBlock({
  code,
  language,
  filename,
  className,
  ...props
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn(
      "group relative my-8 rounded-md border border-border bg-muted/20 overflow-hidden",
      className
    )} {...props}>
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-border bg-muted/40">
        <div className="flex items-center gap-2">
          {filename ? (
            <Badge variant="outline" className="text-[11px] font-bold">
              {filename}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[11px] font-bold uppercase tracking-widest">
              {language || "code"}
            </Badge>
          )}
        </div>

        <Button
          onClick={copyToClipboard}
          variant="ghost"
          size="sm"
          className={cn(
            "p-1 rounded-md transition-all hover:bg-muted-foreground/10",
            copied ? "text-success" : "text-muted-foreground/60"
          )}
          title="Copy to clipboard"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </Button>
      </div>

      <div className="relative">
        <pre className="p-5 overflow-x-auto text-[13px] font-mono leading-relaxed text-foreground/80 selection:bg-primary/20">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
