"use client";

import { useState, useCallback } from "react";
import { Check, Copy, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TerminalOutputProps {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  interrupted?: boolean;
  command?: string;
}

const MAX_LINES = 30;

export function TerminalOutput({
  stdout,
  stderr,
  exitCode,
  interrupted,
  command,
}: TerminalOutputProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const fullOutput = [stdout, stderr].filter(Boolean).join("\n");
  const lines = fullOutput.split("\n");
  const truncated = !expanded && lines.length > MAX_LINES;
  const displayOutput = truncated
    ? lines.slice(0, MAX_LINES).join("\n")
    : fullOutput;

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(fullOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [fullOutput]);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-[var(--color-terminal-bg)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {command && (
            <span className="font-mono text-green-400">$ {command}</span>
          )}
          {interrupted && (
            <span className="flex items-center gap-1 rounded bg-yellow-500/20 px-1.5 py-0.5 text-yellow-500">
              <AlertTriangle className="h-3 w-3" /> Interrupted
            </span>
          )}
          {exitCode !== undefined && exitCode !== 0 && (
            <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-red-400">
              exit {exitCode}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Output */}
      <div className="max-h-80 overflow-auto px-3 py-2">
        {stdout && (
          <pre className="whitespace-pre-wrap font-mono text-xs text-foreground">
            {expanded || !truncated ? stdout : stdout.split("\n").slice(0, MAX_LINES).join("\n")}
          </pre>
        )}
        {stderr && (
          <pre className="whitespace-pre-wrap font-mono text-xs text-red-400">
            {stderr}
          </pre>
        )}
      </div>

      {/* Show more */}
      {truncated && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full border-t border-border py-1.5 text-center text-xs text-muted-foreground hover:bg-accent"
        >
          Show {lines.length - MAX_LINES} more lines
        </button>
      )}
    </div>
  );
}
