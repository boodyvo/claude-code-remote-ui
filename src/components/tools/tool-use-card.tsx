"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { getToolIcon } from "@/lib/tool-icons";
import { ToolApprovalBar } from "./tool-approval-bar";
import { ToolSpinner } from "./tool-spinner";
import { cn } from "@/lib/utils";

type ToolStatus = "pending" | "approved" | "rejected" | "running" | "completed";

interface ToolUseCardProps {
  toolName: string;
  toolUseId: string;
  input: Record<string, unknown>;
  status: ToolStatus;
  startTime?: number;
  children?: React.ReactNode;
}

export function ToolUseCard({
  toolName,
  toolUseId,
  input,
  status,
  startTime,
  children,
}: ToolUseCardProps) {
  const [paramsOpen, setParamsOpen] = useState(false);
  const Icon = getToolIcon(toolName);

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-[var(--color-tool-bg)]/30 bg-[var(--color-tool-bg)]/10">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium">
        <Icon className="h-4 w-4 shrink-0 text-blue-500" />
        <span>{toolName}</span>
        {Object.keys(input).length > 0 && (
          <button
            onClick={() => setParamsOpen(!paramsOpen)}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                paramsOpen && "rotate-90",
              )}
            />
            params
          </button>
        )}
      </div>

      {/* Collapsible input params */}
      {paramsOpen && Object.keys(input).length > 0 && (
        <div className="border-t border-[var(--color-tool-bg)]/20 px-3 py-2">
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
            {JSON.stringify(input, null, 2)}
          </pre>
        </div>
      )}

      {/* Running spinner */}
      {status === "running" && (
        <div className="border-t border-[var(--color-tool-bg)]/20 px-3">
          <ToolSpinner toolName={toolName} startTime={startTime || Date.now()} />
        </div>
      )}

      {/* Tool result (children) */}
      {children && (
        <div className="border-t border-[var(--color-tool-bg)]/20 px-3 py-2">
          {children}
        </div>
      )}

      {/* Approval bar for pending tools */}
      {status === "pending" && (
        <div className="border-t border-[var(--color-tool-bg)]/20 px-3 py-2">
          <ToolApprovalBar toolUseId={toolUseId} />
        </div>
      )}
    </div>
  );
}
