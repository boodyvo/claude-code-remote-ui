import { Lock } from "lucide-react";

export function RedactedBlock() {
  return (
    <div className="my-2 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
      <Lock className="h-4 w-4 shrink-0" />
      <span>Reasoning hidden</span>
    </div>
  );
}
