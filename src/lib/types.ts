// ── Session Types ──

export interface SessionInfo {
  sessionId: string;
  name?: string;
  createdAt: string;
  lastActiveAt: string;
  cwd: string;
  model?: string;
  messageCount?: number;
}

// ── SDK Message Types ──

export interface SDKMessage {
  type: string;
  subtype?: string;
  session_id?: string;
  content?: ContentBlock[];
  [key: string]: unknown;
}

export type ContentBlock =
  | TextBlock
  | ThinkingBlock
  | RedactedThinkingBlock
  | ToolUseBlock
  | ToolResultBlock
  | ServerToolUseBlock;

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ThinkingBlock {
  type: "thinking";
  thinking: string;
}

export interface RedactedThinkingBlock {
  type: "redacted_thinking";
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string | unknown;
  is_error?: boolean;
}

export interface ServerToolUseBlock {
  type: "server_tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// ── Tool Approval ──

export interface ToolApproval {
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  timestamp: number;
}

// ── WebSocket Protocol ──

export type ClientMessage =
  | { type: "send_message"; content: string; sessionId: string }
  | { type: "new_session"; cwd: string; name?: string }
  | { type: "resume_session"; sessionId: string }
  | { type: "fork_session"; sessionId: string }
  | { type: "cancel_session"; sessionId: string }
  | { type: "tool_response"; toolUseId: string; decision: "allow" | "deny"; updatedInput?: unknown }
  | { type: "interrupt" }
  | { type: "set_permission_mode"; mode: PermissionMode }
  | { type: "audio_chunk"; data: ArrayBuffer }
  | { type: "audio_start"; sampleRate: number }
  | { type: "audio_stop" }
  | { type: "list_sessions"; dir?: string }
  | { type: "get_session_messages"; sessionId: string }
  | { type: "ping" };

export type ServerMessage =
  | { type: "sdk_message"; message: SDKMessage }
  | { type: "session_list"; sessions: SessionInfo[] }
  | { type: "session_messages"; messages: SDKMessage[] }
  | { type: "session_created"; sessionId: string }
  | { type: "session_ended"; sessionId: string; reason: string }
  | { type: "transcript_interim"; text: string }
  | { type: "transcript_final"; text: string }
  | { type: "transcript_error"; error: string }
  | { type: "auth_required" }
  | { type: "error"; error: string; code?: string }
  | { type: "connection_state"; state: "connected" | "reconnecting" | "disconnected" }
  | { type: "pong" };

// ── UI State ──

export type ActiveTab = "chat" | "files" | "terminal";
export type Theme = "light" | "dark" | "system";
export type PermissionMode = "default" | "acceptEdits" | "plan" | "bypassPermissions";
