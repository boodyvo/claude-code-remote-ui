"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolSummary {
  toolName: string;
  count: number;
}

interface ToolSummaryChipProps {
  tools: ToolSummary[];
  children?: React.ReactNode;
}

export function ToolSummaryChip({ tools, children }: ToolSummaryChipProps) {
  const [expanded, setExpanded] = useState(false);

  const summary = tools
    .map((t) => `${t.toolName} ${t.count}`)
    .join(", ");

  return (
    <div className="my-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 transition-transform",
            expanded && "rotate-90",
          )}
        />
        {summary}
      </button>
      {expanded && children}
    </div>
  );
}
