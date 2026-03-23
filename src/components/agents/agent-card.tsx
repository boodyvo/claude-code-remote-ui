"use client";

import { Bot, CheckCircle, XCircle, StopCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AgentStatus = "running" | "completed" | "failed" | "stopped";

interface AgentCardProps {
  taskId: string;
  description: string;
  status: AgentStatus;
  summary?: string;
  usage?: { input_tokens: number; output_tokens: number };
  lastToolName?: string;
  children?: React.ReactNode;
}

const STATUS_CONFIG: Record<
  AgentStatus,
  { icon: typeof Bot; color: string; label: string }
> = {
  running: { icon: Loader2, color: "text-blue-500", label: "Running..." },
  completed: { icon: CheckCircle, color: "text-green-500", label: "Completed" },
  failed: { icon: XCircle, color: "text-red-500", label: "Failed" },
  stopped: { icon: StopCircle, color: "text-yellow-500", label: "Stopped" },
};

export function AgentCard({
  description,
  status,
  summary,
  usage,
  lastToolName,
  children,
}: AgentCardProps) {
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  return (
    <div
      className={cn(
        "my-2 overflow-hidden rounded-lg border-l-4 bg-muted/30",
        status === "failed" ? "border-l-red-500" : "border-l-blue-500",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <Bot className="h-4 w-4 shrink-0 text-blue-500" />
        <span className="flex-1 font-medium">{description}</span>
        <span
          className={cn("flex items-center gap-1 text-xs", config.color)}
        >
          <StatusIcon
            className={cn(
              "h-3.5 w-3.5",
              status === "running" && "animate-spin",
            )}
          />
          {config.label}
        </span>
      </div>

      {/* Progress info */}
      {status === "running" && lastToolName && (
        <div className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
          Using {lastToolName}...
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="border-t border-border px-3 py-2 text-sm">
          {summary}
        </div>
      )}

      {/* Usage */}
      {usage && (
        <div className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
          {usage.input_tokens.toLocaleString()} in / {usage.output_tokens.toLocaleString()} out tokens
        </div>
      )}

      {/* Nested messages */}
      {children && (
        <div className="border-t border-border pl-4">{children}</div>
      )}
    </div>
  );
}
