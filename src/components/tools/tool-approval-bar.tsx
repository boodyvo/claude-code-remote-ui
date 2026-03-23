"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { wsClient } from "@/lib/ws-client";

interface ToolApprovalBarProps {
  toolUseId: string;
  onDecision?: (decision: "allow" | "deny") => void;
}

export function ToolApprovalBar({ toolUseId, onDecision }: ToolApprovalBarProps) {
  const [decision, setDecision] = useState<"allow" | "deny" | null>(null);

  function handleDecision(d: "allow" | "deny") {
    if (decision) return; // prevent double-submit
    setDecision(d);
    wsClient.send({ type: "tool_response", toolUseId, decision: d });
    onDecision?.(d);
  }

  if (decision) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
          decision === "allow"
            ? "bg-green-500/10 text-green-600 dark:text-green-400"
            : "bg-red-500/10 text-red-600 dark:text-red-400"
        }`}
      >
        {decision === "allow" ? (
          <>
            <Check className="h-4 w-4" /> Approved
          </>
        ) : (
          <>
            <X className="h-4 w-4" /> Rejected
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-2 pt-2">
      <Button
        variant="outline"
        className="h-12 flex-1 border-green-500/30 text-green-600 hover:bg-green-500/10 dark:text-green-400"
        onClick={() => handleDecision("allow")}
      >
        <Check className="mr-2 h-4 w-4" /> Accept
      </Button>
      <Button
        variant="outline"
        className="h-12 flex-1 border-red-500/30 text-red-600 hover:bg-red-500/10 dark:text-red-400"
        onClick={() => handleDecision("deny")}
      >
        <X className="mr-2 h-4 w-4" /> Reject
      </Button>
    </div>
  );
}
