"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { Plus, MessageSquare, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAppStore } from "@/lib/store";
import { SessionSearch } from "./session-search";
import type { SessionInfo } from "@/lib/types";
import { wsClient } from "@/lib/ws-client";
import { cn } from "@/lib/utils";

interface Project {
  id: number;
  name: string;
  slug: string;
}

function groupByDate(sessions: SessionInfo[]): Record<string, SessionInfo[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400_000);
  const weekAgo = new Date(today.getTime() - 7 * 86400_000);
  const monthAgo = new Date(today.getTime() - 30 * 86400_000);

  const groups: Record<string, SessionInfo[]> = {};

  for (const session of sessions) {
    const date = new Date(session.lastActiveAt);
    let group: string;

    if (date >= today) group = "Today";
    else if (date >= yesterday) group = "Yesterday";
    else if (date >= weekAgo) group = "This Week";
    else if (date >= monthAgo) group = "This Month";
    else group = "Older";

    if (!groups[group]) groups[group] = [];
    groups[group].push(session);
  }

  return groups;
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

interface SidebarContentProps {
  onSelectSession: (id: string) => void;
  onNewSession: (projectId?: number) => void;
}

function SidebarContent({ onSelectSession, onNewSession }: SidebarContentProps) {
  const sessions = useAppStore((s) => s.sessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const connectionState = useAppStore((s) => s.connectionState);
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">("");
  const [showProjectSelect, setShowProjectSelect] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.sessionId.toLowerCase().includes(q),
    );
  }, [sessions, searchQuery]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);
  const groupOrder = ["Today", "Yesterday", "This Week", "This Month", "Older"];

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="space-y-2 p-3">
        <div className="flex gap-1.5">
          <Button
            className="flex-1 justify-start gap-2"
            size="sm"
            onClick={() => onNewSession(selectedProjectId || undefined)}
            disabled={connectionState !== "connected"}
          >
            <Plus className="h-4 w-4" />
            New Session
          </Button>
          {projects.length > 0 && (
            <Button
              size="icon-sm"
              variant="outline"
              title="Select project for new session"
              onClick={() => setShowProjectSelect((v) => !v)}
              disabled={connectionState !== "connected"}
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showProjectSelect && "rotate-180")} />
            </Button>
          )}
        </div>
        {showProjectSelect && projects.length > 0 && (
          <select
            className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">No project (default workspace)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        {sessions.length > 5 && <SessionSearch onSearch={setSearchQuery} />}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {sessions.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            {connectionState === "connected"
              ? "No sessions yet"
              : "Connecting..."}
          </div>
        )}

        {groupOrder.map((group) => {
          const items = grouped[group];
          if (!items?.length) return null;
          return (
            <div key={group} className="mb-1">
              <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </div>
              {items.map((session) => (
                <button
                  key={session.sessionId}
                  onClick={() => onSelectSession(session.sessionId)}
                  className={cn(
                    "group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                    session.sessionId === activeSessionId
                      ? "bg-sidebar-active text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-50" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium leading-snug">
                      {session.name || "Untitled"}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span>{formatTime(session.lastActiveAt)}</span>
                      {session.cwd && (
                        <>
                          <span className="opacity-30">·</span>
                          <span className="truncate">
                            {session.cwd.split("/").pop()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SessionSidebar() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const setActiveSessionId = useAppStore((s) => s.setActiveSessionId);

  const handleSelect = useCallback(
    (id: string) => {
      setActiveSessionId(id);
      wsClient.send({ type: "get_session_messages", sessionId: id });
      wsClient.send({ type: "resume_session", sessionId: id });
      setSidebarOpen(false);
    },
    [setActiveSessionId, setSidebarOpen],
  );

  const handleNewSession = useCallback(
    (projectId?: number) => {
      wsClient.send({ type: "new_session", cwd: "", ...(projectId ? { projectId } : {}) });
      setSidebarOpen(false);
    },
    [setSidebarOpen],
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 border-r border-border md:block">
        <SidebarContent
          onSelectSession={handleSelect}
          onNewSession={handleNewSession}
        />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SidebarContent
            onSelectSession={handleSelect}
            onNewSession={handleNewSession}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
