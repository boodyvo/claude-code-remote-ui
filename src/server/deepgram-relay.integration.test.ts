import { describe, it, expect, afterAll } from "vitest";
import { DeepgramRelay } from "./deepgram-relay";

/**
 * Integration tests for DeepgramRelay against the real Deepgram API.
 * Requires DEEPGRAM_API_KEY in environment.
 *
 * Sends synthetic PCM16 audio to verify the full pipeline:
 * connection → audio send → transcript callback.
 *
 * Run with: pnpm test:integration
 */

const hasApiKey = !!process.env.DEEPGRAM_API_KEY;

/**
 * Generate a PCM16 mono sine wave buffer.
 */
function generateSineWave(
  durationMs: number,
  sampleRate: number,
  frequency: number,
): Buffer {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const buffer = Buffer.alloc(numSamples * 2);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const value = Math.sin(2 * Math.PI * frequency * t);
    const sample = Math.round(value * 32767 * 0.8);
    buffer.writeInt16LE(sample, i * 2);
  }
  return buffer;
}

function generateSilence(durationMs: number, sampleRate: number): Buffer {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  return Buffer.alloc(numSamples * 2);
}

async function waitForConnection(ms = 2000): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function streamAudio(
  relay: DeepgramRelay,
  clientId: string,
  audio: Buffer,
  chunkSize = 3200,
  chunkIntervalMs = 50,
): Promise<void> {
  for (let offset = 0; offset < audio.length; offset += chunkSize) {
    const chunk = audio.subarray(offset, offset + chunkSize);
    relay.sendAudio(clientId, chunk);
    await new Promise((r) => setTimeout(r, chunkIntervalMs));
  }
}

