import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Unit tests for DeepgramRelay.
 * Mocks the 'ws' WebSocket to test connection lifecycle,
 * max duration enforcement, cleanup, and error handling.
 */

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static CONNECTING = 0;
  static CLOSING = 2;

  readyState = MockWebSocket.OPEN;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  url: string;
  options: unknown;
  sent: (string | Buffer)[] = [];
  closed = false;

  constructor(url: string, options?: unknown) {
    this.url = url;
    this.options = options;
    mockInstances.push(this);
  }

  send(data: string | Buffer) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateError() {
    this.onerror?.();
  }
}

let mockInstances: MockWebSocket[] = [];

vi.mock("ws", () => ({
  WebSocket: vi.fn().mockImplementation((url: string, options?: unknown) => {
    return new MockWebSocket(url, options);
  }),
}));

// Make the mock's static properties available
vi.mocked(await import("ws")).WebSocket.OPEN = 1 as never;
vi.mocked(await import("ws")).WebSocket.CLOSED = 3 as never;

describe("DeepgramRelay", () => {
  const originalEnv = process.env.DEEPGRAM_API_KEY;

  beforeEach(() => {
    mockInstances = [];
    process.env.DEEPGRAM_API_KEY = "test-api-key";
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.DEEPGRAM_API_KEY = originalEnv;
    } else {
      delete process.env.DEEPGRAM_API_KEY;
    }
  });

  // Fresh import each test to get clean instance
  async function createRelay() {
    const { DeepgramRelay } = await import("./deepgram-relay");
    return new DeepgramRelay();
  }

  function lastMock(): MockWebSocket {
    return mockInstances[mockInstances.length - 1];
  }

  it("calls error callback when DEEPGRAM_API_KEY is not set", async () => {
    delete process.env.DEEPGRAM_API_KEY;
    const relay = await createRelay();
    const callback = vi.fn();
    await relay.startTranscription("client-1", 16000, callback);

    expect(callback).toHaveBeenCalledWith(
      "error",
      "DEEPGRAM_API_KEY not configured",
    );
  });

  it("creates a WebSocket connection with correct params", async () => {
    const relay = await createRelay();
    const callback = vi.fn();
    await relay.startTranscription("client-1", 16000, callback);

    const ws = lastMock();
    expect(ws.url).toContain("wss://api.deepgram.com/v1/listen");
    expect(ws.url).toContain("model=nova-3");
    expect(ws.url).toContain("sample_rate=16000");
    expect(ws.url).toContain("encoding=linear16");
    expect(ws.url).toContain("interim_results=true");
  });

  it("forwards final transcript to callback", async () => {
    const relay = await createRelay();
    const callback = vi.fn();
    await relay.startTranscription("client-1", 16000, callback);

    lastMock().simulateMessage({
      channel: { alternatives: [{ transcript: "hello world" }] },
      is_final: true,
    });

    expect(callback).toHaveBeenCalledWith("final", "hello world");
  });

  it("forwards interim transcript to callback", async () => {
    const relay = await createRelay();
    const callback = vi.fn();
    await relay.startTranscription("client-1", 16000, callback);

    lastMock().simulateMessage({
      channel: { alternatives: [{ transcript: "hel" }] },
      is_final: false,
    });

    expect(callback).toHaveBeenCalledWith("interim", "hel");
  });

  it("ignores messages with empty transcript", async () => {
    const relay = await createRelay();
    const callback = vi.fn();
    await relay.startTranscription("client-1", 16000, callback);

    lastMock().simulateMessage({
      channel: { alternatives: [{ transcript: "" }] },
      is_final: true,
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("calls error callback on WebSocket error", async () => {
    const relay = await createRelay();
    const callback = vi.fn();
    await relay.startTranscription("client-1", 16000, callback);

    lastMock().simulateError();

    expect(callback).toHaveBeenCalledWith("error", "Deepgram connection error");
  });

  it("sends audio data to the WebSocket", async () => {
    const relay = await createRelay();
    const callback = vi.fn();
    await relay.startTranscription("client-1", 16000, callback);

    const audioData = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    relay.sendAudio("client-1", audioData);

    expect(lastMock().sent).toHaveLength(1);
    expect(lastMock().sent[0]).toBe(audioData);
  });

  it("does nothing when sending audio for unknown client", async () => {
    const relay = await createRelay();
    relay.sendAudio("nonexistent", Buffer.from([0x00, 0x01]));
  });

  it("does not send audio when WebSocket is not open", async () => {
    const relay = await createRelay();
    const callback = vi.fn();
    await relay.startTranscription("client-1", 16000, callback);

    lastMock().readyState = MockWebSocket.CLOSED;
    relay.sendAudio("client-1", Buffer.from([0x00]));

    expect(lastMock().sent).toHaveLength(0);
  });

  it("enforces max recording duration (5 minutes)", async () => {
    const relay = await createRelay();
    const callback = vi.fn();
    await relay.startTranscription("client-1", 16000, callback);
    const ws = lastMock();

    const conn = (
      relay as unknown as {
        connections: Map<string, { ws: MockWebSocket; startedAt: number }>;
      }
    ).connections.get("client-1")!;
    conn.startedAt = Date.now() - 6 * 60 * 1000;

    relay.sendAudio("client-1", Buffer.from([0x00]));

    expect(ws.closed).toBe(true);
    expect(ws.sent).toHaveLength(0);
  });

  it("stops transcription and cleans up", async () => {
    const relay = await createRelay();
    const callback = vi.fn();
    await relay.startTranscription("client-1", 16000, callback);
    const ws = lastMock();

    relay.stopTranscription("client-1");

    expect(ws.closed).toBe(true);
    relay.sendAudio("client-1", Buffer.from([0x00]));
    expect(ws.sent).toHaveLength(0);
  });

  it("cleanupClient delegates to stopTranscription", async () => {
    const relay = await createRelay();
    const callback = vi.fn();
    await relay.startTranscription("client-1", 16000, callback);
    const ws = lastMock();

    relay.cleanupClient("client-1");
    expect(ws.closed).toBe(true);
  });

  it("handles multiple concurrent clients", async () => {
    const relay = await createRelay();
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    await relay.startTranscription("client-1", 16000, cb1);
    const ws1 = lastMock();

    await relay.startTranscription("client-2", 44100, cb2);
    const ws2 = lastMock();

    relay.sendAudio("client-1", Buffer.from([0x01]));
    relay.sendAudio("client-2", Buffer.from([0x02]));

    expect(ws1.sent).toHaveLength(1);
    expect(ws2.sent).toHaveLength(1);

    relay.stopTranscription("client-1");
    expect(ws1.closed).toBe(true);
    expect(ws2.closed).toBe(false);

    relay.sendAudio("client-2", Buffer.from([0x03]));
    expect(ws2.sent).toHaveLength(2);

    relay.stopTranscription("client-2");
  });

  it("removes connection from map on WebSocket close", async () => {
    const relay = await createRelay();
    const callback = vi.fn();
    await relay.startTranscription("client-1", 16000, callback);
    const ws = lastMock();

    ws.onclose?.();

    relay.sendAudio("client-1", Buffer.from([0x00]));
    expect(ws.sent).toHaveLength(0);
  });
});
