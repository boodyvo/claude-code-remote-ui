# Ticket 003 — WebSocket Server + Client

**Phase:** 1 — Foundation
**Effort:** L
**Depends on:** Ticket 1

## Summary

Implement a WebSocket server integrated with Next.js standalone mode, and a client-side connection manager with JWT auth, reconnection logic, and typed message protocol.

## Acceptance Criteria

- [ ] WebSocket server running on the same port as Next.js (upgrade handler)
- [ ] JWT authentication at connection upgrade (token in query string)
- [ ] Origin header validation
- [ ] Typed message protocol matching product design §10 (all client→server and server→client message types)
- [ ] Client-side WebSocket manager (`src/lib/ws-client.ts`) with:
  - Auto-reconnection with exponential backoff (100ms initial, 30s max, jitter)
  - `lastMessageIndex` tracking per session for replay on reconnect
  - Heartbeat ping every 30s, 10s timeout
  - Connection state exposed to Zustand store
- [ ] "Reconnecting..." banner in UI during disconnects
- [ ] Message queuing: messages sent while disconnected are queued and sent on reconnect

## Implementation Notes

### Server (src/server/ws-server.ts)

```typescript
import { WebSocketServer } from "ws";
import { validateJWT } from "./auth";

export function setupWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url!, `https://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!validateJWT(token)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const origin = req.headers.origin;
    if (origin && !isAllowedOrigin(origin)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", handleConnection);
}
```

### Custom Server (server.ts)
Next.js standalone output produces `server.js`. We need a custom entry point that:
1. Creates an HTTP server
2. Attaches Next.js request handler
3. Attaches WebSocket upgrade handler
4. Listens on `PORT`

### Client→Server Message Types
```typescript
type ClientMessage =
  | { type: "send_message"; content: string; sessionId: string }
  | { type: "new_session"; cwd: string; name?: string }
  | { type: "resume_session"; sessionId: string }
  | { type: "fork_session"; sessionId: string }
  | { type: "cancel_session"; sessionId: string }
  | { type: "tool_response"; toolUseId: string; decision: "allow" | "deny"; updatedInput?: unknown }
  | { type: "interrupt" }
  | { type: "set_permission_mode"; mode: "default" | "acceptEdits" | "plan" | "bypassPermissions" }
  | { type: "audio_chunk"; data: ArrayBuffer }
  | { type: "audio_start"; sampleRate: number }
  | { type: "audio_stop" }
  | { type: "list_sessions"; dir?: string }
  | { type: "get_session_messages"; sessionId: string }
  | { type: "ping" }
```

### Server→Client Message Types
```typescript
type ServerMessage =
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
  | { type: "pong" }
```

### Client (src/lib/ws-client.ts)
```typescript
class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private messageQueue: ClientMessage[] = [];
  private lastMessageIndex: Record<string, number> = {};

  connect(token: string): void { /* ... */ }
  send(message: ClientMessage): void { /* queue if disconnected */ }
  private reconnect(): void { /* exponential backoff with jitter */ }
  private handleMessage(event: MessageEvent): void { /* parse, dispatch to store */ }
  disconnect(): void { /* clean close */ }
}
```

## Tests

- [ ] **Unit:** WebSocket client reconnection logic (mock WebSocket)
- [ ] **Unit:** Message serialization/deserialization for all types
- [ ] **Unit:** Exponential backoff timing calculation
- [ ] **Integration:** Server rejects connection without valid JWT
- [ ] **Integration:** Server rejects connection with invalid Origin
- [ ] **Integration:** Client→server ping/pong heartbeat
- [ ] **Integration:** Message round-trip (send → receive → respond)
- [ ] **Integration:** Client reconnects after server disconnect

## Files to Create

- `src/server/ws-server.ts`
- `src/lib/ws-client.ts`
- `src/lib/ws-types.ts` (shared message types)
- `server.ts` (custom entry point wrapping Next.js + WS)

## Dependencies to Add

- `ws` + `@types/ws`
