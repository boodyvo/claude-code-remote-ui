import type { ContentBlock, ToolUseBlock } from "@/lib/types";
import { MarkdownRenderer } from "./markdown-renderer";
import { ThinkingBlock } from "./thinking-block";
import { RedactedBlock } from "./redacted-block";
import { Sparkles } from "lucide-react";

interface AssistantBubbleProps {
  content: ContentBlock[];
}

export function AssistantBubble({ content }: AssistantBubbleProps) {
  return (
    <div className="flex gap-2 px-4 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 max-w-full flex-1 space-y-2">
        {content.map((block, i) => {
          switch (block.type) {
            case "text":
              return <MarkdownRenderer key={i} content={block.text} />;
            case "thinking":
              return <ThinkingBlock key={i} content={block.thinking} />;
            case "redacted_thinking":
              return <RedactedBlock key={i} />;
            case "tool_use":
              return (
                <ToolUseInline
                  key={i}
                  name={(block as ToolUseBlock).name}
                  input={(block as ToolUseBlock).input}
                />
              );
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}

/** Lightweight inline tool-use display for assistant content blocks */
function ToolUseInline({ name, input }: { name: string; input?: Record<string, unknown> }) {
  const displayName = (name || "tool")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-tool-bg text-xs text-muted-foreground">
      <div className="flex items-center gap-2 px-3 py-2 font-medium">
        <span className="text-blue-500">{">"}</span>
        <span>{displayName}</span>
      </div>
      {input && Object.keys(input).length > 0 && (
        <details className="border-t border-border">
          <summary className="cursor-pointer px-3 py-1.5 hover:bg-accent/50">
            Parameters
          </summary>
          <pre className="overflow-x-auto bg-terminal-bg px-3 py-2 font-mono">
            {JSON.stringify(input, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
