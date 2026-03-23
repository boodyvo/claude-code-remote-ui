"use client";

import { MessageSquare, FolderOpen, Terminal } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { ActiveTab } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS: { id: ActiveTab; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "files", label: "Files", icon: FolderOpen },
  { id: "terminal", label: "Terminal", icon: Terminal },
];

export function BottomNav() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  return (
    <nav className="flex h-14 shrink-0 items-stretch border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setActiveTab(id)}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
            activeTab === id
              ? "text-primary"
              : "text-muted-foreground active:text-foreground",
          )}
        >
          <Icon
            className={cn(
              "h-5 w-5",
              activeTab === id && "drop-shadow-sm",
            )}
          />
          {label}
        </button>
      ))}
    </nav>
  );
}
