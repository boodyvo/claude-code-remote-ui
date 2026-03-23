"use client";

import { useState } from "react";
import { X, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceConfirmBarProps {
  transcript: string;
  onSend: (text: string) => void;
  onCancel: () => void;
}

export function VoiceConfirmBar({
  transcript,
  onSend,
  onCancel,
}: VoiceConfirmBarProps) {
  const [text, setText] = useState(transcript);

  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-primary/30 bg-card px-4 py-2 shadow-sm">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[60px] w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
          placeholder="Edit your message before sending..."
          autoFocus
        />
        <div className="flex items-center justify-end gap-2 border-t border-border pt-2">
          <button
            onClick={onCancel}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
          <button
            onClick={() => onSend(text)}
            disabled={!text.trim()}
            className={cn(
              "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
              text.trim()
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground",
            )}
          >
            <ArrowUp className="h-3.5 w-3.5" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
