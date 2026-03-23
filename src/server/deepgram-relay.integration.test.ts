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

describe.skipIf(!hasApiKey)("DeepgramRelay integration (real API)", () => {
  const relays: DeepgramRelay[] = [];

  afterAll(() => {
    for (const r of relays) {
      r.cleanupClient("integration-test-1");
      r.cleanupClient("integration-test-2");
      r.cleanupClient("invalid-key-test");
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

    // Wait for the ws connection to open
    await new Promise((r) => setTimeout(r, 2000));

    // Send a short sine wave in chunks (like a real mic)
    const audio = generateSineWave(2000, 16000, 440);
    const chunkSize = 3200; // 100ms of 16kHz mono 16-bit
    for (let offset = 0; offset < audio.length; offset += chunkSize) {
      const chunk = audio.subarray(offset, offset + chunkSize);
      relay.sendAudio("integration-test-1", chunk);
      await new Promise((r) => setTimeout(r, 50));
    }

    // Wait for Deepgram to process
    await new Promise((r) => setTimeout(r, 3000));

    relay.stopTranscription("integration-test-1");

    // A 440Hz sine wave won't produce meaningful speech,
    // but the connection should succeed without errors
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

    // Wait for connection
    await new Promise((r) => setTimeout(r, 2000));

    // Send some audio then stop immediately
    const audio = generateSilence(500, 16000);
    relay.sendAudio("integration-test-2", audio);
    relay.stopTranscription("integration-test-2");

    // Give time for any async error callbacks
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

    // Wait for Deepgram to reject the connection
    await new Promise((r) => setTimeout(r, 3000));

    process.env.DEEPGRAM_API_KEY = original;

    const errors = messages.filter((m) => m.type === "error");
    expect(errors.length).toBeGreaterThanOrEqual(1);

    relay.cleanupClient("invalid-key-test");
  }, 10_000);
});
