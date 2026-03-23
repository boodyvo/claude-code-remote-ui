import { WebSocket } from "ws";

type TranscriptCallback = (
  type: "interim" | "final" | "error",
  text: string,
) => void;

interface ActiveConnection {
  ws: WebSocket;
  startedAt: number;
}

const MAX_RECORDING_MS = 5 * 60 * 1000; // 5 minutes per recording
const DEEPGRAM_WS_URL = "wss://api.deepgram.com/v1/listen";

/**
 * Deepgram relay using raw WebSocket for maximum compatibility.
 * The @deepgram/sdk v5 has complex typing; raw WS is simpler and equally functional.
 */
export class DeepgramRelay {
  private connections = new Map<string, ActiveConnection>();

  async startTranscription(
    clientId: string,
    sampleRate: number,
    callback: TranscriptCallback,
  ): Promise<void> {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      callback("error", "DEEPGRAM_API_KEY not configured");
      return;
    }

    const params = new URLSearchParams({
      model: "nova-3",
      language: "en-US",
      smart_format: "true",
      punctuate: "true",
      interim_results: "true",
      endpointing: "300",
      sample_rate: String(sampleRate),
      encoding: "linear16",
      channels: "1",
    });

    const ws = new WebSocket(`${DEEPGRAM_WS_URL}?${params.toString()}`, {
      headers: { Authorization: `Token ${apiKey}` },
    });

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data));
        const transcript =
          data?.channel?.alternatives?.[0]?.transcript;
        if (transcript) {
          callback(data.is_final ? "final" : "interim", transcript);
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onerror = (event) => {
      const msg = (event as { message?: string })?.message || "Deepgram connection error";
      callback("error", msg);
    };

    ws.onclose = () => {
      this.connections.delete(clientId);
    };

    this.connections.set(clientId, { ws, startedAt: Date.now() });
  }

  sendAudio(clientId: string, audioData: Buffer): void {
    const conn = this.connections.get(clientId);
    if (!conn) return;

    if (Date.now() - conn.startedAt > MAX_RECORDING_MS) {
      this.stopTranscription(clientId);
      return;
    }

    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(audioData);
    }
  }

  stopTranscription(clientId: string): void {
    const conn = this.connections.get(clientId);
    if (!conn) return;

    conn.ws.close();
    this.connections.delete(clientId);
  }

  cleanupClient(clientId: string): void {
    this.stopTranscription(clientId);
  }
}

export const deepgramRelay = new DeepgramRelay();
