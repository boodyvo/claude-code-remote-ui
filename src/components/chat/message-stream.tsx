"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { ArrowDown, MessageSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { UserBubble } from "./user-bubble";
import { AssistantBubble } from "./assistant-bubble";
import type { SDKMessage, ContentBlock } from "@/lib/types";

const EMPTY_MESSAGES: SDKMessage[] = [];

export function MessageStream() {
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const messages = useAppStore(
    (s) => (activeSessionId ? s.sessionMessages[activeSessionId] : null) ?? EMPTY_MESSAGES,
  );
  const streamBuffer = useAppStore((s) => s.streamBuffer);
  const connectionState = useAppStore((s) => s.connectionState);

  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showNewMessages, setShowNewMessages] = useState(false);
  const isNearBottom = useRef(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
    setShowNewMessages(false);
  }, []);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    isNearBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isNearBottom.current) setShowNewMessages(false);
  }, []);

  useEffect(() => {
    if (isNearBottom.current) {
      scrollToBottom("smooth");
    } else {
      setShowNewMessages(true);
    }
  }, [messages.length, scrollToBottom]);

  // Empty state — no session selected
  if (!activeSessionId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Claude Connector</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {connectionState === "connected"
              ? "Select a session from the sidebar or create a new one."
              : "Connecting to server..."}
          </p>
        </div>
      </div>
    );
  }

  // Empty state — session selected but no messages
  if (messages.length === 0 && !streamBuffer) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5">
          <MessageSquare className="h-7 w-7 text-primary/50" />
        </div>
        <p className="text-sm text-muted-foreground">
          Send a message to start the conversation.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto"
      >
        <div className="mx-auto max-w-3xl py-4">
          {messages.map((msg, i) => (
            <MessageItem key={i} message={msg} />
          ))}

          {streamBuffer && (
            <AssistantBubble
              content={[{ type: "text", text: streamBuffer }]}
            />
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {showNewMessages && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <Button
            size="sm"
            variant="secondary"
            className="rounded-full shadow-lg"
            onClick={() => scrollToBottom()}
          >
            <ArrowDown className="mr-1 h-3.5 w-3.5" />
            New messages
          </Button>
        </div>
      )}
    </div>
  );
}

function extractUserText(message: SDKMessage): string {
  const msg = (message as Record<string, unknown>).message as Record<string, unknown> | undefined;
  if (!msg) return "";

  const content = msg.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block: { type?: string; text?: string }) =>
        block.type === "text" ? block.text || "" : "",
      )
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function extractAssistantContent(message: SDKMessage): ContentBlock[] {
  if (Array.isArray(message.content)) {
    return message.content as ContentBlock[];
  }
  const msg = (message as Record<string, unknown>).message as Record<string, unknown> | undefined;
  if (msg && Array.isArray(msg.content)) {
    return msg.content as ContentBlock[];
  }
  return [];
}

function MessageItem({ message }: { message: SDKMessage }) {
  if (message.type === "user") {
    const content = extractUserText(message);
    if (!content) return null;
    return <UserBubble content={content} />;
  }

  if (message.type === "assistant") {
    const content = extractAssistantContent(message);
    if (content.length === 0) return null;
    return <AssistantBubble content={content} />;
  }

  return null;
}
