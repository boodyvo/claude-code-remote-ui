"use client";

import { useState, useCallback } from "react";
import { ChevronRight, Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface GenericToolResultProps {
  data: unknown;
  isError?: boolean;
}

export function GenericToolResult({ data, isError }: GenericToolResultProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(data, null, 2);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [json]);

  return (
    <div
      className={cn(
        "rounded-lg border",
        isError ? "border-red-500/30 bg-red-500/5" : "border-border",
      )}
    >
      <div className="flex items-center justify-between px-3 py-1.5 text-xs">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              expanded && "rotate-90",
            )}
          />
          {isError ? "Error" : "Result"}
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      {expanded && (
        <pre className="max-h-60 overflow-auto border-t border-border px-3 py-2 font-mono text-xs">
          {json}
        </pre>
      )}
    </div>
  );
}