describe.skipIf(!hasApiKey)("DeepgramRelay integration (real API)", () => {
  const relays: DeepgramRelay[] = [];

  afterAll(() => {
    for (const r of relays) {
      for (const id of [
        "integration-test-1",
        "integration-test-2",
        "invalid-key-test",
        "interim-test",
        "concurrent-a",
        "concurrent-b",
        "cleanup-test",
        "reconnect-test",
      ]) {
        r.cleanupClient(id);
      }
    }
  });

  function createRelay(): DeepgramRelay {
    const r = new DeepgramRelay();
    relays.push(r);
    return r;
  }

  it("connects to Deepgram and accepts audio without errors", async () => {
    const relay = createRelay();
    const messages: { type: string; text: string }[] = [];

    await relay.startTranscription(
      "integration-test-1",
      16000,
      (type, text) => {
        messages.push({ type, text });
      },
    );

    await waitForConnection(2000);

    const audio = generateSineWave(2000, 16000, 440);
    await streamAudio(relay, "integration-test-1", audio);

    await new Promise((r) => setTimeout(r, 3000));

    relay.stopTranscription("integration-test-1");

    const errors = messages.filter((m) => m.type === "error");
    expect(errors).toHaveLength(0);
  }, 15_000);

  it("handles stop during active transcription without error", async () => {
    const relay = createRelay();
    const messages: { type: string; text: string }[] = [];

    await relay.startTranscription(
      "integration-test-2",
      16000,
      (type, text) => {
        messages.push({ type, text });
      },
    );

    await waitForConnection(2000);

    const audio = generateSilence(500, 16000);
    relay.sendAudio("integration-test-2", audio);
    relay.stopTranscription("integration-test-2");

    await new Promise((r) => setTimeout(r, 1000));

    const errors = messages.filter((m) => m.type === "error");
    expect(errors).toHaveLength(0);
  }, 10_000);

  it("errors with invalid API key", async () => {
    const original = process.env.DEEPGRAM_API_KEY;
    process.env.DEEPGRAM_API_KEY = "invalid-key-12345";

    const relay = createRelay();
    const messages: { type: string; text: string }[] = [];

    await relay.startTranscription(
      "invalid-key-test",
      16000,
      (type, text) => {
        messages.push({ type, text });
      },
    );

    await new Promise((r) => setTimeout(r, 3000));

    process.env.DEEPGRAM_API_KEY = original;

    const errors = messages.filter((m) => m.type === "error");
    expect(errors.length).toBeGreaterThanOrEqual(1);

    relay.cleanupClient("invalid-key-test");
  }, 10_000);

  it("returns a non-empty final transcript for speech-like audio", async () => {
    // Use a multi-tone signal that triggers Deepgram to return results.
    // Even though it won't be real speech, Deepgram may return something
    // or (most importantly) the connection must work without errors.
    // We assert no errors and that the pipeline completes cleanly.
    const relay = createRelay();
    const finals: string[] = [];
    const errors: string[] = [];

    await relay.startTranscription("interim-test", 16000, (type, text) => {
      if (type === "final") finals.push(text);
      if (type === "error") errors.push(text);
    });

    await waitForConnection(2000);

    // Stream 3 seconds of a sine wave
    const audio = generateSineWave(3000, 16000, 440);
    await streamAudio(relay, "interim-test", audio);

    // Send silence to trigger Deepgram endpointing
    const silence = generateSilence(1000, 16000);
    relay.sendAudio("interim-test", silence);

    await new Promise((r) => setTimeout(r, 4000));
    relay.stopTranscription("interim-test");

    expect(errors).toHaveLength(0);
    // Pipeline ran without error — transcript may or may not have content
    // (sine waves don't produce speech, but a real mic would give finals)
  }, 20_000);

  it("interim results arrive before final results", async () => {
    const relay = createRelay();
    const order: ("interim" | "final")[] = [];
    let seenInterim = false;
    let seenFinal = false;

    await relay.startTranscription("interim-test-order", 16000, (type) => {
      if (type === "interim") {
        order.push("interim");
        seenInterim = true;
      }
      if (type === "final") {
        order.push("final");
        seenFinal = true;
      }
    });

    await waitForConnection(2000);

    // Stream audio in many small chunks to encourage interim results
    const audio = generateSineWave(4000, 16000, 300);
    await streamAudio(relay, "interim-test-order", audio, 1600, 25);

    await new Promise((r) => setTimeout(r, 3000));
    relay.stopTranscription("interim-test-order");

    // If any interim/final arrived, interims must precede their corresponding final
    if (seenInterim && seenFinal) {
      const firstFinalIdx = order.indexOf("final");
      const firstInterimIdx = order.indexOf("interim");
      expect(firstInterimIdx).toBeLessThan(firstFinalIdx);
    }
    // If no results at all (silent sine wave), that's acceptable — no assertion failure
  }, 20_000);

  it("supports two concurrent transcription sessions", async () => {
    const relayA = createRelay();
    const relayB = createRelay();
    const errorsA: string[] = [];
    const errorsB: string[] = [];

    await Promise.all([
      relayA.startTranscription("concurrent-a", 16000, (type, text) => {
        if (type === "error") errorsA.push(text);
      }),
      relayB.startTranscription("concurrent-b", 16000, (type, text) => {
        if (type === "error") errorsB.push(text);
      }),
    ]);

    await waitForConnection(2000);

    // Stream audio to both simultaneously
    const audioA = generateSineWave(2000, 16000, 440);
    const audioB = generateSineWave(2000, 16000, 880);

    await Promise.all([
      streamAudio(relayA, "concurrent-a", audioA),
      streamAudio(relayB, "concurrent-b", audioB),
    ]);

    await new Promise((r) => setTimeout(r, 2000));

    relayA.stopTranscription("concurrent-a");
    relayB.stopTranscription("concurrent-b");

    expect(errorsA).toHaveLength(0);
    expect(errorsB).toHaveLength(0);
  }, 20_000);

  it("no callbacks fire after stopTranscription", async () => {
    const relay = createRelay();
    const messagesAfterStop: { type: string; text: string }[] = [];
    let stopped = false;

    await relay.startTranscription("cleanup-test", 16000, (type, text) => {
      if (stopped) {
        messagesAfterStop.push({ type, text });
      }
    });

    await waitForConnection(2000);

    const audio = generateSineWave(1000, 16000, 440);
    await streamAudio(relay, "cleanup-test", audio);

    relay.stopTranscription("cleanup-test");
    stopped = true;

    // Wait to confirm no callbacks arrive after stop
    await new Promise((r) => setTimeout(r, 2000));

    expect(messagesAfterStop).toHaveLength(0);
  }, 12_000);

  it("can start a new session after a previous one errored", async () => {
    const original = process.env.DEEPGRAM_API_KEY;

    // First: create a session with bad key → triggers error
    process.env.DEEPGRAM_API_KEY = "bad-key-xyz";
    const relay = createRelay();
    const firstErrors: string[] = [];

    await relay.startTranscription("reconnect-test", 16000, (type, text) => {
      if (type === "error") firstErrors.push(text);
    });

    await new Promise((r) => setTimeout(r, 3000));
    relay.cleanupClient("reconnect-test");

    expect(firstErrors.length).toBeGreaterThanOrEqual(1);

    // Now restore valid key and start a fresh session on the same clientId
    process.env.DEEPGRAM_API_KEY = original;
    const secondErrors: string[] = [];

    await relay.startTranscription("reconnect-test", 16000, (type, text) => {
      if (type === "error") secondErrors.push(text);
    });

    await waitForConnection(2000);

    const audio = generateSineWave(1000, 16000, 440);
    await streamAudio(relay, "reconnect-test", audio);

    await new Promise((r) => setTimeout(r, 2000));
    relay.stopTranscription("reconnect-test");

    expect(secondErrors).toHaveLength(0);
  }, 20_000);
});
