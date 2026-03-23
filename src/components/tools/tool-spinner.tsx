"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getToolIcon } from "@/lib/tool-icons";

interface ToolSpinnerProps {
  toolName: string;
  startTime: number;
}

export function ToolSpinner({ toolName, startTime }: ToolSpinnerProps) {
  const [elapsed, setElapsed] = useState(0);
  const Icon = getToolIcon(toolName);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <Icon className="h-4 w-4" />
      <span>{toolName}</span>
      <span className="tabular-nums">{elapsed}s</span>
    </div>
  );
}
