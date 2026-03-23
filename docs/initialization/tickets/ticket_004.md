# Ticket 004 — Claude Agent SDK Integration

**Phase:** 1 — Foundation
**Effort:** L
**Depends on:** Tickets 1, 3

## Summary

Integrate `@anthropic-ai/claude-agent-sdk` to manage Claude Code sessions. Handle starting, resuming, forking, listing, and cancelling sessions. Stream SDK messages to browser via WebSocket. Implement tool approval delegation to the UI.

## Acceptance Criteria

- [ ] Session Manager (`src/server/session-manager.ts`) wrapping the SDK
- [ ] Start new session with `query()` using async generator for streaming input
- [ ] Resume session by ID (`options.resume`)
- [ ] Fork session (`options.forkSession`)
- [ ] List sessions via `listSessions()`
- [ ] Get session message history via `getSessionMessages()`
- [ ] Cancel/interrupt running session via `query.interrupt()`
- [ ] Tool approval flow: `canUseTool` callback → WebSocket → browser → user decision → callback resolves
- [ ] All SDK messages (`SDKMessage`) forwarded to connected WebSocket clients
- [ ] Token-by-token streaming with `includePartialMessages: true`
- [ ] Session state tracked in memory (active sessions map)
- [ ] Graceful handling of Claude auth token from `~/.claude/`

## Implementation Notes

### Session Manager (src/server/session-manager.ts)

```typescript
import { query, listSessions, getSessionMessages } from "@anthropic-ai/claude-agent-sdk";

class SessionManager {
  private activeSessions = new Map<string, ActiveSession>();

  async startSession(cwd: string, name?: string): Promise<string> {
    const messageGenerator = this.createMessageGenerator(sessionId);

    const q = query({
      prompt: messageGenerator,
      options: {
        cwd,
        includePartialMessages: true,
        canUseTool: (toolName, input) => this.handleToolApproval(sessionId, toolName, input),
      },
    });

    // Consume stream in background, forward to WebSocket
    this.consumeStream(sessionId, q);
    return sessionId;
  }

  async sendMessage(sessionId: string, content: string): void {
    // Yield message into the async generator for the active session
  }

  async resumeSession(sessionId: string): Promise<void> {
    // query() with options.resume
  }

  async interruptSession(sessionId: string): Promise<void> {
    // query.interrupt()
  }

  private async handleToolApproval(sessionId: string, toolName: string, input: unknown): Promise<ToolApprovalResult> {
    // 1. Send tool_approval_request to WebSocket client
    // 2. Wait for tool_response message from client (with timeout)
    // 3. Return { behavior: "allow" } or { behavior: "deny", message: "User rejected" }
  }
}
```

### Tool Approval Flow

```
Claude wants to use Edit tool
  → SDK calls canUseTool("Edit", { filePath, oldString, newString })
  → SessionManager sends WS message: { type: "sdk_message", message: { type: "assistant", ... tool_use block } }
  → Browser renders ToolApprovalCard with Accept/Reject buttons
  → User clicks Accept
  → Browser sends WS: { type: "tool_response", toolUseId: "...", decision: "allow" }
  → SessionManager resolves the canUseTool promise
  → SDK proceeds with tool execution
```

### Message Generator Pattern

Each session has an async generator that yields user messages. When `sendMessage()` is called, the message is pushed into a queue that the generator consumes:

```typescript
private createMessageGenerator(sessionId: string) {
  const session = this.activeSessions.get(sessionId)!;
  return async function* () {
    while (true) {
      const message = await session.messageQueue.dequeue(); // blocks until message available
      if (message === null) return; // session ended
      yield { type: "user" as const, message: { role: "user" as const, content: message } };
    }
  }();
}
```

### Init Message Handling

The `system/init` message contains model, tools, MCP servers, version, permission mode. Store this in session state and forward to client for `SessionHeader` rendering.

## Tests

- [ ] **Unit:** Session Manager creates session and returns ID
- [ ] **Unit:** Message generator yields messages in order
- [ ] **Unit:** Tool approval timeout returns deny after 5 minutes
- [ ] **Integration:** Start session → send message → receive streaming response
- [ ] **Integration:** Resume session by ID loads history
- [ ] **Integration:** List sessions returns correct entries
- [ ] **Integration:** Interrupt session stops generation
- [ ] **Integration:** Fork session creates new session with parent history
- [ ] **E2E:** Full flow: start session → send message → approve tool → see result

## Files to Create

- `src/server/session-manager.ts`
- `src/lib/message-queue.ts` (async queue for message generator)

## Dependencies to Add

- `@anthropic-ai/claude-agent-sdk`

## Notes

- The SDK spawns `claude` CLI as a subprocess — it must be installed in the Docker image
- Auth token from `~/.claude/` is read automatically by the SDK
- Multiple simultaneous sessions are supported but consume Max subscription rate limits
