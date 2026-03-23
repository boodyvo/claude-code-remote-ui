"use client";

import type { SessionInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SessionListItemProps {
  session: SessionInfo;
  isActive: boolean;
  onClick: () => void;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60_000) return "now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SessionListItem({
  session,
  isActive,
  onClick,
}: SessionListItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
        isActive && "bg-accent",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">
          {session.name || "Untitled session"}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatTime(session.lastActiveAt)}
        </span>
      </div>
      {session.model && (
        <span className="mt-0.5 text-xs text-muted-foreground">
          {session.model}
        </span>
      )}
    </button>
  );
}
