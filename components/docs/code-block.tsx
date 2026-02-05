"use client";

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
}

export function CodeBlock({ code, language, filename, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  return (
    <div className={cn('group relative', className)}>
      {/* Header with filename and copy button */}
      {(filename || language) && (
        <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-border bg-muted px-4 py-2">
          <div className="flex items-center gap-2">
            {filename && (
              <span className="text-sm font-medium text-foreground">{filename}</span>
            )}
            {language && !filename && (
              <span className="text-xs text-muted-foreground uppercase">{language}</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-8 px-2 opacity-0 transition-opacity group-hover:opacity-100"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                <span className="text-xs">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1" />
                <span className="text-xs">Copy</span>
              </>
            )}
          </Button>
        </div>
      )}

      {/* Code content */}
      <div className="relative">
        <pre className={cn(
          'overflow-x-auto rounded-lg border border-border bg-muted p-4',
          (filename || language) && 'rounded-t-none border-t-0'
        )}>
          <code className={cn('text-sm', language && `language-${language}`)}>
            {code}
          </code>
        </pre>

        {/* Copy button for blocks without header */}
        {!filename && !language && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="absolute right-2 top-2 h-8 px-2 opacity-0 transition-opacity group-hover:opacity-100"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
