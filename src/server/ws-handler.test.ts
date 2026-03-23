import { describe, it, expect, vi, beforeEach } from "vitest";
import { createServer, type Server } from "node:http";
import { WebSocket } from "ws";
import { setupWebSocket, onMessage } from "./ws-server";
import { createSessionToken } from "./auth";
import type { ServerMessage } from "@/lib/types";

/**
 * Tests for the WebSocket handler with real WS connections but no Claude SDK.
 * Tests message routing, error handling, and protocol correctness.
 */

let server: Server;
let port: number;

function connectWs(): Promise<WebSocket> {
  const token = createSessionToken(1);
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(token)}`,
    );
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function waitForMsg(
  ws: WebSocket,
  predicate: (msg: ServerMessage) => boolean,
  timeoutMs = 5000,
): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timeout waiting for message")),
      timeoutMs,
    );
    const handler = (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as ServerMessage;
      if (predicate(msg)) {
        clearTimeout(timer);
        ws.off("message", handler);
        resolve(msg);
      }
    };
    ws.on("message", handler);
  });
}

beforeEach(() => {
  return new Promise<void>((resolve) => {
    server = createServer();
    setupWebSocket(server);

    // Use a simple handler that echoes errors for invalid operations
    onMessage((client, message) => {
      // We import handleClientMessage dynamically to test it
      // But for basic protocol tests, we use the ws-server directly
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      port = typeof addr === "object" && addr ? addr.port : 0;
      resolve();
    });
  });
});

describe("WebSocket protocol tests", () => {
  it("handles rapid ping/pong", async () => {
    const ws = await connectWs();

    // Send 10 pings rapidly
    for (let i = 0; i < 10; i++) {
      ws.send(JSON.stringify({ type: "ping" }));
    }

    // Collect pongs
    const pongs: ServerMessage[] = [];
    await new Promise<void>((resolve) => {
      const handler = (data: Buffer) => {
        const msg = JSON.parse(data.toString()) as ServerMessage;
        if (msg.type === "pong") pongs.push(msg);
        if (pongs.length >= 10) {
          ws.off("message", handler);
          resolve();
        }
      };
      ws.on("message", handler);
      setTimeout(resolve, 2000); // timeout fallback
    });

    expect(pongs.length).toBe(10);
    ws.close();
    server.close();
  });

  it("handles concurrent connections", async () => {
    const clients = await Promise.all([
      connectWs(),
      connectWs(),
      connectWs(),
    ]);

    // Each client can ping independently
    for (const ws of clients) {
      ws.send(JSON.stringify({ type: "ping" }));
    }

    const results = await Promise.all(
      clients.map(
        (ws) =>
          new Promise<ServerMessage>((resolve) => {
            ws.once("message", (data) => {
              resolve(JSON.parse(data.toString()) as ServerMessage);
            });
          }),
      ),
    );

    for (const msg of results) {
      expect(msg.type).toBe("pong");
    }

    for (const ws of clients) ws.close();
    server.close();
  });

  it("handles malformed JSON gracefully", async () => {
    const ws = await connectWs();

    ws.send("not json at all");

    const error = await waitForMsg(ws, (m) => m.type === "error");
    expect(error.type).toBe("error");
    expect(
      (error as { type: "error"; error: string }).error,
    ).toContain("Invalid message format");

    ws.close();
    server.close();
  });

  it("handles binary data without crashing", async () => {
    const ws = await connectWs();

    // Send binary data
    ws.send(Buffer.from([0x00, 0x01, 0x02, 0x03]));

    // Should get an error back (invalid JSON)
    const error = await waitForMsg(ws, (m) => m.type === "error");
    expect(error.type).toBe("error");

    ws.close();
    server.close();
  });

  it("cleans up on client disconnect", async () => {
    const ws = await connectWs();

    // Verify connection works
    ws.send(JSON.stringify({ type: "ping" }));
    const pong = await waitForMsg(ws, (m) => m.type === "pong");
    expect(pong.type).toBe("pong");

    // Close client
    ws.close();

    // Wait a bit for cleanup
    await new Promise((r) => setTimeout(r, 100));

    // Server should still be running (no crash)
    expect(server.listening).toBe(true);
    server.close();
  });
});
