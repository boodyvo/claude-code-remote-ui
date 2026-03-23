"use client";

import { useEffect, useRef } from "react";
import { wsClient } from "./ws-client";
import { useAppStore } from "./store";
import type { ServerMessage } from "./types";

/**
 * Hook that auto-connects the WebSocket on mount,
 * handles incoming server messages, and fetches the session list.
 */
export function useWsConnection() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Wire up message handler FIRST (before connecting)
    const unsubMessages = wsClient.onMessage(handleServerMessage);

    // Connect — doConnect() internally fetches a fresh short-lived WS token
    wsClient.connect();

    // Once connected, fetch existing sessions
    const checkConnected = setInterval(() => {
      if (wsClient.connected) {
        clearInterval(checkConnected);
        wsClient.send({ type: "list_sessions" });
      }
    }, 200);
    setTimeout(() => clearInterval(checkConnected), 10_000);

    return () => {
      unsubMessages();
    };
  }, []);
}

function handleServerMessage(msg: ServerMessage) {
  const store = useAppStore.getState();

  switch (msg.type) {
    case "session_list":
      store.setSessions(msg.sessions);
      break;

    case "session_created":
      store.setActiveSessionId(msg.sessionId);
      wsClient.send({ type: "list_sessions" });
      break;

    case "session_ended":
      if (store.activeSessionId === msg.sessionId) {
        store.setIsStreaming(false);
      }
      break;

    case "sdk_message": {
      const activeId = store.activeSessionId;
      if (activeId) {
        store.addMessage(activeId, msg.message);
      }
      break;
    }

    case "session_messages": {
      const activeId = store.activeSessionId;
      if (activeId) {
        store.setSessionMessages(activeId, msg.messages);
      }
      break;
    }

    case "transcript_interim":
      store.setInterimTranscript(msg.text);
      break;

    case "transcript_final":
      // Append final transcript text, clear interim
      store.appendFinalTranscript(msg.text);
      store.setInterimTranscript("");
      break;

    case "transcript_error":
      console.error("[Transcript Error]", msg.error);
      store.setRecording(false);
      break;

    case "error":
      console.error("[WS Error]", msg.error);
      // Add error as a system message to the active session so it's visible
      if (store.activeSessionId) {
        store.addMessage(store.activeSessionId, {
          type: "assistant",
          content: [{ type: "text", text: `⚠️ Error: ${msg.error}` }],
        });
      }
      break;
  }
}
