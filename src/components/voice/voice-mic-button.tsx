"use client";

import { Mic, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type VoiceState = "idle" | "recording" | "processing";

interface VoiceMicButtonProps {
  state: VoiceState;
  onClick: () => void;
}

export function VoiceMicButton({ state, onClick }: VoiceMicButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "h-12 w-12 rounded-full transition-all",
        state === "recording" &&
          "border-2 border-red-500 bg-red-500/10 text-red-500 animate-pulse",
        state === "processing" && "text-muted-foreground",
      )}
      onClick={onClick}
      disabled={state === "processing"}
    >
      {state === "processing" ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Mic className="h-5 w-5" />
      )}
    </Button>
  );
}
