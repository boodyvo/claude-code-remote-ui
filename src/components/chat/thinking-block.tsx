"use client";

import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MarkdownRenderer } from "./markdown-renderer";
import { cn } from "@/lib/utils";

interface ThinkingBlockProps {
  content: string;
  durationMs?: number;
  defaultExpanded?: boolean;
}

export function ThinkingBlock({
  content,
  durationMs,
  defaultExpanded,
}: ThinkingBlockProps) {
  const [open, setOpen] = useState(() => {
    if (defaultExpanded !== undefined) return defaultExpanded;
    // Default: collapsed on mobile, expanded on desktop
    if (typeof window !== "undefined") {
      return window.innerWidth >= 768;
    }
    return true;
  });

  // Handle responsive default on mount
  useEffect(() => {
    if (defaultExpanded === undefined) {
      setOpen(window.innerWidth >= 768);
    }
  }, [defaultExpanded]);

  const durationLabel = durationMs
    ? `${(durationMs / 1000).toFixed(1)}s`
    : null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="my-2 overflow-hidden rounded-lg border border-[var(--color-thinking)]/30 bg-[var(--color-thinking)]/10">
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-[var(--color-thinking)]/15">
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 transition-transform duration-200",
              open && "rotate-90",
            )}
          />
          <span className="italic">
            Thinking{durationLabel ? ` (${durationLabel})` : ""}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-[var(--color-thinking)]/20 px-3 py-2 opacity-80">
            <MarkdownRenderer content={content} className="italic" />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
