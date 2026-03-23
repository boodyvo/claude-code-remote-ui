import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import { WebSocket } from "ws";
import { setupWebSocket, onMessage } from "./ws-server";
import { handleClientMessage, initializeHandler } from "./ws-handler";
import { createSessionToken } from "./auth";
import type { ServerMessage } from "@/lib/types";

/**
 * Integration tests for the full WebSocket → SessionManager → Claude SDK pipeline.
 * These spin up a real HTTP + WS server and test actual message flows.
 *
 * Requires: claude CLI installed and authenticated.
 * Run with: pnpm test:integration
 */

let server: Server;
let port: number;

function connectClient(): Promise<WebSocket> {
  const token = createSessionToken(1);
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(token)}`,
    );
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function waitForMessage(
  ws: WebSocket,
  predicate: (msg: ServerMessage) => boolean,
  timeoutMs = 30_000,
): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out waiting for message")),
      timeoutMs,
    );

    const handler = (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as ServerMessage;
        if (predicate(msg)) {
          clearTimeout(timer);
          ws.off("message", handler);
          resolve(msg);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.on("message", handler);
  });
}

function collectMessages(
  ws: WebSocket,
  durationMs: number,
): Promise<ServerMessage[]> {
  return new Promise((resolve) => {
    const messages: ServerMessage[] = [];
    const handler = (data: Buffer) => {
      try {
        messages.push(JSON.parse(data.toString()) as ServerMessage);
      } catch {
        // ignore
      }
    };
    ws.on("message", handler);
    setTimeout(() => {
      ws.off("message", handler);
      resolve(messages);
    }, durationMs);
  });
}

beforeAll(() => {
  return new Promise<void>((resolve) => {
    server = createServer();
    setupWebSocket(server);
    onMessage(handleClientMessage);
    initializeHandler();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      port = typeof addr === "object" && addr ? addr.port : 0;
      resolve();
    });
  });
});

afterAll(() => {
  return new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

describe("WebSocket → Claude SDK full pipeline", () => {
  it(
    "creates a new session and receives session_created response",
    async () => {
      const ws = await connectClient();

      ws.send(
        JSON.stringify({
          type: "new_session",
          cwd: process.cwd(),
        }),
      );

      const response = await waitForMessage(
        ws,
        (m) => m.type === "session_created",
        15_000,
      );

      expect(response.type).toBe("session_created");
      expect(
        (response as { type: "session_created"; sessionId: string }).sessionId,
      ).toBeTruthy();

      ws.close();
    },
    { timeout: 20_000 },
  );

  it(
    "sends a message and receives SDK messages back",
    async () => {
      const ws = await connectClient();

      // Create session
      ws.send(JSON.stringify({ type: "new_session", cwd: process.cwd() }));

      const created = await waitForMessage(
        ws,
        (m) => m.type === "session_created",
        15_000,
      );

      const sessionId = (
        created as { type: "session_created"; sessionId: string }
      ).sessionId;

      // Send a message
      ws.send(
        JSON.stringify({
          type: "send_message",
          sessionId,
          content: "Reply with exactly: INTEGRATION_TEST_OK",
        }),
      );

      // Collect messages for up to 20s
      const messages = await collectMessages(ws, 20_000);

      // We should have received sdk_message events
      const sdkMessages = messages.filter((m) => m.type === "sdk_message");
      expect(sdkMessages.length).toBeGreaterThan(0);

      ws.close();
    },
    { timeout: 35_000 },
  );

  it(
    "lists sessions via WebSocket",
    async () => {
      const ws = await connectClient();

      ws.send(JSON.stringify({ type: "list_sessions" }));

      const response = await waitForMessage(
        ws,
        (m) => m.type === "session_list",
        10_000,
      );

      expect(response.type).toBe("session_list");
      const sessions = (response as { type: "session_list"; sessions: unknown[] })
        .sessions;
      expect(Array.isArray(sessions)).toBe(true);

      ws.close();
    },
    { timeout: 15_000 },
  );

  it("rejects messages to non-existent session", async () => {
    const ws = await connectClient();

    ws.send(
      JSON.stringify({
        type: "send_message",
        sessionId: "nonexistent-session-id",
        content: "hello",
      }),
    );

    const error = await waitForMessage(
      ws,
      (m) => m.type === "error",
      5_000,
    );

    expect(error.type).toBe("error");
    ws.close();
  });
});
