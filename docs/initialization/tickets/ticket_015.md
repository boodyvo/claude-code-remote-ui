# Ticket 015 — Voice UI

**Phase:** 3 — Voice & Mobile
**Effort:** L
**Depends on:** Tickets 13, 14

## Summary

Build the browser-side voice input components: mic button, waveform visualizer, interim transcript display, and confirmation bar.

## Acceptance Criteria

- [ ] `VoiceMicButton` — 48x48px button with 3 states:
  - **Idle**: Microphone outline icon
  - **Recording**: Pulsing red dot animation + red border
  - **Processing**: Spinner icon
  - Haptic feedback on state transitions (`navigator.vibrate`)
- [ ] `WaveformVisualizer` — real-time audio visualization
  - Canvas-based bars responding to audio amplitude
  - Uses Web Audio API `AnalyserNode` alongside MediaRecorder
  - Appears in input area during recording, replacing the text input
  - Duration timer: "0:04"
- [ ] `InterimTranscript` — live transcription preview
  - Grey italic text updating in real-time as Deepgram returns interim results
  - Final results shown in normal weight/color
  - Displayed inside the input area below the waveform
- [ ] `VoiceConfirmBar` — review before sending
  - Shows final transcript as editable text
  - "Cancel" and "Send" buttons
  - User can edit transcript before sending
  - On send, dispatches text as regular chat message
- [ ] Voice recording workflow:
  - Tap mic → start recording → see waveform + interim text → tap stop → see confirm bar → edit/send
  - Alternative: tap-and-hold → release to send (configurable, off by default)
- [ ] `VoiceRecorder` utility (`src/lib/voice-recorder.ts`):
  - Wraps `getUserMedia()` + `MediaRecorder`
  - 250ms chunk interval
  - Sends chunks via WebSocket as `audio_chunk` messages
  - Connects `AnalyserNode` for waveform data
- [ ] Browser compatibility: works on iOS Safari 14.3+, Android Chrome, desktop Chrome/Firefox/Safari
- [ ] HTTPS required (enforced at deployment level)

## Implementation Notes

### VoiceRecorder (src/lib/voice-recorder.ts)
```typescript
class VoiceRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;

  async start(onChunk: (data: Blob) => void, onAudioLevel: (level: number) => void) {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.recorder = new MediaRecorder(this.stream);

    // Setup analyser for waveform
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    source.connect(this.analyser);

    // Start polling audio levels
    this.pollAudioLevel(onAudioLevel);

    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) onChunk(e.data);
    };
    this.recorder.start(250); // 250ms chunks
  }

  stop(): void {
    this.recorder?.stop();
    this.stream?.getTracks().forEach(t => t.stop());
    this.audioContext?.close();
  }
}
```

### Waveform Visualization
```tsx
function WaveformVisualizer({ audioLevel }: { audioLevel: number }) {
  // Canvas with ~20 bars, heights driven by audioLevel (0-1)
  // Smooth animation via requestAnimationFrame
}
```

### State Machine
```
IDLE → (tap mic) → RECORDING → (tap stop) → CONFIRMING → (tap send) → IDLE
                                           → (tap cancel) → IDLE
RECORDING → (error) → IDLE (show toast)
```

## Tests

- [ ] **Unit:** VoiceMicButton renders correct icon for each state
- [ ] **Unit:** State machine transitions correctly
- [ ] **Unit:** InterimTranscript updates on new interim text, replaces on final
- [ ] **Unit:** VoiceConfirmBar allows editing transcript
- [ ] **Unit:** VoiceConfirmBar send dispatches message to WebSocket
- [ ] **Unit:** Duration timer counts up during recording
- [ ] **Integration:** Full recording flow with mocked MediaRecorder
- [ ] **Integration:** Audio chunks sent to server in correct format
- [ ] **E2E:** Record voice → see transcript → edit → send → see message in chat

## Files to Create

- `src/components/voice/voice-mic-button.tsx`
- `src/components/voice/waveform-visualizer.tsx`
- `src/components/voice/interim-transcript.tsx`
- `src/components/voice/voice-confirm-bar.tsx`
- `src/lib/voice-recorder.ts`
