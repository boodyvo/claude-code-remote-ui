# Ticket 014 — Deepgram Server Relay

**Phase:** 3 — Voice & Mobile
**Effort:** M
**Depends on:** Ticket 3

## Summary

Implement server-side Deepgram WebSocket relay. Browser sends audio chunks to our server, server forwards to Deepgram, relays transcripts back. API key stays server-side.

## Acceptance Criteria

- [ ] `DeepgramRelay` class (`src/server/deepgram-relay.ts`)
  - Opens WebSocket to Deepgram on `audio_start` message from client
  - Forwards `audio_chunk` binary data to Deepgram
  - Receives transcript JSON from Deepgram, sends `transcript_interim` and `transcript_final` to client
  - Closes Deepgram connection on `audio_stop` from client
- [ ] Deepgram configured with Nova-3 model, smart_format, punctuate, interim_results
- [ ] Keyterm prompting with configurable terms:
  - Default terms: common programming vocabulary (async, await, function, const, interface, component, etc.)
  - Per-project terms: loaded from session context (file names, function names)
  - Configurable via settings API
- [ ] `DEEPGRAM_API_KEY` env var required; validated at startup
- [ ] Graceful handling of Deepgram connection errors (retry, notify client)
- [ ] Rate limiting: max 5-minute recording per message, 60 minutes per hour
- [ ] Connection cleanup on client disconnect

## Implementation Notes

### DeepgramRelay
```typescript
import { DeepgramClient } from "@deepgram/sdk";

class DeepgramRelay {
  private client: DeepgramClient;
  private connections = new Map<string, DeepgramConnection>();

  constructor() {
    this.client = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });
  }

  async startTranscription(clientId: string, sampleRate: number): Promise<void> {
    const connection = await this.client.listen.v1.connect({
      model: "nova-3",
      language: "en-US",
      smart_format: true,
      punctuate: true,
      interim_results: true,
      endpointing: 300,
      keyterms: this.getKeyterms(),
    });

    connection.on("message", (data) => {
      if (data.type === "Results") {
        const transcript = data.channel.alternatives[0].transcript;
        const isFinal = data.is_final;
        this.sendToClient(clientId, isFinal ? "transcript_final" : "transcript_interim", transcript);
      }
    });

    connection.on("error", (err) => {
      this.sendToClient(clientId, "transcript_error", err.message);
    });

    this.connections.set(clientId, connection);
  }

  sendAudio(clientId: string, audioData: ArrayBuffer): void {
    this.connections.get(clientId)?.send(audioData);
  }

  stopTranscription(clientId: string): void {
    this.connections.get(clientId)?.close();
    this.connections.delete(clientId);
  }
}
```

### WebSocket Integration
Add handlers in `ws-server.ts` for `audio_start`, `audio_chunk`, `audio_stop` messages. Route to DeepgramRelay.

### Keyterm Management
Default list of ~50 common programming terms. Extensible via a settings endpoint or YAML config file.

## Tests

- [ ] **Unit:** DeepgramRelay creates connection with correct config
- [ ] **Unit:** Audio chunks forwarded to Deepgram connection
- [ ] **Unit:** Interim and final transcripts relayed to correct client
- [ ] **Unit:** Connection cleaned up on stop
- [ ] **Unit:** Rate limiting enforced (reject after 5 min)
- [ ] **Integration:** Full audio → transcript round-trip (with mocked Deepgram)
- [ ] **Integration:** Multiple simultaneous clients handled independently
- [ ] **Integration:** Graceful error handling on Deepgram disconnect

## Files to Create

- `src/server/deepgram-relay.ts`
- `src/lib/keyterms.ts` (default + configurable keyterm list)

## Dependencies to Add

- `@deepgram/sdk`

## Environment Variables

- `DEEPGRAM_API_KEY` — required
