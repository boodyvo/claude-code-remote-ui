export function CompactDivider() {
  return (
    <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground/50">
      <div className="h-px flex-1 bg-border" />
      <span>Context compacted</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
