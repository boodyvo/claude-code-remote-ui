import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import type { Server } from "node:http";
import type { Duplex } from "node:stream";
import { verifyWsToken } from "./auth";
import type { ClientMessage, ServerMessage } from "@/lib/types";
import { handleShellMessage, cleanupShell } from "./shell-handler";

interface ConnectedClient {
  ws: WebSocket;
  userId: number;
  lastPing: number;
}

// ── Per-connection rate limiting ──
const MSG_RATE_LIMIT = 30; // max messages per window
const MSG_RATE_WINDOW = 1000; // 1 second window
const rateLimitState = new Map<WebSocket, { count: number; resetAt: number }>();

function checkWsRateLimit(ws: WebSocket): boolean {
  const now = Date.now();
  const state = rateLimitState.get(ws);
  if (!state || now > state.resetAt) {
    rateLimitState.set(ws, { count: 1, resetAt: now + MSG_RATE_WINDOW });
    return true;
  }
  if (state.count >= MSG_RATE_LIMIT) return false;
  state.count++;
  return true;
}

const clients = new Map<WebSocket, ConnectedClient>();

let messageHandler: ((client: ConnectedClient, message: ClientMessage) => void) | null = null;

export function onMessage(handler: (client: ConnectedClient, message: ClientMessage) => void) {
  messageHandler = handler;
}

export function broadcast(message: ServerMessage) {
  const data = JSON.stringify(message);
  for (const [ws] of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

export function sendTo(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function handleConnection(ws: WebSocket, userId: number) {
  const client: ConnectedClient = { ws, userId, lastPing: Date.now() };
  clients.set(ws, client);

  ws.on("message", (raw, isBinary) => {
    if (!checkWsRateLimit(ws)) {
      sendTo(ws, { type: "error", error: "Rate limit exceeded" });
      return;
    }

    try {
      if (isBinary) {
        // Binary data = audio chunk
        const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
        messageHandler?.(client, { type: "audio_chunk", data: buffer } as unknown as ClientMessage);
        return;
      }

      const message = JSON.parse(raw.toString()) as ClientMessage;

      if (message.type === "ping") {
        client.lastPing = Date.now();
        sendTo(ws, { type: "pong" });
        return;
      }

      messageHandler?.(client, message);
    } catch {
      sendTo(ws, { type: "error", error: "Invalid message format" });
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    rateLimitState.delete(ws);
  });

  ws.on("error", () => {
    clients.delete(ws);
    rateLimitState.delete(ws);
  });
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 1024 * 1024, // 1MB max message size
  });

  const shellWss = new WebSocketServer({
    noServer: true,
    maxPayload: 64 * 1024,
  });

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (url.pathname !== "/ws" && url.pathname !== "/shell") {
      socket.destroy();
      return;
    }

    // Authenticate via token in query string
    const token = url.searchParams.get("token");
    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const payload = verifyWsToken(token);
    if (!payload) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    // Validate Origin header
    const origin = req.headers.origin;
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").filter(Boolean) || [];
    if (allowedOrigins.length > 0) {
      if (!origin || !allowedOrigins.includes(origin)) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
    }

    if (url.pathname === "/shell") {
      shellWss.handleUpgrade(req, socket, head, (ws) => {
        ws.on("message", (raw) => {
          if (!checkWsRateLimit(ws)) return;
          handleShellMessage(ws, raw.toString());
        });
        ws.on("close", () => { cleanupShell(ws); rateLimitState.delete(ws); });
        ws.on("error", () => { cleanupShell(ws); rateLimitState.delete(ws); });
      });
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      handleConnection(ws, payload.userId);
    });
  });

  // Heartbeat: close stale connections every 30s
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [ws, client] of clients) {
      if (now - client.lastPing > 60_000) {
        ws.terminate();
        clients.delete(ws);
        rateLimitState.delete(ws);
      }
    }
  }, 30_000);

  wss.on("close", () => clearInterval(interval));

  return wss;
}
