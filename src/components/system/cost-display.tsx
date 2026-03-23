interface CostDisplayProps {
  costUsd?: number;
  totalTokens?: number;
  durationMs?: number;
  turns?: number;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export function CostDisplay({
  costUsd,
  totalTokens,
  durationMs,
  turns,
}: CostDisplayProps) {
  const parts: string[] = [];
  if (costUsd !== undefined) parts.push(`$${costUsd.toFixed(2)}`);
  if (totalTokens !== undefined) parts.push(`${formatTokens(totalTokens)} tokens`);
  if (durationMs !== undefined) parts.push(formatDuration(durationMs));
  if (turns !== undefined) parts.push(`${turns} turns`);

  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1">·</span>}
          {part}
        </span>
      ))}
    </div>
  );
}
