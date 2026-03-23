import type { ClientMessage, ServerMessage } from "./types";
import { useAppStore } from "./store";

const INITIAL_BACKOFF_MS = 100;
const MAX_BACKOFF_MS = 30_000;
const PING_INTERVAL_MS = 30_000;
const PONG_TIMEOUT_MS = 10_000;

type MessageHandler = (message: ServerMessage) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private messageQueue: ClientMessage[] = [];
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private token: string | null = null;
  private intentionalClose = false;
  private handlers = new Set<MessageHandler>();

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  connect(token?: string): void {
    if (token) this.token = token;
    this.intentionalClose = false;
    this.doConnect();
  }

  send(message: ClientMessage): void {
    if (this.connected) {
      this.ws!.send(JSON.stringify(message));
    } else {
      // Queue non-ephemeral messages for replay on reconnect
      if (message.type !== "ping" && message.type !== "audio_chunk") {
        this.messageQueue.push(message);
      }
    }
  }

  /** Send raw binary audio data (bypasses JSON serialization) */
  sendBinary(data: ArrayBuffer): void {
    if (this.connected) {
      this.ws!.send(data);
    }
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.cleanup();
    this.ws?.close(1000, "Client disconnect");
    this.ws = null;
    useAppStore.getState().setConnectionState("disconnected");
  }

  private async doConnect(): Promise<void> {
    this.cleanup();

    // Always fetch a fresh short-lived WS token before connecting
    try {
      const res = await fetch("/api/auth/ws-token");
      if (!res.ok) {
        // Session expired — redirect to login
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      this.token = data.token;
    } catch {
      // Network error — schedule retry
      this.scheduleReconnect();
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(this.token!)}`;

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      useAppStore.getState().setConnectionState("connected");
      this.startPing();
      this.flushQueue();
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as ServerMessage;

        if (message.type === "pong") {
          this.clearPongTimeout();
          return;
        }

        if (message.type === "auth_required") {
          this.intentionalClose = true;
          this.disconnect();
          window.location.href = "/login";
          return;
        }

        for (const handler of this.handlers) {
          handler(message);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      this.cleanup();
      if (!this.intentionalClose) {
        useAppStore.getState().setConnectionState("reconnecting");
        this.scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  private scheduleReconnect(): void {
    const backoff = Math.min(
      INITIAL_BACKOFF_MS * Math.pow(2, this.reconnectAttempts),
      MAX_BACKOFF_MS,
    );
    // Add jitter: ±25%
    const jitter = backoff * (0.75 + Math.random() * 0.5);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.doConnect();
    }, jitter);
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.connected) {
        this.ws!.send(JSON.stringify({ type: "ping" }));
        this.pongTimer = setTimeout(() => {
          // No pong received — force reconnect
          this.ws?.close(4000, "Pong timeout");
        }, PONG_TIMEOUT_MS);
      }
    }, PING_INTERVAL_MS);
  }

  private clearPongTimeout(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private flushQueue(): void {
    while (this.messageQueue.length > 0 && this.connected) {
      const msg = this.messageQueue.shift()!;
      this.ws!.send(JSON.stringify(msg));
    }
  }

  private cleanup(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.clearPongTimeout();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// Singleton instance
export const wsClient = new WebSocketClient();
