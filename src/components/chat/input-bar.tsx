"use client";

import { useState, useRef, useCallback } from "react";
import { ArrowUp, Square, Mic, MicOff } from "lucide-react";
import { wsClient } from "@/lib/ws-client";
import { useAppStore } from "@/lib/store";
import { useVoice } from "@/lib/use-voice";
import { cn } from "@/lib/utils";
import { WaveformVisualizer } from "@/components/voice/waveform-visualizer";
import { InterimTranscript } from "@/components/voice/interim-transcript";
import { VoiceConfirmBar } from "@/components/voice/voice-confirm-bar";

export function InputBar() {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const connectionState = useAppStore((s) => s.connectionState);

  const {
    voiceState,
    isRecording,
    interimTranscript,
    finalTranscript,
    audioLevel,
    toggleRecording,
    confirmSend,
    cancelVoice,
  } = useVoice();

  const canSend =
    value.trim() && activeSessionId && connectionState === "connected";

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || !activeSessionId) return;

    useAppStore.getState().addMessage(activeSessionId, {
      type: "user",
      message: { role: "user", content: trimmed },
    });

    wsClient.send({
      type: "send_message",
      content: trimmed,
      sessionId: activeSessionId,
    });
    setValue("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, activeSessionId]);

  const handleCancel = useCallback(() => {
    if (!activeSessionId) return;
    wsClient.send({ type: "cancel_session", sessionId: activeSessionId });
  }, [activeSessionId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  // Voice confirm state — show editable transcript bar
  if (voiceState === "confirming") {
    return (
      <div className="shrink-0 bg-background px-4 pb-4 pt-2">
        <div className="mx-auto max-w-3xl">
          <VoiceConfirmBar
            transcript={finalTranscript}
            onSend={confirmSend}
            onCancel={cancelVoice}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 bg-background px-4 pb-4 pt-2">
      <div className="mx-auto max-w-3xl">
        {/* Waveform + interim transcript while recording */}
        {isRecording && (
          <div className="mb-2 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2">
            <WaveformVisualizer audioLevel={audioLevel} isActive={isRecording} />
            <InterimTranscript
              interimText={interimTranscript}
              finalText={finalTranscript}
            />
          </div>
        )}

        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card px-4 py-2 shadow-sm transition-colors focus-within:border-primary/50 focus-within:shadow-md">
          {/* Mic button */}
          <button
            onClick={toggleRecording}
            disabled={connectionState !== "connected" || !activeSessionId}
            className={cn(
              "mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all",
              isRecording
                ? "bg-red-500 text-white animate-pulse"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              (connectionState !== "connected" || !activeSessionId) &&
                "opacity-40",
            )}
            aria-label={isRecording ? "Stop recording" : "Start recording"}
          >
            {isRecording ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={
              connectionState !== "connected"
                ? "Connecting..."
                : activeSessionId
                  ? "Message Claude..."
                  : "Select or create a session to start"
            }
            rows={1}
            disabled={connectionState !== "connected" || isRecording}
            className="max-h-[200px] flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-50"
          />

          {/* Send / Stop button */}
          <button
            onClick={canSend ? handleSubmit : handleCancel}
            disabled={!canSend && !activeSessionId}
            className={cn(
              "mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all",
              canSend
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground",
            )}
            aria-label={canSend ? "Send message" : "Stop"}
          >
            {canSend ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <Square className="h-3 w-3" />
            )}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground/60">
          Claude can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}
