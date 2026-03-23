"use client";

import { Menu, Wifi, WifiOff, Loader2, GitFork } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { wsClient } from "@/lib/ws-client";
import { cn } from "@/lib/utils";

export function TopBar() {
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const connectionState = useAppStore((s) => s.connectionState);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const sessions = useAppStore((s) => s.sessions);

  const activeSession = sessions.find((s) => s.sessionId === activeSessionId);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 md:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-medium">
          {activeSession?.name || "Claude Connector"}
        </span>
        {activeSession?.cwd && (
          <span className="hidden truncate text-xs text-muted-foreground md:inline">
            {activeSession.cwd.split("/").pop()}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {activeSessionId && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Fork session"
            onClick={() =>
              wsClient.send({ type: "fork_session", sessionId: activeSessionId })
            }
          >
            <GitFork className="h-3.5 w-3.5" />
          </Button>
        )}

        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium",
            connectionState === "connected" && "bg-green-500/10 text-green-600 dark:text-green-400",
            connectionState === "reconnecting" && "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
            connectionState === "disconnected" && "bg-destructive/10 text-destructive",
          )}
        >
          {connectionState === "connected" && (
            <>
              <Wifi className="h-3 w-3" />
              <span className="hidden sm:inline">Connected</span>
            </>
          )}
          {connectionState === "reconnecting" && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="hidden sm:inline">Reconnecting</span>
            </>
          )}
          {connectionState === "disconnected" && (
            <>
              <WifiOff className="h-3 w-3" />
              <span className="hidden sm:inline">Disconnected</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
