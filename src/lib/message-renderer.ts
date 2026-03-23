import type { ComponentType } from "react";

// Tool result renderer registry
// Each renderer receives the tool result data as props
const TOOL_RENDERERS: Record<string, string> = {
  Edit: "diff-viewer",
  Write: "diff-viewer",
  Read: "code-viewer",
  Bash: "terminal-output",
  Glob: "file-list",
  Grep: "search-results",
  WebSearch: "generic-tool-result",
  WebFetch: "generic-tool-result",
  Agent: "generic-tool-result",
};

export function getToolResultRendererName(toolName: string): string {
  return TOOL_RENDERERS[toolName] || "generic-tool-result";
}
