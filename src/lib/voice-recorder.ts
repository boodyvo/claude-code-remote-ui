type ChunkCallback = (data: Blob) => void;
type LevelCallback = (level: number) => void;

export class VoiceRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrame: number | null = null;

  async start(onChunk: ChunkCallback, onAudioLevel: LevelCallback): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000,
      },
    });

    // Setup audio analysis
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);
    this.pollAudioLevel(onAudioLevel);

    // Setup recording
    this.recorder = new MediaRecorder(this.stream, {
      mimeType: this.getSupportedMimeType(),
    });

    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) onChunk(e.data);
    };

    this.recorder.start(250); // 250ms chunks
  }

  stop(): void {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    this.recorder?.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioContext?.close();
    this.stream = null;
    this.recorder = null;
    this.audioContext = null;
    this.analyser = null;
  }

  private pollAudioLevel(callback: LevelCallback): void {
    if (!this.analyser) return;

    const data = new Uint8Array(this.analyser.frequencyBinCount);
    const poll = () => {
      if (!this.analyser) return;
      this.analyser.getByteFrequencyData(data);
      const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
      callback(avg / 255); // Normalize to 0-1
      this.animFrame = requestAnimationFrame(poll);
    };
    poll();
  }

  private getSupportedMimeType(): string {
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return "";
  }
}
