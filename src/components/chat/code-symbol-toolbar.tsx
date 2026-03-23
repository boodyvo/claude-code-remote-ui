"use client";

const SYMBOLS = ["{ }", "[ ]", "( )", ";", ":", '"', "'", "/", "=", "<", ">", "_", "."];

interface CodeSymbolToolbarProps {
  onInsert: (symbol: string) => void;
}

export function CodeSymbolToolbar({ onInsert }: CodeSymbolToolbarProps) {
  return (
    <div className="flex gap-1 overflow-x-auto border-t border-border bg-muted/50 px-2 py-1.5 md:hidden">
      {SYMBOLS.map((sym) => (
        <button
          key={sym}
          onClick={() => onInsert(sym.replace(" ", ""))}
          className="shrink-0 rounded border border-border bg-background px-2.5 py-1 font-mono text-sm active:bg-accent"
        >
          {sym}
        </button>
      ))}
    </div>
  );
}
