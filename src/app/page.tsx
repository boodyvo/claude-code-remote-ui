"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useWsConnection } from "@/lib/use-ws-connection";
import { TopBar } from "@/components/layout/top-bar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SessionSidebar } from "@/components/session/session-sidebar";
import { MessageStream } from "@/components/chat/message-stream";
import { InputBar } from "@/components/chat/input-bar";
import { AuthOverlay } from "@/components/auth/auth-overlay";
import { wsClient } from "@/lib/ws-client";

function ProjectSessionStarter() {
  const searchParams = useSearchParams();
  const connectionState = useAppStore((s) => s.connectionState);

  useEffect(() => {
    const projectId = searchParams.get("projectId");
    if (!projectId || connectionState !== "connected") return;
    wsClient.send({ type: "new_session", cwd: "", projectId: Number(projectId) });
    window.history.replaceState({}, "", "/");
  }, [searchParams, connectionState]);

  return null;
}

export default function Home() {
  useWsConnection();
  const activeTab = useAppStore((s) => s.activeTab);

  return (
    <div className="flex h-dvh">
      <AuthOverlay />
      <Suspense>
        <ProjectSessionStarter />
      </Suspense>
      <SessionSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex flex-1 flex-col overflow-hidden">
          {activeTab === "chat" && (
            <>
              <MessageStream />
              <InputBar />
            </>
          )}
          {activeTab === "files" && (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              File explorer coming soon
            </div>
          )}
          {activeTab === "terminal" && (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              Terminal coming soon
            </div>
          )}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
