"use client";

import { useCallback, useRef } from "react";
import { useAppStore } from "./store";
import { wsClient } from "./ws-client";
import { VoiceRecorder } from "./voice-recorder";

/**
 * Hook that orchestrates voice recording:
 * IDLE → (tap mic) → RECORDING → (tap stop) → CONFIRMING → (send/cancel) → IDLE
 *
 * Audio is sent as binary WebSocket frames to the server,
 * which relays to Deepgram and sends back transcript_interim/transcript_final messages.
 */
export function useVoice() {
  const recorderRef = useRef<VoiceRecorder | null>(null);

  const voiceState = useAppStore((s) => s.voiceState);
  const isRecording = useAppStore((s) => s.isRecording);
  const interimTranscript = useAppStore((s) => s.interimTranscript);
  const finalTranscript = useAppStore((s) => s.finalTranscript);
  const audioLevel = useAppStore((s) => s.audioLevel);

  const startRecording = useCallback(async () => {
    const store = useAppStore.getState();
    store.resetVoice();
    store.setVoiceState("recording");
    store.setRecording(true);

    // Tell server to start Deepgram transcription
    wsClient.send({ type: "audio_start", sampleRate: 16000 });

    const recorder = new VoiceRecorder();
    recorderRef.current = recorder;

    try {
      await recorder.start(
        // onChunk: send binary audio to server
        async (blob: Blob) => {
          const buffer = await blob.arrayBuffer();
          wsClient.sendBinary(buffer);
        },
        // onAudioLevel: update store for waveform visualization
        (level: number) => {
          useAppStore.getState().setAudioLevel(level);
        },
      );
    } catch (err) {
      console.error("Failed to start recording:", err);
      store.resetVoice();
    }
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.stop();
      recorderRef.current = null;
    }

    // Tell server to stop Deepgram
    wsClient.send({ type: "audio_stop" });

    const store = useAppStore.getState();
    store.setRecording(false);

    // If we have transcript text, move to confirming state
    const finalText = store.finalTranscript;
    if (finalText.trim()) {
      store.setVoiceState("confirming");
    } else {
      // No text captured — go back to idle
      store.resetVoice();
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const confirmSend = useCallback(
    (text: string) => {
      const store = useAppStore.getState();
      const sessionId = store.activeSessionId;
      if (!sessionId || !text.trim()) {
        store.resetVoice();
        return;
      }

      // Add optimistic user message
      store.addMessage(sessionId, {
        type: "user",
        message: { role: "user", content: text.trim() },
      });

      // Send to Claude
      wsClient.send({
        type: "send_message",
        content: text.trim(),
        sessionId,
      });

      store.resetVoice();
    },
    [],
  );

  const cancelVoice = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.stop();
      recorderRef.current = null;
    }
    wsClient.send({ type: "audio_stop" });
    useAppStore.getState().resetVoice();
  }, []);

  return {
    voiceState,
    isRecording,
    interimTranscript,
    finalTranscript,
    audioLevel,
    toggleRecording,
    confirmSend,
    cancelVoice,
  };
}
