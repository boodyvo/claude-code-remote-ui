import { Shield } from "lucide-react";

interface SessionHeaderProps {
  model: string;
  permissionMode: string;
  version?: string;
  toolCount?: number;
  mcpServerCount?: number;
}

export function SessionHeader({
  model,
  permissionMode,
  version,
  toolCount,
  mcpServerCount,
}: SessionHeaderProps) {
  return (
    <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
      <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
        {model}
      </span>
      <span className="flex items-center gap-1">
        <Shield className="h-3 w-3" />
        {permissionMode}
      </span>
      {toolCount !== undefined && <span>{toolCount} tools</span>}
      {mcpServerCount !== undefined && mcpServerCount > 0 && (
        <span>{mcpServerCount} MCP</span>
      )}
      {version && <span className="ml-auto">v{version}</span>}
    </div>
  );
}
