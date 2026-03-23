interface PromptSuggestionProps {
  text: string;
  onClick: (text: string) => void;
}

export function PromptSuggestion({ text, onClick }: PromptSuggestionProps) {
  return (
    <button
      onClick={() => onClick(text)}
      className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-sm text-foreground hover:bg-muted"
    >
      {text}
    </button>
  );
}
