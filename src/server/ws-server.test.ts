import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { WebSocket } from "ws";
import { setupWebSocket } from "./ws-server";
import { createWsToken } from "./auth";

let server: Server;
let port: number;

function connectWs(token?: string): Promise<WebSocket> {
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws${qs}`);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function waitForMessage(ws: WebSocket): Promise<unknown> {
  return new Promise((resolve) => {
    ws.once("message", (data) => resolve(JSON.parse(data.toString())));
  });
}

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      server = createServer();
      setupWebSocket(server);
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        port = typeof addr === "object" && addr ? addr.port : 0;
        resolve();
      });
    }),
);

afterAll(
  () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    }),
);

describe("ws-server", () => {
  it("rejects connection without token", async () => {
    await expect(connectWs()).rejects.toThrow();
  });

  it("rejects connection with invalid token", async () => {
    await expect(connectWs("bad.token.here")).rejects.toThrow();
  });

  it("accepts connection with valid JWT", async () => {
    const token = createWsToken(1);
    const ws = await connectWs(token);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it("responds to ping with pong", async () => {
    const token = createWsToken(1);
    const ws = await connectWs(token);
    const msgPromise = waitForMessage(ws);
    ws.send(JSON.stringify({ type: "ping" }));
    const response = await msgPromise;
    expect(response).toEqual({ type: "pong" });
    ws.close();
  });

  it("returns error for invalid JSON", async () => {
    const token = createWsToken(1);
    const ws = await connectWs(token);
    const msgPromise = waitForMessage(ws);
    ws.send("not json");
    const response = await msgPromise;
    expect(response).toEqual({ type: "error", error: "Invalid message format" });
    ws.close();
  });

  it("rejects upgrade on non-/ws path", async () => {
    await expect(
      new Promise<WebSocket>((resolve, reject) => {
        const token = createWsToken(1);
        const ws = new WebSocket(`ws://127.0.0.1:${port}/other?token=${token}`);
        ws.on("open", () => resolve(ws));
        ws.on("error", reject);
      }),
    ).rejects.toThrow();
  });
});
