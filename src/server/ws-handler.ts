import { resolve, relative } from "node:path";
import type { WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "@/lib/types";
import { sessionManager } from "./session-manager";
import { sendTo } from "./ws-server";
import { deepgramRelay } from "./deepgram-relay";

interface ConnectedClient {
  ws: WebSocket;
  userId: number;
  lastPing: number;
}

// Default working directory for Claude sessions
const DEFAULT_CWD = process.env.CLAUDE_CWD || process.cwd();

export function handleClientMessage(
  client: ConnectedClient,
  message: ClientMessage,
): void {
  switch (message.type) {
    case "new_session":
      handleNewSession(client, message.cwd, message.name);
      break;

    case "send_message":
      handleSendMessage(client, message.sessionId, message.content);
      break;

    case "resume_session":
      handleResumeSession(client, message.sessionId);
      break;

    case "fork_session":
      handleForkSession(client, message.sessionId);
      break;

    case "cancel_session":
      sessionManager.cancelSession(message.sessionId);
      break;

    case "interrupt":
      handleInterrupt(client);
      break;

    case "tool_response":
      handleToolResponse(client, message.toolUseId, message.decision, message.updatedInput);
      break;

    case "set_permission_mode":
      handleSetPermissionMode(client, message.mode);
      break;

    case "list_sessions":
      handleListSessions(client, message.dir);
      break;

    case "get_session_messages":
      handleGetSessionMessages(client, message.sessionId);
      break;

    case "audio_start":
      handleAudioStart(client, message.sampleRate);
      break;

    case "audio_chunk":
      handleAudioChunk(client, message.data);
      break;

    case "audio_stop":
      handleAudioStop(client);
      break;

    case "ping":
      // Already handled by ws-server
      break;
  }
}

// Track which client is associated with which session
const clientSessionMap = new Map<WebSocket, string>();

async function handleNewSession(
  client: ConnectedClient,
  cwd: string,
  _name?: string,
): Promise<void> {
  try {
    // Validate cwd is within DEFAULT_CWD to prevent path traversal
    const safeCwd = cwd ? resolve(DEFAULT_CWD, cwd) : DEFAULT_CWD;
    const rel = relative(DEFAULT_CWD, safeCwd);
    if (rel.startsWith("..")) {
      sendTo(client.ws, {
        type: "error",
        error: "Working directory must be within the workspace",
      });
      return;
    }
    const sessionId = await sessionManager.startSession(safeCwd);
    clientSessionMap.set(client.ws, sessionId);
    sendTo(client.ws, { type: "session_created", sessionId });
  } catch (err) {
    sendTo(client.ws, {
      type: "error",
      error: err instanceof Error ? err.message : "Failed to create session",
    });
  }
}

async function handleSendMessage(
  client: ConnectedClient,
  sessionId: string,
  content: string,
): Promise<void> {
  try {
    // Auto-resume the session if it's not active yet
    if (!sessionManager.isActive(sessionId)) {
      await sessionManager.resumeSession(sessionId, DEFAULT_CWD);
      clientSessionMap.set(client.ws, sessionId);
    }
    sessionManager.sendMessage(sessionId, content);
    clientSessionMap.set(client.ws, sessionId);
  } catch (err) {
    sendTo(client.ws, {
      type: "error",
      error: err instanceof Error ? err.message : "Failed to send message",
    });
  }
}

async function handleResumeSession(
  client: ConnectedClient,
  sessionId: string,
): Promise<void> {
  try {
    await sessionManager.resumeSession(sessionId, DEFAULT_CWD);
    clientSessionMap.set(client.ws, sessionId);
    sendTo(client.ws, { type: "session_created", sessionId });
  } catch (err) {
    sendTo(client.ws, {
      type: "error",
      error: err instanceof Error ? err.message : "Failed to resume session",
    });
  }
}

async function handleForkSession(
  client: ConnectedClient,
  sessionId: string,
): Promise<void> {
  try {
    const newSessionId = await sessionManager.forkSession(sessionId, DEFAULT_CWD);
    clientSessionMap.set(client.ws, newSessionId);
    sendTo(client.ws, { type: "session_created", sessionId: newSessionId });
  } catch (err) {
    sendTo(client.ws, {
      type: "error",
      error: err instanceof Error ? err.message : "Failed to fork session",
    });
  }
}

function handleInterrupt(client: ConnectedClient): void {
  const sessionId = clientSessionMap.get(client.ws);
  if (sessionId) {
    sessionManager.interruptSession(sessionId);
  }
}

function handleToolResponse(
  client: ConnectedClient,
  toolUseId: string,
  decision: "allow" | "deny",
  updatedInput?: unknown,
): void {
  // SECURITY: Only resolve for the requesting client's own session
  const sessionId = clientSessionMap.get(client.ws);
  if (!sessionId || !sessionManager.isActive(sessionId)) return;

  const input = updatedInput as Record<string, unknown> | undefined;
  sessionManager.resolveToolApproval(sessionId, toolUseId, decision, input);
}

async function handleSetPermissionMode(
  client: ConnectedClient,
  mode: "default" | "acceptEdits" | "plan" | "bypassPermissions",
): Promise<void> {
  const sessionId = clientSessionMap.get(client.ws);
  if (sessionId) {
    await sessionManager.setPermissionMode(sessionId, mode);
  }
}

async function handleListSessions(
  client: ConnectedClient,
  dir?: string,
): Promise<void> {
  try {
    // When no dir specified, list all sessions across all projects
    const sessions = await sessionManager.listSessions(dir || undefined);
    const mapped = sessions.map((s) => ({
      sessionId: s.sessionId,
      name: s.customTitle || s.summary || s.firstPrompt || "Untitled",
      createdAt: new Date(s.createdAt || s.lastModified).toISOString(),
      lastActiveAt: new Date(s.lastModified).toISOString(),
      cwd: s.cwd || DEFAULT_CWD,
    }));
    sendTo(client.ws, { type: "session_list", sessions: mapped });
  } catch (err) {
    sendTo(client.ws, {
      type: "error",
      error: err instanceof Error ? err.message : "Failed to list sessions",
    });
  }
}

async function handleGetSessionMessages(
  client: ConnectedClient,
  sessionId: string,
): Promise<void> {
  try {
    const messages = await sessionManager.getSessionMessages(sessionId);
    sendTo(client.ws, {
      type: "session_messages",
      messages: messages as never, // SessionMessage[] → SDKMessage[]
    });
  } catch (err) {
    sendTo(client.ws, {
      type: "error",
      error: err instanceof Error ? err.message : "Failed to get session messages",
    });
  }
}

// ── Audio / Voice handlers ──

function getClientId(client: ConnectedClient): string {
  // Use a stable identifier per WebSocket connection
  return `ws-${client.userId}-${(client as unknown as { _voiceId?: string })._voiceId ?? ((client as unknown as { _voiceId: string })._voiceId = Math.random().toString(36).slice(2))}`;
}

function handleAudioStart(client: ConnectedClient, sampleRate: number): void {
  const clientId = getClientId(client);

  deepgramRelay.startTranscription(clientId, sampleRate || 16000, (type, text) => {
    switch (type) {
      case "interim":
        sendTo(client.ws, { type: "transcript_interim", text });
        break;
      case "final":
        sendTo(client.ws, { type: "transcript_final", text });
        break;
      case "error":
        sendTo(client.ws, { type: "transcript_error", error: text });
        break;
    }
  });
}

function handleAudioChunk(client: ConnectedClient, data: ArrayBuffer): void {
  const clientId = getClientId(client);
  deepgramRelay.sendAudio(clientId, Buffer.from(data));
}

function handleAudioStop(client: ConnectedClient): void {
  const clientId = getClientId(client);
  deepgramRelay.stopTranscription(clientId);
}

// Initialize: Wire session manager events to WebSocket broadcast
export function initializeHandler(): void {
  sessionManager.onMessage((sessionId, message) => {
    // Send to all clients watching this session
    for (const [ws, sid] of clientSessionMap) {
      if (sid === sessionId) {
        const serverMsg: ServerMessage = {
          type: "sdk_message",
          message: message as never, // SDK message → our SDKMessage type
        };
        sendTo(ws, serverMsg);
      }
    }
  });

  sessionManager.onSessionEnd((sessionId, reason) => {
    for (const [ws, sid] of clientSessionMap) {
      if (sid === sessionId) {
        sendTo(ws, { type: "session_ended", sessionId, reason });
      }
    }
  });
}
