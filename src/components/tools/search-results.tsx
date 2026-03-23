"use client";

import { useState } from "react";
import { ChevronRight, File } from "lucide-react";
import { cn } from "@/lib/utils";

interface Match {
  line: number;
  text: string;
}

interface FileMatch {
  file: string;
  matches: Match[];
}

interface SearchResultsProps {
  results: FileMatch[];
  searchTerm?: string;
}

function highlightTerm(text: string, term?: string): React.ReactNode {
  if (!term) return text;

  const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === term.toLowerCase() ? (
      <mark key={i} className="rounded bg-yellow-300/30 px-0.5 text-yellow-200">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function SearchResults({ results, searchTerm }: SearchResultsProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleFile(file: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  }

  return (
    <div className="rounded-lg border border-border">
      {results.map(({ file, matches }) => (
        <div key={file} className="border-b border-border last:border-b-0">
          <button
            onClick={() => toggleFile(file)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted"
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform",
                !collapsed.has(file) && "rotate-90",
              )}
            />
            <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-mono">{file}</span>
            <span className="ml-auto text-muted-foreground">
              {matches.length}
            </span>
          </button>
          {!collapsed.has(file) && (
            <div className="bg-[var(--color-terminal-bg)] px-3 py-1">
              {matches.map((m) => (
                <div
                  key={`${file}:${m.line}`}
                  className="flex gap-3 font-mono text-xs"
                >
                  <span className="w-8 shrink-0 text-right text-muted-foreground">
                    {m.line}
                  </span>
                  <span className="whitespace-pre-wrap break-all">
                    {highlightTerm(m.text, searchTerm)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
