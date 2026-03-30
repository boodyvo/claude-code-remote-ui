import {
  query as sdkQuery,
  listSessions as sdkListSessions,
  getSessionMessages as sdkGetSessionMessages,
} from "@anthropic-ai/claude-agent-sdk";
import type {
  Query,
  SDKMessage,
  SDKUserMessage,
  PermissionResult,
} from "@anthropic-ai/claude-agent-sdk";
import { AsyncQueue } from "@/lib/message-queue";

const TOOL_APPROVAL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface ActiveSession {
  sessionId: string;
  query: Query;
  messageQueue: AsyncQueue<string>;
  abortController: AbortController;
  pendingToolApprovals: Map<
    string,
    {
      resolve: (result: PermissionResult) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >;
}

type MessageCallback = (sessionId: string, message: SDKMessage) => void;
type SessionEndCallback = (sessionId: string, reason: string) => void;

export class SessionManager {
  private activeSessions = new Map<string, ActiveSession>();
  private onMessageCallback: MessageCallback | null = null;
  private onSessionEndCallback: SessionEndCallback | null = null;

  onMessage(callback: MessageCallback): void {
    this.onMessageCallback = callback;
  }

  onSessionEnd(callback: SessionEndCallback): void {
    this.onSessionEndCallback = callback;
  }

  async startSession(cwd: string): Promise<string> {
    const messageQueue = new AsyncQueue<string>();
    const abortController = new AbortController();

    const messageGenerator = this.createMessageGenerator(messageQueue);

    // Generate session ID before creating query so canUseTool closure captures it
    const sessionId = crypto.randomUUID();

    const q = sdkQuery({
      prompt: messageGenerator,
      options: {
        cwd,
        tools: { type: "preset", preset: "claude_code" },
        systemPrompt: { type: "preset", preset: "claude_code" },
        settingSources: ["project", "user", "local"],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        persistSession: true,
        includePartialMessages: true,
        abortController,
        canUseTool: (_toolName: string, input: Record<string, unknown>) =>
          Promise.resolve({ behavior: "allow" as const, updatedInput: input }),
        stderr: (data: string) => console.error(`[Session ${sessionId}] stderr:`, data),
      },
    });

    const session: ActiveSession = {
      sessionId,
      query: q,
      messageQueue,
      abortController,
      pendingToolApprovals: new Map(),
    };

    this.activeSessions.set(sessionId, session);
    console.log(`[Session ${sessionId}] Started in ${cwd}`);
    this.consumeStream(sessionId, q);

    return sessionId;
  }

  async resumeSession(sessionId: string, cwd: string): Promise<void> {
    const abortController = new AbortController();
    const messageQueue = new AsyncQueue<string>();
    const messageGenerator = this.createMessageGenerator(messageQueue);

    const q = sdkQuery({
      prompt: messageGenerator,
      options: {
        cwd,
        resume: sessionId,
        tools: { type: "preset", preset: "claude_code" },
        systemPrompt: { type: "preset", preset: "claude_code" },
        settingSources: ["project", "user", "local"],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        persistSession: true,
        includePartialMessages: true,
        abortController,
        canUseTool: (_toolName: string, input: Record<string, unknown>) =>
          Promise.resolve({ behavior: "allow" as const, updatedInput: input }),
      },
    });

    const session: ActiveSession = {
      sessionId,
      query: q,
      messageQueue,
      abortController,
      pendingToolApprovals: new Map(),
    };

    this.activeSessions.set(sessionId, session);
    this.consumeStream(sessionId, q);
  }

  async forkSession(
    parentSessionId: string,
    cwd: string,
  ): Promise<string> {
    const abortController = new AbortController();
    const messageQueue = new AsyncQueue<string>();
    const messageGenerator = this.createMessageGenerator(messageQueue);
    const newSessionId = crypto.randomUUID();

    const q = sdkQuery({
      prompt: messageGenerator,
      options: {
        cwd,
        resume: parentSessionId,
        forkSession: true,
        sessionId: newSessionId,
        tools: { type: "preset", preset: "claude_code" },
        systemPrompt: { type: "preset", preset: "claude_code" },
        settingSources: ["project", "user", "local"],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        persistSession: true,
        includePartialMessages: true,
        abortController,
        canUseTool: (_toolName: string, input: Record<string, unknown>) =>
          Promise.resolve({ behavior: "allow" as const, updatedInput: input }),
      },
    });

    const session: ActiveSession = {
      sessionId: newSessionId,
      query: q,
      messageQueue,
      abortController,
      pendingToolApprovals: new Map(),
    };

    this.activeSessions.set(newSessionId, session);
    this.consumeStream(newSessionId, q);

    return newSessionId;
  }

  sendMessage(sessionId: string, content: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`No active session: ${sessionId}`);
    }
    session.messageQueue.enqueue(content);
  }

  async interruptSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    await session.query.interrupt();
  }

  cancelSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    session.abortController.abort();
    session.messageQueue.close();
    this.cleanupSession(sessionId);
  }

  resolveToolApproval(
    sessionId: string,
    toolUseId: string,
    decision: "allow" | "deny",
    updatedInput?: Record<string, unknown>,
  ): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const pending = session.pendingToolApprovals.get(toolUseId);
    if (!pending) return;

    clearTimeout(pending.timer);
    session.pendingToolApprovals.delete(toolUseId);

    if (decision === "allow") {
      pending.resolve({
        behavior: "allow",
        ...(updatedInput ? { updatedInput } : {}),
        toolUseID: toolUseId,
      });
    } else {
      pending.resolve({
        behavior: "deny",
        message: "User rejected tool use",
        toolUseID: toolUseId,
      });
    }
  }

  async setPermissionMode(
    sessionId: string,
    mode: "default" | "acceptEdits" | "plan" | "bypassPermissions",
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    await session.query.setPermissionMode(mode);
  }

  async listSessions(dir?: string) {
    return sdkListSessions({ dir, limit: 50 });
  }

  async getSessionMessages(sessionId: string, dir?: string) {
    return sdkGetSessionMessages(sessionId, { dir });
  }

  isActive(sessionId: string): boolean {
    return this.activeSessions.has(sessionId);
  }

  private async *createMessageGenerator(
    queue: AsyncQueue<string>,
  ): AsyncGenerator<SDKUserMessage, void> {
    while (true) {
      const content = await queue.dequeue();
      if (content === null) return; // session closed

      yield {
        type: "user",
        message: { role: "user", content },
        parent_tool_use_id: null,
        session_id: "",
      } satisfies SDKUserMessage;
    }
  }

  private async consumeStream(
    sessionId: string,
    q: Query,
  ): Promise<void> {
    try {
      for await (const message of q) {
        this.onMessageCallback?.(sessionId, message);
      }
      this.onSessionEndCallback?.(sessionId, "completed");
    } catch (err) {
      const reason =
        err instanceof Error ? err.message : "Unknown error";
      console.error(`[Session ${sessionId}] Error:`, err);
      this.onSessionEndCallback?.(sessionId, reason);
    } finally {
      this.cleanupSession(sessionId);
    }
  }

  private handleToolApproval(
    sessionId: string,
    toolName: string,
    _input: Record<string, unknown>,
    toolUseId: string,
  ): Promise<PermissionResult> {
    // Auto-approve all tools — this connector runs in a sandboxed container
    // with --dangerously-skip-permissions equivalent behavior
    return Promise.resolve({
      behavior: "allow" as const,
      toolUseID: toolUseId,
    });
  }

  private cleanupSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Clear pending tool approvals
    for (const [, pending] of session.pendingToolApprovals) {
      clearTimeout(pending.timer);
    }
    session.pendingToolApprovals.clear();
    session.messageQueue.close();
    this.activeSessions.delete(sessionId);
  }
}

// Singleton
export const sessionManager = new SessionManager();
