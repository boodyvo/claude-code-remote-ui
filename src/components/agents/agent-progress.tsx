"use client";

import { useState } from "react";
import { Bot, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentProgressProps {
  description: string;
  lastToolName?: string;
  history?: string[];
}

export function AgentProgress({
  description,
  lastToolName,
  history,
}: AgentProgressProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
        <Bot className="h-3.5 w-3.5" />
        <span className="truncate">{description}</span>
        {lastToolName && (
          <span className="text-blue-400">({lastToolName})</span>
        )}
        {history && history.length > 0 && (
          <ChevronRight
            className={cn(
              "h-3 w-3 transition-transform",
              expanded && "rotate-90",
            )}
          />
        )}
      </button>
      {expanded && history && (
        <ul className="ml-6 mt-1 space-y-0.5 text-xs text-muted-foreground">
          {history.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
